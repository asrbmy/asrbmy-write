// Markdown + front matter helpers. No site-specific text lives here.
import { Marked } from 'marked';
import hljs from 'highlight.js/lib/common';
import katex from 'katex';

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const slugify = (s = '') =>
  String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const unquote = (v) => v.replace(/^(['"])(.*)\1$/, '$2');

/**
 * Minimal front matter parser.
 *   key: value          key: [a, b]          key: true/false
 *   key:                (block list)
 *     - a
 *     - b
 * Tolerates a UTF-8 byte-order mark (Windows Notepad adds one) and CRLF line endings.
 */
export function parseFrontmatter(src) {
  src = String(src).replace(/^﻿/, '');
  const m = src.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const at = line.indexOf(':');
    if (at < 0) continue;
    const key = line.slice(0, at).trim();
    if (!/^[A-Za-z_][\w-]*$/.test(key)) continue;
    let v = line.slice(at + 1).trim();
    if (v === '') {
      const items = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) items.push(unquote(lines[++i].replace(/^\s*-\s+/, '').trim()));
      v = items.length ? items : '';
    } else if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
    } else if (v === 'true') v = true;
    else if (v === 'false') v = false;
    else v = unquote(v);
    data[key] = v;
  }
  return { data, body: m[2] };
}

const stripTags = (html) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export const htmlToText = stripTags;

// ── Safe URLs and raw-HTML filtering ─────────────────────────────────────────
const NAMED = { colon: ':', tab: '\t', newline: '\n', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodeEntities = (s) =>
  String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return NAMED[e.toLowerCase()] ?? m;
  });

/** Returns a safe URL string, or null when the scheme is not allowed (javascript:, data:, vbscript:…). */
export function cleanUrl(raw) {
  const url = decodeEntities(raw).trim();
  const probe = url.replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, '');
  const scheme = probe.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !/^(https?|mailto|tel)$/i.test(scheme[1])) return null;
  return url;
}

const VOID = new Set(['br', 'hr', 'img', 'wbr']);
const TAGS = new Set(['a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'dd', 'del', 'details', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'u', 'ul', 'var', 'wbr']);
const ATTRS = new Set(['class', 'id', 'title', 'lang', 'dir', 'open', 'href', 'src', 'alt', 'width', 'height', 'loading', 'colspan', 'rowspan', 'scope', 'datetime', 'cite', 'aria-label', 'aria-hidden', 'role']);
const TAG_RE = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/**
 * Allow-list filter for raw HTML written inside Markdown. Unknown tags are shown as text,
 * scripts, styles, event handlers and javascript:/data: URLs are removed.
 */
export function sanitizeHtml(html, fixHref = (h) => h) {
  let out = '';
  let last = 0;
  const text = (s) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  for (const m of html.matchAll(TAG_RE)) {
    out += text(html.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[0].startsWith('<!--')) continue;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (!TAGS.has(tag)) { out += text(m[0]); continue; }
    if (closing) { if (!VOID.has(tag)) out += `</${tag}>`; continue; }
    let attrs = '';
    const seen = new Set();
    for (const a of m[3].matchAll(ATTR_RE)) {
      const name = a[1].toLowerCase();
      if (!ATTRS.has(name) || seen.has(name)) continue;
      if ((name === 'href' && tag !== 'a') || (name === 'src' && tag !== 'img') || (name === 'open' && tag !== 'details')) continue;
      let value = a[2] ?? a[3] ?? a[4] ?? '';
      if (name === 'href' || name === 'src') {
        const safe = cleanUrl(value);
        if (safe === null) continue;
        value = fixHref(safe);
      } else value = decodeEntities(value);
      seen.add(name);
      attrs += name === 'open' ? ' open' : ` ${name}="${esc(value)}"`;
    }
    if (tag === 'a' && /href="https?:/i.test(attrs)) attrs += ' rel="noopener noreferrer"';
    if (tag === 'img') { if (!seen.has('alt')) attrs += ' alt=""'; if (!seen.has('loading')) attrs += ' loading="lazy"'; }
    out += `<${tag}${attrs}>`;
  }
  return out + text(html.slice(last));
}

const RESERVED_ID = /^(main|site-nav|q|side-q|theme-toggle|menu-btn|search-.*|sub-\d+|h-(featured|latest|related)|y-\d{4}|comments|load-comments|giscus-box|read-progress|toc-side|h-comments|h-toc-side|h-series|series-box|ft-.*)$/;

/**
 * Render markdown to HTML.
 * @param {string} md
 * @param {{base?: string, vars?: Record<string,string>, images?: (src:string)=>({dark?:string, srcset?:{w:number,url:string}[]}|null)}} opts
 * @returns {{html: string, toc: {depth:number,id:string,text:string}[], features: {mermaid:boolean, video:boolean, math:boolean}}}
 */
export function renderMarkdown(md, { base = '', vars = {}, images = null } = {}) {
  const features = { mermaid: false, video: false, math: false };
  md = String(md).replace(/^﻿/, '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));

  const toc = [];
  const seen = new Map();
  const fixHref = (href) => {
    if (!href) return href;
    if (href.startsWith('/') && !href.startsWith('//')) return base + href;
    return href;
  };
  // "images/pic.png", "./images/pic.png", "public/images/pic.png" all mean the site's /images folder
  const fixImage = (href) => fixHref(href.replace(/^(?:\.{1,2}\/)*(?:public\/)?(images\/)/, '/$1'));

  const marked = new Marked({ gfm: true, breaks: false });

  // $inline$ and $$block$$ maths, rendered at build time as MathML (no scripts, fonts or inline styles needed)
  const tex = (src, displayMode) => {
    features.math = true;
    try { return katex.renderToString(src, { output: 'mathml', displayMode, throwOnError: true, strict: 'ignore', trust: false, maxExpand: 200 }); }
    catch { return `<code class="math-error" title="This formula could not be read">${esc(src)}</code>`; }
  };
  // @[youtube](VIDEO_ID "Title") — a click-to-play placeholder; nothing is loaded from the video site until pressed
  const VIDEO = /^@\[(youtube|vimeo)\]\(\s*([\w-]{3,24})(?:\s+"([^"\n]{0,120})")?\s*\)[ \t]*(?:\n|$)/;
  marked.use({
    extensions: [
      {
        name: 'mathBlock', level: 'block',
        start: (src) => src.indexOf('$$'),
        tokenizer(src) {
          const m = /^\$\$[ \t]*\n?([\s\S]+?)\n?[ \t]*\$\$[ \t]*(?:\n|$)/.exec(src);
          if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
        },
        renderer: (t) => `<div class="math-block">${tex(t.text, true)}</div>\n`,
      },
      {
        name: 'mathInline', level: 'inline',
        start: (src) => src.indexOf('$'),
        tokenizer(src) {
          const m = /^\$(?!\s)((?:\\.|[^$\n\\])+?)(?<!\s)\$(?![\d$])/.exec(src);
          if (m) return { type: 'mathInline', raw: m[0], text: m[1] };
        },
        renderer: (t) => tex(t.text, false),
      },
      {
        name: 'video', level: 'block',
        start: (src) => src.indexOf('@['),
        tokenizer(src) {
          const m = VIDEO.exec(src);
          if (!m) return;
          if (m[1] === 'vimeo' && !/^\d+$/.test(m[2])) return;
          return { type: 'video', raw: m[0], provider: m[1], id: m[2], title: m[3] || '' };
        },
        renderer: (t) => {
          features.video = true;
          const name = t.provider === 'youtube' ? 'YouTube' : 'Vimeo';
          const title = t.title || 'Video';
          return `<div class="video" data-provider="${t.provider}" data-id="${esc(t.id)}" data-title="${esc(title)}"><button type="button" class="video__play" aria-label="Play video: ${esc(title)}"><span class="video__icon" aria-hidden="true">▶</span><strong>${esc(title)}</strong><small>Loads ${name} when you press play</small></button></div>\n`;
        },
      },
    ],
  });
  marked.use({
    renderer: {
      html({ text }) { return sanitizeHtml(text, fixHref); },
      paragraph({ tokens }) {
        const inner = this.parser.parseInline(tokens);
        // a captioned image becomes a <figure>, which must not sit inside a <p>
        return tokens.length === 1 && tokens[0].type === 'image' && tokens[0].title ? inner + '\n' : `<p>${inner}</p>\n`;
      },
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens);
        if (depth < 2) depth = 2; // the page title is the only <h1>, so a "# Title" in the body becomes <h2>
        let id = slugify(text) || 'section';
        if (RESERVED_ID.test(id)) id += '-section';
        const n = seen.get(id) || 0;
        seen.set(id, n + 1);
        if (n) id += `-${n}`;
        if (depth === 2 || depth === 3) toc.push({ depth, id, text: stripTags(inner) });
        const anchor = depth <= 4 ? `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` : '';
        return `<h${depth} id="${id}">${inner}${anchor}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const l = (lang || '').trim().split(/\s+/)[0].toLowerCase();
        if (l === 'mermaid') {
          features.mermaid = true;
          return `<figure class="diagram"><pre class="mermaid" aria-label="Diagram">${esc(text)}</pre></figure>\n`;
        }
        const known = l && /^[a-z0-9+#_-]+$/.test(l) && hljs.getLanguage(l);
        const body = known ? hljs.highlight(text, { language: l, ignoreIllegals: true }).value : esc(text);
        const label = /^[a-z0-9+#_-]+$/.test(l) ? l : 'text';
        return (
          `<div class="code-block"><div class="code-block__bar"><span class="code-block__lang">${esc(label)}</span>` +
          `<button type="button" class="code-copy" aria-label="Copy ${esc(label)} code to clipboard">` +
          `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.3" d="M5.5 5.5h7v8h-7zM3.5 10.5v-8h7"/></svg>` +
          `<span class="code-copy__label">Copy</span></button></div>` +
          `<pre><code class="hljs${known ? ` language-${l}` : ''}">${body}</code></pre></div>\n`
        );
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const safe = cleanUrl(href || '');
        if (safe === null) return text; // javascript:, data: … → plain text
        const h = fixHref(safe);
        const external = /^https?:\/\//i.test(h);
        return `<a href="${esc(h)}"${title ? ` title="${esc(title)}"` : ''}${external ? ' rel="noopener noreferrer" target="_blank"' : ''}>${text}</a>`;
      },
      image({ href, title, text }) {
        const safe = cleanUrl(href || '');
        if (safe === null) return esc(text);
        const norm = (x) => x.replace(/^(?:\.{1,2}\/)*(?:public\/)?(images\/)/, '/$1');
        const info = images ? images(norm(safe)) : null;
        const tag = (src, cls, alt) => {
          const v = images ? images(norm(src)) : null;
          const srcset = v?.srcset?.length ? ` srcset="${v.srcset.map((x) => `${esc(fixHref(x.url))} ${x.w}w`).join(', ')}" sizes="(min-width: 760px) 700px, 100vw"` : '';
          return `<img${cls ? ` class="${cls}"` : ''} src="${esc(fixImage(src))}"${srcset} alt="${esc(alt)}" loading="lazy" decoding="async">`;
        };
        const img = info?.dark ? `<span class="themed-img">${tag(safe, 'img-light', text)}${tag(info.dark, 'img-dark', '')}</span>` : tag(safe, '', text);
        return title ? `<figure>${img}<figcaption>${esc(title)}</figcaption></figure>` : img;
      },
    },
  });

  let html = marked.parse(md);
  html = html.replace(/<table>/g, '<div class="table-wrap" tabindex="0" role="region" aria-label="Scrollable table"><table>').replace(/<\/table>/g, '</table></div>');
  return { html, toc, features };
}
