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

  // ── Search: every word must match; near-misses (typos) are forgiven; filter by category, tag, year ──
  const app = $('#search-app');
  if (app) {
    const input = $('#q', app);
    const status = $('#search-status', app);
    const list = $('#search-results', app);
    const filtersBox = $('#search-filters', app);
    let data = null, vocab = null;
    const fuzzyCache = new Map();
    const load = () => data
      ? Promise.resolve(data)
      : fetch(app.dataset.index).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => {
        d.forEach((a) => { a._t = a.t.toLowerCase(); a._c = a.c.toLowerCase(); a._g = a.g.join(' ').toLowerCase(); a._e = a.e.toLowerCase(); a._x = a.x.toLowerCase(); a._y = a.d.slice(0, 4); });
        return (data = d);
      });
    const count = (hay, needle) => { let n = 0, i = hay.indexOf(needle); while (i !== -1 && n < 5) { n++; i = hay.indexOf(needle, i + needle.length); } return n; };
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Edit distance with early exit (counts a swapped pair of letters as one slip)
    const near = (a, b, k) => {
      const n = a.length, m = b.length;
      if (Math.abs(n - m) > k) return false;
      let p2 = null, p1 = Array.from({ length: m + 1 }, (_, j) => j);
      for (let i = 1; i <= n; i++) {
        const cur = [i]; let best = i;
        for (let j = 1; j <= m; j++) {
          let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
          if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
          cur[j] = v; if (v < best) best = v;
        }
        if (best > k) return false;
        p2 = p1; p1 = cur;
      }
      return p1[m] <= k;
    };
    const buildVocab = () => {
      vocab = new Map();
      data.forEach((a, i) => {
        for (const w of (a._t + ' ' + a._g + ' ' + a._c + ' ' + a._e + ' ' + a._x).match(/[\p{L}\p{N}]{3,}/gu) || []) {
          let s = vocab.get(w); if (!s) vocab.set(w, (s = new Set())); s.add(i);
        }
      });
    };
    /** Articles that contain a word spelled almost like `term`, plus those words (to highlight). */
    const fuzzy = (term) => {
      if (fuzzyCache.has(term)) return fuzzyCache.get(term);
      if (!vocab) buildVocab();
      const k = term.length <= 3 ? 0 : term.length <= 7 ? 1 : 2;
      const out = { idx: new Set(), words: [] };
      if (k) for (const [w, set] of vocab) if (w !== term && near(term, w, k)) { out.words.push(w); set.forEach((i) => out.idx.add(i)); }
      fuzzyCache.set(term, out);
      return out;
    };

    const filters = { cat: '', tag: '', year: '', sort: 'rel' };
    function run(query) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      const pool = data.filter((a) => (!filters.cat || a.c === filters.cat) && (!filters.tag || a.g.includes(filters.tag)) && (!filters.year || a._y === filters.year));
      const newest = (p, q) => q.a.d.localeCompare(p.a.d) || p.a.t.localeCompare(q.a.t);
      if (!terms.length) return { hits: pool.map((a) => ({ a, score: 0 })).sort(newest), hl: [], similar: false };
      const hl = new Set(terms);
      let similar = false;
      const hits = pool.map((a) => {
        let score = 0;
        for (const w of terms) {
          let s = 0;
          if (a._t.includes(w)) s += 10;
          if (a._c.includes(w) || a._g.includes(w)) s += 5;
          if (a._e.includes(w)) s += 3;
          s += count(a._x, w);
          if (!s && w.length >= 4) {
            const f = fuzzy(w);
            if (f.idx.has(data.indexOf(a))) { s = 2; similar = true; f.words.forEach((x) => hl.add(x)); }
          }
          if (!s) return null; // every word must match somewhere
          score += s;
        }
        return { a, score };
      }).filter(Boolean).sort((p, q) => (filters.sort === 'new' ? 0 : q.score - p.score) || newest(p, q));
      return { hits, hl: [...hl], similar };
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
      let at = -1;
      for (const w of terms) { const i = a._x.indexOf(w); if (i !== -1 && (at === -1 || i < at)) at = i; }
      if (at === -1 || terms.some((w) => a._e.includes(w))) return a.e;
      const from = Math.max(0, at - 70);
      return (from ? '…' : '') + a.x.slice(from, from + 220).trim() + '…';
    }
    const activeFilters = () => [filters.cat, filters.tag && '#' + filters.tag, filters.year].filter(Boolean).join(' · ');
    function render(query) {
      list.textContent = '';
      const q = query.trim();
      if (!q && !activeFilters()) { status.textContent = `Type to search ${data.length} article${data.length === 1 ? '' : 's'}.`; return; }
      const { hits, hl, similar } = run(q);
      const what = [q && `“${q}”`, activeFilters()].filter(Boolean).join(' in ');
      status.textContent = hits.length
        ? `${hits.length} result${hits.length === 1 ? '' : 's'}${what ? ' for ' + what : ''}${similar ? ' (includes similar spellings)' : ''}`
        : `No articles match ${what}.`;
      for (const { a } of hits) {
        const li = document.createElement('li');
        const kick = document.createElement('p'); kick.className = 'kicker'; kick.textContent = a.c;
        const h = document.createElement('h3'); const link = document.createElement('a'); link.href = a.u; link.append(marked(a.t, hl)); h.append(link);
        const p = document.createElement('p'); p.append(marked(snippet(a, hl), hl));
        const meta = document.createElement('p'); meta.className = 'meta'; meta.textContent = `${a.d} · ${a.r} min read`;
        li.append(kick, h, p, meta);
        list.append(li);
      }
    }
    function syncUrl() {
      const url = new URL(location.href);
      const set = (k, v) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
      set('q', input.value.trim()); set('cat', filters.cat); set('tag', filters.tag); set('year', filters.year); set('sort', filters.sort === 'new' ? 'new' : '');
      history.replaceState(null, '', url);
    }
    function buildFilters() {
      if (!filtersBox || data.length < 2) return;
      const uniq = (arr) => [...new Set(arr)].sort((x, y) => x.localeCompare(y));
      const mk = (id, label, opts, key) => {
        const wrap = document.createElement('div'); wrap.className = 'field';
        const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = label;
        const sel = document.createElement('select'); sel.id = id;
        for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.append(o); }
        sel.value = filters[key] || '';
        if (sel.value !== (filters[key] || '')) { filters[key] = ''; sel.value = ''; }
        sel.addEventListener('change', () => { filters[key] = sel.value; render(input.value); syncUrl(); });
        wrap.append(lab, sel); filtersBox.append(wrap);
      };
      mk('f-cat', 'Category', [['', 'All categories'], ...uniq(data.map((a) => a.c)).map((c) => [c, c])], 'cat');
      mk('f-tag', 'Tag', [['', 'All tags'], ...uniq(data.flatMap((a) => a.g)).map((t) => [t, '#' + t])], 'tag');
      mk('f-year', 'Year', [['', 'Any year'], ...uniq(data.map((a) => a._y)).reverse().map((y) => [y, y])], 'year');
      mk('f-sort', 'Sort by', [['rel', 'Best match'], ['new', 'Newest first']], 'sort');
      filtersBox.hidden = false;
    }

    const params = new URLSearchParams(location.search);
    const initial = params.get('q') || '';
    filters.cat = params.get('cat') || ''; filters.tag = params.get('tag') || ''; filters.year = params.get('year') || ''; filters.sort = params.get('sort') === 'new' ? 'new' : 'rel';
    input.value = initial;
    status.textContent = 'Loading…';
    load().then(() => {
      buildFilters();
      render(initial);
      let timer;
      input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { render(input.value); syncUrl(); }, 90); });
      $('form', app).addEventListener('submit', (e) => { e.preventDefault(); render(input.value); syncUrl(); });
    }).catch(() => { status.textContent = 'Search is unavailable right now. Browse all articles instead.'; });
  }

  // ── Reading progress + "on this page" highlighting (article pages) ─────────
  const bar = document.querySelector('#read-progress span');
  const leftEl = document.querySelector('#read-progress .read-progress__left');
  const totalMin = Number(document.querySelector('#read-progress')?.dataset.min) || 0;
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
        if (leftEl) {
          const left = Math.ceil(totalMin * (1 - done));
          const show = totalMin > 1 && done > 0.04 && done < 0.97 && left >= 1;
          leftEl.hidden = !show;
          if (show) { const t = left + ' min left'; if (leftEl.textContent !== t) leftEl.textContent = t; }
        }
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
  // Saved articles are also kept for offline reading when the browser supports it (see sw.js)
  const offline = (type, url) => { try { navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage({ type, url }); } catch { /* not available */ } };
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
        bm.title = on ? 'Press to remove from your reading list' : 'Add to your reading list (also kept for offline reading)';
      };
      draw();
      bm.addEventListener('click', () => {
        let list = readList();
        if (list.some((b) => b.u === here)) { list = list.filter((b) => b.u !== here); say('Removed from your reading list'); }
        else { list.unshift({ u: here, t: shareBar.dataset.title || document.title, d: new Date().toISOString().slice(0, 10) }); say('Saved to your reading list'); }
        store.set(KEY, JSON.stringify(list.slice(0, 200)));
        offline(list.some((b) => b.u === here) ? 'save' : 'unsave', here);
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
  // ── Reading settings panel ─────────────────────────────────────────────────
  const rBtn = $('#reader-btn'), rPanel = $('#reader-panel');
  if (rBtn && rPanel) {
    const KEYR = 'asrbmy-reader';
    const DEF = { rs: 'md', rw: 'full', rf: 'site', rc: 'normal' };
    const read = () => { try { const v = JSON.parse(store.get(KEYR) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
    const apply = (prefs) => {
      for (const k of Object.keys(DEF)) {
        const v = prefs[k];
        if (v && v !== DEF[k] && /^[a-z]{2,8}$/.test(v)) root.setAttribute('data-' + k, v); else root.removeAttribute('data-' + k);
        const r = $(`input[name="${k}"][value="${v && /^[a-z]{2,8}$/.test(v) ? v : DEF[k]}"]`, rPanel) || $(`input[name="${k}"][value="${DEF[k]}"]`, rPanel);
        if (r) r.checked = true;
      }
    };
    apply(read());
    rBtn.hidden = false;
    const setOpen = (open) => {
      rPanel.hidden = !open; rBtn.setAttribute('aria-expanded', String(open));
      if (open) { const c = $('input:checked', rPanel); c && c.focus(); }
    };
    rBtn.addEventListener('click', () => setOpen(rPanel.hidden));
    $('#reader-close').addEventListener('click', () => { setOpen(false); rBtn.focus(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !rPanel.hidden) { setOpen(false); rBtn.focus(); } });
    document.addEventListener('click', (e) => { if (!rPanel.hidden && !rPanel.contains(e.target) && !rBtn.contains(e.target)) setOpen(false); });
    rPanel.addEventListener('change', (e) => {
      const t = e.target; if (!t || t.type !== 'radio') return;
      const prefs = read(); prefs[t.name] = t.value;
      for (const k of Object.keys(prefs)) if (!(k in DEF) || prefs[k] === DEF[k]) delete prefs[k];
      store.set(KEYR, JSON.stringify(prefs)); apply(prefs);
    });
    $('#reader-reset').addEventListener('click', () => { store.set(KEYR, '{}'); apply({}); });
  }

  // ── Select text in an article → copy a link that jumps to (and highlights) that passage ──
  const proseEl = document.querySelector('.article .prose');
  if (proseEl) {
    const bar = document.createElement('div');
    bar.className = 'quote-bar'; bar.hidden = true; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Selected text');
    const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', fn); return b; };
    let current = '';
    const fragEnc = (t) => encodeURIComponent(t).replace(/-/g, '%2D');
    const linkFor = (text) => {
      const words = text.split(/\s+/);
      const frag = text.length <= 120 ? fragEnc(text) : fragEnc(words.slice(0, 5).join(' ')) + ',' + fragEnc(words.slice(-5).join(' '));
      return location.origin + location.pathname + location.search + '#:~:text=' + frag;
    };
    const done = (msg) => { bar.textContent = ''; const m = document.createElement('span'); m.className = 'quote-bar__msg'; m.textContent = msg; bar.append(m); setTimeout(() => { bar.hidden = true; build(); }, 1100); };
    const build = () => {
      bar.textContent = '';
      bar.append(
        mk('Copy link to passage', async () => { try { await copyText(linkFor(current)); done('Link copied'); } catch { done('Copy failed'); } }),
        mk('Copy quote', async () => { try { await copyText('“' + current + '”\n' + linkFor(current)); done('Quote copied'); } catch { done('Copy failed'); } }),
      );
    };
    build();
    document.body.append(bar);
    let timer;
    const check = () => {
      const sel = getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { bar.hidden = true; return; }
      const range = sel.getRangeAt(0);
      if (!proseEl.contains(range.commonAncestorContainer)) { bar.hidden = true; return; }
      const box = document.createElement('div'); box.append(range.cloneContents());
      box.querySelectorAll('.sr-only, .anchor, .code-copy, script, style').forEach((n) => n.remove());
      const text = box.textContent.replace(/\s+/g, ' ').trim();
      if (text.length < 8 || text.length > 1500) { bar.hidden = true; return; }
      current = text;
      const r = range.getBoundingClientRect();
      if (!r.width && !r.height) { bar.hidden = true; return; }
      bar.hidden = false;
      const w = bar.offsetWidth, h = bar.offsetHeight;
      const coarse = matchMedia('(pointer: coarse)').matches; // leave room for the phone's own selection menu
      let top = coarse ? r.bottom + 14 : r.top - h - 8;
      if (top < 8) top = r.bottom + 10;
      if (top + h > innerHeight - 8) top = Math.max(8, innerHeight - h - 8);
      bar.style.top = top + 'px';
      bar.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    };
    document.addEventListener('selectionchange', () => { clearTimeout(timer); timer = setTimeout(check, 180); });
    addEventListener('scroll', () => { if (!bar.hidden) check(); }, { passive: true });
  }

  // ── Page views (GoatCounter's public counter, only when switched on in the config) ──
  const views = document.querySelector('[data-views]');
  if (views) {
    fetch(views.dataset.views, { credentials: 'omit' }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((j) => {
      const n = parseInt(String(j.count || '').replace(/\D/g, ''), 10);
      if (Number.isFinite(n) && n > 0) { views.textContent = n.toLocaleString() + (n === 1 ? ' view' : ' views'); views.hidden = false; }
    }).catch(() => { /* the counter is optional */ });
  }

  // ── Small helpers for the features below ───────────────────────────────────
  const toast = (msg) => {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.append(t); }
    t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200);
  };
  const jsonGet = (k, d) => { try { const v = JSON.parse(store.get(k) || 'null'); return v ?? d; } catch { return d; } };

  // ── Heading links: pressing the # beside a heading copies a link to that section ──
  document.addEventListener('click', async (e) => {
    const a = e.target.closest && e.target.closest('a.anchor');
    if (!a) return;
    e.preventDefault();
    const hash = a.getAttribute('href');
    try { history.replaceState(null, '', hash); } catch { /* ignore */ }
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    let ok = true; try { await copyText(location.origin + location.pathname + hash); } catch { ok = false; }
    toast(ok ? 'Link to this section copied' : 'Link is in the address bar');
  });

  // ── Articles you have finished: a ✓ on cards and links, and a reading streak ──
  const DONE = 'asrbmy-done';
  const doneList = () => { const v = jsonGet(DONE, []); return Array.isArray(v) ? v.filter((x) => x && typeof x.u === 'string') : []; };
  const paintDone = () => {
    const done = new Set(doneList().map((x) => x.u));
    if (!done.size) return;
    document.querySelectorAll('.card__title a, .related a, .upnext__title, .prevnext__item span, .series__list a').forEach((el) => {
      const link = el.closest('a') || el.parentElement.querySelector('a');
      const href = link && link.getAttribute('href');
      if (!href || !done.has(href.split('#')[0]) || el.querySelector('.chip--done') || el.parentElement.querySelector(':scope > .chip--done')) return;
      const chip = document.createElement('span'); chip.className = 'chip chip--done'; chip.textContent = '✓ Read'; chip.title = 'You finished this one';
      (el.tagName === 'A' ? el : el.firstElementChild || el).insertAdjacentElement('afterend', chip);
    });
  };
  const streakOf = (list) => {
    const days = new Set(list.map((x) => x.d)); let n = 0; const d = new Date();
    if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1); // today may not be read yet
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };
  if (article) {
    const here = location.pathname;
    let marked = doneList().some((x) => x.u === here);
    const check = () => {
      if (marked) return;
      const r = article.getBoundingClientRect();
      if (r.bottom <= innerHeight + 60 && scrollY > 200) {
        marked = true;
        const list = doneList().filter((x) => x.u !== here); list.unshift({ u: here, d: new Date().toISOString().slice(0, 10) });
        store.set(DONE, JSON.stringify(list.slice(0, 500)));
      }
    };
    addEventListener('scroll', check, { passive: true });
  }
  paintDone();
  document.querySelectorAll('[data-streak]').forEach((el) => {
    const list = doneList(); if (!list.length) return;
    const n = streakOf(list);
    el.textContent = `You have finished ${list.length} article${list.length === 1 ? '' : 's'}` + (n > 1 ? ` · ${n}-day reading streak` : '') + '.';
    el.hidden = false;
  });

  // ── Contents button on small screens ───────────────────────────────────────
  const tocList = document.querySelector('.side-toc ol, .toc__list');
  if (article && tocList) {
    const fab = document.createElement('button'); fab.type = 'button'; fab.className = 'toc-fab'; fab.textContent = 'Contents'; fab.setAttribute('aria-haspopup', 'dialog');
    const sheet = document.createElement('div'); sheet.className = 'toc-sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Contents');
    const inner = document.createElement('div'); inner.className = 'toc-sheet__box';
    const h = document.createElement('p'); h.className = 'toc-sheet__title'; h.textContent = 'On this page';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'toc-sheet__close'; close.textContent = 'Close';
    inner.append(h, tocList.cloneNode(true), close); sheet.append(inner); document.body.append(fab, sheet);
    const set = (open) => { sheet.hidden = !open; fab.setAttribute('aria-expanded', String(open)); if (open) close.focus(); else fab.focus(); };
    fab.addEventListener('click', () => set(true));
    close.addEventListener('click', () => set(false));
    sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) set(false); });
  }

  // ── "Was this helpful?" (the answer stays in this browser; GoatCounter gets an event if it is switched on) ──
  document.querySelectorAll('[data-helpful]').forEach((box) => {
    const KEYH = 'asrbmy-helpful', id = box.dataset.helpful;
    const msg = box.querySelector('.helpful__msg'), more = box.querySelector('.helpful__more');
    const show = (v) => {
      box.querySelectorAll('[data-vote]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.vote === v)); });
      msg.hidden = false; msg.textContent = v === 'yes' ? 'Glad it helped. Thank you.' : 'Thanks for saying so. I would like to fix that.';
      more.hidden = v !== 'no' || !more.textContent.trim();
    };
    const prev = jsonGet(KEYH, {})[id]; if (prev) show(prev);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-vote]'); if (!b) return;
      const all = jsonGet(KEYH, {}); all[id] = b.dataset.vote; store.set(KEYH, JSON.stringify(all)); show(b.dataset.vote);
      try { window.goatcounter && window.goatcounter.count && window.goatcounter.count({ path: `helpful-${b.dataset.vote}${id}`, title: `Helpful: ${b.dataset.vote}`, event: true }); } catch { /* optional */ }
    });
  });

  // ── Audio chapters ─────────────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-seek]'); if (!b) return;
    const au = document.querySelector('.audio audio'); if (!au) return;
    au.currentTime = Number(b.dataset.seek) || 0; au.play().catch(() => { /* needs a tap first */ });
  });

  // ── One-page print sheet ───────────────────────────────────────────────────
  document.querySelector('[data-sheet]')?.addEventListener('click', () => {
    document.body.classList.add('sheet-mode');
    const off = () => { document.body.classList.remove('sheet-mode'); removeEventListener('afterprint', off); };
    addEventListener('afterprint', off); window.print();
  });

  // ── Slides: turn the article into a slideshow (arrow keys, swipe, Esc) ─────
  document.querySelector('[data-slides]')?.addEventListener('click', (ev) => {
    const prose = document.querySelector('.article .prose'); if (!prose) return;
    const opener = ev.currentTarget;
    const slides = [];
    let cur = { title: document.querySelector('.article .title')?.textContent || document.title, nodes: [], intro: true };
    for (const n of prose.children) {
      if (n.tagName === 'H2') { slides.push(cur); cur = { title: n.cloneNode(true).childNodes[0]?.textContent || n.textContent.replace(/#$/, ''), nodes: [] }; }
      else cur.nodes.push(n);
    }
    slides.push(cur);
    const deck = slides.filter((s) => s.nodes.length || s.intro);
    if (deck.length < 2) return;
    const ov = document.createElement('div'); ov.className = 'slides'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Slides');
    const stage = document.createElement('div'); stage.className = 'slides__stage'; stage.tabIndex = -1;
    const bar = document.createElement('div'); bar.className = 'slides__bar';
    const mk = (t, l) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-label', l); return b; };
    const prev = mk('←', 'Previous slide'), next = mk('→', 'Next slide'), shut = mk('Close', 'Close slides'); const count = document.createElement('span'); count.setAttribute('aria-live', 'polite');
    bar.append(prev, count, next, shut); ov.append(stage, bar); document.body.append(ov); document.body.classList.add('slides-open');
    let i = 0;
    const draw = () => {
      const s = deck[i]; stage.textContent = '';
      const h = document.createElement(s.intro ? 'h1' : 'h2'); h.textContent = s.title; stage.append(h);
      const body = document.createElement('div'); body.className = 'prose';
      s.nodes.forEach((n) => { const c = n.cloneNode(true); c.querySelectorAll('.anchor,[id]').forEach((x) => { if (x.classList.contains('anchor')) x.remove(); else x.removeAttribute('id'); }); body.append(c); });
      stage.append(body); count.textContent = `${i + 1} / ${deck.length}`; prev.disabled = i === 0; next.disabled = i === deck.length - 1; stage.scrollTop = 0;
    };
    const go = (d) => { i = Math.max(0, Math.min(deck.length - 1, i + d)); draw(); };
    const end = () => { ov.remove(); document.body.classList.remove('slides-open'); removeEventListener('keydown', key, true); opener.focus(); };
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); end(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && e.target === stage)) { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
      else if (e.key === 'Tab') { const f = [...ov.querySelectorAll('button:not(:disabled)'), stage]; const k = f.indexOf(document.activeElement); const n = e.shiftKey ? (k <= 0 ? f.length - 1 : k - 1) : (k + 1) % f.length; e.preventDefault(); f[n].focus(); }
    };
    addEventListener('keydown', key, true);
    prev.addEventListener('click', () => go(-1)); next.addEventListener('click', () => go(1)); shut.addEventListener('click', end);
    let x0 = null; ov.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    ov.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); }, { passive: true });
    draw(); stage.focus();
  });

  // ── Offline reading (service worker) ───────────────────────────────────────
  const swMeta = document.querySelector('meta[name="asrbmy-sw"]');
  if (swMeta && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    addEventListener('load', () => {
      navigator.serviceWorker.register(swMeta.content, { scope: swMeta.dataset.scope || './' }).catch(() => { /* optional */ });
    });
  }
})();
