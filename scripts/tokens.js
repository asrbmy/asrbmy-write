// Turns site.config.js (theme + typography) into tokens.css. Shared by the site build and the Writer.
import { fontPresets } from '../fonts.config.js';

export function resolveTypography(C) {
  const t = C.typography || {};
  const preset = fontPresets[t.preset || 'editorial'] || fontPresets.editorial;
  return {
    'font-head': t.head || preset.head,
    'font-serif': t.body || preset.body,
    'reading-size': t.size || '18px',
    'reading-leading': String(t.lineHeight || 1.75),
    'head-weight': String(t.headingWeight || 800),
  };
}

export function tokensCss(C) {
  const decl = (o) => Object.entries(o).map(([k, v]) => `  --${k}: ${v};`).join('\n');
  const light = { ...C.theme, ...resolveTypography(C) };
  return `/* Generated from site.config.js — do not edit. */
:root {
${decl(light)}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${decl(C.themeDark || {})}
  }
}
:root[data-theme="dark"] {
${decl(C.themeDark || {})}
}
`;
}
