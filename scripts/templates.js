// HTML templates. Every site-specific string comes from `S.config` / article data.
import crypto from 'node:crypto';
import { esc } from './markdown.js';
import { analyticsInfo, newsletterInfo } from './features.js';

// Runs before the page paints so a saved dark/light choice never flashes. Its hash is allowed in the CSP.
const THEME_SCRIPT = "try{var d=document.documentElement,t=localStorage.getItem('asrbmy-theme');if(t==='dark'||t==='light')d.setAttribute('data-theme',t);var r=JSON.parse(localStorage.getItem('asrbmy-reader')||'{}');['rs','rw','rf','rc'].forEach(function(k){if(/^[a-z]{2,8}$/.test(r[k]||''))d.setAttribute('data-'+k,r[k])})}catch(e){}";
const THEME_HASH = `'sha256-${crypto.createHash('sha256').update(THEME_SCRIPT).digest('base64')}'`;

const ICONS = {
  search: '<path d="M7 12.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Zm4-1.5 3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  moon: '<path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" fill="currentColor"/>',
  sun: '<circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
  arrow: '<path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  menu: '<path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  github: '<path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>',
  x: '<path fill="currentColor" d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/>',
  linkedin: '<path fill="currentColor" d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z"/>',
  mail: '<path d="M1.500 3.500h13v9h-13zM1.800 4l6.200 5 6.200-5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  link: '<path d="M6.500 9.500a3 3 0 0 0 4.200 0l2.300-2.300a3 3 0 0 0-4.200-4.200L7.700 4.100M9.500 6.500a3 3 0 0 0-4.200 0L3 8.800a3 3 0 0 0 4.200 4.200l1.100-1.100" fill="none" stroke="currentColor" stroke-width="1.400" stroke-linecap="round"/>',
  share: '<path d="M8 10V2M5 5l3-3 3 3M3 9v4.500h10V9" fill="none" stroke="currentColor" stroke-width="1.400" stroke-linecap="round" stroke-linejoin="round"/>',
  bookmark: '<path d="M3.500 1.500h9v13L8 11l-4.500 3.500z" fill="none" stroke="currentColor" stroke-width="1.400" stroke-linejoin="round"/>',
  print: '<path d="M4 6V1.500h8V6M4 11.500H1.500V6h13v5.500H12M4 9.500h8v5H4z" fill="none" stroke="currentColor" stroke-width="1.300" stroke-linejoin="round"/>',
  text: '<path d="M1.500 13 5.500 3l4 10M2.800 9.500h5.400M10.500 13l2.300-5.500 2.200 5.500M11.300 11.500h3" fill="none" stroke="currentColor" stroke-width="1.400" stroke-linecap="round" stroke-linejoin="round"/>',
  dice: '<rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.300"/><circle cx="5.500" cy="5.500" r="1" fill="currentColor"/><circle cx="10.500" cy="10.500" r="1" fill="currentColor"/><circle cx="8" cy="8" r="1" fill="currentColor"/>',
  rss: '<path d="M2 2.500a11.500 11.500 0 0 1 11.500 11.500M2 7a7 7 0 0 1 7 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="3" cy="13" r="1.4" fill="currentColor"/>',
};
export const icon = (name, size = 16) =>
  `<svg class="icon" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

export function createTemplates(S) {
  const { config: C, u } = S;
  const analytics = analyticsInfo(C);
  const newsletter = newsletterInfo(C);

  // ── Small helpers ──────────────────────────────────────────────────────────
  const catLink = (name) => `<a href="${u(`/categories/${S.catSlug(name)}/`)}">${esc(name)}</a>`;
  const tagChips = (tags = []) =>
    tags.length
      ? `<ul class="tags">${tags.map((t) => `<li><a href="${u(`/tags/${S.tagSlug(t)}/`)}">${esc(t)}</a></li>`).join('')}</ul>`
      : '';

  const metaLine = (a) =>
    `<p class="meta"><time datetime="${a.date}">${S.fmtDate(a.date)}</time><span aria-hidden="true">·</span><span>${a.readingTime} min read</span>${a.status ? `<span class="chip chip--warn">${a.status === 'draft' ? 'Draft' : 'Scheduled'}</span>` : ''}</p>`;

  // `level` is the heading level of the card title — 2 under a page <h1>, 3 under a section <h2>.
  function articleCard(a, { featured = false, level = 2 } = {}) {
    return `<article class="card${featured ? ' card--featured' : ''}${a.cover ? ' card--cover' : ''}">
  ${a.cover ? `<a class="card__cover" href="${u(a.url)}" tabindex="-1" aria-hidden="true"><img src="${esc(S.imgSrc(a.cover))}" alt="" width="1200" height="630" loading="lazy" decoding="async"></a>` : ''}
  <p class="kicker">${catLink(a.category)}${a.kind === 'note' ? ' <span class="chip chip--note">Note</span>' : ''}${a.rating ? ` <span class="chip chip--note" title="Rated ${a.rating} out of 5">★ ${a.rating}/5</span>` : ''}${a.audio ? ' <span class="chip chip--note">Audio</span>' : ''}</p>
  <h${level} class="card__title"><a href="${u(a.url)}">${esc(a.title)}</a></h${level}>
  <p class="card__excerpt">${esc(a.excerpt)}</p>
  <div class="card__foot">${metaLine(a)}${tagChips(a.tags)}</div>
</article>`;
  }

  const crumbs = (items) =>
    `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items
      .map((c, i) =>
        i === items.length - 1
          ? `<li aria-current="page">${esc(c.label)}</li>`
          : `<li><a href="${u(c.href)}">${esc(c.label)}</a></li>`)
      .join('')}</ol></nav>`;

  // ── Header & navigation ────────────────────────────────────────────────────
  const isActive = (item, path) => {
    const hrefs = [item.href, ...(item.match || [])].map((h) => u(h));
    const own = u(item.href);
    if (item.href === '/') return path === own;
    return hrefs.some((h) => path === h || path.startsWith(h));
  };

  function navChildren(item) {
    if (item.children === 'categories') {
      return S.categories.map((c) => ({ label: c.name, href: `/categories/${c.slug}/` }));
    }
    return item.children || [];
  }

  function nav(path) {
    const items = C.nav
      .filter((item) => S.hasRoute(item.href))
      .map((item, i) => {
        const kids = navChildren(item).filter((k) => S.hasRoute(k.href));
        const active = isActive(item, path) || kids.some((k) => path === u(k.href));
        const link = `<a class="nav__link" href="${u(item.href)}"${active ? ' aria-current="page"' : ''}>${esc(item.label)}</a>`;
        if (!kids.length) return `<li class="nav__item${active ? ' is-active' : ''}">${link}</li>`;
        const id = `sub-${i}`;
        return `<li class="nav__item has-sub${active ? ' is-active' : ''}">${link}
      <button type="button" class="nav__toggle" aria-expanded="false" aria-controls="${id}" aria-label="Toggle ${esc(item.label)} submenu"><span class="nav__sign" aria-hidden="true"></span></button>
      <ul class="nav__sub" id="${id}">${kids.map((k) => `<li><a href="${u(k.href)}"${path === u(k.href) ? ' aria-current="page"' : ''}>${esc(k.label)}</a></li>`).join('')}</ul></li>`;
      })
      .join('\n');
    return `<nav class="nav" id="site-nav" aria-label="Primary"><ul class="nav__list">${items}</ul></nav>`;
  }

  function header(path) {
    return `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header__inner">
    <a class="brand" href="${u('/')}" aria-label="${esc(C.name)} — home">
      <span class="brand__mark"><img src="${u(C.logo.src)}" alt="" width="40" height="40"></span>
      <span class="brand__text"><span class="brand__name">${esc(C.name)}</span><span class="brand__tag">${esc(C.tagline)}</span></span>
    </a>
    <div class="header__actions">
      ${(C.headerActions || []).map((a) => `<a class="btn-ghost${a.accent ? ' btn-ghost--accent' : ''}" href="${u(a.href)}">${esc(a.label)} ${icon('arrow', 14)}</a>`).join('\n      ')}
      ${C.reader?.enabled === false ? '' : `<button type="button" class="icon-btn" id="reader-btn" aria-label="Reading settings" aria-expanded="false" aria-controls="reader-panel" hidden>${icon('text', 18)}</button>`}
      <button type="button" class="icon-btn" id="theme-toggle" aria-label="Switch colour theme" aria-pressed="false">${icon('moon', 16)}</button>
      <button type="button" class="icon-btn menu-btn" id="menu-btn" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">${icon('menu', 18)}</button>
    </div>
  </div>
</header>
<div class="navbar"><div class="wrap">${nav(path)}</div></div>${C.reader?.enabled === false ? '' : readerPanel()}`;
  }

  // ── Reading settings (text size, width, font, contrast) — saved in the reader's browser ──
  function readerPanel() {
    const group = (id, label, opts) => `<fieldset class="reader__group"><legend>${label}</legend><div class="seg">${opts.map(([v, t, hint], i) =>
      `<label class="seg__opt"><input type="radio" name="${id}" value="${v}"${i === 0 ? ' checked' : ''}><span${hint ? ` title="${esc(hint)}"` : ''}>${t}</span></label>`).join('')}</div></fieldset>`;
    return `<div class="reader" id="reader-panel" role="dialog" aria-label="Reading settings" hidden>
  <div class="reader__head"><strong>Reading settings</strong><button type="button" class="reader__close" id="reader-close" aria-label="Close reading settings">×</button></div>
  ${group('rs', 'Text size', [['md', 'Normal'], ['lg', 'Large'], ['xl', 'Larger'], ['sm', 'Small']])}
  ${group('rw', 'Line width', [['full', 'Full'], ['medium', 'Medium'], ['narrow', 'Narrow']])}
  ${group('rf', 'Font', [['site', 'Site font'], ['sans', 'Easy-read', 'Atkinson Hyperlegible, designed for low vision'], ['dys', 'Dyslexia-friendly', 'OpenDyslexic']])}
  ${group('rc', 'Contrast', [['normal', 'Normal'], ['high', 'High']])}
  <p class="reader__foot"><button type="button" class="btn btn--ghost" id="reader-reset">Reset</button><span>Saved on this device only.</span></p>
</div>`;
  }

  // ── Newsletter form ────────────────────────────────────────────────────────
  function newsletterForm(where = 'article') {
    if (!newsletter) return '';
    const id = `nl-${where}`;
    return `<form class="newsletter" method="post" action="${esc(newsletter.action)}" target="_blank" rel="noopener noreferrer" aria-labelledby="${id}-t">
  <h2 class="newsletter__title" id="${id}-t">${esc(newsletter.title)}</h2>
  <p>${esc(newsletter.text)}</p>
  ${Object.entries(newsletter.hidden).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}
  <div class="newsletter__row">
    <label class="sr-only" for="${id}-e">Email address</label>
    <input id="${id}-e" type="email" name="${esc(newsletter.field)}" placeholder="${esc(newsletter.placeholder)}" autocomplete="email" required>
    <button type="submit" class="btn">${esc(newsletter.button)}</button>
  </div>
  <p class="newsletter__note">${esc(newsletter.note)}</p>
</form>`;
  }

  // ── Share / save / print bar ───────────────────────────────────────────────
  function shareBar(a) {
    const sh = C.share || {};
    if (sh.enabled === false) return '';
    const url = encodeURIComponent(S.abs(a.url ? u(a.url) : '/'));
    const title = encodeURIComponent(a.title);
    const links = {
      x: ['X', `https://twitter.com/intent/tweet?url=${url}&text=${title}`],
      linkedin: ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${url}`],
      whatsapp: ['WhatsApp', `https://wa.me/?text=${title}%20${url}`],
      facebook: ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${url}`],
      email: ['Email', `mailto:?subject=${title}&body=${url}`],
    };
    const targets = (sh.targets || ['x', 'linkedin', 'whatsapp', 'email']).filter((t) => links[t]);
    return `<div class="share" data-url="${esc(S.abs(u(a.url)))}" data-title="${esc(a.title)}" role="group" aria-label="Share, save or print this article">
  <button type="button" class="share__btn" data-copy>${icon('link', 14)} Copy link</button>
  <button type="button" class="share__btn" data-native hidden>${icon('share', 14)} Share…</button>
  ${targets.map((t) => `<a class="share__btn" href="${esc(links[t][1])}" rel="noopener noreferrer"${t === 'email' ? '' : ' target="_blank"'}>${esc(links[t][0])}</a>`).join('\n  ')}
  <button type="button" class="share__btn" data-bookmark aria-pressed="false">${icon('bookmark', 14)} <span>Save for later</span></button>
  <button type="button" class="share__btn" data-print>${icon('print', 14)} Print / PDF</button>
  ${a.sheet ? `<button type="button" class="share__btn" data-sheet>${icon('print', 14)} One-page sheet</button>` : ''}
  ${(a.toc || []).length >= 2 ? `<button type="button" class="share__btn" data-slides>${icon('text', 14)} Slides</button>` : ''}
  <span class="share__status" role="status" aria-live="polite"></span>
</div>`;
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────
  function sidebar(extra = '') {
    const sb = C.sidebar || {};
    const featured = sb.showFeatured ? S.articles.find((a) => a.featured) : null;
    const recent = S.articles.slice(0, sb.recentCount ?? 5);
    const promo = sb.promo;
    const start = sb.start;
    const best = sb.best === false ? [] : S.bestList.slice(0, sb.bestCount ?? 4);
    const bestBlock = best.length ? `<section class="side-block">
    <h2 class="side-title">${esc(sb.bestTitle || 'Best of')}</h2>
    <ul class="side-recent">${best.map((a) => `<li><a href="${u(a.url)}">${esc(a.title)}</a><span class="side-recent__meta">${esc(a.category)} · ${a.readingTime} min</span></li>`).join('')}</ul>
    <p class="more"><a href="${u('/best/')}">See all ${icon('arrow', 14)}</a></p>
  </section>` : '';
    const popBlock = S.popular ? `<section class="side-block">
    <h2 class="side-title">${esc(S.popular.title)}</h2>
    <ol class="side-recent side-popular">${S.popular.list.map((a) => `<li><a href="${u(a.url)}">${esc(a.title)}</a><span class="side-recent__meta">${esc(a.category)} · ${a.readingTime} min</span></li>`).join('')}</ol>
  </section>` : '';
    return `<aside class="sidebar" aria-label="Sidebar">
    ${extra}
  <section class="side-block">
    <h2 class="side-title">Search Articles</h2>
    <form class="side-search" role="search" action="${u('/search/')}" method="get">
      <label class="sr-only" for="side-q">Search articles</label>
      <input id="side-q" name="q" type="search" placeholder="Search…" autocomplete="off">
      <button type="submit" aria-label="Search">${icon('search', 15)}</button>
    </form>
  </section>
  ${promo ? `<section class="side-feature side-promo">
    <h2>${esc(promo.title)}</h2>
    ${promo.tagline ? `<p class="side-promo__tag">${esc(promo.tagline)}</p>` : ''}
    ${promo.text ? `<p>${esc(promo.text)}</p>` : ''}
    ${promo.button ? `<a class="btn-light" href="${u(promo.button.href)}">${esc(promo.button.label)}</a>` : ''}
    ${promo.note ? `<p class="side-promo__note">${esc(promo.note)}</p>` : ''}
  </section>` : ''}
  ${start ? `<section class="side-start">
    <h2 class="side-title">${esc(start.title)}</h2>
    <p>${esc(start.text)}</p>
    ${start.button ? `<a class="btn-dark" href="${u(start.button.href)}">${esc(start.button.label)}</a>` : ''}
  </section>` : ''}
  ${featured ? `<section class="side-feature">
    <h2>Featured</h2>
    <p class="side-feature__tag">${esc(featured.category)}</p>
    <p class="side-feature__title"><a href="${u(featured.url)}">${esc(featured.title)}</a></p>
    <p>${esc(featured.excerpt)}</p>
    <a class="btn-light" href="${u(featured.url)}">Read article</a>
  </section>` : ''}
  ${(sb.tools || []).length ? `<section class="side-block">
    <p class="side-label">${esc(sb.toolsLabel || 'Tools')}</p>
    <h2 class="side-title side-title--lg">${esc(sb.toolsTitle || 'Tools')}</h2>
    <ul class="side-tools">${sb.tools.filter((t) => S.hasRoute(t.href)).map((t) => `<li><a href="${u(t.href)}"><span class="side-tools__text"><strong>${esc(t.label)}</strong><small>${esc(t.desc || '')}</small></span><span class="badge">Tool</span></a></li>`).join('')}</ul>
  </section>` : ''}
  ${popBlock}
  ${bestBlock}
  ${newsletter && sb.newsletter ? `<section class="side-block">${newsletterForm('side')}</section>` : ''}
  ${(sb.downloads || []).length ? `<section class="side-block">
    <h2 class="side-title side-title--lg">Downloads</h2>
    <ul class="side-links side-links--plain">${sb.downloads.map((d) => `<li><a href="${d.href.startsWith('/') ? u(d.href) : esc(d.href)}">${esc(d.label)}</a></li>`).join('')}</ul>
  </section>` : ''}
  <section class="side-block">
    <h2 class="side-title side-title--lg">Browse by Topic</h2>
    <ul class="side-links side-links--count">
      <li><a href="${u('/writing/')}"><span>All Articles</span><span class="count">${S.articles.length}</span></a></li>
      ${S.categories.map((c) => `<li><a href="${u(`/categories/${c.slug}/`)}"><span>${esc(c.name)}</span><span class="count">${c.count}</span></a></li>`).join('\n      ')}
    </ul>
  </section>
  <section class="side-block">
    <h2 class="side-title">Recent Articles</h2>
    <ul class="side-recent">
      ${recent.map((a) => `<li><a href="${u(a.url)}">${esc(a.title)}</a><span class="side-recent__meta">${S.fmtDate(a.date)} · ${a.readingTime} min</span></li>`).join('\n      ')}
    </ul>
  </section>
  ${sb.quote?.text ? `<figure class="side-quote"><blockquote><p>${esc(sb.quote.text)}</p></blockquote>${sb.quote.by ? `<figcaption>— ${esc(sb.quote.by)}</figcaption>` : ''}</figure>` : ''}
</aside>`;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  function footer() {
    const f = C.footer || {};
    const social = S.social
      .map((s) => `<a href="${esc(s.href.startsWith('/') ? u(s.href) : s.href)}" aria-label="${esc(s.label)}"${/^https?:/.test(s.href) ? ' rel="noopener noreferrer" target="_blank"' : ''}>${icon(s.icon, 18)}</a>`)
      .join('');
    return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer__top">
      <a class="brand brand--footer" href="${u('/')}"><span class="brand__mark"><img src="${u(C.logo.src)}" alt="" width="36" height="36"></span><span class="brand__text"><span class="brand__name">${esc(C.name)}</span><span class="brand__tag">${esc(C.tagline)}</span></span></a>
      <nav aria-label="Footer"><ul class="footer__links">${(f.links || []).filter((l) => S.hasRoute(l.href)).map((l) => `<li><a href="${u(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul></nav>
      <div class="footer__social">${social}</div>
    </div>
    <div class="footer__bottom">
      <p>© ${new Date().getFullYear()} <strong>${esc(f.copyright || C.name)}</strong>. All rights reserved.</p>
      <ul>${(f.legal || []).filter((l) => S.hasRoute(l.href)).map((l) => `<li><a href="${l.href.startsWith('/') ? u(l.href) : esc(l.href)}">${esc(l.label)}</a></li>`).join('')}</ul>
    </div>
  </div>
</footer>`;
  }

  // ── Document shell ─────────────────────────────────────────────────────────
  /**
   * @param {object} o
   * @param {string} o.title       page title (site name is appended automatically)
   * @param {string} o.path        site-relative path incl. base, e.g. "/repo/about/"
   * @param {string} o.body        HTML for the main column
   * @param {boolean} [o.wide]     no sidebar
   */
  function page(o) {
    const full = o.path === u('/') || o.noSuffix ? o.title : `${o.title} · ${C.name}`;
    const desc = (o.description || C.description).replace(/\s+/g, ' ').trim();
    const socialText = (o.social || desc).replace(/\s+/g, ' ').trim();
    const canon = S.abs(o.canonicalPath || o.path);
    const seo = C.seo || {};
    const ogRaw = o.ogImage || seo.ogImage || '/og-default.png';
    const ogImg = S.abs(S.imgSrc(ogRaw));
    const sec = C.security || {};
    const f = o.features || {};
    const cm = C.comments?.enabled === true;
    const dirs = {
      'default-src': ["'none'"],
      'script-src': ["'self'", THEME_HASH, ...(cm ? ['https://giscus.app'] : []), ...(analytics?.script || [])],
      'style-src': ["'self'", ...(f.mermaid ? ["'unsafe-inline'"] : [])], // diagrams draw with inline styles
      'img-src': [sec.imgSrc || "'self' data: https:"],
      'font-src': ["'self'"],
      'connect-src': ["'self'", ...(analytics?.connect || []), ...(S.views?.views ? [S.views.origin] : [])],
      'frame-src': [...(cm ? ['https://giscus.app'] : []), ...(f.video ? ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'] : [])],
      'media-src': ["'self'", ...(o.media || [])],
      'manifest-src': ["'self'"],
      'form-action': ["'self'", ...(newsletter ? [newsletter.origin] : []), ...(o.formOrigins || [])],
      'base-uri': ["'self'"],
      'object-src': ["'none'"],
    };
    const csp = sec.csp === false ? '' : `<meta http-equiv="Content-Security-Policy" content="${esc(
      Object.entries(dirs).filter(([, v]) => v.length).map(([k, v]) => `${k} ${[...new Set(v)].join(' ')}`).join('; ') + (sec.extra ? '; ' + sec.extra : ''))}">`;
    const lang = o.lang || C.language;
    const dir = (S.langOf.get(lang) || {}).dir === 'rtl' ? ' dir="rtl"' : '';
    const alt = o.alternates || [];
    const mainAlt = alt.find((x) => x.lang === S.defaultLang);
    const alternates = [...alt, ...(mainAlt ? [{ lang: 'x-default', url: mainAlt.url }] : [])].map((x) => `<link rel="alternate" hreflang="${esc(x.lang)}" href="${esc(S.abs(u(x.url)))}">`).join('\n');
    const robots = o.noindex || S.includeDrafts ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1';
    const a = o.article;
    const ld = [...(o.jsonld ? (Array.isArray(o.jsonld) ? o.jsonld : [o.jsonld]) : [])];
    if (o.crumbs && o.crumbs.length > 1) {
      ld.push({
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: o.crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: c.href ? S.abs(u(c.href)) : canon })),
      });
    }
    return `<!doctype html>
<html lang="${esc(lang)}"${dir}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
<meta name="author" content="${esc(C.author?.name || C.name)}">
<link rel="canonical" href="${esc(canon)}">
${o.prev ? `<link rel="prev" href="${esc(S.abs(o.prev))}">` : ''}${o.next ? `<link rel="next" href="${esc(S.abs(o.next))}">` : ''}
<meta name="color-scheme" content="light dark">
<meta name="referrer" content="strict-origin-when-cross-origin">
${csp}
${alternates}
${analytics ? analytics.tag : ''}
<meta name="theme-color" content="${esc(C.theme['header-bg'])}">
<meta property="og:site_name" content="${esc(C.name)}">
<meta property="og:locale" content="${esc(seo.locale || 'en_US')}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(socialText)}">
<meta property="og:type" content="${a ? 'article' : 'website'}">
<meta property="og:url" content="${esc(canon)}">
<meta property="og:image" content="${esc(ogImg)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(C.name)} — ${esc(C.tagline)}">
${a ? `<meta property="article:published_time" content="${a.published}">
<meta property="article:modified_time" content="${a.modified}">
<meta property="article:section" content="${esc(a.section)}">
${a.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join('\n')}` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(socialText)}">
<meta name="twitter:image" content="${esc(ogImg)}">
${seo.twitter ? `<meta name="twitter:site" content="${esc(seo.twitter)}">` : ''}
<link rel="icon" type="image/svg+xml" href="${u(C.logo.favicon)}">
<link rel="apple-touch-icon" href="${u('/apple-touch-icon.png')}">
<link rel="manifest" href="${u('/manifest.webmanifest')}">
${S.offline ? `<meta name="asrbmy-sw" content="${esc(u('/sw.js'))}" data-scope="${esc(u('/'))}">` : ''}
<link rel="alternate" type="application/rss+xml" title="${esc(C.name)}" href="${u('/rss.xml')}">
<link rel="alternate" type="application/atom+xml" title="${esc(C.name)} (Atom)" href="${u('/atom.xml')}">
<link rel="alternate" type="application/feed+json" title="${esc(C.name)} (JSON Feed)" href="${u('/feed.json')}">
${o.feed ? `<link rel="alternate" type="application/rss+xml" title="${esc(o.title)}" href="${esc(u(o.feed))}">` : ''}
<script>${THEME_SCRIPT}</script>
<link rel="stylesheet" href="${S.asset('tokens.css')}">
<link rel="stylesheet" href="${S.asset('theme.css')}">
<noscript><style>.navbar{display:block!important}.menu-btn{display:none!important}</style></noscript>
${ld.length ? `<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="${o.bodyClass || ''}">
${S.includeDrafts ? '<p class="previewbar" role="status">Preview build: drafts and scheduled posts are shown, and search engines are told to ignore this site. Do not publish this output.</p>' : ''}
${header(o.path)}
${o.progress ? `<div class="read-progress" id="read-progress" aria-hidden="true" data-min="${Number(o.readMin) || 0}"><span></span><b class="read-progress__left" hidden></b></div>` : ''}
<div class="stage"><div class="wrap">
${o.crumbs ? crumbs(o.crumbs) : ''}
<div class="layout${o.wide ? ' layout--wide' : ''}">
<main id="main" class="main" tabindex="-1">
${o.body}
</main>
${o.wide ? '' : sidebar(o.sideExtra)}
</div>
</div></div>
${footer()}
<script src="${S.asset('site.js')}" defer></script>
${(o.scripts || []).map((x) => `<script src="${S.asset(x)}" defer></script>`).join('\n')}
</body>
</html>
`;
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  function pagination(current, total, hrefFor) {
    if (total <= 1) return '';
    const link = (n, label, cls = '') =>
      n === current
        ? `<span class="pager__item is-current ${cls}" aria-current="page">${label}</span>`
        : `<a class="pager__item ${cls}" href="${hrefFor(n)}">${label}</a>`;
    const nums = Array.from({ length: total }, (_, i) => link(i + 1, i + 1)).join('');
    return `<nav class="pager" aria-label="Pagination">
${current > 1 ? `<a class="pager__item pager__prev" href="${hrefFor(current - 1)}" rel="prev">← Newer</a>` : ''}
${nums}
${current < total ? `<a class="pager__item pager__next" href="${hrefFor(current + 1)}" rel="next">Older →</a>` : ''}
</nav>`;
  }

  return { newsletterForm, shareBar, hasNewsletter: !!newsletter, page, articleCard, crumbs, catLink, tagChips, metaLine, pagination, icon };
}
