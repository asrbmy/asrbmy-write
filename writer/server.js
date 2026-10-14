// ASRBMY Writer — a tiny local server. Saves Markdown files on this computer; never publishes anything.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFrontmatter, renderMarkdown, slugify, htmlToText } from '../scripts/markdown.js';
import { tokensCss } from '../scripts/tokens.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const W = (await import(pathToFileURL(path.join(HERE, 'writer.config.js')).href)).default;
const SITE = (await import(pathToFileURL(path.join(ROOT, 'site.config.js')).href)).default;

const abs = (d) => (path.isAbsolute(d) ? d : path.join(ROOT, d));
const ARTICLES = abs(process.env.WRITER_ARTICLES_DIR || W.articlesDir);
const IMAGES = abs(process.env.WRITER_IMAGES_DIR || W.imagesDir);
const TRASH = path.join(HERE, '.trash');
for (const d of [ARTICLES, IMAGES]) fs.mkdirSync(d, { recursive: true });

const PORT = Number(process.env.WRITER_PORT) || W.port || 4400;
const HOST = '127.0.0.1';
const TOKEN = crypto.randomBytes(18).toString('hex'); // required on every /api call (blocks other sites from talking to the Writer)
const DEFAULT_AUTHOR = W.author || SITE.author?.name || '';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};
const FILE_RE = /^[a-z0-9][a-z0-9._-]*\.md$/i;
const IMG_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

// ── Helpers ──────────────────────────────────────────────────────────────────
const SECURITY = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
const send = (res, status, body, type = 'text/plain; charset=utf-8', headers = {}) => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SECURITY, ...headers });
  res.end(body);
};
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { if (chunks.length) { chunks.length = 0; reject(new HttpError(413, 'Too large')); req.resume(); } } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const readJson = async (req) => { try { return JSON.parse((await readBody(req, 8 * 1024 * 1024)).toString('utf8') || '{}'); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'Invalid JSON'); } };

function safeJoin(base, rel) {
  const full = path.resolve(base, '.' + path.sep + rel);
  if (full !== base && !full.startsWith(base + path.sep)) throw new HttpError(403, 'Forbidden');
  return full;
}
// Write to a temp file then rename, so a crash or full disk can never leave half an article behind.
function writeAtomic(file, data, exclusive = false) {
  if (exclusive && fs.existsSync(file)) throw new HttpError(409, 'File already exists');
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
function sniffImage(buf) {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 6 && /^GIF8[79]a/.test(buf.subarray(0, 6).toString('latin1'))) return 'image/gif';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}
function articlePath(file) {
  if (!FILE_RE.test(file) || file.includes('..')) throw new HttpError(400, 'Invalid file name');
  return path.join(ARTICLES, file);
}
function serveStatic(res, file, transform) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, 'Not found');
  let data = fs.readFileSync(file);
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  if (transform) data = transform(data.toString('utf8'));
  send(res, 200, data, type);
}

// ── Front matter ─────────────────────────────────────────────────────────────
const ORDER = ['title', 'slug', 'date', 'updated', 'category', 'tags', 'excerpt', 'subtitle', 'author', 'featured', 'draft', 'series', 'seriesOrder', 'cover', 'coverAlt', 'comments', 'readingTime'];
function fmValue(v) {
  if (Array.isArray(v)) return `[${v.map((x) => String(x).replace(/[,\[\]]/g, '').trim()).filter(Boolean).join(', ')}]`;
  if (typeof v === 'boolean') return String(v);
  let s = String(v).replace(/\s+/g, ' ').trim();
  if (/^[\[\]'"-]|['"]$/.test(s)) s = `"${s.replace(/"/g, '“')}"`;
  return s;
}
function serialize(front, body) {
  const keys = [...ORDER.filter((k) => k in front), ...Object.keys(front).filter((k) => !ORDER.includes(k) && /^[A-Za-z][\w-]*$/.test(k))];
  const lines = ['---'];
  for (const k of keys) {
    const v = front[k];
    if (k === 'comments') { if (v === false) lines.push('comments: false'); continue; } // comments are on unless switched off
    if (v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length)) continue;
    lines.push(`${k}: ${fmValue(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n') + String(body).replace(/\s+$/, '') + '\n';
}
const slugOf = (file, front) => slugify(front.slug || file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, ''));
const words = (md) => (md.trim() ? md.trim().split(/\s+/).length : 0);

function listFiles() {
  return fs.readdirSync(ARTICLES).filter((f) => FILE_RE.test(f)).map((file) => {
    const { data, body } = parseFrontmatter(fs.readFileSync(path.join(ARTICLES, file), 'utf8'));
    return { file, title: data.title || file, date: data.date || '', category: data.category || '', draft: data.draft === true, featured: data.featured === true, slug: slugOf(file, data), tags: Array.isArray(data.tags) ? data.tags : [], series: data.series || '', words: words(body) };
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title));
}

function validate(front, body, currentFile) {
  const title = String(front.title || '').trim();
  if (!title) throw new HttpError(400, 'Add a title first.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(front.date || ''))) throw new HttpError(400, 'The date must look like 2026-11-02.');
  front.title = title;
  front.slug = slugify(front.slug || title);
  if (!front.slug) throw new HttpError(400, 'The slug is empty — use letters or numbers in the title.');
  if (front.seriesOrder !== undefined && front.seriesOrder !== '' && !(Number.isFinite(Number(front.seriesOrder)) && Number(front.seriesOrder) > 0)) throw new HttpError(400, 'Part number must be a positive number.');
  if (front.cover && !/^(https:\/\/|\/?images\/|\/?public\/images\/)/i.test(String(front.cover).trim())) throw new HttpError(400, 'Cover image must be a file in images (like /images/cover.jpg) or an https:// address.');
  front.category = String(front.category || W.defaultCategory || 'Notes').trim();
  front.tags = Array.isArray(front.tags) ? front.tags : String(front.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const clash = listFiles().find((a) => a.file !== currentFile && a.slug === front.slug);
  if (clash) throw new HttpError(409, `Another article (${clash.file}) already uses the slug “${front.slug}”. Change the slug.`);
  return front;
}

// ── API ──────────────────────────────────────────────────────────────────────
async function api(req, res, p, url) {
  if (req.headers['x-writer-token'] !== TOKEN) throw new HttpError(401, 'Missing or wrong token — reload the Writer page.');
  const method = req.method;
  let m;

  if (method === 'GET' && p === '/api/state') {
    const arts = listFiles();
    const cats = [...new Set([...arts.map((a) => a.category).filter(Boolean), ...(W.categories || [])])].sort();
    const tags = [...new Set(arts.flatMap((a) => a.tags))].sort();
    const series = [...new Set(arts.map((a) => a.series).filter(Boolean))].sort();
    return json(res, 200, { siteName: SITE.name, author: DEFAULT_AUTHOR, defaultCategory: W.defaultCategory || 'Notes', categories: cats, tags, series, autosaveSeconds: Number(W.autosaveSeconds) || 0, articlesDir: ARTICLES, imagesDir: IMAGES, filenameDate: W.filenameDate !== false });
  }
  if (method === 'GET' && p === '/api/articles') return json(res, 200, listFiles());

  if ((m = p.match(/^\/api\/articles\/([^/]+?)(\/raw)?$/))) {
    let file;
    try { file = decodeURIComponent(m[1]); } catch { throw new HttpError(400, 'Bad file name'); }
    const fp = articlePath(file);
    if (method === 'GET') {
      if (!fs.existsSync(fp)) throw new HttpError(404, 'Not found');
      const src = fs.readFileSync(fp, 'utf8');
      if (m[2]) return send(res, 200, src, 'text/markdown; charset=utf-8');
      const { data, body } = parseFrontmatter(src);
      return json(res, 200, { file, front: data, body });
    }
    if (method === 'PUT') {
      if (!fs.existsSync(fp)) throw new HttpError(404, 'Not found');
      const { front = {}, body = '' } = await readJson(req);
      validate(front, body, file);
      writeAtomic(fp, serialize(front, body));
      return json(res, 200, { ok: true, file, slug: front.slug, savedAt: new Date().toISOString() });
    }
    if (method === 'DELETE') {
      if (!fs.existsSync(fp)) throw new HttpError(404, 'Not found');
      fs.mkdirSync(TRASH, { recursive: true });
      fs.renameSync(fp, path.join(TRASH, `${Date.now()}-${file}`));
      return json(res, 200, { ok: true, trash: TRASH });
    }
  }

  if (method === 'POST' && p === '/api/articles') {
    const { front = {}, body = '' } = await readJson(req);
    validate(front, body, null);
    let name = `${W.filenameDate === false ? '' : front.date + '-'}${front.slug}`;
    let file = `${name}.md`;
    for (let i = 2; fs.existsSync(path.join(ARTICLES, file)); i++) file = `${name}-${i}.md`;
    writeAtomic(path.join(ARTICLES, file), serialize(front, body), true);
    return json(res, 201, { ok: true, file, slug: front.slug, savedAt: new Date().toISOString() });
  }

  if (method === 'POST' && p === '/api/images') {
    const type = String(req.headers['content-type'] || '').split(';')[0];
    const ext = IMG_EXT[type];
    if (!ext) throw new HttpError(415, 'Only PNG, JPG, GIF or WebP images are supported.');
    const data = await readBody(req, 12 * 1024 * 1024);
    if (sniffImage(data) !== type) throw new HttpError(415, 'That file is not really a ' + ext.slice(1).toUpperCase() + ' image.');
    const base = slugify(String(url.searchParams.get('name') || 'image').replace(/\.[a-z0-9]+$/i, '')) || 'image';
    let name = `${base}${ext}`;
    for (let i = 2; fs.existsSync(path.join(IMAGES, name)); i++) name = `${base}-${i}${ext}`;
    writeAtomic(path.join(IMAGES, name), data, true);
    return json(res, 201, { ok: true, url: `/images/${name}`, name });
  }

  if (method === 'POST' && p === '/api/preview') {
    const { body = '' } = await readJson(req);
    const { html, toc } = renderMarkdown(body, { base: '' });
    const n = words(htmlToText(html));
    return json(res, 200, { html, headings: toc.length, words: n, readingTime: Math.max(1, Math.round(n / 220)) });
  }

  if (method === 'POST' && p === '/api/build') {
    const run = (script) => new Promise((resolve) => execFile(process.execPath, [path.join(ROOT, 'scripts', script)], { cwd: ROOT, timeout: 90000 }, (err, out, errOut) => resolve({ ok: !err, text: `${out}${errOut}` })));
    const b = await run('build.js');
    const c = b.ok ? await run('check.js') : { ok: false, text: '' };
    return json(res, 200, { ok: b.ok && c.ok, output: (b.text + c.text).trim() });
  }

  throw new HttpError(404, 'Unknown API route');
}

// ── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    // Only answer requests addressed to this computer (blocks DNS-rebinding tricks)
    if (![`127.0.0.1:${PORT}`, `localhost:${PORT}`].includes(String(req.headers.host || '').toLowerCase())) throw new HttpError(403, 'Forbidden');
    const url = new URL(req.url, `http://${req.headers.host}`);
    let p;
    try { p = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, 'Bad request'); }

    if (p.startsWith('/api/')) return await api(req, res, p, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');

    if (p === '/' || p === '/index.html') return serveStatic(res, path.join(HERE, 'app/index.html'), (t) => t.replace('__TOKEN__', TOKEN));
    if (p.startsWith('/app/')) return serveStatic(res, safeJoin(path.join(HERE, 'app'), p.slice(5)));
    if (p === '/site/theme.css') return serveStatic(res, path.join(ROOT, 'src/theme.css'));
    if (p === '/site/tokens.css') return send(res, 200, tokensCss(SITE), 'text/css; charset=utf-8');
    if (p.startsWith('/images/')) return serveStatic(res, safeJoin(IMAGES, p.slice(8)));
    return send(res, 404, 'Not found');
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (req.url.startsWith('/api/')) return json(res, status, { error: e.message });
    send(res, status, e.message);
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.error(`\n✖ Port ${PORT} is busy. The Writer may already be running — open http://localhost:${PORT}\n  Or change "port" in writer/writer.config.js.\n`);
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const link = `http://127.0.0.1:${PORT}`;
  console.log(`\n✔ ${SITE.name} — Writer is running → ${link}`);
  console.log(`  Saving articles to: ${ARTICLES}`);
  console.log(`  Saving images to:   ${IMAGES}`);
  console.log('  Press Ctrl+C to stop.\n');
  if (W.openBrowser !== false && !process.env.NO_OPEN) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', link]] : process.platform === 'darwin' ? ['open', [link]] : ['xdg-open', [link]];
    try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* browser can be opened by hand */ }
  }
});
