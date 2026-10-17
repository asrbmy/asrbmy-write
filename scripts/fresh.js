// Moves the template's sample articles, projects and pages (marked "sample: true") out of the site,
// into content-samples/, so you can start with your own writing. Nothing is deleted.
//   npm run fresh              ask first
//   npm run fresh -- --yes     do it without asking
//   npm run fresh -- --restore put them back
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './markdown.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLES = path.join(ROOT, 'content-samples');
const DIRS = ['content/articles', 'content/projects', 'content/pages'];
const IMAGES = ['cover-code.svg', 'cover-setup.svg', 'diagram-light.svg', 'diagram-light.dark.svg']; // pictures only the samples use
const moves = [];

if (process.argv.includes('--restore')) {
  for (const dir of DIRS) {
    const from = path.join(SAMPLES, dir);
    for (const f of fs.existsSync(from) ? fs.readdirSync(from) : []) moves.push([path.join(from, f), path.join(ROOT, dir, f)]);
  }
  for (const f of IMAGES) { const a = path.join(SAMPLES, 'public/images', f); if (fs.existsSync(a)) moves.push([a, path.join(ROOT, 'public/images', f)]); }
} else {
  for (const dir of DIRS) {
    const d = path.join(ROOT, dir);
    for (const f of fs.existsSync(d) ? fs.readdirSync(d).filter((x) => x.endsWith('.md')) : []) {
      if (parseFrontmatter(fs.readFileSync(path.join(d, f), 'utf8')).data.sample === true) moves.push([path.join(d, f), path.join(SAMPLES, dir, f)]);
    }
  }
  for (const f of IMAGES) { const a = path.join(ROOT, 'public/images', f); if (fs.existsSync(a)) moves.push([a, path.join(SAMPLES, 'public/images', f)]); }
}
if (!moves.length) { console.log('Nothing to move.'); process.exit(0); }
console.log(`${moves.length} file${moves.length === 1 ? '' : 's'} will be moved:`);
for (const [a, b] of moves) console.log(`  ${path.relative(ROOT, a)}  →  ${path.relative(ROOT, b)}`);
if (!process.argv.includes('--yes')) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('\nContinue? (y/N) ')).trim().toLowerCase(); rl.close();
  if (answer !== 'y' && answer !== 'yes') { console.log('Nothing changed.'); process.exit(0); }
}
for (const [a, b] of moves) { fs.mkdirSync(path.dirname(b), { recursive: true }); if (fs.existsSync(b)) { console.error(`Skipped (already exists): ${path.relative(ROOT, b)}`); continue; } fs.renameSync(a, b); }
console.log('\nDone. Now write your first article, then run `npm run doctor` and `npm test`.\n');
