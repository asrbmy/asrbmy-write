#!/usr/bin/env node
// Bring existing writing into the site as Markdown articles.
//
//   node scripts/import.js <file-or-folder> [--format wordpress|blogger|markdown] [--out content/articles]
//                          [--download-images] [--pages] [--force] [--dry-run]
//
//   WordPress:  Tools → Export → "Posts" gives a .xml file.
//   Blogger:    Settings → Manage blog → Back up content (or Google Takeout) gives a .xml / .atom file.
//   Markdown:   a folder of .md files (Jekyll, Hugo, Obsidian…). Missing titles, dates and tags are filled in.
// Imported posts that were not published are saved with `draft: true`, so nothing goes live by accident.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFrontmatter, slugify } from './markdown.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── HTML → Markdown ──────────────────────────────────────────────────────────
let TurndownService = null;
async function turndown() {
  if (!TurndownService) {
    try { TurndownService = (await import('turndown')).default; }
    catch { throw new Error('The importer needs the "turndown" package. Run: npm install'); }
  }
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*', hr: '---' });
  td.remove(['script', 'style', 'noscript', 'form', 'button']);
  // A YouTube / Vimeo embed becomes this site's click-to-play video line
  td.addRule('video', {
    filter: (node) => node.nodeName === 'IFRAME',
    replacement: (_c, node) => {
      const src = node.getAttribute('src') || '';
      const yt = src.match(/(?:youtube(?:-nocookie)?\.com\/embed\/)([\w-]{6,15})/);
      const vm = src.match(/player\.vimeo\.com\/video\/(\d+)/);
      const title = (node.getAttribute('title') || '').replace(/"/g, '');
      if (yt) return `\n\n@[youtube](${yt[1]}${title ? ` "${title}"` : ''})\n\n`;
      if (vm) return `\n\n@[vimeo](${vm[1]}${title ? ` "${title}"` : ''})\n\n`;
      return '';
    },
  });
  // Code samples keep their language when the old site recorded it in a class
  td.addRule('pre', {
    filter: (node) => node.nodeName === 'PRE',
    replacement: (_c, node) => {
      const code = node.querySelector ? node.querySelector('code') : null;
      const cls = ((code || node).getAttribute && (code || node).getAttribute('class')) || '';
      const lang = (cls.match(/(?:language|lang|brush:)[-:\s]*([a-z0-9+#]+)/i) || [])[1] || '';
      const text = (code || node).textContent.replace(/\n$/, '');
      const fence = text.includes('```') ? '~~~~' : '```';
      return `\n\n${fence}${lang.toLowerCase()}\n${text}\n${fence}\n\n`;
    },
  });
  return td;
}

/** WordPress stores paragraphs as blank-line-separated text without <p>; add them back. Also drops shortcodes. */
export function wpautop(html) {
  let h = String(html || '').replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  h = h.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, '$1').replace(/\[\/?[a-z_][\w-]*(?:\s[^\]]*)?\]/gi, (m) => (/^\[\/?(?:code|sourcecode)/i.test(m) ? m : ''));
  if (/<p[\s>]/i.test(h)) return h;
  return h.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map((x) => (/^<(?:h\d|ul|ol|pre|blockquote|table|figure|div|iframe)/i.test(x) ? x : `<p>${x.replace(/\n/g, '<br>')}</p>`)).join('\n\n');
}

export async function htmlToMarkdown(html, td) {
  td = td || await turndown();
  return td.turndown(wpautop(html)).replace(/\n{3,}/g, '\n\n').replace(/[ \t]+$/gm, '').trim();
}

// ── Readers ──────────────────────────────────────────────────────────────────
async function xmlParser() {
  let XMLParser;
  try { ({ XMLParser } = await import('fast-xml-parser')); } catch { throw new Error('The importer needs the "fast-xml-parser" package. Run: npm install'); }
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', parseTagValue: false, parseAttributeValue: false, trimValues: true, processEntities: true });
}
const arr = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const txt = (v) => (v && typeof v === 'object' ? String(v['#text'] ?? '') : String(v ?? '')).trim();
const dateOnly = (s) => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };

export async function readWordPress(xml) {
  const doc = (await xmlParser()).parse(xml);
  const items = arr(doc?.rss?.channel?.item);
  return items.map((it) => {
    const cats = arr(it.category);
    const cat = cats.filter((c) => c?.['@_domain'] === 'category').map(txt).filter((c) => c && c.toLowerCase() !== 'uncategorized');
    const tags = cats.filter((c) => c?.['@_domain'] === 'post_tag').map(txt).filter(Boolean);
    return {
      kind: txt(it['wp:post_type']) || 'post', title: txt(it.title), slug: txt(it['wp:post_name']),
      date: dateOnly(txt(it['wp:post_date']) || txt(it.pubDate)), html: txt(it['content:encoded']), excerpt: txt(it['excerpt:encoded']),
      published: txt(it['wp:status']) === 'publish', category: cat[0] || '', tags: [...cat.slice(1), ...tags],
    };
  }).filter((p) => p.kind === 'post' || p.kind === 'page');
}

export async function readBlogger(xml) {
  const doc = (await xmlParser()).parse(xml);
  const entries = arr(doc?.feed?.entry);
  return entries.map((e) => {
    const cats = arr(e.category);
    const kind = (cats.find((c) => /kind#/.test(c?.['@_term'] || '')) || {})['@_term'] || '';
    const type = txt(e['blogger:type']).toLowerCase() || (/kind#post$/.test(kind) ? 'post' : /kind#page$/.test(kind) ? 'page' : '');
    const status = txt(e['blogger:status']).toUpperCase();
    const labels = cats.filter((c) => /blogger\.com\/atom\/ns#/.test(c?.['@_scheme'] || '')).map((c) => c['@_term']).filter(Boolean);
    const file = txt(e['blogger:filename']);
    return {
      kind: type, title: txt(e.title), slug: slugify(path.basename(file, '.html')), date: dateOnly(txt(e.published)), html: txt(e.content),
      excerpt: '', published: status ? status === 'LIVE' : !e['app:control'], category: labels[0] || '', tags: labels.slice(1),
    };
  }).filter((p) => p.kind === 'post' || p.kind === 'page');
}

export function readMarkdownFile(src, file, mtime) {
  const { data, body } = parseFrontmatter(src);
  const tagsRaw = data.tags ?? data.tag ?? '';
  const catsRaw = data.categories ?? data.category ?? '';
  const toList = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim()).filter(Boolean);
  const cats = toList(catsRaw);
  const name = path.basename(file).replace(/\.(md|markdown)$/i, '');
  const fromName = name.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  const heading = (body.match(/^#\s+(.+)$/m) || [])[1];
  return {
    kind: 'post', title: String(data.title || heading || (fromName ? fromName[2] : name)).replace(/-/g, (m, i) => (data.title || heading ? m : ' ')),
    slug: slugify(data.slug || (fromName ? fromName[2] : name)), date: dateOnly(data.date) || (fromName ? fromName[1] : mtime), markdown: body.replace(/^#\s+.+\n+/, (m) => (data.title ? m : '')),
    excerpt: String(data.excerpt || data.description || data.summary || ''), published: data.draft !== true && data.published !== false,
    category: cats[0] || '', tags: [...cats.slice(1), ...toList(tagsRaw)],
  };
}

// ── Writing files ────────────────────────────────────────────────────────────
const q = (s) => JSON.stringify(String(s).replace(/\s+/g, ' ').trim());
export function frontMatter(p) {
  const lines = ['---', `title: ${q(p.title || 'Untitled')}`, `date: ${p.date}`];
  if (p.slug) lines.push(`slug: ${p.slug}`);
  lines.push(`category: ${q(p.category || 'Imported')}`);
  const tags = [...new Set(p.tags.map((t) => String(t).replace(/[,\[\]\n]/g, ' ').trim()).filter(Boolean))];
  if (tags.length) lines.push(`tags: [${tags.join(', ')}]`);
  if (p.excerpt) lines.push(`excerpt: ${q(p.excerpt.slice(0, 300))}`);
  if (!p.published) lines.push('draft: true');
  lines.push('---', '');
  return lines.join('\n');
}

export async function downloadImages(md, outDir, report) {
  const seen = new Map();
  const re = /!\[([^\]]*)\]\((https:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  const found = [...md.matchAll(re)];
  for (const m of found) {
    const url = m[2];
    if (seen.has(url)) continue;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
      const r = await fetch(url, { signal: ctl.signal }); clearTimeout(t);
      const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }[type];
      if (!r.ok || !ext) throw new Error(r.ok ? `type ${type || 'unknown'} is not allowed` : `HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 8 * 1024 * 1024) throw new Error('larger than 8 MB');
      const base = slugify(path.basename(new URL(url).pathname).replace(/\.[a-z0-9]+$/i, '')) || 'image';
      const name = `${base}-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 6)}.${ext}`;
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, name), buf);
      seen.set(url, `/images/imported/${name}`);
    } catch (e) { report.warn.push(`image not downloaded (${e.message}): ${url}`); seen.set(url, url); }
  }
  return md.replace(re, (all, alt, url) => `![${alt}](${seen.get(url) || url})`);
}

/** Converts posts to files. Pure of the file system except through `opts.write`. */
export async function convertPosts(posts, opts = {}) {
  const report = { created: [], skipped: [], drafts: 0, pages: 0, warn: [] };
  const td = posts.some((p) => !p.markdown) ? await turndown() : null;
  const used = new Set();
  for (const p of posts) {
    if (p.kind === 'page' && !opts.pages) { report.pages++; continue; }
    let md = p.markdown ?? await htmlToMarkdown(p.html, td);
    if (opts.downloadImages) md = await downloadImages(md, opts.imagesDir, report);
    if (/\{%|\{\{<|\{\{%/.test(md)) report.warn.push(`"${p.title}" contains template shortcodes ({% … %} or {{< … >}}) that this site does not understand; check it.`);
    const date = p.date || new Date().toISOString().slice(0, 10);
    const slug = slugify(p.slug || p.title) || 'post';
    let name = p.kind === 'page' ? `${slug}.md` : `${date}-${slug}.md`;
    for (let n = 2; used.has(name); n++) name = name.replace(/(-\d+)?\.md$/, `-${n}.md`);
    used.add(name);
    const target = path.join(p.kind === 'page' ? opts.pagesDir : opts.outDir, name);
    if (fs.existsSync(target) && !opts.force) { report.skipped.push(name); continue; }
    const front = p.kind === 'page'
      ? `---\ntitle: ${q(p.title)}\n---\n`
      : frontMatter({ ...p, date, slug });
    if (!p.published) report.drafts++;
    if (!opts.dryRun) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${front}\n${md}\n`); }
    report.created.push(name);
  }
  return report;
}

// ── Command line ─────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => args.includes(n);
  const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const source = args.find((a, i) => !a.startsWith('--') && !['--format', '--out'].includes(args[i - 1]));
  if (!source || flag('--help')) {
    console.log('Usage: node scripts/import.js <file-or-folder> [--format wordpress|blogger|markdown] [--out content/articles] [--download-images] [--pages] [--force] [--dry-run]');
    process.exit(source ? 0 : 1);
  }
  const src = path.resolve(source);
  if (!fs.existsSync(src)) { console.error(`✖ Not found: ${source}`); process.exit(1); }
  const isDir = fs.statSync(src).isDirectory();
  let format = val('--format');
  let posts;
  if (isDir || format === 'markdown') {
    format = 'markdown';
    const walk = (d, depth = 0) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (depth < 3 && !e.name.startsWith('.') && e.name !== 'node_modules' ? walk(path.join(d, e.name), depth + 1) : []) : /\.(md|markdown)$/i.test(e.name) ? [path.join(d, e.name)] : []));
    const files = isDir ? walk(src) : [src];
    posts = files.map((f) => readMarkdownFile(fs.readFileSync(f, 'utf8'), f, fs.statSync(f).mtime.toISOString().slice(0, 10)));
  } else {
    const xml = fs.readFileSync(src, 'utf8');
    format = format || (/<wp:wxr_version|xmlns:wp=/.test(xml.slice(0, 5000)) ? 'wordpress' : /<feed[\s>]/.test(xml.slice(0, 2000)) ? 'blogger' : '');
    if (!format) { console.error('✖ Could not tell what kind of export this is. Use --format wordpress, blogger or markdown.'); process.exit(1); }
    posts = format === 'wordpress' ? await readWordPress(xml) : await readBlogger(xml);
  }
  const outDir = path.resolve(ROOT, val('--out') || 'content/articles');
  const report = await convertPosts(posts, { outDir, pagesDir: path.join(ROOT, 'content/pages'), imagesDir: path.join(ROOT, 'public/images/imported'), downloadImages: flag('--download-images'), pages: flag('--pages'), force: flag('--force'), dryRun: flag('--dry-run') });
  console.log(`\n${flag('--dry-run') ? '(dry run) ' : ''}Imported from ${format}: ${report.created.length} created, ${report.skipped.length} skipped (already exist; use --force to overwrite).`);
  if (report.drafts) console.log(`  ${report.drafts} were not published on the old site, so they are saved with draft: true.`);
  if (report.pages) console.log(`  ${report.pages} static page${report.pages === 1 ? '' : 's'} left out (add --pages to import them into content/pages).`);
  for (const w of report.warn) console.log(`  ! ${w}`);
  console.log(`\nNext: open the files in ${path.relative(ROOT, outDir) || '.'}, check them, then run "npm run build".${flag('--download-images') ? '' : ' Images still point to the old site; add --download-images to copy them here.'}`);
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch((e) => { console.error(`✖ ${e.message}`); process.exit(1); });
