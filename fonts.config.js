// ─────────────────────────────────────────────────────────────────────────────
//  Font presets for ASRBMY Write.
//  Pick one in site.config.js:  typography: { preset: 'editorial' }
//  Try them live on the site's /font-tester/ page.
//
//  Only system font stacks are used, so there is nothing to download: pages
//  load faster and no visitor data goes to a font service.
// ─────────────────────────────────────────────────────────────────────────────

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SERIF = "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, 'Times New Roman', serif";
const GEORGIA = "Georgia, Charter, 'Times New Roman', serif";
const CHARTER = "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, Georgia, serif";
const HUMANIST = "'Gill Sans', 'Gill Sans MT', Candara, 'Trebuchet MS', Calibri, sans-serif";
const SLAB = "Rockwell, 'Roboto Slab', 'Rockwell Extra Bold', Georgia, serif";
const DIDONE = "Didot, 'Bodoni MT', 'Playfair Display', 'Times New Roman', serif";
const MONO = "ui-monospace, 'SFMono-Regular', 'JetBrains Mono', Menlo, Consolas, 'Liberation Mono', monospace";

/** Ready-made heading + body pairings. */
export const fontPresets = {
  editorial: { label: 'Editorial — serif headings, serif text', head: SERIF, body: SERIF },
  classic: { label: 'Classic — Georgia throughout', head: GEORGIA, body: GEORGIA },
  modern: { label: 'Modern — clean sans-serif', head: SANS, body: SANS },
  technical: { label: 'Technical — sans headings, serif text', head: SANS, body: CHARTER },
  humanist: { label: 'Humanist — friendly sans headings, serif text', head: HUMANIST, body: CHARTER },
  magazine: { label: 'Magazine — high-contrast headings, serif text', head: DIDONE, body: CHARTER },
  slab: { label: 'Slab — sturdy headings, Georgia text', head: SLAB, body: GEORGIA },
  terminal: { label: 'Terminal — monospace headings, sans text', head: MONO, body: SANS },
};

/** Individual families offered in the Font Tester. */
export const fontFamilies = [
  { label: 'Editorial serif (Iowan / Palatino)', stack: SERIF },
  { label: 'Georgia', stack: GEORGIA },
  { label: 'Charter', stack: CHARTER },
  { label: 'Times New Roman', stack: "'Times New Roman', Times, serif" },
  { label: 'Didot / Bodoni (high contrast)', stack: DIDONE },
  { label: 'Rockwell (slab)', stack: SLAB },
  { label: 'System sans-serif', stack: SANS },
  { label: 'Humanist sans (Gill Sans / Candara)', stack: HUMANIST },
  { label: 'Helvetica / Arial', stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', stack: "'Trebuchet MS', Tahoma, sans-serif" },
  { label: 'Monospace', stack: MONO },
  { label: 'Courier New', stack: "'Courier New', Courier, monospace" },
];
