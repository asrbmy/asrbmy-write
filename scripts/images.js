// Optional image optimiser. If `sharp` is installed it writes smaller WebP copies of the pictures in
// public/images into dist/images/_opt/ and returns what it made, so pages can offer them via srcset.
// Your original files are never changed. Without sharp the site simply uses the originals.
import fs from 'node:fs';
import path from 'node:path';

const WIDTHS = [480, 960, 1600];
const RASTER = /\.(png|jpe?g)$/i;

export async function optimiseImages({ srcDir, outDir, quiet = false }) {
  const variants = new Map(); // "/images/pic.jpg" -> [{ w, url }]
  if (!fs.existsSync(srcDir)) return variants;
  let sharp;
  try { sharp = (await import('sharp')).default; }
  catch { if (!quiet) console.log('ℹ Image optimiser skipped (the optional "sharp" package is not installed). Originals are used.'); return variants; }
  const files = fs.readdirSync(srcDir).filter((f) => RASTER.test(f) && !f.startsWith('.'));
  fs.mkdirSync(path.join(outDir, '_opt'), { recursive: true });
  for (const f of files) {
    const base = f.replace(RASTER, '');
    try {
      const input = path.join(srcDir, f);
      const srcTime = fs.statSync(input).mtimeMs;
      const fresh = (out) => fs.existsSync(out) && fs.statSync(out).mtimeMs >= srcTime; // already made and up to date
      const meta = await sharp(input).metadata();
      const list = [];
      for (const w of WIDTHS) {
        if (!meta.width || w >= meta.width) continue;
        const name = `${base}-${w}.webp`;
        const out = path.join(outDir, '_opt', name);
        if (!fresh(out)) await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
        list.push({ w, url: `/images/_opt/${encodeURIComponent(name)}` });
      }
      if (meta.width) {
        const name = `${base}-${meta.width}.webp`;
        const out = path.join(outDir, '_opt', name);
        if (!fresh(out)) await sharp(input).rotate().webp({ quality: 82 }).toFile(out);
        list.push({ w: meta.width, url: `/images/_opt/${encodeURIComponent(name)}` });
      }
      if (list.length) variants.set(`/images/${encodeURI(f)}`, list);
    } catch (e) { if (!quiet) console.warn(`! Could not optimise images/${f}: ${e.message}`); }
  }
  return variants;
}
