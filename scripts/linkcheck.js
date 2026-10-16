#!/usr/bin/env node
// Checks every link that points to ANOTHER website (the normal "npm run check" only checks links inside this site).
//   node scripts/linkcheck.js [--warn] [--concurrency 6] [--timeout 12000]
// Exit code 1 when a link is really broken (404, 410, DNS failure). Sites that block robots (403, 429, 999) are
// reported as "could not be checked" and never fail the run. --warn never fails.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every external http(s) link in the built pages: Map<url, pages[]>. */
export function collectLinks(distDir, ownHosts = []) {
  const found = new Map();
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.html') ? [path.join(d, e.name)] : []));
  for (const file of walk(distDir)) {
    const html = fs.readFileSync(file, 'utf8').replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<head>[\s\S]*?<\/head>/, '');
    const page = '/' + path.relative(distDir, file).replace(/index\.html$/, '').replace(/\\/g, '/');
    for (const m of html.matchAll(/<a\s[^>]*?href="(https?:\/\/[^"#]+)/g)) {
      const url = m[1].replace(/&amp;/g, '&');
      let host; try { host = new URL(url).hostname; } catch { continue; }
      if (ownHosts.includes(host)) continue;
      // share buttons and sign-in style endpoints are not links to check
      if (/^(twitter\.com|x\.com|wa\.me|www\.facebook\.com|www\.linkedin\.com)$/.test(host) && /(intent|share|sharer)/.test(url)) continue;
      if (!found.has(url)) found.set(url, new Set());
      found.get(url).add(page);
    }
  }
  return found;
}

/** Returns { state: 'ok' | 'broken' | 'unchecked', detail }. */
export async function checkOne(url, { timeoutMs = 12000, fetchImpl = fetch, retries = 1 } = {}) {
  const attempt = async (method) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { method, redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ASRBMY-Write-LinkCheck/1.0)', Accept: 'text/html,*/*;q=0.8' } });
    } finally { clearTimeout(t); }
  };
  let last = '';
  for (let i = 0; i <= retries; i++) {
    try {
      let r = await attempt('HEAD');
      if (r.status === 405 || r.status === 501 || r.status === 403 || r.status === 400) r = await attempt('GET'); // some servers refuse HEAD
      if (r.status >= 200 && r.status < 400) return { state: 'ok', detail: String(r.status) };
      if (r.status === 404 || r.status === 410) return { state: 'broken', detail: `HTTP ${r.status}` };
      if ([401, 403, 429, 451, 999].includes(r.status)) return { state: 'unchecked', detail: `HTTP ${r.status} (the site may block automatic checks)` };
      last = `HTTP ${r.status}`;
    } catch (e) {
      const code = e?.cause?.code || e?.code || '';
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') last = 'domain not found';
      else last = e?.name === 'AbortError' ? 'timed out' : `${code || e?.message || 'failed'}`;
      if (code === 'ENOTFOUND') return { state: 'broken', detail: last };
    }
    if (i < retries) await new Promise((r) => setTimeout(r, 800));
  }
  // 5xx, timeouts and connection problems are often temporary: report, but do not call them proof of a dead link
  return { state: /^HTTP 5|timed out|ECONN|failed/.test(last) ? 'unchecked' : 'broken', detail: last };
}

export async function runPool(items, worker, concurrency = 6) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await worker(items[i], i); }
  }));
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const val = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) || d : d; };
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(dist)) { console.error('dist/ not found. Run `npm run build` first.'); process.exit(1); }
  const cfg = (await import(new URL('../site.config.js', import.meta.url).href)).default;
  const own = [];
  try { own.push(new URL(cfg.url).hostname); } catch { /* ignore */ }
  if (process.env.GITHUB_REPOSITORY) own.push(`${process.env.GITHUB_REPOSITORY.split('/')[0].toLowerCase()}.github.io`);
  const links = collectLinks(dist, own);
  const urls = [...links.keys()];
  console.log(`Checking ${urls.length} outside link${urls.length === 1 ? '' : 's'}…`);
  const results = await runPool(urls, (u) => checkOne(u, { timeoutMs: val('--timeout', 12000) }), val('--concurrency', 6));
  const broken = [], unchecked = [];
  urls.forEach((u, i) => { if (results[i].state === 'broken') broken.push([u, results[i].detail]); else if (results[i].state === 'unchecked') unchecked.push([u, results[i].detail]); });
  const show = ([u, d]) => `  - ${u}  (${d})\n      on: ${[...links.get(u)].slice(0, 4).join(', ')}${links.get(u).size > 4 ? ', …' : ''}`;
  if (unchecked.length) console.log(`\n${unchecked.length} could not be checked (not counted as broken):\n${unchecked.map(show).join('\n')}`);
  if (broken.length) {
    console.error(`\n✖ ${broken.length} broken link${broken.length === 1 ? '' : 's'}:\n${broken.map(show).join('\n')}`);
    if (!args.includes('--warn')) process.exit(1);
  } else console.log(`\n✔ No broken outside links (${urls.length - unchecked.length} checked).`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
