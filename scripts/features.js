// Optional site features that depend on outside services: analytics and the newsletter form.
// Both are off until switched on in site.config.js, and both add their addresses to the page's
// Content-Security-Policy so the browser allows exactly those services and nothing else.
import { esc } from './markdown.js';

const https = (v, what) => {
  let url;
  try { url = new URL(String(v)); } catch { throw new Error(`site.config.js: ${what} must be a full https:// address (got "${v}")`); }
  if (url.protocol !== 'https:') throw new Error(`site.config.js: ${what} must start with https:// (got "${v}")`);
  return url;
};

/** Privacy-friendly analytics. Returns the <script> tag, the origins to allow, and a sentence for the Privacy page. */
export function analyticsInfo(C) {
  const a = C.analytics || {};
  if (!a.provider) return null;
  if (a.provider === 'plausible') {
    if (!a.domain) throw new Error('site.config.js: analytics.domain is needed for Plausible (your site address without https://)');
    const src = https(a.src || 'https://plausible.io/js/script.js', 'analytics.src');
    return {
      tag: `<script defer data-domain="${esc(a.domain)}" src="${esc(src.href)}"></script>`,
      script: [src.origin], connect: [src.origin],
      note: 'This site uses Plausible Analytics to count visits. It sets no cookies, does not track you across sites and keeps no personal profile of you.',
    };
  }
  if (a.provider === 'goatcounter') {
    if (!/^[a-z0-9-]+$/i.test(String(a.code || ''))) throw new Error('site.config.js: analytics.code is needed for GoatCounter (the name in https://NAME.goatcounter.com)');
    const endpoint = `https://${a.code}.goatcounter.com/count`;
    return {
      tag: `<script data-goatcounter="${esc(endpoint)}" async src="https://gc.zgo.at/count.js"></script>`,
      script: ['https://gc.zgo.at'], connect: [`https://${a.code}.goatcounter.com`],
      note: 'This site uses GoatCounter to count visits. It sets no cookies and keeps no personal profile of you.',
    };
  }
  if (a.provider === 'custom') {
    const src = https(a.src, 'analytics.src');
    const attrs = Object.entries(a.attrs || {}).filter(([k]) => /^(data-[a-z0-9-]+|defer|async)$/.test(k))
      .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join('');
    return {
      tag: `<script${attrs} src="${esc(src.href)}"></script>`,
      script: [src.origin], connect: (a.connect || []).map((c) => https(c, 'analytics.connect').origin).concat(src.origin),
      note: a.note || 'This site uses an analytics service to count visits.',
    };
  }
  throw new Error(`site.config.js: analytics.provider "${a.provider}" is not known (use "plausible", "goatcounter" or "custom")`);
}

/** Newsletter sign-up form that posts straight to your email service. */
export function newsletterInfo(C) {
  const n = C.newsletter || {};
  if (!n.enabled) return null;
  let action = n.action, field = n.field || 'email', hidden = { ...(n.hidden || {}) };
  if (n.provider === 'buttondown') {
    if (!/^[a-z0-9_-]+$/i.test(String(n.username || ''))) throw new Error('site.config.js: newsletter.username is needed for Buttondown');
    action = `https://buttondown.com/api/emails/embed-subscribe/${n.username}`;
    hidden = { embed: '1', ...hidden };
  }
  if (!action) throw new Error('site.config.js: newsletter.action is needed (the form address from your email service)');
  const url = https(action, 'newsletter.action');
  return {
    action: url.href, origin: url.origin, field: String(field).replace(/[^\w-]/g, ''), hidden,
    title: n.title || 'Get new articles by email', text: n.text || 'One email when something new is published. No spam; unsubscribe any time.',
    button: n.button || 'Subscribe', placeholder: n.placeholder || 'you@example.com',
    note: n.note || `Your address goes to ${url.hostname}, the service that sends the emails.`,
  };
}

/** Contact form that posts straight to a form service. */
export function contactInfo(C) {
  const f = C.contact?.form || {};
  if (!f.enabled) return null;
  if (!f.action) throw new Error('site.config.js: contact.form.action is needed (the address your form service gave you)');
  const url = https(f.action, 'contact.form.action');
  const next = f.next ? https(f.next, 'contact.form.next').href : '';
  const topics = (Array.isArray(f.topics) && f.topics.length ? f.topics : ['Question', 'Suggest a topic', 'Feedback']).map(String).filter(Boolean).slice(0, 12);
  return { action: url.href, origin: url.origin, next, topics, note: f.note || `Your message goes to ${url.hostname}, the service that delivers it to ${C.author?.name || 'the author'}.` };
}

/** Public view counter + popular list (GoatCounter). */
export function viewsInfo(C) {
  const wantViews = C.views?.enabled === true;
  const wantPopular = C.popular?.enabled === true;
  if (!wantViews && !wantPopular) return null;
  const a = C.analytics || {};
  if (a.provider !== 'goatcounter' || !/^[a-z0-9-]+$/i.test(String(a.code || ''))) {
    throw new Error('site.config.js: "views" and "popular" need analytics.provider "goatcounter" with your code');
  }
  return { code: a.code, origin: `https://${a.code}.goatcounter.com`, views: wantViews, popular: wantPopular, days: Math.min(365, Math.max(1, Number(C.popular?.days) || 30)), count: Math.min(10, Math.max(1, Number(C.popular?.count) || 4)), title: C.popular?.title || 'Popular this month' };
}

/** Top pages for the last N days from GoatCounter's API. Never throws: a failure just means no list. */
export async function fetchPopular(info, token, { fetchImpl = fetch, timeoutMs = 8000, now = new Date() } = {}) {
  if (!info || !token) return [];
  const iso = (d) => d.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - info.days * 86400000);
  const url = `${info.origin}/api/v0/stats/hits?start=${iso(start)}&end=${iso(now)}&limit=40`;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return (Array.isArray(j.hits) ? j.hits : []).map((h) => ({ path: String(h.path || ''), count: Number(h.count) || 0 })).filter((h) => h.path.startsWith('/') && h.count > 0);
  } catch (e) {
    console.warn(`! Could not fetch popular articles from GoatCounter (${e.message}). The block is left out this time.`);
    return [];
  }
}
