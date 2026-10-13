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

const build = () => spawnSync(process.execPath, [path.join(ROOT, 'scripts/build.js')], { stdio: 'inherit' });
if (watch || !fs.existsSync(DIST)) build();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (base) {
    if (url === base) { res.writeHead(302, { Location: base + '/' }); return res.end(); }
    if (!url.startsWith(base + '/')) url = '/__outside_base__';
    else url = url.slice(base.length);
  }
  let file = path.join(DIST, path.normalize(url));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end('Forbidden'); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!url.endsWith('/')) { res.writeHead(301, { Location: base + url + '/' }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  if (fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  const nf = path.join(DIST, '404.html');
  res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found');
}).listen(port, () => console.log(`Serving dist/ at http://localhost:${port}${base}/${watch ? '  (watching for changes)' : ''}`));

if (watch) {
  let timer;
  for (const dir of ['content', 'src', 'public', 'scripts']) {
    fs.watch(path.join(ROOT, dir), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(build, 150); });
  }
  fs.watch(path.join(ROOT, 'site.config.js'), () => { clearTimeout(timer); timer = setTimeout(build, 150); });
}
