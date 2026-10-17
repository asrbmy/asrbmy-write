// ASRBMY Writer — editor UI. Talks only to the local server in writer/server.js.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TOKEN = document.querySelector('meta[name="writer-token"]').content;
  const el = {
    status: $('status'), siteName: $('site-name'), list: $('file-list'), foot: $('files-foot'), filter: $('file-search'),
    title: $('f-title'), slug: $('f-slug'), date: $('f-date'), cat: $('f-cat'), tags: $('f-tags'), excerpt: $('f-excerpt'),
    series: $('f-series'), part: $('f-part'), cover: $('f-cover'), coverAlt: $('f-coveralt'), comments: $('f-comments'),
    lang: $('f-lang'), trans: $('f-trans'), best: $('f-best'),
    note: $('f-note'), sheet: $('f-sheet'), helpful: $('f-helpful'), rating: $('f-rating'), reviewItem: $('f-reviewitem'), social: $('f-social'), change: $('f-change'),
    featured: $('f-featured'), draft: $('f-draft'), body: $('f-body'), preview: $('preview'), info: $('info'),
    cTitle: $('c-title'), cExcerpt: $('c-excerpt'), split: $('split'), files: $('files'),
    save: $('btn-save'), del: $('btn-delete'), download: $('btn-download'),
  };
  let state = {}, list = [], cur = { file: null, extra: {} };
  let dirty = false, slugTouched = false, saveTimer, previewTimer;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const slugify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const say = (msg, kind = '') => { el.status.textContent = msg; el.status.className = 'top__status' + (kind ? ` is-${kind}` : ''); };

  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { 'X-Writer-Token': TOKEN, ...(opts.headers || {}) } });
    const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : await res.text();
    if (!res.ok) throw new Error((data && data.error) || data || res.statusText);
    return data;
  }
  const send = (path, method, body) => api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // ── Form <-> article ───────────────────────────────────────────────────────
  const EDITED = ['title', 'slug', 'date', 'category', 'tags', 'excerpt', 'featured', 'draft', 'series', 'seriesOrder', 'cover', 'coverAlt', 'comments', 'best', 'lang', 'translationOf', 'type', 'sheet', 'helpful', 'rating', 'reviewItem', 'social'];
  function collect() {
    const title = el.title.value.trim();
    return {
      ...cur.extra, title, slug: el.slug.value.trim() || slugify(title), date: el.date.value, category: el.cat.value.trim() || state.defaultCategory,
      tags: el.tags.value.split(',').map((t) => t.trim()).filter(Boolean), excerpt: el.excerpt.value.trim(),
      featured: el.featured.checked, draft: el.draft.checked,
      series: el.series.value.trim(), seriesOrder: el.part.value ? Number(el.part.value) : '', cover: el.cover.value.trim(), coverAlt: el.coverAlt.value.trim(),
      comments: el.comments.checked, best: el.best.checked,
      lang: el.lang.value && el.lang.value !== (state.languages?.[0]?.code || '') ? el.lang.value : '', translationOf: el.trans.value.trim(),
      type: el.note.checked ? 'note' : '', sheet: el.sheet.checked, helpful: el.helpful.checked, rating: el.rating.value ? Number(el.rating.value) : '', reviewItem: el.reviewItem.value.trim(), social: el.social.value.trim(),
      ...pendingChange(),
    };
  }
  // "Log a change": adds a dated line to the article's changes and sets "updated" to today
  function pendingChange() {
    const text = el.change.value.replace(/\s+/g, ' ').trim();
    if (!text) return {};
    const old = Array.isArray(cur.extra.changes) ? cur.extra.changes : [];
    return { updated: today(), changes: [...old, `${today()}: ${text}`] };
  }
  function fill(file, front, body) {
    cur = { file, extra: Object.fromEntries(Object.entries(front).filter(([k]) => !EDITED.includes(k))) };
    el.title.value = front.title || ''; el.slug.value = front.slug || ''; el.date.value = front.date || today();
    el.cat.value = front.category || state.defaultCategory; el.tags.value = (front.tags || []).join(', ');
    el.excerpt.value = front.excerpt || ''; el.featured.checked = front.featured === true; el.draft.checked = front.draft === true;
    el.series.value = front.series || ''; el.part.value = front.seriesOrder || ''; el.cover.value = front.cover || ''; el.coverAlt.value = front.coverAlt || '';
    el.comments.checked = front.comments !== false; el.best.checked = front.best === true;
    el.note.checked = front.type === 'note'; el.sheet.checked = front.sheet === true; el.helpful.checked = front.helpful !== false;
    el.rating.value = front.rating || ''; el.reviewItem.value = front.reviewItem || ''; el.social.value = front.social || ''; el.change.value = '';
    el.lang.value = front.lang || (state.languages?.[0]?.code || ''); el.trans.value = front.translationOf || ''; spellLang();
    el.body.value = body || '';
    slugTouched = !!file;
    dirty = false; counters(); renderPreview(); buttons(); highlight(); updateGoal(); updateReadability();
  }
  function buttons() { el.del.disabled = el.download.disabled = !cur.file; }

  function counters() {
    const t = el.title.value.length, x = el.excerpt.value.length;
    el.cTitle.textContent = t ? `${t}/60` : ''; el.cTitle.className = 'count ' + (t && t <= 60 ? 'ok' : t ? 'warn' : '');
    el.cExcerpt.textContent = x ? `${x} (aim for 120–160)` : ''; el.cExcerpt.className = 'count ' + (x >= 120 && x <= 160 ? 'ok' : x ? 'warn' : '');
  }

  // ── Saving ─────────────────────────────────────────────────────────────────
  let inflight = null, edits = 0;
  async function save(manual = false) {
    if (inflight) { await inflight.catch(() => {}); if (!dirty) return true; }
    const front = collect();
    if (!front.title) { if (manual) say('Add a title first.', 'err'); return false; }
    // A brand-new article is only created once it has a sensible title and some text (no files named "ab.md").
    if (!cur.file && !manual && (front.title.length < 3 || !el.body.value.trim())) return false;
    clearTimeout(saveTimer);
    const target = cur, version = edits, body = el.body.value, pendingText = el.change.value.trim();
    say('Saving…');
    const run = (async () => {
      const r = target.file ? await send(`/api/articles/${encodeURIComponent(target.file)}`, 'PUT', { front, body })
        : await send('/api/articles', 'POST', { front, body });
      if (front.changes && cur === target) { target.extra.changes = front.changes; target.extra.updated = front.updated; if (el.change.value.trim() === pendingText) el.change.value = ''; }
      target.file = r.file; // always the article that was saved, even if the user has since switched to another one
      if (cur === target) {
        el.slug.value = r.slug;
        if (version === edits) dirty = false; // typed more while saving? stay dirty and save again
        say(`Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → ${r.file}`, 'ok');
        buttons();
      }
      await refresh();
      return true;
    })();
    inflight = run;
    try { const ok = await run; if (cur === target && dirty) setTimeout(() => save(), 0); return ok; }
    catch (e) { say(e.message, 'err'); return false; }
    finally { if (inflight === run) inflight = null; }
  }
  function changed() {
    dirty = true; edits++; counters(); say('Unsaved changes…');
    clearTimeout(saveTimer);
    if (state.autosaveSeconds > 0 && el.title.value.trim().length >= 3) saveTimer = setTimeout(() => save(), state.autosaveSeconds * 1000);
    clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 300);
  }

  // ── Article list ───────────────────────────────────────────────────────────
  async function refresh() { list = await api('/api/articles'); drawList(); }
  function drawList() {
    const q = el.filter.value.trim().toLowerCase();
    el.list.textContent = '';
    for (const a of list.filter((x) => !q || `${x.title} ${x.category} ${x.tags.join(' ')}`.toLowerCase().includes(q))) {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.dataset.file = a.file;
      b.innerHTML = `<strong>${esc(a.title)}${a.draft ? '<span class="chip">draft</span>' : ''}${!a.draft && a.date > today() ? '<span class="chip">scheduled</span>' : ''}</strong><small>${esc(a.date)} · ${esc(a.category)} · ${a.words} word${a.words === 1 ? "" : "s"}</small>`;
      b.addEventListener('click', () => openArticle(a.file));
      li.append(b); el.list.append(li);
    }
    highlight();
  }
  function highlight() { el.list.querySelectorAll('button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.file === cur.file))); }
  async function openArticle(file) {
    if (inflight) await inflight.catch(() => {});
    if (dirty) await save();
    try { const a = await api(`/api/articles/${encodeURIComponent(file)}`); fill(file, a.front, a.body); say(`Opened ${file}`); el.files.classList.remove('is-open'); }
    catch (e) { say(e.message, 'err'); }
  }
  async function newArticle() {
    if (inflight) await inflight.catch(() => {});
    if (dirty) await save();
    fill(null, { date: today(), category: state.defaultCategory }, '');
    say('New article — start with a title.'); el.title.focus(); el.files.classList.remove('is-open');
  }

  // ── Preview (rendered with the website's own Markdown + CSS) ───────────────
  let previewSeq = 0;
  async function renderPreview() {
    const seq = ++previewSeq;
    try {
      const r = await send('/api/preview', 'POST', { body: el.body.value });
      if (seq !== previewSeq) return; // a newer preview is already on its way
      const f = collect();
      el.preview.srcdoc = `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><link rel="stylesheet" href="/site/tokens.css"><link rel="stylesheet" href="/site/theme.css"><style>body{display:block;padding:16px;background:#e9e8d9}</style></head><body><article class="panel panel--top article"><header class="panel__head"><p class="kicker">${esc(f.category)}</p><h1 class="title">${esc(f.title || 'Untitled')}</h1>${f.excerpt ? `<p class="lede">${esc(f.excerpt)}</p>` : ''}</header><hr class="rule"><div class="prose">${r.html}</div></article></body></html>`;
      el.info.textContent = `${r.words} words · ${r.readingTime} min read`;
    } catch { /* preview is best-effort */ }
  }

  // ── Toolbar ────────────────────────────────────────────────────────────────
  function insert(start, end, text, selFrom, selTo) {
    el.body.focus(); el.body.setSelectionRange(start, end);
    if (!document.execCommand('insertText', false, text)) el.body.setRangeText(text, start, end, 'end'); // execCommand keeps Ctrl+Z working
    el.body.setSelectionRange(selFrom ?? start + text.length, selTo ?? selFrom ?? start + text.length);
    changed();
  }
  function wrap(before, after, placeholder) {
    const s = el.body.selectionStart, e = el.body.selectionEnd, t = el.body.value.slice(s, e) || placeholder;
    insert(s, e, before + t + after, s + before.length, s + before.length + t.length);
  }
  function prefix(fn) {
    const v = el.body.value, s = el.body.selectionStart, e = el.body.selectionEnd, ls = v.lastIndexOf('\n', s - 1) + 1;
    const block = (v.slice(ls, e) || 'Item').split('\n').map((l, i) => fn(i) + l).join('\n');
    insert(ls, e, block, ls + block.length);
  }
  const block = (text, selText) => {
    const s = el.body.selectionStart, e = el.body.selectionEnd, pad = s > 0 && el.body.value[s - 1] !== '\n' ? '\n\n' : '';
    const from = s + pad.length + text.indexOf(selText);
    insert(s, e, pad + text, from, from + selText.length);
  };
  const ACTIONS = {
    h2: () => prefix(() => '## '), h3: () => prefix(() => '### '),
    bold: () => wrap('**', '**', 'bold text'), italic: () => wrap('*', '*', 'italic text'), code: () => wrap('`', '`', 'code'),
    link: () => { const s = el.body.selectionStart, e = el.body.selectionEnd, t = el.body.value.slice(s, e) || 'link text'; insert(s, e, `[${t}](https://)`, s + t.length + 3, s + t.length + 11); },
    codeblock: () => block('```js\ncode here\n```\n', 'code here'),
    ul: () => prefix(() => '- '), ol: () => prefix((i) => `${i + 1}. `), quote: () => prefix(() => '> '),
    table: () => block('| Column A | Column B |\n| --- | --- |\n| One | Two |\n', 'Column A'),
    faq: () => block('<details class="faq">\n<summary>Question?</summary>\n\nAnswer.\n\n</details>\n', 'Question?'),
    image: () => $('img-input').click(),
    footnote: () => {
      const v = el.body.value, s = el.body.selectionStart, e = el.body.selectionEnd;
      const n = Math.max(0, ...[...v.matchAll(/\[\^(\d+)\]/g)].map((x) => Number(x[1]))) + 1;
      const def = `\n\n[^${n}]: Note text`;
      const at = v.replace(/\s+$/, '').length;
      el.body.focus(); el.body.setSelectionRange(at, v.length);
      document.execCommand('insertText', false, def) || el.body.setRangeText(def, at, v.length, 'end');
      const ref = `[^${n}]`;
      insert(s, e, ref, s + ref.length);
      const from = el.body.value.indexOf(`[^${n}]: `, s + ref.length) + `[^${n}]: `.length;
      el.body.setSelectionRange(from, from + 'Note text'.length);
    },
  };
  $('toolbar').addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) ACTIONS[b.dataset.act](); });

  // Big photos slow a site down: shrink to at most 1600px wide and re-encode (JPEG stays JPEG; PNG becomes WebP). Used only if it is smaller.
  async function compressImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 250 * 1024) return file;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / bmp.width), w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
      const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
      const blob = await new Promise((r) => cv.toBlob(r, type, 0.85));
      if (!blob || blob.type !== type || blob.size >= file.size * 0.95) return file;
      const ext = type === 'image/jpeg' ? '.jpg' : '.webp';
      const out = new File([blob], (file.name || 'image').replace(/\.[a-z0-9]+$/i, '') + ext, { type });
      out.note = `${(file.size / 1048576).toFixed(1)} MB → ${Math.max(1, Math.round(blob.size / 1024))} KB`;
      return out;
    } catch { return file; }
  }
  async function uploadImage(file) {
    say('Saving image…');
    try {
      file = await compressImage(file);
      const r = await api(`/api/images?name=${encodeURIComponent(file.name || 'image')}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      const alt = 'Describe the image', s = el.body.selectionStart;
      insert(s, el.body.selectionEnd, `![${alt}](${r.url})`, s + 2, s + 2 + alt.length);
      say(`Image saved as ${r.name}${file.note ? ` (smaller: ${file.note})` : ''} — upload it to your site's public/images folder too.`, 'ok');
    } catch (e) { say(e.message, 'err'); }
  }
  $('img-input').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) uploadImage(f); e.target.value = ''; });
  el.body.addEventListener('paste', (e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); uploadImage(f); } });
  el.body.addEventListener('dragover', (e) => e.preventDefault());
  el.body.addEventListener('drop', (e) => { const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); uploadImage(f); } });

  // ── Wiring ─────────────────────────────────────────────────────────────────
  el.title.addEventListener('input', () => { if (!slugTouched) el.slug.value = slugify(el.title.value); changed(); });
  el.slug.addEventListener('input', () => { slugTouched = el.slug.value.trim() !== ''; changed(); });
  $('meta').addEventListener('submit', (e) => e.preventDefault());
  for (const k of ['date', 'cat', 'tags', 'excerpt', 'featured', 'draft', 'body', 'series', 'part', 'cover', 'coverAlt', 'comments', 'best', 'trans', 'note', 'sheet', 'helpful', 'rating', 'reviewItem', 'social', 'change']) el[k].addEventListener('input', changed);
  el.filter.addEventListener('input', drawList);
  el.save.addEventListener('click', () => save(true));
  $('btn-new').addEventListener('click', newArticle);
  $('files-toggle').addEventListener('click', (e) => { const o = el.files.classList.toggle('is-open'); e.currentTarget.setAttribute('aria-expanded', String(o)); });
  for (const [id, view] of [['tab-write', 'write'], ['tab-preview', 'preview']]) {
    $(id).addEventListener('click', () => { el.split.dataset.view = view; $('tab-write').setAttribute('aria-selected', String(view === 'write')); $('tab-preview').setAttribute('aria-selected', String(view === 'preview')); if (view === 'preview') renderPreview(); });
  }
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); save(true); }
    else if (document.activeElement === el.body && ACTIONS[{ b: 'bold', i: 'italic', k: 'link' }[k]]) { e.preventDefault(); ACTIONS[{ b: 'bold', i: 'italic', k: 'link' }[k]](); }
  });
  addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  $('btn-delete').addEventListener('click', async () => {
    if (!cur.file || !confirm(`Move “${el.title.value}” to the Writer's trash folder?\n(You can recover it from writer/.trash.)`)) return;
    try { await api(`/api/articles/${encodeURIComponent(cur.file)}`, { method: 'DELETE' }); dirty = false; await refresh(); fill(null, { date: today(), category: state.defaultCategory }, ''); say('Moved to trash.', 'ok'); }
    catch (e) { say(e.message, 'err'); }
  });
  el.download.addEventListener('click', async () => {
    if (dirty && !(await save(true))) return;
    try {
      const text = await api(`/api/articles/${encodeURIComponent(cur.file)}/raw`);
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' })); a.download = cur.file;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) { say(e.message, 'err'); }
  });
  $('btn-build').addEventListener('click', async () => {
    if (dirty) await save();
    say('Building the site…');
    try {
      const r = await send('/api/build', 'POST', {});
      $('dlg-title').textContent = r.ok ? 'Build passed ✓' : 'Build failed';
      $('dlg-text').textContent = r.output || '(no output)'; $('dlg').showModal();
      say(r.ok ? 'Site built into dist/.' : 'Build failed — see details.', r.ok ? 'ok' : 'err');
    } catch (e) { say(e.message, 'err'); }
  });

  // ── Word goal ──────────────────────────────────────────────────────────────
  function updateGoal() {
    const goal = Number(state.wordGoal) || 0, box = $('goal');
    if (!goal) { box.hidden = true; return; }
    const t = el.body.value.trim(), n = t ? t.split(/\s+/).length : 0;
    box.hidden = false; box.classList.toggle('is-done', n >= goal);
    $('goal-bar').value = Math.min(100, Math.round((n / goal) * 100));
    $('goal-text').textContent = n >= goal ? `${n} words — goal reached` : `${n} / ${goal} words`;
  }
  el.body.addEventListener('input', updateGoal);

  // ── Spell-check language: the browser checks spelling in the language set on the editor ──
  function spellLang() { el.body.lang = el.lang.value || 'en'; el.body.spellcheck = true; }
  el.lang.addEventListener('change', () => { spellLang(); changed(); });

  // ── Readability: reading level and long sentences (English-style estimate; sentence length works for any Latin text) ──
  const plain = (md) => md.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]*`/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, '').replace(/^\s*\|.*\|\s*$/gm, ' ').replace(/<[^>]+>/g, ' ').replace(/[*_~]+/g, '').replace(/\$\$[\s\S]*?\$\$/g, ' ');
  const syllables = (w) => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length); };
  function analyse(md) {
    const text = plain(md);
    const sentences = text.split(/(?<=[.!?…])\s+|\n{2,}/).map((x) => x.trim()).filter((x) => /[\p{L}\p{N}]/u.test(x));
    const wordsOf = (x) => x.match(/[\p{L}\p{N}'’-]+/gu) || [];
    const all = sentences.map(wordsOf);
    const n = all.reduce((a, w) => a + w.length, 0);
    if (n < 40) return null;
    const syl = all.flat().reduce((a, w) => a + syllables(w), 0);
    const per = n / Math.max(1, sentences.length), spw = syl / n;
    const ease = Math.round(206.835 - 1.015 * per - 84.6 * spw);
    const grade = Math.max(1, Math.round(0.39 * per + 11.8 * spw - 15.59));
    const long = sentences.map((s, i) => ({ s, n: all[i].length })).filter((x) => x.n > 28).sort((a, b) => b.n - a.n);
    return { n, per: Math.round(per), ease, grade, long, latin: /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Z}]*$/u.test(text) };
  }
  let lastRd = null;
  function updateReadability() {
    const b = $('readability');
    lastRd = analyse(el.body.value);
    if (!lastRd) { b.hidden = true; return; }
    b.hidden = false;
    const r = lastRd;
    b.textContent = (r.latin && /^en/.test(el.lang.value || 'en') ? `Grade ${r.grade} · ` : '') + `${r.per} words/sentence` + (r.long.length ? ` · ${r.long.length} long` : '');
    b.classList.toggle('is-warn', r.long.length > 0 || r.per > 24);
  }
  let rdTimer;
  el.body.addEventListener('input', () => { clearTimeout(rdTimer); rdTimer = setTimeout(updateReadability, 400); });
  $('readability').addEventListener('click', () => {
    const r = lastRd; if (!r) return;
    const dlg = $('dlg');
    $('dlg-title').textContent = 'Readability';
    const t = $('dlg-text'); t.textContent = '';
    const lines = [`${r.n} words, about ${r.per} words per sentence.`];
    if (r.latin && /^en/.test(el.lang.value || 'en')) lines.push(`Reading ease ${r.ease} (60–70 is plain English). School grade ${r.grade}. Aim for grade 7–9 for a general audience.`);
    lines.push(r.long.length ? `${r.long.length} sentence${r.long.length === 1 ? ' is' : 's are'} over 28 words. Consider splitting the longest:` : 'No very long sentences. Nice.');
    for (const x of r.long.slice(0, 6)) lines.push(`• (${x.n} words) ${x.s.length > 160 ? x.s.slice(0, 157) + '…' : x.s}`);
    t.textContent = lines.join('\n');
    dlg.showModal();
  });

  // ── Templates ──────────────────────────────────────────────────────────────
  $('tpl').addEventListener('change', async (e) => {
    const t = (state.templates || []).find((x) => x.id === e.target.value);
    e.target.value = '';
    if (!t) return;
    await newArticle();
    el.cat.value = t.category || state.defaultCategory; el.tags.value = (t.tags || []).join(', ');
    el.body.value = t.body; counters(); updateGoal(); changed(); renderPreview();
    say(`New ${t.label.toLowerCase()} — give it a title.`); el.title.focus();
  });

  // ── Focus mode ─────────────────────────────────────────────────────────────
  const setFocus = (on) => { document.body.classList.toggle('focus', on); $('btn-focus').setAttribute('aria-pressed', String(on)); $('btn-focus').textContent = on ? 'Leave focus' : 'Focus'; if (on) { el.split.dataset.view = 'write'; el.body.focus(); } };
  $('btn-focus').addEventListener('click', () => setFocus(!document.body.classList.contains('focus')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('focus') && !$('pub').open) setFocus(false); });

  // ── Publish (git add → commit → push) ──────────────────────────────────────
  $('btn-publish').addEventListener('click', async () => {
    if (dirty && !(await save(true))) return;
    const dlg = $('pub'); $('pub-out').hidden = true; $('pub-out').textContent = ''; $('pub-go').disabled = true; $('pub-list').textContent = '';
    $('pub-sum').textContent = 'Checking what is new…';
    dlg.showModal();
    try {
      const r = await api('/api/publish');
      $('pub-go').disabled = !r.changes.length || !r.remote;
      $('pub-sum').textContent = !r.remote ? 'This repository has no GitHub remote yet, so nothing can be pushed.' : r.changes.length
        ? `${r.changes.length} new or changed file${r.changes.length === 1 ? '' : 's'} will be sent to “${r.remote}” (${r.branch}). GitHub Pages then rebuilds the site.`
        : 'Nothing new to publish.';
      for (const c of r.changes) { const li = document.createElement('li'); li.textContent = `${c.state} ${c.file}`; $('pub-list').append(li); }
      const warns = checkSummary();
      if (warns) $('pub-sum').textContent += ` The checklist found ${warns} thing${warns === 1 ? '' : 's'} to look at (press “Checklist” in the editor).`;
      const first = list.find((a) => a.file === cur.file);
      $('pub-msg').value = `Add article: ${first ? first.title : el.title.value || 'new writing'}`;
    } catch (e) { $('pub-sum').textContent = e.message; }
  });
  $('pub-go').addEventListener('click', async () => {
    $('pub-go').disabled = true; $('pub-sum').textContent = 'Publishing…';
    try {
      const r = await send('/api/publish', 'POST', { message: $('pub-msg').value });
      $('pub-out').hidden = false; $('pub-out').textContent = r.output;
      $('pub-sum').textContent = r.ok ? (r.nothing ? 'Nothing new to publish.' : 'Published. The site updates in about a minute.') : `Stopped at “git ${r.step}”. Details below.`;
      say(r.ok ? 'Published.' : 'Publishing failed — see details.', r.ok ? 'ok' : 'err');
    } catch (e) { $('pub-sum').textContent = e.message; }
  });

  // ── Checklist: things worth fixing before publishing ───────────────────────
  const mask = (md) => md.replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length)).replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));
  function checklist() {
    const f = collect(), body = el.body.value, text = mask(body), out = [];
    const add = (level, msg) => out.push({ level, msg });
    const t = f.title.length;
    t >= 20 && t <= 70 ? add('ok', `Title is ${t} characters.`) : add('warn', t ? `The title is ${t} characters. 20–70 reads well in search results.` : 'Add a title.');
    const x = f.excerpt.length;
    x >= 70 && x <= 170 ? add('ok', 'Excerpt length is good.') : add('warn', x ? `The excerpt is ${x} characters. About 120–160 works best in search results.` : 'Write an excerpt: it is what people see in search results and shares.');
    f.tags.length ? (f.tags.length > 8 ? add('warn', `${f.tags.length} tags is a lot. 2–5 is easier to browse.`) : add('ok', `${f.tags.length} tag${f.tags.length === 1 ? '' : 's'}.`)) : add('warn', 'Add at least one tag so readers can find related articles.');
    f.cover ? (f.coverAlt ? add('ok', 'Cover image has a description.') : add('warn', 'The cover image has no description for screen readers.')) : add('info', 'No cover image. That is fine; the site makes a share card for you.');
    const words = body.trim() ? body.trim().split(/\s+/).length : 0;
    if (f.type !== 'note') words >= 300 ? add('ok', `${words} words.`) : add('info', `Only ${words} words. Mark it as a short note, or add more.`);
    const noAlt = [...text.matchAll(/!\[([^\]]*)\]\(/g)].filter((m) => !m[1].trim() || /^describe the image$/i.test(m[1].trim())).length;
    noAlt ? add('warn', `${noAlt} image${noAlt === 1 ? ' has' : 's have'} no description (alt text). Screen readers cannot say what they show.`) : /!\[/.test(text) ? add('ok', 'All images are described.') : 0;
    const left = [...text.matchAll(/\b(TODO|FIXME|XXX|lorem ipsum)\b|\]\(https:\/\/\)|\]\(\)|\]\(#\)/gi)].map((m) => m[0]);
    left.length ? add('warn', `Unfinished bits left in the text: ${[...new Set(left)].slice(0, 4).join(', ')}.`) : add('ok', 'No TODO or empty links.');
    const http = [...text.matchAll(/\]\((http:\/\/[^)\s]+)/g)].length;
    if (http) add('warn', `${http} link${http === 1 ? ' uses' : 's use'} http:// instead of https://.`);
    const slugs = new Map(list.map((a) => [a.slug, a]));
    const dead = [...text.matchAll(/\]\(\/(?:[a-z]{2,3}\/)?articles\/([^/)\s#]+)\/?/g)].map((m) => m[1]).filter((sl) => !slugs.has(sl));
    dead.length ? add('warn', `Links to articles that do not exist here: ${[...new Set(dead)].join(', ')}.`) : 0;
    const levels = [...text.matchAll(/^(#{1,6})\s+\S/gm)].map((m) => m[1].length);
    if (levels.includes(1)) add('warn', 'A “#” heading in the text becomes a second page title. Use “##”.');
    let prev = 1; let skip = false; for (const l of levels) { if (l > prev + 1) skip = true; prev = l; }
    skip ? add('warn', 'Heading levels skip (for example ## then ####). Screen readers use them to navigate.') : levels.length ? add('ok', 'Headings are in order.') : words > 600 ? add('info', 'A long article reads better with ## headings.') : 0;
    if (f.draft) add('warn', 'This is still marked as a draft, so it will not appear on the website.');
    else if (f.date > today()) add('info', `Scheduled: it goes live on ${f.date} (the daily build publishes it).`);
    if (f.lang && f.lang !== (state.languages?.[0]?.code || '') && !f.translationOf) add('info', 'This is in another language. Set “Translation of” so readers can switch between versions.');
    if (f.rating && !f.reviewItem) add('info', 'A rating is set but “Item reviewed” is empty.');
    return out;
  }
  const openTool = (title, build) => { $('tool-title').textContent = title; const b = $('tool-body'); b.textContent = ''; build(b); $('tool').showModal(); };
  const checkSummary = () => { const w = checklist().filter((x) => x.level === 'warn').length; return w; };
  $('btn-check').addEventListener('click', () => openTool('Checklist', (b) => {
    const ul = document.createElement('ul'); ul.className = 'tool-list';
    for (const c of checklist()) { const li = document.createElement('li'); li.className = `is-${c.level}`; li.textContent = `${{ ok: '✓', warn: '!', info: 'i' }[c.level]}  ${c.msg}`; ul.append(li); }
    b.append(ul);
  }));

  // ── Link ideas: your own articles that this one mentions or relates to ─────
  function linkIdeas() {
    const body = el.body.value, text = mask(body).replace(/!?\[[^\]]*\]\([^)]*\)/g, (m) => ' '.repeat(m.length));
    const f = collect(), mainLang = state.languages?.[0]?.code || '';
    const urlOf = (a) => `/${a.lang && a.lang !== mainLang ? a.lang + '/' : ''}articles/${a.slug}/`;
    const linked = new Set([...body.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1].replace(/#.*/, '')));
    const mentions = [], related = [];
    for (const a of list) {
      if (a.file === cur.file || a.slug === f.slug || a.draft || linked.has(urlOf(a))) continue;
      const i = a.title.length >= 8 ? text.toLowerCase().indexOf(a.title.toLowerCase()) : -1;
      if (i >= 0) { mentions.push({ a, at: i, phrase: body.slice(i, i + a.title.length) }); continue; }
      const shared = a.tags.filter((t) => f.tags.map((x) => x.toLowerCase()).includes(String(t).toLowerCase())).length + (a.category && a.category === f.category ? 1 : 0);
      if (shared) related.push({ a, shared });
    }
    related.sort((x, y) => y.shared - x.shared || String(y.a.date).localeCompare(String(x.a.date)));
    return { mentions: mentions.slice(0, 6), related: related.slice(0, 6), urlOf };
  }
  $('btn-links').addEventListener('click', () => openTool('Link ideas', (b) => {
    const { mentions, related, urlOf } = linkIdeas();
    const sec = (title, items, mk) => {
      const h = document.createElement('h3'); h.textContent = title; b.append(h);
      if (!items.length) { const p = document.createElement('p'); p.textContent = 'Nothing to suggest.'; b.append(p); return; }
      const ul = document.createElement('ul'); ul.className = 'tool-list';
      for (const it of items) { const li = document.createElement('li'); mk(li, it); ul.append(li); }
      b.append(ul);
    };
    sec('Your text already names these articles', mentions, (li, it) => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.textContent = 'Link it';
      btn.addEventListener('click', () => { const i = el.body.value.toLowerCase().indexOf(it.phrase.toLowerCase()); if (i < 0) return; insert(i, i + it.phrase.length, `[${it.phrase}](${urlOf(it.a)})`); btn.disabled = true; btn.textContent = 'Linked'; });
      li.append(`“${it.phrase}” `, btn);
    });
    sec('Related by topic: add a “See also”', related, (li, it) => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn'; btn.textContent = 'Insert link';
      btn.addEventListener('click', () => { const s = el.body.selectionStart; insert(s, el.body.selectionEnd, `[${it.a.title}](${urlOf(it.a)})`); btn.disabled = true; btn.textContent = 'Inserted at the cursor'; });
      li.append(`${it.a.title} `, Object.assign(document.createElement('small'), { textContent: `· ${it.a.category}` }), ' ', btn);
    });
  }));

  // ── Versions: earlier saves of this article ────────────────────────────────
  $('btn-history').addEventListener('click', async () => {
    if (!cur.file) { say('Save the article first; versions start from the second save.', 'err'); return; }
    let versions = [];
    try { versions = await api(`/api/history/${encodeURIComponent(cur.file)}`); } catch (e) { say(e.message, 'err'); return; }
    openTool('Earlier versions', (b) => {
      const p = document.createElement('p'); p.textContent = versions.length ? 'The text as it was before a save (at most one a minute). Restoring puts it in the editor; nothing changes until you save.' : 'No earlier versions yet. One is kept each time you save over a changed article.'; b.append(p);
      const ul = document.createElement('ul'); ul.className = 'tool-list';
      for (const v of versions) {
        const li = document.createElement('li'), btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'btn'; btn.textContent = 'Restore';
        btn.addEventListener('click', async () => {
          try {
            const r = await api(`/api/history/${encodeURIComponent(cur.file)}/${v.id}`);
            const file = cur.file; fill(file, r.front, r.body); changed(); renderPreview(); $('tool').close(); say('Earlier version loaded. Press Save to keep it.', 'ok');
          } catch (e) { say(e.message, 'err'); }
        });
        li.append(`${new Date(v.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · ${v.words} words · ${v.title} `, btn); ul.append(li);
      }
      b.append(ul);
    });
  });

  // ── Start ──────────────────────────────────────────────────────────────────
  (async () => {
    try {
      state = await api('/api/state');
      document.title = `Writer · ${state.siteName}`; el.siteName.textContent = state.siteName;
      $('cats').innerHTML = state.categories.map((c) => `<option value="${esc(c)}">`).join('');
      $('series-list').innerHTML = (state.series || []).map((c) => `<option value="${esc(c)}">`).join('');
      $('tag-list').innerHTML = state.tags.map((c) => `<option value="${esc(c)}">`).join('');
      el.foot.textContent = `Saved in: ${state.articlesDir}`;
      for (const t of state.templates || []) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.label; $('tpl').append(o); }
      $('btn-publish').hidden = !state.publishEnabled;
      await refresh();
      if ((state.languages || []).length > 1) { el.lang.innerHTML = state.languages.map((l) => `<option value="${esc(l.code)}">${esc(l.label)}</option>`).join(''); $('lang-box').hidden = false; $('trans-box').hidden = false; }
      fill(null, { date: today(), category: state.defaultCategory }, '');
      say(`Ready. ${list.length} article${list.length === 1 ? '' : 's'} in your folder.`);
    } catch (e) { say(e.message, 'err'); }
  })();
})();
