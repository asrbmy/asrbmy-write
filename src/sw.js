// ASRBMY Write — offline support. Generated into dist/sw.js at build time (the __PLACEHOLDERS__ are filled in then).
// - Pages: network first (readers always get the newest version); the last copy is used when offline.
// - Scripts, styles, fonts and pictures: kept after first use so pages open instantly and work offline.
// - Articles a reader taps "Save for later" on are stored in a separate cache that is never trimmed.
const VERSION = '__VERSION__';
const SCOPE = '__SCOPE__';
const OFFLINE = '__OFFLINE__';
const PRECACHE = __PRECACHE__;
const STATIC = 'asrbmy-static-' + VERSION;
const PAGES = 'asrbmy-pages';
const SAVED = 'asrbmy-saved';
const MAX_PAGES = 40;
const ASSET = /\.(?:css|js|woff2?|png|jpe?g|webp|svg|gif|ico|webmanifest)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC);
    await Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => { /* one missing file must not block the install */ })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('asrbmy-static-') && k !== STATIC) await caches.delete(k);
    await self.clients.claim();
  })());
});

const inScope = (url) => url.origin === location.origin && url.pathname.startsWith(SCOPE);
const timeout = (ms) => new Promise((r) => setTimeout(() => r(null), ms));

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PAGES; i++) await cache.delete(keys[i]);
}

async function pageResponse(event) {
  const req = event.request;
  const cached = await caches.match(req.url, { ignoreSearch: true });
  const network = fetch(req).then(async (res) => {
    if (res.ok && !res.redirected && res.type === 'basic') {
      const copy = res.clone();
      const cache = await caches.open(PAGES);
      await cache.put(req.url, copy);
      await trim(cache);
    }
    return res;
  });
  if (!cached) {
    try { return await network; } catch { return (await caches.match(OFFLINE)) || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
  }
  event.waitUntil(network.catch(() => null)); // refresh the copy in the background
  const fresh = await Promise.race([network.catch(() => null), timeout(3500)]);
  return fresh || cached;
}

async function assetResponse(event) {
  const req = event.request;
  const hit = await caches.match(req);
  const versioned = new URL(req.url).searchParams.has('v');
  if (hit && versioned) return hit; // the address changes whenever the file does
  const update = fetch(req).then(async (res) => {
    if (res.ok && res.type === 'basic') (await caches.open(STATIC)).put(req, res.clone());
    return res;
  });
  if (hit) { event.waitUntil(update.catch(() => null)); return hit; }
  return update;
}

async function dataResponse(event) {
  const req = event.request;
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(PAGES)).put(req, res.clone());
    return res;
  } catch {
    return (await caches.match(req)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (!inScope(url)) return;
  if (req.mode === 'navigate') event.respondWith(pageResponse(event));
  else if (/search-index\.json$/.test(url.pathname)) event.respondWith(dataResponse(event));
  else if (ASSET.test(url.pathname)) event.respondWith(assetResponse(event));
});

// A reader pressed "Save for later" (or removed the article): keep or drop an offline copy.
async function savePage(target) {
  const res = await fetch(target.href, { cache: 'reload' });
  if (!res.ok || res.redirected) return;
  const html = await res.clone().text();
  const cache = await caches.open(SAVED);
  await cache.put(target.href, res);
  const found = new Set();
  for (const m of html.matchAll(/\s(?:src|href)="([^"#]+)"/g)) found.add(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) for (const part of m[1].split(',')) found.add(part.trim().split(/\s+/)[0]);
  let n = 0;
  for (const raw of found) {
    if (n >= 40) break;
    let u;
    try { u = new URL(raw, target.href); } catch { continue; }
    if (!inScope(u) || !ASSET.test(u.pathname)) continue;
    if (await cache.match(u.href)) continue;
    try { const r = await fetch(u.href); if (r.ok) { await cache.put(u.href, r); n++; } } catch { /* best effort */ }
  }
}

self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type !== 'save' && d.type !== 'unsave') return;
  let target;
  try { target = new URL(String(d.url), location.origin); } catch { return; }
  if (!inScope(target)) return;
  event.waitUntil(d.type === 'save' ? savePage(target).catch(() => null) : caches.open(SAVED).then((c) => c.delete(target.href)));
});
