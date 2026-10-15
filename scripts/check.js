// Post-build sanity check: every internal link/asset in dist/ must exist.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
if (!fs.existsSync(DIST)) { console.error('dist/ not found — run `npm run build` first.'); process.exit(1); }

const ghRepo = process.env.GITHUB_REPOSITORY || '';
const [ghOwner, ghName] = ghRepo.split('/');
const cfg = (await import(pathToFileURL(path.join(ROOT, 'site.config.js')).href)).default;
let base = process.env.BASE_PATH ?? (ghRepo ? (ghName?.toLowerCase() === `${ghOwner.toLowerCase()}.github.io` ? '' : `/${ghName}`) : cfg.base || '');
base = base && base !== '/' ? '/' + base.replace(/^\/+|\/+$/g, '') : '';

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html'));

const exists = (urlPath) => {
  let p;
  try { p = decodeURIComponent(urlPath); } catch { return false; }
  const full = path.join(DIST, p);
  if (fs.existsSync(full) && fs.statSync(full).isFile()) return true;
  return fs.existsSync(path.join(full, 'index.html'));
};

const problems = [];
if (process.env.GITHUB_ACTIONS && /YOUR-USERNAME/.test(fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8'))) problems.push('sitemap.xml: site url still contains YOUR-USERNAME (set url in site.config.js)');
const ids = new Map();
const idsOf = (file) => {
  if (!ids.has(file)) ids.set(file, new Set([...fs.readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return ids.get(file);
};

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(DIST, file);
  const prose = html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code[\s\S]*?<\/code>/g, '');
  if (/\{\{\s*[\w.]+\s*\}\}/.test(prose)) problems.push(`${rel}: unreplaced {{placeholder}}`);
  if (/\son[a-z]+\s*=\s*["']/i.test(prose.replace(/<script[\s\S]*?<\/script>/g, ''))) problems.push(`${rel}: inline event handler (blocked by the Content-Security-Policy)`);
  if ((html.match(/<a\s[^>]*>/g) || []).some((t) => /target="_blank"/.test(t) && !/rel="[^"]*noopener/.test(t))) problems.push(`${rel}: target=_blank link without rel=noopener`);
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${rel}: missing <title>`);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) problems.push(`${rel}: expected exactly one <h1>`);
  // SEO basics
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  if (!desc) problems.push(`${rel}: missing meta description`);
  else if (desc.length > 320) problems.push(`${rel}: meta description is ${desc.length} chars (keep it under ~160)`);
  if (!/<link rel="canonical" href="https?:\/\//.test(html)) problems.push(`${rel}: missing absolute canonical URL`);
  if (!/<meta property="og:image" content="https?:\/\//.test(html)) problems.push(`${rel}: missing og:image`);
  if (!/<html lang="[a-z-]+"/i.test(html)) problems.push(`${rel}: missing <html lang>`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { problems.push(`${rel}: invalid JSON-LD`); }
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt="/.test(m[0])) problems.push(`${rel}: <img> without alt`);
  // valid HTML: every id appears once per page
  const seenIds = new Map();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) seenIds.set(m[1], (seenIds.get(m[1]) || 0) + 1);
  for (const [id, n] of seenIds) if (n > 1) problems.push(`${rel}: id="${id}" used ${n} times`);
  if ((html.match(/<main[\s>]/g) || []).length !== 1) problems.push(`${rel}: expected exactly one <main>`);
  if ((html.match(/<form\b[^>]*target="_blank"[^>]*>/g) || []).some((t) => !/rel="[^"]*noopener/.test(t))) problems.push(`${rel}: <form target=_blank> without rel=noopener`);
  // responsive picture variants must exist
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) {
    for (const part of m[1].split(',')) {
      const u0 = part.trim().split(/\s+/)[0];
      if (!u0 || /^https?:/.test(u0)) continue;
      const pth = decodeURIComponent(u0.split('?')[0]);
      if (!pth.startsWith('/') || !exists(base && pth.startsWith(base + '/') ? pth.slice(base.length) : pth)) problems.push(`${rel}: srcset image missing ${u0}`);
    }
  }
  // language links point at real pages
  for (const m of html.matchAll(/<link rel="alternate" hreflang="[^"]+" href="https?:\/\/[^/"]+([^"]*)"/g)) {
    const pth = m[1];
    if (!exists(base && pth.startsWith(base + '/') ? pth.slice(base.length) : pth)) problems.push(`${rel}: hreflang link to missing page ${pth}`);
  }
  if (rel === 'index.html' && /name="robots" content="noindex/.test(html)) problems.push('index.html must not be noindex');
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    let url = m[1];
    if (!url || /^(https?:|mailto:|tel:|data:|javascript:)/.test(url)) continue;
    const [pathPart, hash] = [url.split('#')[0].split('?')[0], url.includes('#') ? url.split('#')[1] : ''];
    if (!pathPart) { if (hash && !idsOf(file).has(hash)) problems.push(`${rel}: dangling #${hash}`); continue; }
    if (!pathPart.startsWith('/')) { problems.push(`${rel}: relative URL "${url}" (use root-relative)`); continue; }
    if (base && !pathPart.startsWith(base + '/') && pathPart !== base) { problems.push(`${rel}: "${url}" ignores base path "${base}"`); continue; }
    const target = base ? pathPart.slice(base.length) || '/' : pathPart;
    if (!exists(target)) problems.push(`${rel}: broken link ${url}`);
    else if (hash && target.endsWith('/') || (hash && target.endsWith('.html'))) {
      const tf = fs.existsSync(path.join(DIST, target, 'index.html')) ? path.join(DIST, target, 'index.html') : path.join(DIST, target);
      if (fs.statSync(tf).isFile() && !idsOf(tf).has(hash)) problems.push(`${rel}: ${url} — no #${hash} on target`);
    }
  }
}

for (const f of ['rss.xml', 'sitemap.xml', 'search-index.json', 'robots.txt', '404.html', 'assets/theme.css', 'assets/tokens.css', 'assets/site.js']) {
  if (!fs.existsSync(path.join(DIST, f))) problems.push(`missing ${f}`);
}
try { JSON.parse(fs.readFileSync(path.join(DIST, 'search-index.json'), 'utf8')); } catch { problems.push('search-index.json is not valid JSON'); }

if (problems.length) {
  console.error(`✖ ${problems.length} problem(s):\n` + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`✔ checked ${htmlFiles.length} pages — all internal links, anchors and assets resolve (base "${base || '/'}").`);
