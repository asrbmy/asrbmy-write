// Share cards: a 1200×630 picture (title + category on the site's colours) for each article that has no cover,
// so links shared on social media and chat apps look good. Needs `sharp`; without it the default image is used.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { esc } from './markdown.js';

let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional */ }
export const canMakeCards = !!sharp;

// Latin-script text only: the card is drawn with system fonts, which may lack other scripts.
export const drawable = (s) => /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Z}]+$/u.test(String(s));

/** Splits a title into at most `maxLines` lines of about `width` characters, adding an ellipsis if cut. */
export function wrapTitle(text, width = 24, maxLines = 4) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if (w.length > width) { // a very long word: break it
      if (line) { lines.push(line); line = ''; }
      for (let i = 0; i < w.length; i += width) lines.push(w.slice(i, i + width));
      continue;
    }
    if (!line) line = w;
    else if ((line + ' ' + w).length <= width) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; let last = lines[maxLines - 1]; if (last.length > width - 1) { last = last.slice(0, width - 1); const sp = last.lastIndexOf(' '); if (sp > 6) last = last.slice(0, sp); } lines[maxLines - 1] = last.replace(/[\s.,;:–-]*$/, '') + '…'; }
  return lines;
}

export function cardSvg({ title, category, site, tagline, colors }) {
  // Largest type size at which the title fits the card in at most 4 lines (DejaVu Sans Bold is about 0.62 em wide)
  let size = 48, lines = wrapTitle(title, Math.floor(940 / (48 * 0.62)), 4);
  for (const sz of [76, 66, 58, 52]) {
    const l = wrapTitle(title, Math.floor(940 / (sz * 0.62)), 4);
    if (l.length <= (sz >= 66 ? 3 : 4) && !String(l[l.length - 1]).endsWith('…')) { size = sz; lines = l; break; }
  }
  const lh = Math.round(size * 1.2);
  const top = Math.round(325 - ((lines.length - 1) * lh) / 2 + size * 0.3);
  const font = "'DejaVu Sans','Liberation Sans','Helvetica Neue',Arial,sans-serif";
  const mono = "'DejaVu Sans Mono','Liberation Mono',Menlo,monospace";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${colors.bg}"/>
<g stroke="${colors.line}" stroke-width="1">${Array.from({ length: 22 }, (_, i) => `<path d="M${i * 56} 0V630"/>`).join('')}${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${i * 56}H1200"/>`).join('')}</g>
<rect x="0" y="0" width="14" height="630" fill="${colors.accent}"/>
<rect x="64" y="64" width="1072" height="502" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
<text x="110" y="132" font-family="${mono}" font-size="26" font-weight="700" letter-spacing="5" fill="${colors.accent}">${esc(String(category).toUpperCase().slice(0, 40))}</text>
<text font-family="${font}" font-weight="700" font-size="${size}" fill="${colors.text}">${lines.map((l, i) => `<tspan x="110" y="${top + i * lh}">${esc(l)}</tspan>`).join('')}</text>
<rect x="64" y="486" width="1072" height="80" fill="${colors.header}"/>
<text x="110" y="537" font-family="${mono}" font-size="28" font-weight="700" letter-spacing="6" fill="${colors.headerText}">${esc(String(site).toUpperCase().slice(0, 30))}</text>
<text x="1090" y="537" text-anchor="end" font-family="${font}" font-size="24" fill="${colors.headerMuted}">${esc(String(tagline).slice(0, 36))}</text>
</svg>`;
}

/** Writes one PNG per item into outDir (cached by content, so unchanged cards are not redrawn). Returns a Map id → file name. */
export async function makeCards(items, { outDir, cacheDir, site, tagline, theme }) {
  const made = new Map();
  if (!sharp || !items.length) return made;
  const colors = {
    bg: theme.bg, line: 'rgba(12,48,45,0.07)', panel: theme.panel, border: theme['panel-border'], text: theme.text, accent: theme.accent,
    header: theme['header-bg'], headerText: theme['header-text'], headerMuted: theme['header-muted'],
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  for (const it of items) {
    if (!drawable(it.title) || !drawable(it.category)) continue;
    const svg = cardSvg({ title: it.title, category: it.category, site, tagline, colors });
    const key = crypto.createHash('sha1').update(svg).digest('hex').slice(0, 16);
    const cached = path.join(cacheDir, `${key}.png`);
    try {
      if (!fs.existsSync(cached)) await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toFile(cached);
      const name = `${it.id}.png`;
      fs.copyFileSync(cached, path.join(outDir, name));
      made.set(it.id, name);
    } catch (e) { console.warn(`! Could not draw a share card for "${it.title}": ${e.message}`); }
  }
  return made;
}
