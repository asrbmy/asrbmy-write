// Markdown + front matter helpers. No site-specific text lives here.
import { Marked } from 'marked';
import hljs from 'highlight.js/lib/common';

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

/** Minimal front matter parser: `key: value`, `key: [a, b]`, true/false. */
export function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (v.startsWith('[') && v.endsWith(']')) {
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

/**
 * Render markdown to HTML.
 * @param {string} md
 * @param {{base?: string, vars?: Record<string,string>}} opts
 * @returns {{html: string, toc: {depth:number,id:string,text:string}[]}}
 */
export function renderMarkdown(md, { base = '', vars = {} } = {}) {
  md = md.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));

  const toc = [];
  const seen = new Map();
  const fixHref = (href) => (href && href.startsWith('/') && !href.startsWith('//') ? base + href : href);

  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens);
        let id = slugify(text) || 'section';
        const n = seen.get(id) || 0;
        seen.set(id, n + 1);
        if (n) id += `-${n}`;
        if (depth === 2 || depth === 3) toc.push({ depth, id, text: stripTags(inner) });
        const anchor = depth >= 2 && depth <= 4
          ? `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>` : '';
        return `<h${depth} id="${id}">${inner}${anchor}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const l = (lang || '').trim().split(/\s+/)[0].toLowerCase();
        const known = l && hljs.getLanguage(l);
        const body = known ? hljs.highlight(text, { language: l, ignoreIllegals: true }).value : esc(text);
        const label = l || 'text';
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
        const h = fixHref(href);
        const external = /^https?:\/\//i.test(h);
        return `<a href="${esc(h)}"${title ? ` title="${esc(title)}"` : ''}${external ? ' rel="noopener noreferrer" target="_blank"' : ''}>${text}</a>`;
      },
      image({ href, title, text }) {
        const img = `<img src="${esc(fixHref(href))}" alt="${esc(text)}" loading="lazy" decoding="async">`;
        return title ? `<figure>${img}<figcaption>${esc(title)}</figcaption></figure>` : img;
      },
    },
  });

  let html = marked.parse(md);
  html = html.replace(/<table>/g, '<div class="table-wrap" tabindex="0" role="region" aria-label="Table"><table>').replace(/<\/table>/g, '</table></div>');
  return { html, toc };
}
