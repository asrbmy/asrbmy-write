// ASRBMY Write — static site builder.
//   content/articles/*.md  →  dist/articles/<slug>/index.html (+ indexes, feeds, search index)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFrontmatter, renderMarkdown, htmlToText, esc, slugify } from './markdown.js';
import { createTemplates, icon } from './templates.js';
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

const u = (p) => base + p;
const abs = (p) => siteUrl + p;
const fmtDate = (d) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));

// ── Load articles ────────────────────────────────────────────────────────────
const defaults = { author: C.author?.name, category: 'Notes', featured: false, ...(C.defaults || {}) };
const includeDrafts = !!process.env.INCLUDE_DRAFTS;
const fail = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

const articleDir = path.join(ROOT, 'content/articles');
const articles = [];
for (const file of fs.readdirSync(articleDir).filter((f) => f.endsWith('.md')).sort()) {
  const src = fs.readFileSync(path.join(articleDir, file), 'utf8');
  const { data: fm, body } = parseFrontmatter(src);
  const where = `content/articles/${file}`;
  if (fm.draft === true && !includeDrafts) continue;
  if (!fm.title) fail(`${where}: missing "title" in front matter`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fm.date || ''))) fail(`${where}: "date" must look like 2025-04-26`);
  const slug = slugify(fm.slug || file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, ''));
  const category = String(fm.category || defaults.category);
  const tags = Array.isArray(fm.tags) ? fm.tags : fm.tags ? [fm.tags] : [];
  const { html, toc } = renderMarkdown(body, { base });
  const text = htmlToText(html);
  const firstPara = htmlToText((html.match(/<p>([\s\S]*?)<\/p>/) || [, ''])[1]);
  const excerpt = String(fm.excerpt || (firstPara.length > 180 ? firstPara.slice(0, 177).trimEnd() + '…' : firstPara));
  articles.push({
    file, slug, url: `/articles/${slug}/`, title: String(fm.title), subtitle: fm.subtitle ? String(fm.subtitle) : '',
    date: String(fm.date), updated: fm.updated ? String(fm.updated) : '',
    author: String(fm.author || defaults.author), category, tags, featured: fm.featured === true,
    excerpt, html, toc, text,
    readingTime: Number(fm.readingTime) || Math.max(1, Math.round(text.split(/\s+/).length / 220)),
  });
}
const slugs = new Set();
for (const a of articles) {
  if (slugs.has(a.slug)) fail(`Duplicate article slug "${a.slug}" (${a.file})`);
  slugs.add(a.slug);
}
articles.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

// ── Taxonomies ───────────────────────────────────────────────────────────────
const catSlug = (n) => slugify(n);
const tagSlug = (n) => slugify(n);
const catMap = new Map();
const tagMap = new Map();
for (const a of articles) {
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

// ── Social links ─────────────────────────────────────────────────────────────
const social = (C.social || [])
  .map((s) => ({ ...s, href: s.href || (s.icon === 'github' && repo ? `https://github.com/${repo}` : '') }))
  .filter((s) => s.href)
  .map((s) => ({ ...s, href: s.href.startsWith('/') ? u(s.href) : s.href }));
// footer templates re-wrap root-relative hrefs; keep them root-relative there
const socialForTemplate = (C.social || [])
  .map((s) => ({ ...s, href: s.href || (s.icon === 'github' && repo ? `https://github.com/${repo}` : '') }))
  .filter((s) => s.href);

const S = { config: C, base, siteUrl, u, abs, fmtDate, articles, categories, tags, catSlug, tagSlug, social: socialForTemplate };
const T = createTemplates(S);

// ── Output helpers ───────────────────────────────────────────────────────────
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const emitted = [];
function emit(sitePath, content, { sitemap = true } = {}) {
  const file = sitePath.endsWith('/') ? `${sitePath}index.html` : sitePath;
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
${featured ? `<section class="panel panel--top block" aria-labelledby="h-featured"><h2 class="block__title" id="h-featured">Featured</h2>${T.articleCard(featured, { featured: true })}</section>` : ''}
<section class="panel panel--top block" aria-labelledby="h-latest">
  <h2 class="block__title" id="h-latest">Latest writing</h2>
  <div class="cards">${latest.map((a) => T.articleCard(a)).join('')}</div>
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
</section>`;
    emit(`/categories/${c.slug}/`, T.page({ title: c.name, path: u(`/categories/${c.slug}/`), body: b,
      crumbs: [homeCrumb, { label: 'Categories', href: '/categories/' }, { label: c.name }], description: c.description || `${c.name} articles from ${C.name}.` }));
  }
}

// ── Tags ─────────────────────────────────────────────────────────────────────
{
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Browse by tag', title: 'Tags', lede: 'Smaller topics that cut across categories.' })}
<ul class="chips chips--lg">${tags.map((t) => `<li><a href="${u(`/tags/${t.slug}/`)}">${esc(t.name)} <span>${t.count}</span></a></li>`).join('')}</ul>
</section>`;
  emit('/tags/', T.page({ title: 'Tags', path: u('/tags/'), body, crumbs: [homeCrumb, { label: 'Tags' }], description: `All tags used on ${C.name}.` }));
  for (const t of tags) {
    const b = `<section class="panel panel--top">
${panelHead({ kicker: 'Tag', title: `#${t.name}`, lede: `${t.count} article${t.count === 1 ? '' : 's'} tagged “${esc(t.name)}”.` })}
<div class="cards">${t.articles.map((a) => T.articleCard(a)).join('')}</div>
</section>`;
    emit(`/tags/${t.slug}/`, T.page({ title: `#${t.name}`, path: u(`/tags/${t.slug}/`), body: b,
      crumbs: [homeCrumb, { label: 'Tags', href: '/tags/' }, { label: t.name }], description: `Articles tagged ${t.name}.`, noindex: t.count < 3 }), { sitemap: false });
  }
}

// ── Archive ──────────────────────────────────────────────────────────────────
{
  const byYear = new Map();
  for (const a of articles) {
    const y = a.date.slice(0, 4);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(a);
  }
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Everything, by date', title: 'Archive', lede: `${articles.length} article${articles.length === 1 ? '' : 's'} since ${articles.length ? fmtDate(articles[articles.length - 1].date).slice(-4) : '—'}.` })}
${[...byYear.entries()].map(([y, list]) => `<section class="archive__year" aria-labelledby="y-${y}"><h2 id="y-${y}">${y}</h2><ul class="archive__list">${list.map((a) => `<li><time datetime="${a.date}">${fmtDate(a.date).replace(/, \d{4}$/, '')}</time><a href="${u(a.url)}">${esc(a.title)}</a><span class="archive__cat">${esc(a.category)}</span></li>`).join('')}</ul></section>`).join('')}
</section>`;
  emit('/archive/', T.page({ title: 'Archive', path: u('/archive/'), body, crumbs: [homeCrumb, { label: 'Archive' }], description: `Every article on ${C.name}, by date.` }));
}

// ── Search ───────────────────────────────────────────────────────────────────
{
  const body = `<section class="panel panel--top">
${panelHead({ kicker: 'Find an article', title: 'Search', lede: 'Searches titles, excerpts, categories, tags and the full text.' })}
<div id="search-app" data-index="${u('/search-index.json')}">
  <form class="search-form" role="search" action="${u('/search/')}" method="get">
    <label class="sr-only" for="q">Search</label>
    <input id="q" name="q" type="search" placeholder="Search articles…" autocomplete="off" autofocus>
    <button type="submit" class="btn-solid">Search</button>
  </form>
  <p id="search-status" class="search-status" role="status" aria-live="polite"></p>
  <ol id="search-results" class="results"></ol>
  <noscript><p>Search needs JavaScript. You can browse <a href="${u('/writing/')}">all articles</a> instead.</p></noscript>
</div>
</section>`;
  emit('/search/', T.page({ title: 'Search', path: u('/search/'), body, crumbs: [homeCrumb, { label: 'Search' }], description: `Search ${C.name}.`, noindex: true }), { sitemap: false });
  fs.writeFileSync(path.join(DIST, 'search-index.json'), JSON.stringify(articles.map((a) => ({
    t: a.title, u: u(a.url), c: a.category, g: a.tags, e: a.excerpt, d: a.date, r: a.readingTime, x: a.text,
  }))));
}

// ── Static pages from content/pages ──────────────────────────────────────────
const pageVars = { name: C.name, author: C.author?.name || '', bio: C.author?.bio || '', description: C.description, tagline: C.tagline, url: siteUrl };
const pagesDir = path.join(ROOT, 'content/pages');
for (const file of fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir).filter((f) => f.endsWith('.md')) : []) {
  const { data: fm, body: md } = parseFrontmatter(fs.readFileSync(path.join(pagesDir, file), 'utf8'));
  const slug = slugify(fm.slug || file.replace(/\.md$/, ''));
  const sub = (v) => String(v ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in pageVars ? pageVars[k] : m));
  const { html } = renderMarkdown(md, { base, vars: pageVars });
  const body = `<article class="panel panel--top">
${panelHead({ kicker: fm.kicker ? esc(sub(fm.kicker)) : '', title: sub(fm.title || slug), lede: fm.lede ? esc(sub(fm.lede)) : '' })}
<div class="prose">${html}</div>
</article>`;
  emit(`/${slug}/`, T.page({ title: sub(fm.title || slug), path: u(`/${slug}/`), body, crumbs: [homeCrumb, { label: sub(fm.title || slug) }], description: sub(fm.description || C.description) }));
}

// ── Contact (generated from config) ──────────────────────────────────────────
{
  const rows = [];
  if (C.contact?.email) rows.push(`<li><span class="contact__k">Email</span><a href="mailto:${esc(C.contact.email)}">${esc(C.contact.email)}</a></li>`);
  for (const s of social) if (s.icon !== 'rss') rows.push(`<li><span class="contact__k">${esc(s.label)}</span><a href="${esc(s.href)}" rel="noopener noreferrer" target="_blank">${esc(s.href.replace(/^https?:\/\//, ''))}</a></li>`);
  const body = `<article class="panel panel--top">
${panelHead({ kicker: 'Get in touch', title: 'Contact', lede: `The best way to reach ${esc(C.author?.name || C.name)}.` })}
<div class="prose">
${rows.length ? `<ul class="contact">${rows.join('')}</ul>` : `<p>No contact details have been added yet. Set <code>contact.email</code> and the <code>social</code> links in <code>site.config.js</code> and they will appear here.</p>`}
<p>This site is static, so there is no contact form — it never collects your details.</p>
</div></article>`;
  emit('/contact/', T.page({ title: 'Contact', path: u('/contact/'), body, crumbs: [homeCrumb, { label: 'Contact' }], description: `Contact ${C.author?.name || C.name}.` }));
}

// ── Font Tester ──────────────────────────────────────────────────────────────
{
  const ty = resolveTypography(C);
  const current = { head: ty['font-head'], body: ty['font-serif'], size: ty['reading-size'], lineHeight: Number(ty['reading-leading']), weight: Number(ty['head-weight']) };
  const body = `<section class="panel panel--top fonttester" id="fonttester"
  data-presets="${esc(JSON.stringify(fontPresets))}" data-families="${esc(JSON.stringify(fontFamilies))}" data-current="${esc(JSON.stringify(current))}">
${panelHead({ kicker: 'Typography', title: 'Font Tester', lede: 'Try heading and body fonts, text size and line spacing. Copy the result into site.config.js to restyle every article.' })}
<form class="ft__controls" onsubmit="return false">
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
    description: 'Preview heading and body fonts, text size and line spacing for the writing on this site.', scripts: ['/assets/font-tester.js'] }));
}

// ── Articles ─────────────────────────────────────────────────────────────────
function related(a) {
  return articles
    .filter((b) => b !== a)
    .map((b) => ({ b, score: (b.category === a.category ? 3 : 0) + b.tags.filter((t) => a.tags.includes(t)).length }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || y.b.date.localeCompare(x.b.date))
    .slice(0, 3)
    .map((x) => x.b);
}
articles.forEach((a, i) => {
  const newer = articles[i - 1];
  const older = articles[i + 1];
  const rel = related(a);
  const toc = a.toc.length >= 3
    ? `<details class="toc" open><summary>Table of Contents</summary><ol class="toc__list">${a.toc.map((h) => `<li class="toc__d${h.depth}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ol></details>` : '';
  const body = `<article class="panel panel--top article">
  <header class="panel__head">
    <p class="kicker">${T.catLink(a.category)}</p>
    <h1 class="title">${esc(a.title)}</h1>
    ${a.subtitle || a.excerpt ? `<p class="lede">${esc(a.subtitle || a.excerpt)}</p>` : ''}
    <div class="byline">
      <span class="byline__item">${esc(a.author)}</span>
      <span class="byline__item"><time datetime="${a.date}">${fmtDate(a.date)}</time></span>
      <span class="byline__item">${a.readingTime} min read</span>
      ${a.updated ? `<span class="byline__item">Updated <time datetime="${a.updated}">${fmtDate(a.updated)}</time></span>` : ''}
      ${T.tagChips(a.tags)}
    </div>
  </header>
  <hr class="rule">
  ${toc}
  <div class="prose">${a.html}</div>
  ${rel.length ? `<aside class="related" aria-labelledby="h-related"><h2 id="h-related">Related Articles</h2><ul>${rel.map((r) => `<li><a href="${u(r.url)}">${esc(r.title)}</a><span>${esc(r.category)} · ${r.readingTime} min read</span></li>`).join('')}</ul></aside>` : ''}
  <nav class="prevnext" aria-label="More articles">
    ${older ? `<a class="prevnext__item" rel="prev" href="${u(older.url)}"><small>← Older</small><span>${esc(older.title)}</span></a>` : '<span></span>'}
    ${newer ? `<a class="prevnext__item prevnext__item--next" rel="next" href="${u(newer.url)}"><small>Newer →</small><span>${esc(newer.title)}</span></a>` : '<span></span>'}
  </nav>
</article>`;
  emit(a.url, T.page({
    title: a.title, path: u(a.url), body, description: a.excerpt, bodyClass: 'is-article',
    article: { published: a.date, modified: a.updated || a.date, section: a.category, tags: a.tags },
    crumbs: [homeCrumb, { label: 'Writing', href: '/writing/' }, { label: a.title }],
    jsonld: {
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: a.title, description: a.excerpt,
      datePublished: a.date, dateModified: a.updated || a.date, author: { '@type': 'Person', name: a.author },
      mainEntityOfPage: { '@type': 'WebPage', '@id': abs(u(a.url)) }, keywords: a.tags.join(', '), articleSection: a.category,
      wordCount: a.text.split(/\s+/).length, inLanguage: C.language, image: abs(u(C.seo?.ogImage || '/og-default.png')),
      publisher: { '@type': 'Organization', name: C.name, logo: { '@type': 'ImageObject', url: abs(u('/icon-512.png')) } },
    },
  }));
});

// ── 404 ──────────────────────────────────────────────────────────────────────
emit('/404.html', T.page({
  title: 'Page not found', path: u('/404.html'), noindex: true,
  body: `<section class="panel panel--top">
${panelHead({ kicker: 'Error 404', title: 'Page not found', lede: 'That page does not exist, or it has moved.' })}
<div class="prose"><p>Try searching, or head back to one of these:</p>
<ul><li><a href="${u('/')}">Home</a></li><li><a href="${u('/writing/')}">All writing</a></li><li><a href="${u('/categories/')}">Categories</a></li><li><a href="${u('/search/')}">Search</a></li></ul></div>
</section>`,
}), { sitemap: false });

// ── Feeds ────────────────────────────────────────────────────────────────────
{
  const rfc = (d) => new Date(`${d}T00:00:00Z`).toUTCString();
  const items = articles.slice(0, 30).map((a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${esc(abs(u(a.url)))}</link>
      <guid isPermaLink="true">${esc(abs(u(a.url)))}</guid>
      <pubDate>${rfc(a.date)}</pubDate>
      <category>${esc(a.category)}</category>
      <description>${esc(a.excerpt)}</description>
    </item>`).join('\n');
  fs.writeFileSync(path.join(DIST, 'rss.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(C.name)}</title>
    <link>${esc(abs(u('/')))}</link>
    <description>${esc(C.description)}</description>
    <language>${esc(C.language)}</language>
    <atom:link href="${esc(abs(u('/rss.xml')))}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`);
  const latest = articles[0]?.date;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${emitted.map((p) => {
    const a = articles.find((x) => x.url === p);
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
  for (const f of ['theme.css', 'site.js', 'font-tester.js']) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(DIST, 'assets', f));
  if (fs.existsSync(path.join(ROOT, 'public'))) fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });
}

console.log(`✔ ${C.name}: ${articles.length} articles, ${categories.length} categories, ${tags.length} tags → dist/  (base "${base || '/'}", url ${siteUrl})`);
