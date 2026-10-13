// ASRBMY Write — site behaviour: theme toggle, navigation, code copy, search.
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };

  // ── Theme ──────────────────────────────────────────────────────────────────
  if (!root.getAttribute('data-theme')) {
    root.setAttribute('data-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  const themeBtn = $('#theme-toggle');
  if (themeBtn) {
    themeBtn.innerHTML = '<span class="i-moon">' + themeBtn.innerHTML + '</span>' +
      '<span class="i-sun"><svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></span>';
    themeBtn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store.set('asrbmy-theme', next);
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  const menuBtn = $('#menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
  }
  const closeMenu = () => { document.body.classList.remove('nav-open'); if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false'); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { closeMenu(); menuBtn && menuBtn.focus(); } });
  addEventListener('resize', () => { if (innerWidth > 860) closeMenu(); });
  $$('#site-nav a').forEach((a) => a.addEventListener('click', closeMenu));
  const subs = $$('.has-sub');
  const setOpen = (li, open) => {
    li.classList.toggle('open', open);
    $('.nav__toggle', li).setAttribute('aria-expanded', String(open));
  };
  subs.forEach((li) => {
    const btn = $('.nav__toggle', li);
    btn.addEventListener('click', () => {
      const willOpen = !li.classList.contains('open');
      subs.forEach((o) => setOpen(o, false));
      setOpen(li, willOpen);
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && li.classList.contains('open')) { setOpen(li, false); btn.focus(); }
    });
    li.addEventListener('focusout', (e) => { if (!li.contains(e.relatedTarget)) setOpen(li, false); });
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.has-sub')) subs.forEach((li) => setOpen(li, false)); });

  // ── Copy buttons on code blocks ────────────────────────────────────────────
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return; }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) throw new Error('copy failed');
  }
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.code-copy');
    if (!btn) return;
    const label = $('.code-copy__label', btn);
    try {
      await copyText($('code', btn.closest('.code-block')).textContent.replace(/\n$/, ''));
      label.textContent = 'Copied'; btn.classList.add('is-done');
    } catch { label.textContent = 'Press Ctrl+C'; }
    setTimeout(() => { label.textContent = 'Copy'; btn.classList.remove('is-done'); }, 1800);
  });

  // ── Search ─────────────────────────────────────────────────────────────────
  const app = $('#search-app');
  if (app) {
    const input = $('#q', app);
    const status = $('#search-status', app);
    const list = $('#search-results', app);
    let data = null;
    const load = () => data
      ? Promise.resolve(data)
      : fetch(app.dataset.index).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => (data = d));
    const count = (hay, needle) => { let n = 0, i = hay.indexOf(needle); while (i !== -1 && n < 5) { n++; i = hay.indexOf(needle, i + needle.length); } return n; };
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    function run(query) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) return [];
      return data.map((a) => {
        const t = a.t.toLowerCase(), c = a.c.toLowerCase(), g = a.g.join(' ').toLowerCase(), e = a.e.toLowerCase(), x = a.x.toLowerCase();
        let score = 0;
        for (const w of terms) {
          let s = 0;
          if (t.includes(w)) s += 10;
          if (c.includes(w) || g.includes(w)) s += 5;
          if (e.includes(w)) s += 3;
          s += count(x, w);
          if (!s) return null; // every term must match somewhere
          score += s;
        }
        return { a, score };
      }).filter(Boolean).sort((p, q) => q.score - p.score || q.a.d.localeCompare(p.a.d));
    }
    function marked(text, terms) {
      const frag = document.createDocumentFragment();
      if (!terms.length) { frag.append(text); return frag; }
      const re = new RegExp('(' + terms.map(esc).join('|') + ')', 'ig');
      text.split(re).forEach((part, i) => {
        if (i % 2) { const m = document.createElement('mark'); m.textContent = part; frag.append(m); } else frag.append(part);
      });
      return frag;
    }
    function snippet(a, terms) {
      const low = a.x.toLowerCase();
      let at = -1;
      for (const w of terms) { const i = low.indexOf(w); if (i !== -1 && (at === -1 || i < at)) at = i; }
      if (at === -1 || a.e.toLowerCase().includes(terms[0])) return a.e;
      const from = Math.max(0, at - 70);
      return (from ? '…' : '') + a.x.slice(from, from + 220).trim() + '…';
    }
    function render(query) {
      list.textContent = '';
      const q = query.trim();
      if (!q) { status.textContent = `Type to search ${data.length} article${data.length === 1 ? '' : 's'}.`; return; }
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = run(q);
      status.textContent = hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'} for “${q}”` : `No articles match “${q}”.`;
      for (const { a } of hits) {
        const li = document.createElement('li');
        const kick = document.createElement('p'); kick.className = 'kicker'; kick.textContent = a.c;
        const h = document.createElement('h3'); const link = document.createElement('a'); link.href = a.u; link.append(marked(a.t, terms)); h.append(link);
        const p = document.createElement('p'); p.append(marked(snippet(a, terms), terms));
        const meta = document.createElement('p'); meta.className = 'meta'; meta.textContent = `${a.d} · ${a.r} min read`;
        li.append(kick, h, p, meta);
        list.append(li);
      }
    }

    const initial = new URLSearchParams(location.search).get('q') || '';
    input.value = initial;
    status.textContent = 'Loading…';
    load().then(() => {
      render(initial);
      input.addEventListener('input', () => {
        render(input.value);
        const url = new URL(location.href);
        input.value.trim() ? url.searchParams.set('q', input.value.trim()) : url.searchParams.delete('q');
        history.replaceState(null, '', url);
      });
      $('form', app).addEventListener('submit', (e) => { e.preventDefault(); render(input.value); });
    }).catch(() => { status.textContent = 'Search is unavailable right now. Browse all articles instead.'; });
  }
})();
