// Tiny static server for dist/. `--watch` rebuilds when content, config or src change.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const port = Number(process.env.PORT) || 4321;
const watch = process.argv.includes('--watch');
const base = (() => { const b = (process.env.BASE_PATH || '').trim(); return b && b !== '/' ? '/' + b.replace(/^\/+|\/+$/g, '') : ''; })();

const drafts = process.argv.includes('--drafts'); // preview drafts and scheduled posts
const build = () => spawnSync(process.execPath, [path.join(ROOT, 'scripts/build.js'), ...(drafts ? ['--drafts'] : [])], { stdio: 'inherit' });
if (watch || drafts || !fs.existsSync(DIST)) build();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const handler = (req, res) => {
  const send = (code, body, type = 'text/plain; charset=utf-8', extra = {}) => { res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', ...extra }); res.end(body); };
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method not allowed', undefined, { Allow: 'GET, HEAD' });
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(400, 'Bad request'); }
  if (url.includes('\0')) return send(400, 'Bad request');
  if (base) {
    if (url === base) return send(302, '', undefined, { Location: base + '/' });
    if (!url.startsWith(base + '/')) url = '/__outside_base__';
    else url = url.slice(base.length);
  }
  let file = path.join(DIST, path.normalize(url));
  if (file !== DIST && !file.startsWith(DIST + path.sep)) return send(403, 'Forbidden');
  try { if (fs.statSync(file).isDirectory()) {
    if (!url.endsWith('/')) return send(301, '', undefined, { Location: base + url + '/' });
    file = path.join(file, 'index.html');
  } } catch { /* not found below */ }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }
  const nf = path.join(DIST, '404.html');
  send(404, fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found', 'text/html; charset=utf-8');
};
const host = process.env.HOST || '127.0.0.1'; // local only unless HOST is set
http.createServer(handler).listen(port, host, () => console.log(`Serving dist/ at http://${host === '127.0.0.1' ? 'localhost' : host}:${port}${base}/${watch ? '  (watching for changes)' : ''}`));

if (watch) {
  let timer;
  const rebuild = () => { clearTimeout(timer); timer = setTimeout(build, 200); };
  const walk = (dir) => { // fs.watch({recursive}) is not supported everywhere, so watch each folder
    try { fs.watch(dir, rebuild); } catch { return; }
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory() && e.name !== 'node_modules') walk(path.join(dir, e.name));
  };
  for (const d of ['content', 'src', 'public', 'scripts']) walk(path.join(ROOT, d));
  for (const f of ['site.config.js', 'fonts.config.js']) fs.watch(path.join(ROOT, f), rebuild);
}
