// Regression tests for security and parsing bugs. Run with: npm run test:unit
import assert from 'node:assert/strict';
import { analyticsInfo, newsletterInfo } from '../scripts/features.js';
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

process.exit(failed ? 1 : 0);
