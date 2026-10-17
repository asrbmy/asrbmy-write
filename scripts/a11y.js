// Accessibility checks that run after every build (part of `npm run check`).
// 1. Colour contrast of the theme colours in site.config.js (WCAG AA: 4.5:1 for text).
// 2. Page structure: heading order, empty links and buttons, form fields without a label.

const hex = (c) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (a, b) => { const x = hex(a), y = hex(b); if (!x || !y) return null; const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };

/** Pairs the stylesheet really uses: [label, text colour key, background key] (keys are theme tokens, or a literal #hex). */
const PAIRS = [
  ['body text on a panel', 'text', 'panel'], ['body text on the page', 'text', 'bg'], ['muted text on a panel', 'text-muted', 'panel'],
  ['muted text on the page', 'text-muted', 'bg'], ['links on a panel', 'link', 'panel'], ['accent text on a panel', 'accent', 'panel'],
  ['button text', '#ffffff', 'accent-fill'], ['header text', 'header-text', 'header-bg'], ['header muted text', 'header-muted', 'header-bg'],
  ['sidebar text', 'side-text', 'side-bg'], ['sidebar muted text', 'side-muted', 'side-bg'], ['code text', 'code-text', 'code-bg'],
];
export function contrastIssues(cfg) {
  const out = [];
  for (const [mode, theme] of [['light', cfg.theme || {}], ['dark', { ...(cfg.theme || {}), ...(cfg.themeDark || {}) }]]) {
    for (const [label, fg, bg] of PAIRS) {
      const r = contrast(fg.startsWith('#') ? fg : theme[fg], bg.startsWith('#') ? bg : theme[bg]);
      if (r !== null && r < 4.5) out.push(`theme (${mode}): ${label} has contrast ${r.toFixed(2)}:1, below the 4.5:1 minimum. Adjust "${fg.startsWith('#') ? bg : fg}" in site.config.js.`);
    }
  }
  return out;
}

const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ').trim();
/** Structural problems in one page. */
export function auditHtml(html, rel) {
  const out = [];
  const main = (html.match(/<main[\s\S]*?<\/main>/) || [html])[0].replace(/<(script|style|pre|template)[\s\S]*?<\/\1>/g, '');
  let prev = 0;
  for (const m of main.matchAll(/<h([1-6])\b/g)) {
    const l = Number(m[1]);
    if (prev && l > prev + 1) { out.push(`${rel}: heading level jumps from h${prev} to h${l}`); break; }
    prev = l;
  }
  const label = (tag, attrs) => /\baria-label="[^"]+"|\baria-labelledby="[^"]+"/.test(attrs) || /\btitle="[^"]+"/.test(attrs);
  for (const m of main.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    if (!/\bhref=/.test(m[1]) || /\baria-hidden="true"/.test(m[1])) continue; // decorative duplicate links (cover images) are hidden on purpose
    if (!text(m[2]) && !/<img\b[^>]*\balt="[^"]+"/.test(m[2]) && !/<svg\b/.test(m[2]) && !label('a', m[1])) out.push(`${rel}: a link with no text (${m[0].slice(0, 60)}…)`);
    else if (!text(m[2]) && !/<img\b[^>]*\balt="[^"]+"/.test(m[2]) && !label('a', m[1])) out.push(`${rel}: an icon-only link has no accessible name (${m[0].slice(0, 60)}…)`);
  }
  for (const m of main.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    if (!text(m[2]) && !label('button', m[1])) out.push(`${rel}: a button with no accessible name (${m[0].slice(0, 60)}…)`);
  }
  const ids = new Set([...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
  const wrapped = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map((m) => m[1]);
  for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const a = m[2];
    if (/\btype="(hidden|submit|button|image)"/.test(a) || /\bclass="[^"]*\bcf-trap/.test(a)) continue;
    const id = (a.match(/\bid="([^"]+)"/) || [])[1];
    if (/\baria-label="[^"]+"|\baria-labelledby=/.test(a) || (id && ids.has(id)) || wrapped.some((w) => w.includes(m[0]))) continue;
    out.push(`${rel}: a form field has no label (${m[0].slice(0, 70)})`);
  }
  if ((html.match(/\btabindex="[1-9]/g) || []).length) out.push(`${rel}: a positive tabindex changes the tab order unexpectedly`);
  if (!/<a\b[^>]*class="[^"]*skip/.test(html) && !/href="#main"/.test(html)) out.push(`${rel}: no "skip to content" link`);
  return out;
}
