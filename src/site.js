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
    const sync = () => themeBtn.setAttribute('aria-pressed', String(root.getAttribute('data-theme') === 'dark'));
    sync();
    themeBtn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store.set('asrbmy-theme', next);
      sync();
    });
    // Follow the system setting live, unless the reader picked a theme themselves
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
      if (store.get && store.get('asrbmy-theme')) return;
      root.setAttribute('data-theme', e.matches ? 'dark' : 'light'); sync();
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

  // ── Reading progress + "on this page" highlighting (article pages) ─────────
  const bar = document.querySelector('#read-progress span');
  const article = document.querySelector('.article .prose');
  if (article) {
    const links = [...document.querySelectorAll('.toc a[href^="#"], .side-toc a[href^="#"]')];
    const targets = [...new Set(links.map((a) => a.getAttribute('href').slice(1)))]
      .map((id) => document.getElementById(id)).filter(Boolean);
    let ticking = false;
    const update = () => {
      ticking = false;
      if (bar) {
        const r = article.getBoundingClientRect();
        const total = r.height - innerHeight * 0.6;
        const done = total > 0 ? Math.min(1, Math.max(0, (innerHeight * 0.2 - r.top) / total)) : 0;
        bar.style.transform = `scaleX(${done.toFixed(4)})`;
      }
      if (targets.length) {
        let current = null;
        for (const t of targets) if (t.getBoundingClientRect().top <= 120) current = t.id;
        for (const a of links) {
          if (a.getAttribute('href') === '#' + current) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        }
      }
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    update();
  }

  // ── Share, save for later, print ───────────────────────────────────────────
  const KEY = 'asrbmy-bookmarks';
  const readList = () => { try { const v = JSON.parse(store.get(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const shareBar = document.querySelector('.share');
  if (shareBar) {
    const status = shareBar.querySelector('.share__status');
    const say = (t) => { if (status) { status.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => { status.textContent = ''; }, 2500); } };
    const url = shareBar.dataset.url || location.href;
    shareBar.querySelector('[data-copy]')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); say('Link copied'); }
      catch {
        const t = document.createElement('textarea'); t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.append(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ } t.remove();
        say(ok ? 'Link copied' : 'Copy failed. Select the address bar instead.');
      }
    });
    const native = shareBar.querySelector('[data-native]');
    if (native && navigator.share) {
      native.hidden = false;
      native.addEventListener('click', () => { navigator.share({ title: shareBar.dataset.title, url }).catch(() => { /* cancelled */ }); });
    }
    shareBar.querySelector('[data-print]')?.addEventListener('click', () => window.print());
    const bm = shareBar.querySelector('[data-bookmark]');
    if (bm) {
      const here = location.pathname;
      const label = bm.querySelector('span');
      const draw = () => {
        const on = readList().some((b) => b.u === here);
        bm.setAttribute('aria-pressed', String(on));
        if (label) label.textContent = on ? 'Saved' : 'Save for later';
        bm.title = on ? 'Press to remove from your reading list' : 'Add to your reading list';
      };
      draw();
      bm.addEventListener('click', () => {
        let list = readList();
        if (list.some((b) => b.u === here)) { list = list.filter((b) => b.u !== here); say('Removed from your reading list'); }
        else { list.unshift({ u: here, t: shareBar.dataset.title || document.title, d: new Date().toISOString().slice(0, 10) }); say('Saved to your reading list'); }
        store.set(KEY, JSON.stringify(list.slice(0, 200)));
        draw();
      });
    }
  }

  // ── Click-to-play videos (nothing loads from the video site until pressed) ─
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.video__play');
    if (!btn) return;
    const box = btn.closest('.video');
    const { provider, id, title } = box.dataset;
    const src = provider === 'vimeo' ? `https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=1` : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
    const f = document.createElement('iframe');
    f.src = src; f.title = title || 'Video'; f.loading = 'lazy'; f.allowFullscreen = true;
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    box.textContent = ''; box.append(f); f.focus();
  });

  // ── Keep glossary hints inside the screen ──────────────────────────────────
  const placeHint = (e) => {
    const a = e.target.closest && e.target.closest('a.gloss');
    if (!a) return;
    a.style.removeProperty('--gloss-shift');
    requestAnimationFrame(() => {
      const w = parseFloat(getComputedStyle(a, '::after').width) || 0;
      const left = a.getBoundingClientRect().left;
      const overflow = left + w - (innerWidth - 12);
      if (overflow > 0) a.style.setProperty('--gloss-shift', `${-Math.min(overflow, left - 12)}px`);
    });
  };
  document.addEventListener('mouseover', placeHint);
  document.addEventListener('focusin', placeHint);
})();
