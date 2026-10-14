// Regression tests for security and parsing bugs. Run with: npm run test:unit
import assert from 'node:assert/strict';
import { renderMarkdown, parseFrontmatter, cleanUrl, sanitizeHtml } from '../scripts/markdown.js';

let failed = 0;
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

process.exit(failed ? 1 : 0);
