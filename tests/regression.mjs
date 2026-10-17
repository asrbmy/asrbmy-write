// Regression tests for security and parsing bugs. Run with: npm run test:unit
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyticsInfo, newsletterInfo, contactInfo, viewsInfo, fetchPopular } from '../scripts/features.js';
import { wrapTitle, cardSvg, drawable } from '../scripts/og.js';
import { collectLinks, checkOne, runPool } from '../scripts/linkcheck.js';
import { wpautop, readWordPress, readBlogger, readMarkdownFile, convertPosts, downloadImages, frontMatter } from '../scripts/import.js';
import { adminConfig, adminHtml, CMS_SRC, CMS_INTEGRITY } from '../scripts/cms.js';
import { rssXml, atomXml, jsonFeed } from '../scripts/feeds.js';
import { contrast, contrastIssues, auditHtml } from '../scripts/a11y.js';
import { renderMarkdown, parseFrontmatter, cleanUrl, sanitizeHtml } from '../scripts/markdown.js';

let failed = 0;
const pending = [];
const ta = (name, fn) => pending.push((async () => { try { await fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); } })());
const t = (name, fn) => { try { fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); } };
const html = (md) => renderMarkdown(md).html;

t('javascript: links are removed', () => assert.ok(!/javascript:/i.test(html('[x](javascript:alert(1))'))));
t('entity-obfuscated javascript: is removed', () => assert.ok(!/javascript/i.test(html('[x](&#106;avascript:alert(1))'))));
t('data: images are removed', () => assert.ok(!/data:/i.test(html('![x](data:text/html;base64,AAAA)'))));
t('raw <script> is shown as text, not run', () => assert.ok(!/<script/i.test(html('<script>alert(1)</script>'))));
t('on* handlers and style are dropped', () => assert.ok(!/onerror|style=/i.test(html('<img src="x" onerror="alert(1)" style="x:y">'))));
t('iframe/object/form are escaped', () => assert.ok(!/<(iframe|object|form|embed)/i.test(html('<iframe src="https://x"></iframe><form action="/"></form>'))));
t('javascript: href in raw <a> is dropped', () => assert.ok(!/javascript/i.test(sanitizeHtml('<a href="JaVa\tScRiPt:alert(1)">x</a>'))));
t('https/mailto/relative URLs survive', () => { for (const u of ['https://a.b/c', 'mailto:a@b.c', '/x/', '#top']) assert.equal(cleanUrl(u), u); });
t('external links get rel=noopener', () => assert.match(html('[x](https://example.com)'), /rel="noopener noreferrer"/));
t('front matter tolerates BOM + CRLF', () => assert.equal(parseFrontmatter('﻿---\r\ntitle: Hi\r\n---\r\nBody').data.title, 'Hi'));
t('front matter block list tags', () => assert.deepEqual(parseFrontmatter('---\ntags:\n  - a\n  - b\n---\nx').data.tags, ['a', 'b']));
t('"##" stays h2, "#" becomes h2, "###" stays h3', () => {
  const h = html('# A\n\n## B\n\n### C');
  assert.equal((h.match(/<h2/g) || []).length, 2); assert.equal((h.match(/<h3/g) || []).length, 1); assert.ok(!/<h1/.test(h));
});
t('headings cannot take reserved page ids', () => assert.ok(!/id="main"/.test(html('## main'))));
t('headings cannot take the comments/progress ids', () => { for (const id of ['comments', 'giscus-box', 'read-progress', 'toc-side']) assert.ok(!new RegExp(`id="${id}"`).test(html('## ' + id)), id); });
t('duplicate headings get unique ids', () => { const h = html('## Same\n\n## Same'); assert.ok(h.includes('id="same"') && h.includes('id="same-1"')); });
t('code blocks keep {{braces}}', () => assert.ok(html('```\n{{x}}\n```').includes('{{x}}')));
t('tables are scroll-wrapped', () => assert.match(html('|a|b|\n|-|-|\n|1|2|'), /table-wrap/));

t('maths render as MathML and plain prices are left alone', () => {
  const h = html('Cost $5 and $10. Then $x^2$.\n\n$$\n\\frac{a}{b}\n$$');
  assert.equal((h.match(/<math/g) || []).length, 2); assert.ok(h.includes('$5 and $10'));
});
t('broken maths is shown as text, not an error page', () => assert.ok(/math-error|<math/.test(html('$\\frac{$'))));
t('mermaid blocks become diagram sources and are flagged', () => { const r = renderMarkdown('```mermaid\ngraph TD; A-->B\n```'); assert.ok(r.features.mermaid && r.html.includes('class="mermaid"') && r.html.includes('--&gt;')); });
t('video embeds are click-to-play placeholders (no iframe)', () => { const r = renderMarkdown('@[youtube](aqz-KE-bpKQ "Demo")'); assert.ok(r.features.video && !/<iframe/.test(r.html) && r.html.includes('data-id="aqz-KE-bpKQ"')); });
t('video ids cannot inject markup', () => assert.ok(!/onerror|<script/i.test(html('@[youtube](x"><img src=x onerror=alert(1)>)'))));
t('light/dark picture pairs and srcset', () => {
  const h = renderMarkdown('![x](/images/a.png)', { images: (src) => (src === '/images/a.png' ? { dark: '/images/a.dark.png', srcset: [{ w: 480, url: '/images/_opt/a-480.webp' }] } : null) }).html;
  assert.ok(h.includes('img-light') && h.includes('img-dark') && h.includes('480w'));
});
t('captioned images are not wrapped in a paragraph', () => assert.ok(!/<p><figure/.test(html('![x](/images/a.png "caption")'))));
t('unsafe analytics/newsletter addresses are refused', () => {
  assert.throws(() => analyticsInfo({ analytics: { provider: 'custom', src: 'http://evil.example/x.js' } }));
  assert.throws(() => analyticsInfo({ analytics: { provider: 'plausible' } }));
  assert.throws(() => newsletterInfo({ newsletter: { enabled: true, action: 'javascript:alert(1)' } }));
  assert.equal(analyticsInfo({}), null);
});
t('hostile text in every markdown position never yields handlers or scripts', () => {
  const evil = '"><img src=x onerror=alert(1)><script>alert(1)</script>';
  const md = `# ${evil}\n\n[${evil}](/x "${evil}")\n\n![${evil}](/a.png "${evil}")\n\n| ${evil} |\n|---|\n| ${evil} |\n\n\`${evil}\`\n\n$$${evil}$$\n\n@[vimeo](${evil})`;
  const h = renderMarkdown(md).html;
  assert.ok(!/<script/i.test(h) && !/<[a-z][^>]*\son\w+\s*=/i.test(h), h);
});

// ── Second batch of features ─────────────────────────────────────────────────
t('front matter: escaped quotes, doubled single quotes and block text', () => {
  const { data } = parseFrontmatter('---\ntitle: "He said \\"hi\\": ok"\nexcerpt: >-\n  Long text\n  continues here\ntags:\n  - a\n  - \'it\'\'s\'\n---\nbody');
  assert.equal(data.title, 'He said "hi": ok');
  assert.equal(data.excerpt, 'Long text continues here');
  assert.deepEqual(data.tags, ['a', "it's"]);
});
t('share-card titles wrap, stay short and never break the picture', () => {
  const lines = wrapTitle('A very long title that goes on and on about many different things in the world of software privacy and research', 24, 4);
  assert.ok(lines.length <= 4 && lines.every((l) => l.length <= 24), JSON.stringify(lines));
  assert.ok(lines[3].endsWith('…'));
  assert.ok(wrapTitle('Supercalifragilisticexpialidocious-word', 12, 4).every((l) => l.length <= 12));
  const svg = cardSvg({ title: '<script>alert(1)</script> & "x"', category: 'A<B', site: 'S', tagline: 'T', colors: { bg: '#fff', line: '#eee', panel: '#fff', border: '#000', text: '#000', accent: '#f00', header: '#000', headerText: '#fff', headerMuted: '#ccc' } });
  assert.ok(!/<script/.test(svg) && svg.includes('&lt;script&gt;'));
  assert.ok(drawable('Hello, World 2026') && !drawable('हिन्दी'));
});
t('contact form and view counter settings are validated', () => {
  assert.equal(contactInfo({}), null);
  assert.throws(() => contactInfo({ contact: { form: { enabled: true } } }));
  assert.throws(() => contactInfo({ contact: { form: { enabled: true, action: 'http://x.example/f' } } }));
  assert.throws(() => contactInfo({ contact: { form: { enabled: true, action: 'javascript:alert(1)' } } }));
  const ok = contactInfo({ author: { name: 'A' }, contact: { form: { enabled: true, action: 'https://formspree.io/f/abc', next: 'https://me.example/thanks/' } } });
  assert.equal(ok.origin, 'https://formspree.io'); assert.equal(ok.next, 'https://me.example/thanks/');
  assert.throws(() => viewsInfo({ views: { enabled: true }, analytics: { provider: 'plausible', domain: 'x.com' } }));
  assert.throws(() => viewsInfo({ popular: { enabled: true }, analytics: { provider: 'goatcounter', code: 'a b' } }));
  assert.equal(viewsInfo({}), null);
  assert.equal(viewsInfo({ views: { enabled: true }, analytics: { provider: 'goatcounter', code: 'me' } }).origin, 'https://me.goatcounter.com');
});
ta('popular articles: parsed, and a failure never stops the build', async () => {
  const info = viewsInfo({ popular: { enabled: true, days: 7 }, analytics: { provider: 'goatcounter', code: 'me' } });
  let seen;
  const good = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => ({ hits: [{ path: '/articles/a/', count: 9 }, { path: 'no-slash', count: 4 }, { path: '/b/', count: 0 }] }) }; };
  const hits = await fetchPopular(info, 'tok', { fetchImpl: good, now: new Date('2026-10-15T00:00:00Z') });
  assert.deepEqual(hits, [{ path: '/articles/a/', count: 9 }]);
  assert.ok(seen.url.includes('start=2026-10-08') && seen.opts.headers.Authorization === 'Bearer tok');
  assert.deepEqual(await fetchPopular(info, '', { fetchImpl: good }), []); // no token: skipped quietly
  const warn = console.warn; console.warn = () => {};
  assert.deepEqual(await fetchPopular(info, 'tok', { fetchImpl: async () => ({ ok: false, status: 500 }) }), []);
  assert.deepEqual(await fetchPopular(info, 'tok', { fetchImpl: async () => { throw new Error('boom'); } }), []);
  console.warn = warn;
});
ta('outside-link checker: finds links, judges statuses fairly', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-'));
  fs.mkdirSync(path.join(dir, 'a'));
  fs.writeFileSync(path.join(dir, 'a/index.html'), '<head><a href="https://head.example/x">no</a></head><body><a href="https://ok.example/p?a=1&amp;b=2">x</a> <a href="https://me.example/own">own</a> <a href="https://twitter.com/intent/tweet?url=1">share</a> <pre><a href="https://code.example/">c</a></pre> <a href="/inside/">in</a></body>');
  const links = collectLinks(dir, ['me.example']);
  assert.deepEqual([...links.keys()], ['https://ok.example/p?a=1&b=2']);
  const fake = (status) => async () => ({ status });
  assert.equal((await checkOne('https://x', { fetchImpl: fake(200) })).state, 'ok');
  assert.equal((await checkOne('https://x', { fetchImpl: fake(404) })).state, 'broken');
  assert.equal((await checkOne('https://x', { fetchImpl: fake(403) })).state, 'unchecked');
  assert.equal((await checkOne('https://x', { fetchImpl: fake(429) })).state, 'unchecked');
  assert.equal((await checkOne('https://x', { fetchImpl: fake(503), retries: 0 })).state, 'unchecked');
  assert.equal((await checkOne('https://x', { fetchImpl: async () => { const e = new Error('x'); e.cause = { code: 'ENOTFOUND' }; throw e; } })).state, 'broken');
  let calls = []; // a server that refuses HEAD is asked again with GET
  assert.equal((await checkOne('https://x', { fetchImpl: async (u, o) => { calls.push(o.method); return { status: o.method === 'HEAD' ? 405 : 200 }; } })).state, 'ok');
  assert.deepEqual(calls, ['HEAD', 'GET']);
  assert.deepEqual(await runPool([1, 2, 3, 4, 5], async (x) => x * 2, 2), [2, 4, 6, 8, 10]);
  fs.rmSync(dir, { recursive: true });
});
const fixture = (n) => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
ta('importer: WordPress, Blogger and Markdown exports', async () => {
  const wp = await readWordPress(fixture('wordpress.xml'));
  assert.deepEqual(wp.map((p) => [p.kind, p.title, p.published]), [['post', 'My First Post: & Things', true], ['post', 'Unfinished', false], ['page', 'About', true]]);
  assert.equal(wp[0].date, '2023-01-02'); assert.equal(wp[0].category, 'Notes'); assert.deepEqual(wp[0].tags, ['Privacy', 'Tips']);
  const bl = await readBlogger(fixture('blogger.atom'));
  assert.deepEqual(bl.map((p) => [p.title, p.published, p.slug]), [['Hello Blogger', true, 'hello-blogger'], ['Draft one', false, '']]);
  assert.deepEqual(bl[0].tags, ['Travel']); assert.equal(bl[0].category, 'Life');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-'));
  const rep = await convertPosts(wp, { outDir: path.join(out, 'a'), pagesDir: path.join(out, 'p') });
  assert.equal(rep.created.length, 2); assert.equal(rep.drafts, 1); assert.equal(rep.pages, 1);
  const md = fs.readFileSync(path.join(out, 'a', '2023-01-02-my-first-post.md'), 'utf8');
  assert.ok(md.includes('[link](https://example.com/x)') && md.includes('```python') && md.includes('@[youtube](aqz-KE-bpKQ "Demo")'));
  assert.ok(!/<script|alert\(1\)/.test(md), 'scripts from the old site are dropped');
  const { data } = parseFrontmatter(md);
  assert.equal(data.title, 'My First Post: & Things'); assert.deepEqual(data.tags, ['Privacy', 'Tips']);
  assert.equal(parseFrontmatter(fs.readFileSync(path.join(out, 'a', '2023-02-01-unfinished.md'), 'utf8')).data.draft, true);
  const again = await convertPosts(wp, { outDir: path.join(out, 'a'), pagesDir: path.join(out, 'p') });
  assert.equal(again.created.length, 0); assert.equal(again.skipped.length, 2); // never overwrites unless --force
  const m = readMarkdownFile(fixture('md-site/2022-03-04-jekyll-post.md'), '2022-03-04-jekyll-post.md', '2000-01-01');
  assert.equal(m.title, 'Jekyll Post'); assert.equal(m.date, '2022-03-04'); assert.equal(m.category, 'dev'); assert.deepEqual(m.tags, ['tips', 'a', 'b']);
  const o = readMarkdownFile(fixture('md-site/obsidian-note.md'), 'obsidian-note.md', '2001-02-03');
  assert.equal(o.title, 'Obsidian Note'); assert.equal(o.date, '2001-02-03'); assert.ok(!o.markdown.startsWith('# Obsidian'));
  assert.ok(frontMatter({ title: 'He said "x"\nnewline', date: '2020-01-01', slug: 's', tags: ['a,b', '[c]'], category: '', published: false }).includes('draft: true'));
  assert.equal(wpautop('One.\n\nTwo.'), '<p>One.</p>\n\n<p>Two.</p>');
  fs.rmSync(out, { recursive: true });
});
ta('importer: image download keeps only safe pictures', async () => {
  const real = globalThis.fetch;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  globalThis.fetch = async (u) => {
    if (u.endsWith('ok.png')) return { ok: true, headers: new Headers({ 'content-type': 'image/png' }), arrayBuffer: async () => png };
    if (u.endsWith('x.svg')) return { ok: true, headers: new Headers({ 'content-type': 'image/svg+xml' }), arrayBuffer: async () => Buffer.from('<svg onload=alert(1)>') };
    return { ok: false, status: 404, headers: new Headers() };
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'img-'));
  const report = { warn: [] };
  const out = await downloadImages('![a](https://x.example/ok.png) ![b](https://x.example/x.svg) ![c](https://x.example/gone.jpg)', dir, report);
  globalThis.fetch = real;
  assert.match(out, /!\[a\]\(\/images\/imported\/ok-[0-9a-f]{6}\.png\)/);
  assert.ok(out.includes('(https://x.example/x.svg)') && out.includes('(https://x.example/gone.jpg)'));
  assert.equal(report.warn.length, 2); assert.equal(fs.readdirSync(dir).length, 1);
  fs.rmSync(dir, { recursive: true });
});
ta('browser editor settings: valid YAML, pinned script with an integrity hash', async () => {
  const C = { name: 'Site', categories: { Notes: 'x' }, languages: [{ code: 'en' }, { code: 'hi' }] };
  const yml = adminConfig(C, { repo: 'me/blog', branch: 'main', siteUrl: 'https://me.github.io', base: '/blog' });
  let load; try { load = (await import('js-yaml')).load; } catch { load = null; }
  if (load) {
    const cfg = load(yml);
    assert.equal(cfg.backend.repo, 'me/blog'); assert.deepEqual(cfg.collections.map((c) => c.name), ['articles', 'projects', 'pages']);
    assert.ok(cfg.collections[0].fields.some((f) => f.name === 'draft' && f.default === true));
    assert.equal(cfg.collections[0].folder, 'content/articles');
  }
  assert.ok(/@sveltia\/cms@\d+\.\d+\.\d+\//.test(CMS_SRC) && /^sha384-[A-Za-z0-9+/]{64}$/.test(CMS_INTEGRITY));
  assert.ok(adminHtml(C).includes(`integrity="${CMS_INTEGRITY}"`) && adminHtml(C).includes('noindex'));
});

t('footnotes: numbered in order of use, repeated refs, back-links, unknown refs left alone', () => {
  const h = html('A[^x] B[^y] C[^x] D[^nope] `[^x]`\n\n[^x]: First *note*\n  more\n[^y]: Second');
  assert.equal((h.match(/class="fnref"/g) || []).length, 3);
  assert.match(h, /id="fnref-x-2"/); assert.match(h, /<li id="fn-x">First <em>note<\/em> more/); assert.match(h, /\[\^nope\]/); assert.match(h, /<code>\[\^x\]<\/code>/);
  assert.equal(html('no notes here').includes('footnotes'), false);
});
t('footnote text cannot inject HTML', () => assert.ok(!/<script|onerror/i.test(html('x[^1]\n\n[^1]: <img src=x onerror=alert(1)><script>alert(2)</script>'))));
t('headings cannot take footnote ids', () => assert.ok(!/id="fn-title"|id="fn-a"/.test(html('## fn-title\n\n## fn-a'))));
const feedCtx = { title: 'T & <Co>', description: 'd', language: 'en', home: 'https://x.test/', self: 'https://x.test/rss.xml', fullText: true, author: 'Me',
  items: [{ title: 'A "q" \u0001 <b>', url: 'https://x.test/a/', date: '2026-01-02', updated: '2026-02-03', category: 'C', excerpt: 'e & f', tags: ['t1'], html: '<p>hi ]]> there</p>' }] };
t('RSS, Atom and JSON Feed escape and stay well-formed', () => {
  const r = rssXml(feedCtx), a = atomXml(feedCtx), j = JSON.parse(jsonFeed(feedCtx));
  assert.ok(!/\u0001/.test(r + a + jsonFeed(feedCtx))); assert.ok(r.includes('T &amp; &lt;Co&gt;') && a.includes('T &amp; &lt;Co&gt;'));
  assert.ok(r.includes(']]]]><![CDATA[>')); assert.ok(a.includes('<updated>2026-02-03T00:00:00Z</updated>'));
  assert.equal(j.version, 'https://jsonfeed.org/version/1.1'); assert.deepEqual(j.items[0].tags, ['C', 't1']); assert.equal(j.items[0].date_modified, '2026-02-03T00:00:00Z');
});
ta('contrast maths and the shipped theme pass WCAG AA', async () => {
  assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01); assert.ok(contrast('#777777', '#ffffff') < 4.5);
  const cfg = (await import('../site.config.js')).default;
  assert.deepEqual(contrastIssues(cfg), []);
  assert.equal(contrastIssues({ theme: { text: '#999999', panel: '#ffffff' } }).length > 0, true);
});
t('accessibility audit finds skipped headings, empty links/buttons and unlabeled fields', () => {
  const bad = '<a class="skip" href="#main">x</a><main><h1>T</h1><h3>Skip</h3><a href="/x/"></a><button></button><input id="q"></main>';
  const msgs = auditHtml(bad, 'p').join('|');
  for (const w of ['jumps from h1 to h3', 'link with no text', 'button with no accessible name', 'no label']) assert.ok(msgs.includes(w), w);
  const good = '<a class="skip" href="#main">x</a><main><h1>T</h1><h2>S</h2><a href="/x/">Read</a><button aria-label="Go"></button><label for="q">Q</label><input id="q"><a href="/y/" aria-hidden="true" tabindex="-1"><img alt=""></a></main>';
  assert.deepEqual(auditHtml(good, 'p'), []);
});

await Promise.all(pending);
process.exit(failed ? 1 : 0);
