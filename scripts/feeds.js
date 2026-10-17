// Feed writers: RSS 2.0, Atom 1.0 and JSON Feed 1.1. Shared by the main feed and the per-tag / per-category feeds.
import { esc } from './markdown.js';

const clean = (v) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const xml = (v) => esc(clean(v));
const rfc = (d) => new Date(`${d}T00:00:00Z`).toUTCString();
const iso = (d) => `${d}T00:00:00Z`;

/** ctx: { title, description, language, home, self, items:[{title,url,date,updated,category,excerpt,html,tags}], fullText, author } (urls already absolute) */
export function rssXml(ctx) {
  const items = ctx.items.map((a) => `    <item>
      <title>${xml(a.title)}</title>
      <link>${xml(a.url)}</link>
      <guid isPermaLink="true">${xml(a.url)}</guid>
      <pubDate>${rfc(a.date)}</pubDate>
      <category>${xml(a.category)}</category>
      <description>${xml(a.excerpt)}</description>${ctx.fullText ? `\n      <content:encoded><![CDATA[${a.html.replace(/]]>/g, ']]]]><![CDATA[>')}]]></content:encoded>` : ''}
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${xml(ctx.title)}</title>
    <link>${xml(ctx.home)}</link>
    <description>${xml(ctx.description)}</description>
    <lastBuildDate>${rfc(ctx.items[0]?.date || new Date().toISOString().slice(0, 10))}</lastBuildDate>
    <language>${xml(ctx.language)}</language>
    <atom:link href="${xml(ctx.self)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

export function atomXml(ctx) {
  const entries = ctx.items.map((a) => `  <entry>
    <title>${xml(a.title)}</title>
    <link href="${xml(a.url)}"/>
    <id>${xml(a.url)}</id>
    <published>${iso(a.date)}</published>
    <updated>${iso(a.updated || a.date)}</updated>
    <category term="${xml(a.category)}"/>
    <summary>${xml(a.excerpt)}</summary>${ctx.fullText ? `\n    <content type="html">${xml(a.html)}</content>` : ''}
  </entry>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${xml(ctx.language)}">
  <title>${xml(ctx.title)}</title>
  <subtitle>${xml(ctx.description)}</subtitle>
  <link href="${xml(ctx.home)}"/>
  <link rel="self" href="${xml(ctx.self)}"/>
  <id>${xml(ctx.home)}</id>
  <updated>${iso(ctx.items[0]?.updated || ctx.items[0]?.date || new Date().toISOString().slice(0, 10))}</updated>
  <author><name>${xml(ctx.author || ctx.title)}</name></author>
${entries}
</feed>
`;
}

export function jsonFeed(ctx) {
  return JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: clean(ctx.title), home_page_url: ctx.home, feed_url: ctx.self, description: clean(ctx.description), language: ctx.language,
    items: ctx.items.map((a) => ({
      id: a.url, url: a.url, title: clean(a.title), summary: clean(a.excerpt),
      ...(ctx.fullText ? { content_html: a.html } : {}),
      date_published: iso(a.date), ...(a.updated ? { date_modified: iso(a.updated) } : {}),
      tags: [a.category, ...(a.tags || [])].filter(Boolean).map(clean),
    })),
  }, null, 2);
}
