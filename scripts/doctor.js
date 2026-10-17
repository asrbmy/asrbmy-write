// "Is this site ready to go live?" — checks your settings and content for leftovers from the template.
//   npm run doctor            show the report
//   npm run doctor -- --strict   exit with an error if anything needs attention (for automation)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFrontmatter } from './markdown.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const C = (await import(pathToFileURL(path.join(ROOT, 'site.config.js')).href)).default;
const onActions = !!process.env.GITHUB_ACTIONS;
const rows = [];
const ok = (m) => rows.push(['ok', m]);
const warn = (m, fix) => rows.push(['warn', m, fix]);
const info = (m) => rows.push(['info', m]);
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const exists = (f) => fs.existsSync(path.join(ROOT, f));

// Address
const customDomain = exists('public/CNAME') ? read('public/CNAME').trim() : '';
if (onActions) ok('The site address is detected automatically on GitHub.');
else if (/YOUR-USERNAME/.test(C.url || '') && !process.env.SITE_URL) info('The address in site.config.js is still the placeholder. GitHub fills it in when it builds, so this only matters for local builds or a custom domain.');
else ok(`Site address: ${C.url}`);
if (customDomain) {
  if (/YOUR-USERNAME|github\.io/.test(C.url || '') && !process.env.SITE_URL) warn(`public/CNAME says ${customDomain}, but "url" in site.config.js is ${C.url}.`, `Set url: 'https://${customDomain}' (and base: '') in site.config.js.`);
  else ok(`Custom domain: ${customDomain}`);
} else if (C.url && !/YOUR-USERNAME|github\.io/.test(C.url) && !process.env.SITE_URL) warn(`You use your own address (${C.url}) but there is no public/CNAME file, so GitHub will not serve it.`, `Create public/CNAME containing just: ${C.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}`);

// Identity and contact
if (!C.name || /^ASRBMY Write$/.test(C.name)) info('The site name is still "ASRBMY Write". Change `name` in site.config.js if you want your own.');
else ok(`Site name: ${C.name}`);
if (!C.author?.name) warn('No author name is set.', 'Set author.name in site.config.js.');
if (!C.contact?.email && !C.contact?.form?.enabled) warn('Readers have no way to contact you (no email and no form on the Contact page).', 'Set contact.email or switch on contact.form in site.config.js.');
else ok('There is a way to contact you.');
if (!(C.social || []).some((s) => s.href && s.icon !== 'rss')) info('No social links are set (`social` in site.config.js). Fine if you do not want any.');

// Template leftovers
const samples = [];
for (const dir of ['content/articles', 'content/projects', 'content/pages']) {
  const d = path.join(ROOT, dir);
  for (const f of fs.existsSync(d) ? fs.readdirSync(d).filter((x) => x.endsWith('.md')) : []) {
    if (parseFrontmatter(read(`${dir}/${f}`)).data.sample === true) samples.push(`${dir}/${f}`);
  }
}
if (samples.length) warn(`${samples.length} sample file${samples.length === 1 ? '' : 's'} from the template are still in your content (articles, projects, pages marked "sample: true").`, 'Run `npm run fresh` to move them aside, then write your own. Edit the Now, Uses and About pages too.');
else ok('No sample content left.');
const about = read('content/pages/about.md');
if (/personal space for writing/i.test(about) && !/sample: true/.test(about)) info('The About page still has the template wording. Make it yours.');

// Privacy page vs. what you switched on
const priv = exists('content/pages/privacy.md');
if (!priv) warn('There is no privacy page (content/pages/privacy.md). Most countries expect one if you use analytics, comments or forms.', 'Restore content/pages/privacy.md.');
const services = [C.analytics?.provider && `analytics (${C.analytics.provider})`, C.comments?.enabled && 'comments (GitHub Discussions)', C.newsletter?.enabled && 'newsletter', C.contact?.form?.enabled && 'contact form'].filter(Boolean);
services.length ? info(`Outside services in use: ${services.join(', ')}. The privacy page explains analytics automatically; mention the others in content/pages/privacy.md.`) : ok('No outside services are used. Nothing leaves the visitor\'s browser.');

// Project files
for (const f of ['.github/workflows/deploy.yml', 'public/og-default.png', 'public/favicon.svg', 'public/icon-512.png']) if (!exists(f)) warn(`Missing ${f}.`, f.endsWith('deploy.yml') ? 'Restore it from the original zip, or the site will not publish.' : 'Restore it from the original zip.');
if (exists('public/og-default.png')) info('public/og-default.png is the picture shown when your home page is shared. Replace it with your own 1200×630 image if you like.');
if (!exists('node_modules')) warn('Packages are not installed.', 'Run `npm install`.');
const major = Number(process.versions.node.split('.')[0]);
major >= 20 ? ok(`Node.js ${process.versions.node}`) : warn(`Node.js ${process.versions.node} is too old.`, 'Install Node.js 20 or newer.');
if (!exists('.git')) info('This folder is not a Git repository yet, so nothing can be published from it. See the README, "Deploy to GitHub Pages".');

const sym = { ok: '✔', warn: '!', info: 'i' };
console.log('\nProduction check\n');
for (const [k, m, fix] of rows) console.log(`  ${sym[k]}  ${m}${fix ? `\n       → ${fix}` : ''}`);
const warns = rows.filter((r) => r[0] === 'warn').length;
console.log(warns ? `\n${warns} thing${warns === 1 ? '' : 's'} to look at before you go live. Then run: npm test\n` : '\nNothing blocking. Run `npm test`, then push to GitHub.\n');
if (strict && warns) process.exit(1);
