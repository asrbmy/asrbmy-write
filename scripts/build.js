// ASRBMY Write — static site builder.
//   content/articles/*.md  →  dist/articles/<slug>/index.html (+ indexes, feeds, search index)
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFrontmatter, renderMarkdown, htmlToText, esc, slugify, cleanUrl } from './markdown.js';
import { createTemplates, icon } from './templates.js';
import { optimiseImages } from './images.js';
import { analyticsInfo, contactInfo, viewsInfo, fetchPopular } from './features.js';
import { makeCards } from './og.js';
import { rssXml, atomXml, jsonFeed } from './feeds.js';
import { cmsInfo, adminHtml, adminConfig } from './cms.js';
import { tokensCss, resolveTypography } from './tokens.js';
import { fontPresets, fontFamilies } from '../fonts.config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const C = (await import(pathToFileURL(path.join(ROOT, 'site.config.js')).href)).default;

// ── Environment: base path, site URL, repository ─────────────────────────────
const ghRepo = process.env.GITHUB_REPOSITORY || ''; // "owner/name" on GitHub Actions
const [ghOwner, ghName] = ghRepo.split('/');
const isUserSite = ghName && ghName.toLowerCase() === `${(ghOwner || '').toLowerCase()}.github.io`;

const cleanBase = (b = '') => {
  b = String(b).trim();
  if (!b || b === '/') return '';
  return '/' + b.replace(/^\/+|\/+$/g, '');
};
let base = cleanBase(process.env.BASE_PATH ?? (ghRepo && !process.env.BASE_PATH ? (isUserSite ? '' : `/${ghName}`) : C.base));
let siteUrl = (process.env.SITE_URL || (ghOwner ? `https://${ghOwner.toLowerCase()}.github.io` : C.url) || '').replace(/\/+$/, '');
const repo = process.env.SITE_REPO || ghRepo || C.repo || '';
if (/YOUR-USERNAME/.test(siteUrl) && !process.env.QUIET) console.warn('! site.config.js still has the placeholder url. Search-engine links use it; on GitHub Actions it is detected automatically. For a custom domain, set url in site.config.js.');

const u = (p) => base + p;
const abs = (p) => siteUrl + p;
const fmtDate = (d) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));

// ── Load articles ────────────────────────────────────────────────────────────
const defaults = { author: C.author?.name, category: 'Notes', featured: false, ...(C.defaults || {}) };
const includeDrafts = !!process.env.INCLUDE_DRAFTS || process.argv.includes('--drafts');
const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const articleDir = path.join(ROOT, 'content/articles');
fs.mkdirSync(articleDir, { recursive: true });
// "Today" in the site's own time zone, so a post dated today appears at the start of that day.
const zone = (() => { try { new Intl.DateTimeFormat('en', { timeZone: C.timezone || 'UTC' }); return C.timezone || 'UTC'; } catch { fail(`site.config.js: timezone "${C.timezone}" is not a valid time zone name (try "UTC" or "Asia/Kolkata")`); } })();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const scheduled = [];
// A cover image is a file in public/images ("images/pic.jpg" or "/images/pic.jpg") or an https:// address.
function coverPath(v, where) {
  if (!v) return '';
  const raw = cleanUrl(String(v));
  if (raw === null) fail(`${where}: "cover" must be an image path or https:// address`);
  if (/^https:\/\//i.test(raw)) return raw;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) fail(`${where}: "cover" must be a path such as /images/photo.jpg or an https:// address`);
  return '/' + raw.replace(/^(?:\.{0,2}\/)*(?:public\/)?/, '');
}
// ── Languages ────────────────────────────────────────────────────────────────
// The first language is the site's main one. Articles in other languages live at /<code>/articles/…
const languages = Array.isArray(C.languages) && C.languages.length ? C.languages : [{ code: C.language || 'en', label: 'English' }];
for (const l of languages) if (!/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(String(l.code))) fail(`site.config.js: language code "${l.code}" is not valid (use codes like en, hi, es, pt-BR)`);
const defaultLang = languages[0].code;
const langOf = new Map(languages.map((l) => [l.code, l]));

// ── Pictures: smaller copies + light/dark pairs ──────────────────────────────
const publicImages = path.join(ROOT, 'public/images');
const cacheDir = path.join(ROOT, '.cache/images');
const variants = await optimiseImages({ srcDir: publicImages, outDir: cacheDir, quiet: !!process.env.QUIET });
const imageInfo = (rawSrc) => {
  let src = rawSrc;
  try { src = encodeURI(decodeURI(rawSrc)); } catch { /* keep as written */ }
  const m = src.match(/^\/images\/([^/]+)\.(png|jpe?g|gif|webp|svg)$/i);
  if (!m) return null;
  let dark = null;
  let plain = m[1];
  try { plain = decodeURIComponent(m[1]); } catch { return null; }
  if (/[\\/]|\.\./.test(plain)) return null; // never look outside public/images
  if (!/\.dark$/i.test(m[1])) for (const e of ['png', 'jpg', 'jpeg', 'webp', 'svg']) if (fs.existsSync(path.join(publicImages, `${plain}.dark.${e}`))) { dark = `/images/${m[1]}.dark.${e}`; break; }
  return { dark, srcset: variants.get(src) };
};

// ── Glossary (content/glossary.md): "## Term" or "## Term | alias", then the meaning ──
const glossary = [];
{
  const gf = path.join(ROOT, 'content/glossary.md');
  if (fs.existsSync(gf)) {
    const { body: gb } = parseFrontmatter(fs.readFileSync(gf, 'utf8'));
    for (const part of gb.split(/^##[ \t]+/m).slice(1)) {
      const nl = part.indexOf('\n');
      const head = (nl < 0 ? part : part.slice(0, nl)).trim();
      const def = (nl < 0 ? '' : part.slice(nl + 1)).trim();
      const [term, ...aliases] = head.split('|').map((x) => x.trim()).filter(Boolean);
      if (!term || !def) continue;
      const slug = slugify(term);
      if (!slug) continue;
      if (glossary.some((g) => g.slug === slug)) fail(`content/glossary.md: "${term}" is defined twice`);
      const html = renderMarkdown(def, { base }).html;
      const tip = htmlToText(html);
      glossary.push({ term, aliases, slug, html, tip: tip.length > 220 ? tip.slice(0, 217).trimEnd() + '…' : tip });
    }
    glossary.sort((a, b) => a.term.localeCompare(b.term));
  }
}
const SKIP = new Set(['a', 'code', 'pre', 'button', 'summary', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'math', 'svg', 'script', 'style', 'figcaption']);
/** Wraps the first mention of each glossary term in a link that shows its meaning on hover or focus. */
function applyGlossary(html) {
  if (!glossary.length) return html;
  const names = glossary.flatMap((g) => [g.term, ...g.aliases].map((n) => ({ n, g }))).sort((a, b) => b.n.length - a.n.length);
  const used = new Set();
  let skip = 0;
  return html.split(/(<[^>]+>)/).map((chunk) => {
    if (chunk.startsWith('<')) {
      const m = chunk.match(/^<(\/?)([a-zA-Z0-9]+)/);
      if (m && SKIP.has(m[2].toLowerCase()) && !/\/>$/.test(chunk)) skip += m[1] ? -1 : 1;
      return chunk;
    }
    if (skip > 0 || !chunk.trim()) return chunk;
    const live = names.filter(({ g }) => !used.has(g.slug));
    if (!live.length) return chunk;
    const re = new RegExp(`(?<![\\p{L}\\p{N}_-])(${live.map(({ n }) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}_-])`, 'iu');
    let out = '', rest = chunk, hit;
    while ((hit = re.exec(rest))) {
      const g = live.find(({ n }) => n.toLowerCase() === hit[1].toLowerCase())?.g;
      if (!g || used.has(g.slug)) { out += rest.slice(0, hit.index + hit[0].length); rest = rest.slice(hit.index + hit[0].length); continue; }
      used.add(g.slug);
      out += `${rest.slice(0, hit.index)}<a class="gloss" href="${u(`/glossary/#g-${g.slug}`)}" data-def="${esc(g.tip)}">${hit[1]}<span class="sr-only"> (definition: ${esc(g.tip)})</span></a>`;
      rest = rest.slice(hit.index + hit[0].length);
    }
    return out + rest;
  }).join('');
}

const audioPath = (v, where) => {
  if (!v) return '';
  const c = cleanUrl(String(v));
  if (c === null || !/^(\/audio\/[\w./%-]+|https:\/\/[^\s"'<>]+)$/i.test(c) || !/\.(mp3|m4a|ogg|wav|opus|aac)(\?.*)?$/i.test(c)) fail(`${where}: "audio" must be a file under /audio/ (put it in public/audio) or an https:// address ending in .mp3, .m4a, .ogg, .wav or .opus`);
  return c;
};
const allArticles = [];
for (const file of fs.readdirSync(articleDir).filter((f) => f.endsWith('.md') && !f.startsWith('.')).sort()) {
  const src = fs.readFileSync(path.join(articleDir, file), 'utf8');
  const { data: fm, body } = parseFrontmatter(src);
  const where = `content/articles/${file}`;
  if (fm.draft === true && !includeDrafts) continue;
  if (!fm.title) fail(`${where}: missing "title" in front matter`);
  if (!validDate(String(fm.date || ''))) fail(`${where}: "date" must be a real date written like 2026-04-26 (got "${fm.date ?? ''}")`);
  if (fm.updated && !validDate(String(fm.updated))) fail(`${where}: "updated" must be a real date written like 2026-04-26`);
  if (String(fm.date) > today && !includeDrafts) { scheduled.push(`${fm.date}  ${fm.title}`); continue; } // scheduled: goes live on its date
  const status = fm.draft === true ? 'draft' : String(fm.date) > today ? 'scheduled' : '';
  const slug = slugify(fm.slug || file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, ''));
  if (!slug) fail(`${where}: could not make a URL slug — add a "slug:" using letters or numbers`);
  const category = String(fm.category || defaults.category).trim();
  if (!slugify(category)) fail(`${where}: category "${category}" needs at least one letter or number`);
  const rawTags = Array.isArray(fm.tags) ? fm.tags : String(fm.tags || '').split(',');
  const tags = [...new Set(rawTags.map((t) => String(t).trim()).filter((t) => slugify(t)))];
  const lang = String(fm.lang || defaultLang);
  if (!langOf.has(lang)) fail(`${where}: lang "${lang}" is not listed under "languages" in site.config.js`);
  const { html: rawHtml, toc, features } = renderMarkdown(body, { base, images: imageInfo });
  const html = fm.glossary === false || lang !== defaultLang ? rawHtml : applyGlossary(rawHtml);
  const text = htmlToText(rawHtml.replace(/<math[\s\S]*?<\/math>/g, ' '));
  const firstPara = htmlToText((html.match(/<p>([\s\S]*?)<\/p>/) || [, ''])[1]);
  const excerpt = String(fm.excerpt || (firstPara.length > 180 ? firstPara.slice(0, 177).trimEnd() + '…' : firstPara));
  allArticles.push({
    file, slug, status, lang, translationOf: fm.translationOf ? slugify(String(fm.translationOf)) : '', features, best: fm.best === true,
    url: lang === defaultLang ? `/articles/${slug}/` : `/${lang}/articles/${slug}/`, title: String(fm.title), subtitle: fm.subtitle ? String(fm.subtitle) : '',
    date: String(fm.date), updated: fm.updated ? String(fm.updated) : '',
    author: String(fm.author || defaults.author), category, tags, featured: fm.featured === true,
    excerpt, html, toc, text,
    cover: coverPath(fm.cover, where), coverAlt: fm.coverAlt ? String(fm.coverAlt) : '',
    series: fm.series ? String(fm.series).trim() : '', seriesOrder: fm.seriesOrder !== undefined && fm.seriesOrder !== '' && Number.isFinite(Number(fm.seriesOrder)) ? Number(fm.seriesOrder) : null,
    comments: fm.comments !== false,
    kind: String(fm.type || '').toLowerCase() === 'note' ? 'note' : '',
    social: fm.social ? String(fm.social).slice(0, 300) : '',
    changes: (Array.isArray(fm.changes) ? fm.changes : fm.changes ? [fm.changes] : []).map((c) => { const m = /^\s*(\d{4}-\d{2}-\d{2})\s*[:\-–—]?\s*(.+)$/.exec(String(c)); return m && validDate(m[1]) ? { date: m[1], text: m[2].trim() } : (console.warn(`! ${where}: a "changes" line must look like "2026-04-26: What changed" (got "${c}")`), null); }).filter(Boolean).sort((x, y) => y.date.localeCompare(x.date)),
    rating: Number.isFinite(Number(fm.rating)) && Number(fm.rating) >= 1 && Number(fm.rating) <= 5 ? Math.round(Number(fm.rating) * 2) / 2 : 0,
    reviewItem: fm.reviewItem ? String(fm.reviewItem).slice(0, 160) : '',
    sheet: fm.sheet === true,
    helpful: fm.helpful !== false,
    audio: audioPath(fm.audio, where), audioTitle: fm.audioTitle ? String(fm.audioTitle).slice(0, 120) : '',
    chapters: (Array.isArray(fm.chapters) ? fm.chapters : []).map((c) => { const m = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)$/.exec(String(c)); return m ? { at: (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]), label: m[4].trim().slice(0, 100) } : null; }).filter(Boolean),
    readingTime: Number(fm.readingTime) || Math.max(1, Math.round(text.split(/\s+/).length / 220)),
  });
}
const slugs = new Set();
for (const a of allArticles) {
  if (slugs.has(a.lang + '/' + a.slug)) fail(`Duplicate article slug "${a.slug}" (${a.file})`);
  slugs.add(a.lang + '/' + a.slug);
}
allArticles.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
// `articles` is the main-language list that feeds the home page, listings, tags, search and feeds.
const articles = allArticles.filter((a) => a.lang === defaultLang);
const translations = allArticles.filter((a) => a.lang !== defaultLang);
for (const t of translations) if (t.translationOf && !articles.some((a) => a.slug === t.translationOf)) console.warn(`! ${t.file}: translationOf "${t.translationOf}" matches no ${defaultLang} article`);
for (const a of allArticles) {
  const key = a.lang === defaultLang ? a.slug : a.translationOf;
  a.alternates = key ? allArticles.filter((b) => b !== a && (b.lang === defaultLang ? b.slug : b.translationOf) === key) : [];
}

// ── Authors ──────────────────────────────────────────────────────────────────
const authorProfiles = [];
for (const p of [{ name: C.author?.name, bio: C.author?.bio, links: C.author?.links }, ...(C.authors || [])]) {
  if (!p?.name) continue;
  const slug = slugify(p.slug || p.name);
  if (slug && !authorProfiles.some((x) => x.slug === slug)) authorProfiles.push({ ...p, slug, links: p.links || [] });
}
for (const a of allArticles) { a.authorProfile = authorProfiles.find((p) => p.slug === slugify(a.author)) || null; }
const authorList = authorProfiles.map((p) => ({ ...p, articles: articles.filter((a) => a.authorProfile === p) })).filter((p) => p.articles.length);
const bestList = articles.filter((a) => a.best);

// ── Projects (content/projects/*.md) ─────────────────────────────────────────
const projects = [];
{
  const dir = path.join(ROOT, 'content/projects');
  for (const file of fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('.')).sort() : []) {
    const { data: fm, body } = parseFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
    const where = `content/projects/${file}`;
    if (!fm.title) fail(`${where}: missing "title"`);
    const slug = slugify(fm.slug || file.replace(/\.md$/, ''));
    if (!slug) fail(`${where}: could not make a URL slug`);
    const link = (v, key) => { if (!v) return ''; const c = cleanUrl(String(v)); if (c === null || !/^https?:\/\//i.test(c)) fail(`${where}: "${key}" must be an https:// address`); return c; };
    if (fm.draft === true && !includeDrafts) continue;
    projects.push({
      slug, url: `/projects/${slug}/`, title: String(fm.title), summary: String(fm.summary || ''), status: String(fm.status || ''),
      tech: Array.isArray(fm.tags || fm.tech) ? (fm.tags || fm.tech) : String(fm.tech || '').split(',').map((x) => x.trim()).filter(Boolean),
      link: link(fm.url, 'url'), repo: link(fm.repo, 'repo'), cover: coverPath(fm.cover, where), coverAlt: fm.coverAlt ? String(fm.coverAlt) : '',
      order: Number.isFinite(Number(fm.order)) && fm.order !== undefined && fm.order !== '' ? Number(fm.order) : 999, date: String(fm.date || ''),
      html: renderMarkdown(body, { base, images: imageInfo }).html,
    });
  }
  projects.sort((a, b) => a.order - b.order || b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

// ── Taxonomies ───────────────────────────────────────────────────────────────
const catSlug = (n) => slugify(n);
const tagSlug = (n) => slugify(n);
const catMap = new Map();
const tagMap = new Map();
const nameFor = (map, key, name, kind) => {
  const seen = map.get(key);
  if (seen && seen.toLowerCase() !== name.toLowerCase()) fail(`The ${kind}s "${seen}" and "${name}" would share the address "${key}". Rename one of them.`);
  if (!seen) map.set(key, name);
  return map.get(key);
};
const catNames = new Map();
const tagNames = new Map();
for (const a of articles) {
  a.category = nameFor(catNames, catSlug(a.category), a.category, 'category');
  a.tags = [...new Set(a.tags.map((t) => nameFor(tagNames, tagSlug(t), t, 'tag')))];
  if (!catMap.has(a.category)) catMap.set(a.category, []);
  catMap.get(a.category).push(a);
  for (const t of a.tags) {
    const k = tagSlug(t);
    if (!tagMap.has(k)) tagMap.set(k, { name: t, slug: k, articles: [] });
    tagMap.get(k).articles.push(a);
  }
}
const categories = [...catMap.entries()]
  .map(([name, list]) => ({ name, slug: catSlug(name), count: list.length, articles: list, description: C.categories?.[name] || '' }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
const tags = [...tagMap.values()].map((t) => ({ ...t, count: t.articles.length })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

// ── Series ───────────────────────────────────────────────────────────────────
// Articles that share a `series:` name are grouped, ordered by `seriesOrder` (else by date, oldest first).
const seriesNames = new Map();
const seriesMap = new Map();
for (const a of articles) {
  if (!a.series) continue;
  const key = slugify(a.series);
  if (!key) fail(`content/articles/${a.file}: series "${a.series}" needs at least one letter or number`);
  a.series = nameFor(seriesNames, key, a.series, 'series');
  if (!seriesMap.has(key)) seriesMap.set(key, { name: a.series, slug: key, parts: [] });
  seriesMap.get(key).parts.push(a);
}
const seriesList = [...seriesMap.values()].map((sr) => {
  sr.parts.sort((x, y) => (x.seriesOrder ?? Infinity) - (y.seriesOrder ?? Infinity) || x.date.localeCompare(y.date) || x.title.localeCompare(y.title));
  sr.parts.forEach((a, i) => { a.seriesInfo = { ...sr, index: i }; });
  return sr;
}).sort((x, y) => x.name.localeCompare(y.name));

// Does a configured link point at something that exists? (hides nav items for empty categories)
const hasRoute = (href) => {
  let m;
  if ((m = href.match(/^\/categories\/([^/]+)\/?$/))) return categories.some((c) => c.slug === m[1]);
  if ((m = href.match(/^\/tags\/([^/]+)\/?$/))) return tags.some((t) => t.slug === m[1]);
  if (href === '/best/') return bestList.length > 0;
  if (href === '/notes/') return articles.some((a) => a.kind === 'note');
  if (href === '/projects/') return projects.length > 0;
  if (href === '/glossary/') return glossary.length > 0;
  if (href === '/series/') return seriesList.length > 0;
  if (href === '/authors/') return authorList.length > 1;
  return true;
};

// ── Cache-busting versions for assets ────────────────────────────────────────
const sha = (x) => crypto.createHash('sha1').update(x).digest('hex').slice(0, 8);
const assetVer = {
  'tokens.css': sha(tokensCss(C)),
  ...Object.fromEntries(['theme.css', 'site.js', 'font-tester.js', 'comments.js', 'bookmarks.js', 'diagrams.js', 'random.js'].map((f) => [f, sha(fs.readFileSync(path.join(ROOT, 'src', f)))])),
};
const asset = (name) => `${u(`/assets/${name}`)}?v=${assetVer[name]}`;
const searchIndexJson = JSON.stringify(articles.map((a) => ({ t: a.title, u: u(a.url), c: a.category, g: a.tags, e: a.excerpt, d: a.date, r: a.readingTime, x: a.text })));
const searchUrl = `${u('/search-index.json')}?v=${sha(searchIndexJson)}`;

// ── Social links ─────────────────────────────────────────────────────────────
const social = (C.social || [])
  .map((s) => ({ ...s, href: s.href || (s.icon === 'github' && repo ? `https://github.com/${repo}` : '') }))
  .filter((s) => s.href)
  .map((s) => ({ ...s, href: s.href.startsWith('/') ? u(s.href) : s.href }));
// footer templates re-wrap root-relative hrefs; keep them root-relative there
const socialForTemplate = (C.social || [])
  .map((s) => ({ ...s, href: s.href || (s.icon === 'github' && repo ? `https://github.com/${repo}` : '') }))
  .filter((s) => s.href);

const imgSrc = (c) => (/^https:/i.test(c) ? c : u(c));
const guard = (fn) => { try { return fn(); } catch (e) { return fail(e.message); } };
const vInfo = guard(() => viewsInfo(C));
const offlineOn = C.offline?.enabled !== false;
// "Popular this month" comes from GoatCounter while building (needs the GOATCOUNTER_TOKEN secret)
let popular = null;
if (vInfo?.popular) {
  const hits = await fetchPopular(vInfo, process.env.GOATCOUNTER_TOKEN);
  const byPath = new Map(articles.map((a) => [u(a.url), a]));
  const list = [];
  for (const h of hits) { const a = byPath.get(h.path) || byPath.get(h.path.replace(/\/?$/, '/')); if (a && !list.includes(a)) list.push(a); }
  if (list.length) popular = { title: vInfo.title, list: list.slice(0, vInfo.count) };
  else if (!process.env.GOATCOUNTER_TOKEN && !process.env.QUIET) console.log('ℹ popular: set the GOATCOUNTER_TOKEN secret to show "Popular this month" (see the README).');
}
// Social networks cannot show SVG pictures, so a cover must be png/jpg/webp/gif to be used for sharing
const shareable = (c) => !!c && !/\.svg(?:[?#]|$)/i.test(c);
// Share cards for articles without a (shareable) cover (written to .cache, copied into dist at the end)
const ogOut = path.join(ROOT, '.cache/og-out');
fs.rmSync(ogOut, { recursive: true, force: true });
const cards = C.seo?.autoImages === false ? new Map() : await makeCards(
  allArticles.filter((a) => !shareable(a.cover)).map((a) => ({ id: `${a.lang}-${a.slug}`, title: a.title, category: a.category })),
  { outDir: ogOut, cacheDir: path.join(ROOT, '.cache/og'), site: C.name, tagline: C.tagline, theme: C.theme });
for (const a of allArticles) { const f = cards.get(`${a.lang}-${a.slug}`); a.autoOg = f ? `/images/_og/${f}` : ''; }
const S = { popular, views: vInfo, offline: offlineOn, includeDrafts, allArticles, translations, languages, defaultLang, langOf, authorList, bestList, glossary, projects, imgSrc, seriesList, config: C, base, siteUrl, u, abs, asset, fmtDate, articles, categories, tags, catSlug, tagSlug, hasRoute, social: socialForTemplate };
let T;
try { T = createTemplates(S); } catch (e) { fail(e.message); }

// ── Output helpers ───────────────────────────────────────────────────────────
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const emitted = [];
const written = new Set();
const topicFeedOn = C.feed?.perTopic !== false;
const topicFeed = (p, name) => topicFeedOn ? `<p class="topicfeed">${icon('rss')} <a href="${u(p)}">Follow “${esc(name)}” by RSS</a></p>` : '';
function emit(sitePath, content, { sitemap = true } = {}) {
  const file = sitePath.endsWith('/') ? `${sitePath}index.html` : sitePath;
  if (written.has(file)) fail(`Two pages want the same address (${sitePath}). Rename the page in content/pages or the article slug.`);
  written.add(file);
  const out = path.join(DIST, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content);
  if (sitemap) emitted.push(sitePath);
}
const panelHead = ({ kicker, title, lede }) =>
  `<header class="panel__head">${kicker ? `<p class="kicker">${kicker}</p>` : ''}<h1 class="title">${esc(title)}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</header><hr class="rule">`;
const homeCrumb = { label: 'Home', href: '/' };

// ── Home ─────────────────────────────────────────────────────────────────────
{
  const featured = articles.find((a) => a.featured) || articles[0];
  const latest = articles.filter((a) => a !== featured).slice(0, 5);
  const body = `<section class="panel panel--top intro">
  <p class="kicker">Personal writing</p>
  <h1 class="title">${esc(C.name)}</h1>
  <p class="lede">${esc(C.description)}</p>
  <ul class="chips" aria-label="Browse by topic">${categories.map((c) => `<li><a href="${u(`/categories/${c.slug}/`)}">${esc(c.name)} <span>${c.count}</span></a></li>`).join('')}</ul>
</section>
${featured ? `<section class="panel panel--top block" aria-labelledby="h-featured"><h2 class="block__title" id="h-featured">Featured</h2>${T.articleCard(featured, { featured: true, level: 3 })}</section>` : ''}
<section class="panel panel--top block" aria-labelledby="h-latest">
  <h2 class="block__title" id="h-latest">Latest writing</h2>
  <div class="cards">${latest.map((a) => T.articleCard(a, { level: 3 })).join('')}</div>
  <p class="more"><a href="${u('/writing/')}">All articles ${icon('arrow', 14)}</a></p>
</section>`;
  emit('/', T.page({ title: `${C.name} — ${C.tagline}`, path: u('/'), body, description: C.description, noSuffix: true,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: C.name, url: abs(u('/')), description: C.description, inLanguage: C.language,
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: abs(u('/search/')) + '?q={search_term_string}' }, 'query-input': 'required name=search_term_string' } },
      { '@context': 'https://schema.org', '@type': 'Person', name: C.author?.name || C.name, description: C.author?.bio || '', url: abs(u('/about/')) }] }));
}

// ── Writing (paginated) ──────────────────────────────────────────────────────
{
  const size = C.pageSize || 6;
  const total = Math.max(1, Math.ceil(articles.length / size));
  const hrefFor = (n) => (n === 1 ? u('/writing/') : u(`/writing/page/${n}/`));
  for (let n = 1; n <= total; n++) {
    const slice = articles.slice((n - 1) * size, n * size);
    const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Archive of ideas', title: 'Writing', lede: `${articles.length} article${articles.length === 1 ? '' : 's'}, newest first.` })}
<div class="cards">${slice.map((a) => T.articleCard(a)).join('')}</div>
${T.pagination(n, total, hrefFor)}
</section>`;
    emit(n === 1 ? '/writing/' : `/writing/page/${n}/`, T.page({
      title: n === 1 ? 'Writing' : `Writing — page ${n}`, path: hrefFor(n), body,
      crumbs: [homeCrumb, { label: n === 1 ? 'Writing' : `Writing — page ${n}` }],
      description: n === 1 ? `All articles from ${C.name}.` : `Page ${n} of the articles from ${C.name}.`,
      prev: n > 1 ? hrefFor(n - 1) : '', next: n < total ? hrefFor(n + 1) : '',
    }), { sitemap: n === 1 });
  }
}

// ── Categories ───────────────────────────────────────────────────────────────
{
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Browse by topic', title: 'Categories', lede: 'Writing grouped by subject.' })}
<ul class="catgrid">${categories.map((c) => `<li><a href="${u(`/categories/${c.slug}/`)}"><span class="catgrid__name">${esc(c.name)}</span><span class="count">${c.count}</span><span class="catgrid__desc">${esc(c.description || `${c.count} article${c.count === 1 ? '' : 's'}`)}</span></a></li>`).join('')}</ul>
</section>`;
  emit('/categories/', T.page({ title: 'Categories', path: u('/categories/'), body, crumbs: [homeCrumb, { label: 'Categories' }], description: `Browse ${C.name} by category.` }));
  for (const c of categories) {
    const b = `<section class="panel panel--top">
${panelHead({ kicker: 'Category', title: c.name, lede: esc(c.description || `${c.count} article${c.count === 1 ? '' : 's'} filed under ${c.name}.`) })}
<div class="cards">${c.articles.map((a) => T.articleCard(a)).join('')}</div>
${topicFeed(`/categories/${c.slug}/rss.xml`, c.name)}
</section>`;
    emit(`/categories/${c.slug}/`, T.page({ title: c.name, feed: topicFeedOn ? `/categories/${c.slug}/rss.xml` : '', path: u(`/categories/${c.slug}/`), body: b,
      crumbs: [homeCrumb, { label: 'Categories', href: '/categories/' }, { label: c.name }], description: c.description || `${c.name} articles from ${C.name}.` }));
  }
}

// ── Tags (shown as a weighted cloud: the more articles, the bigger the tag) ──
const weight = (n) => { const max = Math.max(...tags.map((t) => t.count), 1); return n <= 1 ? 1 : Math.min(5, 1 + Math.ceil((n / max) * 4 - 0.01)); };
// ──────────────────────────────────────────────────────────────────────────────
{
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Browse by tag', title: 'Tags', lede: 'Smaller topics that cut across categories.' })}
<ul class="chips chips--lg chips--cloud">${tags.map((t) => `<li class="w${weight(t.count)}"><a href="${u(`/tags/${t.slug}/`)}">${esc(t.name)} <span>${t.count}</span></a></li>`).join('')}</ul>
</section>`;
  emit('/tags/', T.page({ title: 'Tags', path: u('/tags/'), body, crumbs: [homeCrumb, { label: 'Tags' }], description: `All tags used on ${C.name}.` }));
  for (const t of tags) {
    const b = `<section class="panel panel--top">
${panelHead({ kicker: 'Tag', title: `#${t.name}`, lede: `${t.count} article${t.count === 1 ? '' : 's'} tagged “${esc(t.name)}”.` })}
<div class="cards">${t.articles.map((a) => T.articleCard(a)).join('')}</div>
${topicFeed(`/tags/${t.slug}/rss.xml`, t.name)}
</section>`;
    emit(`/tags/${t.slug}/`, T.page({ title: `#${t.name}`, feed: topicFeedOn ? `/tags/${t.slug}/rss.xml` : '', path: u(`/tags/${t.slug}/`), body: b,
      crumbs: [homeCrumb, { label: 'Tags', href: '/tags/' }, { label: t.name }], description: `Articles tagged ${t.name}.`, noindex: t.count < 3 }), { sitemap: false });
  }
}

// ── Archive (by year, then month) ────────────────────────────────────────────
{
  const monthName = (d) => new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
  const byYear = new Map();
  for (const a of articles) {
    const y = a.date.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, new Map());
    const months = byYear.get(y);
    const m = a.date.slice(0, 7);
    if (!months.has(m)) months.set(m, []);
    months.get(m).push(a);
  }
  const yearsNav = byYear.size > 1 ? `<nav class="az" aria-label="Jump to year">${[...byYear.keys()].map((y) => `<a href="#y-${y}">${y}</a>`).join('')}</nav>` : '';
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Everything, by date', title: 'Archive', lede: `${articles.length} article${articles.length === 1 ? '' : 's'} since ${articles.length ? fmtDate(articles[articles.length - 1].date).slice(-4) : '—'}.` })}
${articles.length > 1 ? `<p class="archive__tools"><a class="btn btn--ghost" href="${u('/writing/')}" data-random data-index="${esc(searchUrl)}">${icon('dice', 15)} Read a random article</a></p>` : ''}
${yearsNav}
${[...byYear.entries()].map(([y, months]) => `<section class="archive__year" aria-labelledby="y-${y}"><h2 id="y-${y}">${y}</h2>${[...months.entries()].map(([m, list]) => `<h3 class="archive__month" id="m-${m}">${monthName(list[0].date)} <span>${list.length}</span></h3><ul class="archive__list">${list.map((a) => `<li><time datetime="${a.date}">${fmtDate(a.date).replace(/, \d{4}$/, '')}</time><a href="${u(a.url)}">${esc(a.title)}</a><span class="archive__cat">${esc(a.category)}</span></li>`).join('')}</ul>`).join('')}</section>`).join('')}
</section>`;
  emit('/archive/', T.page({ title: 'Archive', path: u('/archive/'), body, crumbs: [homeCrumb, { label: 'Archive' }], description: `Every article on ${C.name}, by date.`, scripts: ['random.js'] }));
}

// ── Search ───────────────────────────────────────────────────────────────────
{
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Find an article', title: 'Search', lede: 'Searches titles, excerpts, categories, tags and the full text.' })}
<div id="search-app" data-index="${esc(searchUrl)}">
  <form class="search-form" role="search" action="${u('/search/')}" method="get">
    <label class="sr-only" for="q">Search</label>
    <input id="q" name="q" type="search" placeholder="Search articles…" autocomplete="off" autofocus>
    <button type="submit" class="btn-solid">Search</button>
  </form>
  <div class="search-filters" id="search-filters" hidden></div>
  <p id="search-status" class="search-status" role="status" aria-live="polite"></p>
  <ol id="search-results" class="results"></ol>
  <noscript><p>Search needs JavaScript. You can browse <a href="${u('/writing/')}">all articles</a> instead.</p></noscript>
</div>
</section>`;
  emit('/search/', T.page({ title: 'Search', path: u('/search/'), body, crumbs: [homeCrumb, { label: 'Search' }], description: `Search ${C.name}.`, noindex: true }), { sitemap: false });
  fs.writeFileSync(path.join(DIST, 'search-index.json'), searchIndexJson);
}

// ── Static pages from content/pages ──────────────────────────────────────────
const pageVars = { analytics: (() => { try { return analyticsInfo(C)?.note || 'This site does not use analytics, advertising or tracking scripts.'; } catch (e) { return fail(e.message); } })(), name: C.name, author: C.author?.name || '', bio: C.author?.bio || '', description: C.description, tagline: C.tagline, url: siteUrl };
const pagesDir = path.join(ROOT, 'content/pages');
for (const file of fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir).filter((f) => f.endsWith('.md')) : []) {
  const { data: fm, body: md } = parseFrontmatter(fs.readFileSync(path.join(pagesDir, file), 'utf8'));
  const slug = slugify(fm.slug || file.replace(/\.md$/, ''));
  if (!slug) fail(`content/pages/${file}: could not make a URL slug`);
  const sub = (v) => String(v ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in pageVars ? pageVars[k] : m));
  const { html } = renderMarkdown(md, { base, vars: pageVars });
  const body = `<article class="panel panel--top">
${panelHead({ kicker: fm.kicker ? esc(sub(fm.kicker)) : '', title: sub(fm.title || slug), lede: fm.lede ? esc(sub(fm.lede)) : '' })}
<div class="prose">${html}</div>
</article>`;
  emit(`/${slug}/`, T.page({ title: sub(fm.title || slug), path: u(`/${slug}/`), body, crumbs: [homeCrumb, { label: sub(fm.title || slug) }], description: sub(fm.description || C.description) }));
}

// ── Contact (generated from config) ──────────────────────────────────────────
const contactForm = guard(() => contactInfo(C));
{
  const rows = [];
  if (C.contact?.email) rows.push(`<li><span class="contact__k">Email</span><a href="mailto:${esc(C.contact.email)}">${esc(C.contact.email)}</a></li>`);
  for (const s of social) if (s.icon !== 'rss') rows.push(`<li><span class="contact__k">${esc(s.label)}</span><a href="${esc(s.href)}" rel="noopener noreferrer" target="_blank">${esc(s.href.replace(/^https?:\/\//, ''))}</a></li>`);
  const form = contactForm ? `<form class="contactform" method="post" action="${esc(contactForm.action)}" aria-labelledby="cf-t">
  <h2 id="cf-t">Send a message</h2>
  ${contactForm.next ? `<input type="hidden" name="_next" value="${esc(contactForm.next)}"><input type="hidden" name="_redirect" value="${esc(contactForm.next)}">` : ''}
  <div class="field"><label for="cf-name">Your name <small>(optional)</small></label><input id="cf-name" name="name" autocomplete="name" maxlength="120"></div>
  <div class="field"><label for="cf-email">Your email</label><input id="cf-email" type="email" name="email" autocomplete="email" required maxlength="200"></div>
  <div class="field"><label for="cf-topic">What is it about?</label><select id="cf-topic" name="topic">${contactForm.topics.map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
  <div class="field"><label for="cf-msg">Message</label><textarea id="cf-msg" name="message" rows="7" required maxlength="4000"></textarea></div>
  <p class="cf-trap" aria-hidden="true"><label>Leave this empty <input type="text" name="_gotcha" tabindex="-1" autocomplete="off"></label></p>
  <p><button type="submit" class="btn">Send message</button></p>
  <p class="newsletter__note">${esc(contactForm.note)}</p>
</form>` : '';
  const body = `<article class="panel panel--top">
${panelHead({ kicker: 'Get in touch', title: 'Contact', lede: `The best way to reach ${esc(C.author?.name || C.name)}.` })}
<div class="prose">
${rows.length ? `<ul class="contact">${rows.join('')}</ul>` : contactForm ? '' : `<p>No contact details have been added yet. Set <code>contact.email</code> and the <code>social</code> links in <code>site.config.js</code> and they will appear here.</p>`}
${form}
${contactForm ? '' : '<p>This site is static, so there is no contact form: it never collects your details.</p>'}
</div></article>`;
  emit('/contact/', T.page({ title: 'Contact', path: u('/contact/'), body, crumbs: [homeCrumb, { label: 'Contact' }], description: `Contact ${C.author?.name || C.name}.`, formOrigins: contactForm ? [contactForm.origin] : [] }));
}

// ── Font Tester ──────────────────────────────────────────────────────────────
{
  const ty = resolveTypography(C);
  const current = { head: ty['font-head'], body: ty['font-serif'], size: ty['reading-size'], lineHeight: Number(ty['reading-leading']), weight: Number(ty['head-weight']) };
  const body = `<section class="panel panel--top fonttester" id="fonttester"
  data-presets="${esc(JSON.stringify(fontPresets))}" data-families="${esc(JSON.stringify(fontFamilies))}" data-current="${esc(JSON.stringify(current))}">
${panelHead({ kicker: 'Typography', title: 'Font Tester', lede: 'Try heading and body fonts, text size and line spacing. Copy the result into site.config.js to restyle every article.' })}
<form class="ft__controls">
  <div class="field"><label for="ft-preset">Preset</label><select id="ft-preset"></select></div>
  <div class="field"><label for="ft-head">Heading font</label><select id="ft-head"></select></div>
  <div class="field"><label for="ft-body">Body font</label><select id="ft-body"></select></div>
  <div class="field"><label for="ft-weight">Heading weight</label><select id="ft-weight"><option value="400">400 Regular</option><option value="500">500</option><option value="600">600 Semibold</option><option value="700">700 Bold</option><option value="800">800 Extra bold</option><option value="900">900 Black</option></select></div>
  <div class="field"><label for="ft-size">Text size <output id="ft-size-v"></output></label><input id="ft-size" type="range" min="14" max="24" step="1" value="18"></div>
  <div class="field"><label for="ft-lead">Line spacing <output id="ft-lead-v"></output></label><input id="ft-lead" type="range" min="1.3" max="2.2" step="0.05" value="1.75"></div>
  <div class="field"><label for="ft-track">Heading letter-spacing <output id="ft-track-v"></output></label><input id="ft-track" type="range" min="-0.05" max="0.1" step="0.005" value="-0.02"></div>
  <div class="field field--wide"><label for="ft-headtext">Heading text</label><input id="ft-headtext" value="Notes on building better software"></div>
  <div class="field field--wide"><label for="ft-sample">Paragraph text</label><textarea id="ft-sample" rows="4">Good writing is mostly rewriting. Read it aloud, cut the sentence that does no work, and keep the one that a tired reader could still follow. The best typography disappears: people notice the ideas, not the font.</textarea></div>
</form>
<div class="ft__preview" id="ft-card" aria-live="polite">
  <p class="kicker">Programming</p>
  <h2 id="ft-title"></h2>
  <p id="ft-text"></p>
  <p><code>inline code</code> stays monospace, and <a href="${u('/')}">links</a> keep your link colour.</p>
</div>
<h2 class="block__title">Use it on your site</h2>
<p class="ft__hint">Open <code>site.config.js</code>, replace the <code>typography</code> block with this, then rebuild.</p>
<pre class="ft__code"><code id="ft-snippet"></code></pre>
<div class="editor__buttons"><button type="button" class="btn-solid" id="ft-copy">Copy setting</button></div>
<p id="ft-status" class="editor__status" role="status" aria-live="polite"></p>
<p class="ft__hint">Only fonts already installed on a device can be shown, so a font marked “not on this device” falls back to the next one in its list. That is why the site uses system fonts: nothing to download, nothing sent to a font service, and the page loads fast.</p>
</section>`;
  emit('/font-tester/', T.page({ title: 'Font Tester', path: u('/font-tester/'), body, wide: true, crumbs: [homeCrumb, { label: 'Font Tester' }],
    description: 'Preview heading and body fonts, text size and line spacing for the writing on this site.', scripts: ['font-tester.js'] }));
}

// ── Articles ─────────────────────────────────────────────────────────────────
/** If an article has a "FAQ" section (an h2 named FAQ, with a question per h3), describe it for search engines. */
function faqEntities(html) {
  const heads = [...html.matchAll(/<(h[23])\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ({ tag: m[1], text: htmlToText(m[2].replace(/<a class="anchor"[\s\S]*?<\/a>/g, '')), start: m.index, end: m.index + m[0].length }));
  const at = heads.findIndex((h) => h.tag === 'h2' && /^(faq|faqs|frequently asked questions)$/i.test(h.text));
  if (at < 0) return [];
  const out = [];
  // Questions written as expandable <details><summary>Question</summary>Answer</details> blocks (the Writer's FAQ button)
  const next2 = heads.slice(at + 1).find((h) => h.tag === 'h2');
  const section = html.slice(heads[at].end, next2 ? next2.start : html.length);
  for (const m of section.matchAll(/<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)) {
    const name = htmlToText(m[1]), answer = htmlToText(m[2]);
    if (name && answer) out.push({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text: answer.slice(0, 1500) } });
  }
  if (out.length) return out;
  for (let i = at + 1; i < heads.length && heads[i].tag === 'h3'; i++) {
    const stop = heads[i + 1] ? heads[i + 1].start : html.length;
    const answer = htmlToText(html.slice(heads[i].end, stop));
    if (heads[i].text && answer) out.push({ '@type': 'Question', name: heads[i].text, acceptedAnswer: { '@type': 'Answer', text: answer.slice(0, 1500) } });
  }
  return out;
}
function related(a) {
  return allArticles
    .filter((b) => b !== a && b.lang === a.lang)
    .map((b) => ({ b, score: (b.category === a.category ? 3 : 0) + b.tags.filter((t) => a.tags.includes(t)).length }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || y.b.date.localeCompare(x.b.date))
    .slice(0, 3)
    .map((x) => x.b);
}
allArticles.forEach((a) => {
  const sameLang = allArticles.filter((b) => b.lang === a.lang);
  const newer = sameLang[sameLang.indexOf(a) - 1];
  const older = sameLang[sameLang.indexOf(a) + 1];
  const authorPage = a.authorProfile && authorList.some((x) => x.slug === a.authorProfile.slug) ? `/authors/${a.authorProfile.slug}/` : '';
  const langLinks = a.alternates.length ? `<p class="langs"><span>${a.lang === defaultLang ? 'Also available in' : 'Other languages'}:</span> ${a.alternates.map((x) => `<a href="${u(x.url)}" hreflang="${esc(x.lang)}" lang="${esc(x.lang)}">${esc(langOf.get(x.lang)?.label || x.lang)}</a>`).join(' · ')}</p>` : '';
  const rel = related(a);
  const upNext = (a.seriesInfo && a.seriesInfo.parts[a.seriesInfo.index + 1]) || rel[0] || newer || older || null;
  const upNextKind = a.seriesInfo && a.seriesInfo.parts[a.seriesInfo.index + 1] ? `Next in the series · ${esc(a.seriesInfo.name)}` : 'Up next';
  const si = a.seriesInfo;
  const series = si ? `<details class="series" id="series-box" open>
    <summary><span class="series__label">Series · Part ${si.index + 1} of ${si.parts.length}</span><a class="series__name" href="${u(`/series/${si.slug}/`)}">${esc(si.name)}</a></summary>
    <ol class="series__list">${si.parts.map((p, i) => i === si.index ? `<li aria-current="page"><span>${esc(p.title)}</span></li>` : `<li><a href="${u(p.url)}">${esc(p.title)}</a></li>`).join('')}</ol>
    <p class="series__nav">${si.parts[si.index - 1] ? `<a rel="prev" href="${u(si.parts[si.index - 1].url)}">← Previous part</a>` : '<span></span>'}${si.parts[si.index + 1] ? `<a rel="next" href="${u(si.parts[si.index + 1].url)}">Next part →</a>` : ''}</p>
  </details>` : '';
  const cm = C.comments || {};
  const commentsOn = cm.enabled === true && cm.repo && cm.repoId && cm.categoryId && a.comments;
  const comments = commentsOn ? `<section class="comments" id="comments" aria-labelledby="h-comments">
    <h2 id="h-comments">Discussion</h2>
    <p>Comments are GitHub Discussions. Nothing is loaded from GitHub until you choose to.</p>
    <button type="button" class="btn" id="load-comments" data-repo="${esc(cm.repo)}" data-repo-id="${esc(cm.repoId)}" data-category="${esc(cm.category || '')}" data-category-id="${esc(cm.categoryId)}" data-mapping="${esc(cm.mapping || 'pathname')}" data-lang="${esc(cm.lang || C.language || 'en')}" data-reactions="${cm.reactions === false ? '0' : '1'}">Load comments</button>
    <div id="giscus-box"></div>
  </section>` : '';
  const sideToc = a.toc.length >= 3 ? `<nav class="side-toc" id="toc-side" aria-labelledby="h-toc-side"><h2 class="side-title" id="h-toc-side">On this page</h2><ol>${a.toc.map((h) => `<li class="toc__d${h.depth}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ol></nav>` : '';
  const toc = a.toc.length >= 3
    ? `<details class="toc" open><summary>Table of Contents</summary><ol class="toc__list">${a.toc.map((h) => `<li class="toc__d${h.depth}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ol></details>` : '';
  const fmtTime = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const audioBlock = a.audio ? `<section class="audio" aria-label="Listen to this article">
    <audio controls preload="none" src="${esc(/^\//.test(a.audio) ? u(a.audio) : a.audio)}" aria-label="${esc(a.audioTitle || a.title)}"></audio>
    ${a.chapters.length ? `<ol class="audio__chapters">${a.chapters.map((c) => `<li><button type="button" data-seek="${c.at}"><time>${fmtTime(c.at)}</time> ${esc(c.label)}</button></li>`).join('')}</ol>` : ''}
  </section>` : '';
  const changesBlock = a.changes.length ? `<details class="changes"><summary>What changed in this article <span>(${a.changes.length})</span></summary><ul>${a.changes.map((c) => `<li><time datetime="${c.date}">${fmtDate(c.date)}</time> ${esc(c.text)}</li>`).join('')}</ul></details>` : '';
  const stars = a.rating ? `<span class="byline__item stars" role="img" aria-label="Rated ${a.rating} out of 5">${'★'.repeat(Math.floor(a.rating))}${a.rating % 1 ? '½' : ''}<span aria-hidden="true" class="stars__off">${'★'.repeat(5 - Math.ceil(a.rating))}</span> <small>${a.rating}/5${a.reviewItem ? ` · ${esc(a.reviewItem)}` : ''}</small></span>` : '';
  const helpfulBlock = a.helpful && C.helpful?.enabled !== false && a.kind !== 'note' ? `<aside class="helpful" data-helpful="${esc(a.url)}" aria-labelledby="h-helpful"><h2 id="h-helpful" class="helpful__q">Was this helpful?</h2><div class="helpful__btns"><button type="button" data-vote="yes">Yes</button><button type="button" data-vote="no">Not really</button></div><p class="helpful__msg" role="status" aria-live="polite" hidden></p><p class="helpful__more" hidden>${C.contact ? `<a href="${u('/contact/')}">Tell me what was missing</a>` : ''}</p></aside>` : '';
  const body = `<article class="panel panel--top article${a.kind === 'note' ? ' article--note' : ''}${a.sheet ? ' article--sheet' : ''}" data-slug="${esc(a.slug)}">
  <header class="panel__head">
    <p class="kicker">${T.catLink(a.category)}</p>
    <h1 class="title">${esc(a.title)}</h1>
    ${a.cover ? `<figure class="cover"><img src="${esc(S.imgSrc(a.cover))}" alt="${esc(a.coverAlt)}" width="1200" height="630" decoding="async" fetchpriority="high"></figure>` : ''}
    ${a.subtitle || a.excerpt ? `<p class="lede">${esc(a.subtitle || a.excerpt)}</p>` : ''}
    ${langLinks}
    <div class="byline">
      <span class="byline__item">${authorPage ? `<a href="${u(authorPage)}" rel="author">${esc(a.author)}</a>` : esc(a.author)}</span>
      <span class="byline__item"><time datetime="${a.date}">${fmtDate(a.date)}</time></span>
      <span class="byline__item">${a.readingTime} min read</span>
      ${stars}
      ${vInfo?.views ? `<span class="byline__item" data-views="${esc(`${vInfo.origin}/counter/${encodeURIComponent(u(a.url))}.json`)}" hidden></span>` : ''}
      ${a.status ? `<span class="byline__item"><span class="chip chip--warn">${a.status === 'draft' ? 'Draft' : 'Scheduled'}</span></span>` : ''}
      ${a.updated ? `<span class="byline__item">Updated <time datetime="${a.updated}">${fmtDate(a.updated)}</time></span>` : ''}
      ${T.tagChips(a.tags)}
    </div>
  </header>
  <hr class="rule">
  ${series}
  ${audioBlock}
  ${toc}
  <div class="prose">${a.html}</div>
  ${changesBlock}
  ${helpfulBlock}
  ${T.shareBar(a)}
  ${T.hasNewsletter ? T.newsletterForm('article') : ''}
  ${upNext ? `<aside class="upnext" aria-labelledby="h-upnext"><h2 class="upnext__k" id="h-upnext">${upNextKind}</h2><a class="upnext__card" href="${u(upNext.url)}"><span class="upnext__title">${esc(upNext.title)}</span><span class="upnext__ex">${esc(upNext.excerpt)}</span><span class="upnext__meta">${esc(upNext.category)} · ${upNext.readingTime} min read ${icon('arrow', 14)}</span></a></aside>` : ''}
  ${comments}
  ${rel.length ? `<aside class="related" aria-labelledby="h-related"><h2 id="h-related">Related Articles</h2><ul>${rel.map((r) => `<li><a href="${u(r.url)}">${esc(r.title)}</a><span>${esc(r.category)} · ${r.readingTime} min read</span></li>`).join('')}</ul></aside>` : ''}
  <nav class="prevnext" aria-label="More articles">
    ${older ? `<a class="prevnext__item" rel="prev" href="${u(older.url)}"><small>← Older</small><span>${esc(older.title)}</span></a>` : '<span></span>'}
    ${newer ? `<a class="prevnext__item prevnext__item--next" rel="next" href="${u(newer.url)}"><small>Newer →</small><span>${esc(newer.title)}</span></a>` : '<span></span>'}
  </nav>
</article>`;
  emit(a.url, T.page({
    title: a.title, path: u(a.url), body, description: a.excerpt, bodyClass: `is-article${sideToc ? ' has-side-toc' : ''}`,
    progress: true, readMin: a.readingTime, social: a.social, media: /^https:/.test(a.audio) ? [new URL(a.audio).origin] : [], sideExtra: sideToc, ogImage: (shareable(a.cover) ? a.cover : a.autoOg) || undefined, lang: a.lang, features: a.features,
    alternates: [a, ...a.alternates], scripts: [...(commentsOn ? ['comments.js'] : []), ...(a.features.mermaid ? ['diagrams.js'] : [])],
    article: { published: a.date, modified: a.updated || a.date, section: a.category, tags: a.tags },
    crumbs: [homeCrumb, { label: 'Writing', href: '/writing/' }, { label: a.title }],
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: a.title, description: a.excerpt,
      datePublished: a.date, dateModified: a.updated || a.date, author: { '@type': 'Person', name: a.author, ...(authorPage ? { url: abs(u(authorPage)) } : {}) }, inLanguage: a.lang,
      mainEntityOfPage: { '@type': 'WebPage', '@id': abs(u(a.url)) }, keywords: a.tags.join(', '), articleSection: a.category,
      wordCount: a.text.split(/\s+/).length, image: shareable(a.cover) ? abs(S.imgSrc(a.cover)) : a.autoOg ? abs(u(a.autoOg)) : abs(u(C.seo?.ogImage || '/og-default.png')),
      ...(a.rating ? { review: { '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: a.rating, bestRating: 5, worstRating: 1 }, author: { '@type': 'Person', name: a.author }, itemReviewed: { '@type': 'Thing', name: a.reviewItem || a.title } } } : {}),
      ...(si ? { isPartOf: { '@type': 'CreativeWorkSeries', name: si.name, url: abs(u(`/series/${si.slug}/`)) }, position: si.index + 1 } : {}),
      publisher: { '@type': 'Organization', name: C.name, logo: { '@type': 'ImageObject', url: abs(u('/icon-512.png')) } },
    }, ...(faqEntities(a.html).length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqEntities(a.html) }] : [])],
  }));
});

// ── Best of ──────────────────────────────────────────────────────────────────
if (bestList.length) {
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Start here', title: 'Best of', lede: 'The articles worth reading first.' })}
<div class="cards">${bestList.map((a) => T.articleCard(a)).join('')}</div>
</section>`;
  emit('/best/', T.page({ title: 'Best of', path: u('/best/'), body, crumbs: [homeCrumb, { label: 'Best of' }], description: `The best articles on ${C.name}, chosen by the author.` }));
}

// ── Notes (short posts: `type: note` in the front matter) ───────────────────
{
  const notes = articles.filter((a) => a.kind === 'note');
  if (notes.length) {
    const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Short posts', title: 'Notes', lede: 'Quick thoughts and links that do not need a full article.' })}
<ul class="notes">${notes.map((a) => `<li id="n-${esc(a.slug)}"><div class="prose">${a.html.replace(/(\sid=")/g, `$1n-${a.slug}-`).replace(/(\shref="#)/g, `$1n-${a.slug}-`)}</div><p class="meta"><a href="${u(a.url)}"><time datetime="${a.date}">${fmtDate(a.date)}</time></a>${a.tags.length ? ' · ' + a.tags.map((t) => `<a href="${u(`/tags/${tagSlug(t)}/`)}">#${esc(t)}</a>`).join(' ') : ''}</p></li>`).join('')}</ul>
</section>`;
    emit('/notes/', T.page({ title: 'Notes', path: u('/notes/'), body, crumbs: [homeCrumb, { label: 'Notes' }], description: `Short notes from ${C.name}.`, feed: '/rss.xml' }));
  }
}

// ── Start here (an onboarding page assembled from the Best of list, series and topics) ──
if (C.startPage?.enabled !== false && articles.length >= 3) {
  const pick = bestList.length ? bestList.slice(0, 4) : articles.filter((a) => a.featured).concat(articles).filter((a, i, l) => l.indexOf(a) === i).slice(0, 3);
  const sp = C.startPage || {};
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'New here?', title: sp.title || 'Start here', lede: esc(sp.lede || `${C.name} is ${C.description.replace(/\.$/, '').replace(/^A /, 'a ')}. Here is a short way in.`) })}
<h2 class="startsec">${bestList.length ? 'The articles to read first' : 'Good places to begin'}</h2>
<div class="cards">${pick.map((a) => T.articleCard(a, { level: 3 })).join('')}</div>
${seriesList.length ? `<h2 class="startsec">Read in order</h2><ul class="catgrid">${seriesList.map((sr) => `<li><a href="${u(`/series/${sr.slug}/`)}"><span class="catgrid__name">${esc(sr.name)}</span><span class="count">${sr.parts.length}</span><span class="catgrid__desc">${esc(C.series?.[sr.name] || 'A series, in reading order.')}</span></a></li>`).join('')}</ul>` : ''}
<h2 class="startsec">Browse by topic</h2>
<ul class="catgrid">${categories.slice(0, 8).map((c) => `<li><a href="${u(`/categories/${c.slug}/`)}"><span class="catgrid__name">${esc(c.name)}</span><span class="count">${c.count}</span><span class="catgrid__desc">${esc(c.description || '')}</span></a></li>`).join('')}</ul>
<h2 class="startsec">Follow along</h2>
<p>Use the <a href="${u('/rss.xml')}">RSS feed</a>, <a href="${u('/atom.xml')}">Atom</a> or <a href="${u('/feed.json')}">JSON Feed</a> in any feed reader, or follow a single topic from its page. <a href="${u('/search/')}">Search</a> finds anything by title or text.</p>
</section>`;
  emit('/start/', T.page({ title: sp.title || 'Start here', path: u('/start/'), body, crumbs: [homeCrumb, { label: sp.title || 'Start here' }], description: `A short guide to ${C.name}: where to begin, what to read in order, and how to follow along.` }));
}

// ── Authors ──────────────────────────────────────────────────────────────────
if (authorList.length) {
  const linkRows = (p) => (p.links || []).filter((l) => l.href && /^https?:\/\//i.test(l.href)).map((l) => `<li><a href="${esc(l.href)}" rel="me noopener noreferrer" target="_blank">${esc(l.label || l.href)}</a></li>`).join('');
  if (authorList.length > 1) {
    const body = `<section class="panel panel--top">
${panelHead({ kicker: 'The writers', title: 'Authors', lede: 'Everyone who writes here.' })}
<ul class="catgrid">${authorList.map((p) => `<li><a href="${u(`/authors/${p.slug}/`)}"><span class="catgrid__name">${esc(p.name)}</span><span class="count">${p.articles.length}</span><span class="catgrid__desc">${esc(p.bio || '')}</span></a></li>`).join('')}</ul>
</section>`;
    emit('/authors/', T.page({ title: 'Authors', path: u('/authors/'), body, crumbs: [homeCrumb, { label: 'Authors' }], description: `The writers at ${C.name}.` }));
  }
  for (const p of authorList) {
    const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Author', title: p.name, lede: esc(p.bio || `${p.articles.length} article${p.articles.length === 1 ? '' : 's'} by ${p.name}.`) })}
${linkRows(p) ? `<ul class="chips author__links">${linkRows(p)}</ul>` : ''}
<div class="cards">${p.articles.map((a) => T.articleCard(a)).join('')}</div>
</section>`;
    emit(`/authors/${p.slug}/`, T.page({
      title: p.name, path: u(`/authors/${p.slug}/`), body, description: p.bio || `Articles by ${p.name}.`,
      crumbs: [homeCrumb, ...(authorList.length > 1 ? [{ label: 'Authors', href: '/authors/' }] : []), { label: p.name }],
      jsonld: { '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: { '@type': 'Person', name: p.name, description: p.bio || '', url: abs(u(`/authors/${p.slug}/`)), sameAs: (p.links || []).map((l) => l.href).filter((h) => /^https?:/i.test(h || '')) } },
    }), { sitemap: authorList.length > 1 });
  }
}

// ── Glossary ─────────────────────────────────────────────────────────────────
if (glossary.length) {
  const firstOf = new Map();
  for (const g of glossary) { const L = g.term[0].toUpperCase(); if (!firstOf.has(L)) firstOf.set(L, g.slug); }
  const letters = [...firstOf.keys()];
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Plain-language definitions', title: 'Glossary', lede: 'Terms used in the articles. In an article, the first mention of each is underlined; hover or focus it for the meaning.' })}
<nav class="az" aria-label="Jump to letter">${letters.map((l) => `<a href="#g-${esc(firstOf.get(l))}">${esc(l)}</a>`).join('')}</nav>
<dl class="glossary">${glossary.map((g) => `<dt id="g-${g.slug}">${esc(g.term)}${g.aliases.length ? ` <small>also: ${esc(g.aliases.join(', '))}</small>` : ''}</dt><dd>${g.html}</dd>`).join('')}</dl>
</section>`;
  emit('/glossary/', T.page({ title: 'Glossary', path: u('/glossary/'), body, crumbs: [homeCrumb, { label: 'Glossary' }], description: `Definitions of the terms used on ${C.name}.`,
    jsonld: { '@context': 'https://schema.org', '@type': 'DefinedTermSet', name: `${C.name} glossary`, hasDefinedTerm: glossary.map((g) => ({ '@type': 'DefinedTerm', name: g.term, description: g.tip })) } }));
}

// ── Projects ─────────────────────────────────────────────────────────────────
if (projects.length) {
  const links = (p) => `${p.link ? `<a class="btn" href="${esc(p.link)}" rel="noopener noreferrer" target="_blank">Visit</a>` : ''}${p.repo ? `<a class="btn btn--ghost" href="${esc(p.repo)}" rel="noopener noreferrer" target="_blank">Source code</a>` : ''}`;
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Things I have built', title: 'Projects', lede: 'Tools, experiments and longer pieces of work.' })}
<div class="projects">${projects.map((p) => `<article class="project">
  ${p.cover ? `<a class="project__cover" href="${u(p.url)}" tabindex="-1" aria-hidden="true"><img src="${esc(imgSrc(p.cover))}" alt="" width="1200" height="630" loading="lazy" decoding="async"></a>` : ''}
  <h2 class="project__title"><a href="${u(p.url)}">${esc(p.title)}</a>${p.status ? ` <span class="chip">${esc(p.status)}</span>` : ''}</h2>
  <p>${esc(p.summary)}</p>
  ${p.tech.length ? `<ul class="chips">${p.tech.map((t) => `<li><span>${esc(t)}</span></li>`).join('')}</ul>` : ''}
</article>`).join('')}</div>
</section>`;
  emit('/projects/', T.page({ title: 'Projects', path: u('/projects/'), body, crumbs: [homeCrumb, { label: 'Projects' }], description: `Projects by ${C.author?.name || C.name}.` }));
  for (const p of projects) {
    const b = `<article class="panel panel--top">
${panelHead({ kicker: p.status ? esc(p.status) : 'Project', title: p.title, lede: esc(p.summary) })}
${p.cover ? `<figure class="cover"><img src="${esc(imgSrc(p.cover))}" alt="${esc(p.coverAlt)}" width="1200" height="630" decoding="async"></figure>` : ''}
${p.tech.length ? `<ul class="chips">${p.tech.map((t) => `<li><span>${esc(t)}</span></li>`).join('')}</ul>` : ''}
<div class="prose">${p.html}</div>
<p class="project__links">${links(p)}</p>
</article>`;
    emit(p.url, T.page({ title: p.title, path: u(p.url), body: b, crumbs: [homeCrumb, { label: 'Projects', href: '/projects/' }, { label: p.title }], description: p.summary || `${p.title} — a project by ${C.author?.name || C.name}.` }));
  }
}

// ── Reading list (saved in the reader's own browser) ─────────────────────────
{
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Saved on this device', title: 'Reading list', lede: 'Articles you saved with “Save for later”. The list lives only in this browser; nothing is sent anywhere.' })}
<p class="streak" data-streak hidden></p>
<div id="bookmarks" data-home="${esc(u('/writing/'))}" aria-live="polite"><p>Loading…</p></div>
<p id="bookmarks-tools" class="share"></p>
<noscript><p>The reading list needs JavaScript. Your saved articles stay in this browser.</p></noscript>
</section>`;
  emit('/bookmarks/', T.page({ title: 'Reading list', path: u('/bookmarks/'), body, crumbs: [homeCrumb, { label: 'Reading list' }], description: 'Articles saved to read later.', noindex: true, scripts: ['bookmarks.js'] }), { sitemap: false });
}

// ── Other languages ──────────────────────────────────────────────────────────
for (const l of languages.slice(1)) {
  const list = translations.filter((a) => a.lang === l.code);
  if (!list.length) continue;
  const body = `<section class="panel panel--top">
${panelHead({ kicker: esc(l.label), title: l.label, lede: `${list.length} article${list.length === 1 ? '' : 's'} in ${esc(l.label)}.` })}
<div class="cards">${list.map((a) => T.articleCard(a)).join('')}</div>
</section>`;
  emit(`/${l.code}/`, T.page({ title: l.label, path: u(`/${l.code}/`), body, lang: l.code, crumbs: [homeCrumb, { label: l.label }], description: `${C.name} in ${l.label}.`,
    alternates: [{ lang: defaultLang, url: '/' }, ...languages.slice(1).filter((x) => translations.some((a) => a.lang === x.code)).map((x) => ({ lang: x.code, url: `/${x.code}/` }))] }));
}

// ── Series pages ─────────────────────────────────────────────────────────────
if (seriesList.length) {
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Multi-part writing', title: 'Series', lede: 'Articles that belong together, in reading order.' })}
<ul class="catgrid">${seriesList.map((sr) => `<li><a href="${u(`/series/${sr.slug}/`)}"><span class="catgrid__name">${esc(sr.name)}</span><span class="count">${sr.parts.length}</span><span class="catgrid__desc">${sr.parts.length} part${sr.parts.length === 1 ? '' : 's'}</span></a></li>`).join('')}</ul>
</section>`;
  emit('/series/', T.page({ title: 'Series', path: u('/series/'), body, crumbs: [homeCrumb, { label: 'Series' }], description: `Multi-part series on ${C.name}.` }));
  for (const sr of seriesList) {
    const b = `<section class="panel panel--top">
${panelHead({ kicker: 'Series', title: sr.name, lede: esc(C.series?.[sr.name] || `${sr.parts.length} part${sr.parts.length === 1 ? '' : 's'}, in reading order.`) })}
<p class="series-start"><a class="btn" href="${u(sr.parts[0].url)}">Start with part 1 ${icon('arrow', 14)}</a> <span>${sr.parts.length} part${sr.parts.length === 1 ? '' : 's'} · about ${sr.parts.reduce((n, p) => n + p.readingTime, 0)} min in all</span></p>
<ol class="series-parts">${sr.parts.map((p, i) => `<li><span class="series-parts__n" aria-hidden="true">${i + 1}</span>${T.articleCard(p, { level: 2 })}</li>`).join('')}</ol>
</section>`;
    emit(`/series/${sr.slug}/`, T.page({ title: `${sr.name} (series)`, path: u(`/series/${sr.slug}/`), body: b,
      crumbs: [homeCrumb, { label: 'Series', href: '/series/' }, { label: sr.name }], description: `All ${sr.parts.length} parts of the ${sr.name} series.` }));
  }
}

// ── Offline page (shown by the service worker when a page is not available offline) ──
if (offlineOn) {
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'No connection', title: 'You are offline', lede: 'This page has not been saved on this device yet.' })}
<div class="prose"><p>Pages you have already opened still work offline. Articles you pressed <strong>Save for later</strong> on are kept for offline reading:</p></div>
<div id="bookmarks" data-home="${esc(u('/writing/'))}" aria-live="polite"><p>Loading…</p></div>
<p><a class="btn" href="${u('/')}">Try the home page</a></p>
</section>`;
  emit('/offline/', T.page({ title: 'Offline', path: u('/offline/'), body, wide: true, noindex: true, description: 'You are offline.', scripts: ['bookmarks.js'] }), { sitemap: false });
}

// ── 404 ──────────────────────────────────────────────────────────────────────
emit('/404.html', T.page({
  title: 'Page not found', path: u('/404.html'), noindex: true,
  body: `<section class="panel panel--top">
${panelHead({ kicker: 'Error 404', title: 'Page not found', lede: 'That page does not exist, or it has moved.' })}
<div class="prose"><p>Try searching, or head back to one of these:</p>
<ul><li><a href="${u('/')}">Home</a></li><li><a href="${u('/writing/')}">All writing</a></li><li><a href="${u('/categories/')}">Categories</a></li><li><a href="${u('/search/')}">Search</a></li>${articles.length > 1 ? `<li><a href="${u('/writing/')}" data-random data-index="${esc(searchUrl)}">A random article</a></li>` : ''}</ul></div>
</section>`,
  scripts: ['random.js'],
}), { sitemap: false });

// ── Feeds ────────────────────────────────────────────────────────────────────
{
  const absolutise = (h) => h.replace(/(\s(?:href|src))="\/(?!\/)/g, `$1="${siteUrl}/`).replace(/(\ssrcset=")([^"]+)"/g, (m, a, v) => a + v.replace(/(^|,\s*)\//g, `$1${siteUrl}/`) + '"');
  const toItem = (a) => ({ title: a.title, url: abs(u(a.url)), date: a.date, updated: a.updated, category: a.category, excerpt: a.excerpt, tags: a.tags || [], html: C.feed?.fullText ? absolutise(a.html) : '' });
  const feedCtx = (title, description, selfPath, list) => ({ title, description, language: C.language, home: abs(u('/')), self: abs(u(selfPath)), items: list.slice(0, 30).map(toItem), fullText: !!C.feed?.fullText, author: C.author?.name });
  const main = (p, list = articles, title = C.name, desc = C.description) => {
    const ctx = feedCtx(title, desc, p, list);
    fs.mkdirSync(path.dirname(path.join(DIST, p)), { recursive: true });
    fs.writeFileSync(path.join(DIST, p), rssXml(ctx));
    if (p === '/rss.xml') {
      fs.writeFileSync(path.join(DIST, 'atom.xml'), atomXml({ ...ctx, self: abs(u('/atom.xml')) }));
      fs.writeFileSync(path.join(DIST, 'feed.json'), jsonFeed({ ...ctx, self: abs(u('/feed.json')) }));
    }
  };
  main('/rss.xml');
  if (C.feed?.perTopic !== false) {
    for (const c of categories) main(`/categories/${c.slug}/rss.xml`, c.articles, `${C.name} — ${c.name}`, c.description || `${c.name} articles from ${C.name}.`);
    for (const t of tags) main(`/tags/${t.slug}/rss.xml`, t.articles, `${C.name} — #${t.name}`, `Articles tagged ${t.name}.`);
  }
  const latest = articles[0]?.date;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${emitted.map((p) => {
    const a = allArticles.find((x) => x.url === p);
    return `  <url><loc>${esc(abs(u(p)))}</loc>${a ? `<lastmod>${a.updated || a.date}</lastmod>` : latest ? `<lastmod>${latest}</lastmod>` : ''}</url>`;
  }).join('\n')}
</urlset>
`);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${abs(u('/sitemap.xml'))}\n`);
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
  fs.writeFileSync(path.join(DIST, 'manifest.webmanifest'), JSON.stringify({
    name: C.name, short_name: C.name.length > 12 ? C.name.split(' ')[0] : C.name, description: C.description,
    start_url: u('/'), scope: u('/'), display: 'standalone', background_color: C.theme.bg, theme_color: C.theme['header-bg'],
    icons: [{ src: u('/icon-192.png'), sizes: '192x192', type: 'image/png' }, { src: u('/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
  }, null, 2));
}

// ── Assets: tokens, CSS, JS, public files ────────────────────────────────────
{
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'assets/tokens.css'), tokensCss(C));
  for (const f of ['theme.css', 'site.js', 'font-tester.js', 'comments.js', 'bookmarks.js', 'diagrams.js', 'random.js']) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(DIST, 'assets', f));
  // Diagram library: only shipped when an article actually uses a ```mermaid block
  if (allArticles.some((a) => a.features.mermaid)) {
    const src = path.join(ROOT, 'node_modules/mermaid/dist/mermaid.min.js');
    if (!fs.existsSync(src)) fail('An article uses a mermaid diagram but the "mermaid" package is not installed. Run npm install.');
    fs.mkdirSync(path.join(DIST, 'assets/vendor'), { recursive: true });
    fs.copyFileSync(src, path.join(DIST, 'assets/vendor/mermaid.min.js'));
  }
  // Reading fonts (only downloaded by a browser when a reader picks them)
  fs.mkdirSync(path.join(DIST, 'assets/fonts'), { recursive: true });
  for (const [pkg, name] of [['atkinson-hyperlegible', 'atkinson'], ['opendyslexic', 'opendyslexic']]) {
    for (const w of [400, 700]) {
      const f = path.join(ROOT, `node_modules/@fontsource/${pkg}/files/${pkg}-latin-${w}-normal.woff2`);
      if (fs.existsSync(f)) fs.copyFileSync(f, path.join(DIST, `assets/fonts/${name}-${w}.woff2`));
    }
  }
  if (fs.existsSync(ogOut)) fs.cpSync(ogOut, path.join(DIST, 'images/_og'), { recursive: true });
  if (offlineOn) {
    const precache = ['/offline/', '/bookmarks/', C.logo.src, C.logo.favicon, '/icon-192.png', '/manifest.webmanifest', asset('tokens.css').replace(u(''), ''), asset('theme.css').replace(u(''), ''), asset('site.js').replace(u(''), ''), asset('bookmarks.js').replace(u(''), ''), asset('random.js').replace(u(''), '')].map((x) => u(x.startsWith('/') ? x : '/' + x));
    const version = sha(JSON.stringify([assetVer, searchUrl, precache]));
    fs.writeFileSync(path.join(DIST, 'sw.js'), fs.readFileSync(path.join(ROOT, 'src/sw.js'), 'utf8')
      .replace('__VERSION__', version).replace('__SCOPE__', u('/')).replace('__OFFLINE__', u('/offline/')).replace('__PRECACHE__', JSON.stringify(precache)));
  }
  const cms = guard(() => cmsInfo(C, { repo, siteUrl }));
  if (cms) {
    fs.mkdirSync(path.join(DIST, 'admin'), { recursive: true });
    fs.writeFileSync(path.join(DIST, 'admin/index.html'), adminHtml(C));
    fs.writeFileSync(path.join(DIST, 'admin/config.yml'), adminConfig(C, { ...cms, base }));
  }
  if (fs.existsSync(path.join(cacheDir, '_opt'))) fs.cpSync(path.join(cacheDir, '_opt'), path.join(DIST, 'images/_opt'), { recursive: true });
  if (fs.existsSync(path.join(ROOT, 'public'))) fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });
}

if (scheduled.length) console.log(`⏰ ${scheduled.length} scheduled article${scheduled.length === 1 ? '' : 's'} not published yet (they go live on their date):\n   ${scheduled.join('\n   ')}`);
console.log(`✔ ${C.name}: ${articles.length} articles, ${categories.length} categories, ${tags.length} tags → dist/  (base "${base || '/'}", url ${siteUrl})`);
