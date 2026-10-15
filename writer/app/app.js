// ASRBMY Writer — editor UI. Talks only to the local server in writer/server.js.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const TOKEN = document.querySelector('meta[name="writer-token"]').content;
  const el = {
    status: $('status'), siteName: $('site-name'), list: $('file-list'), foot: $('files-foot'), filter: $('file-search'),
    title: $('f-title'), slug: $('f-slug'), date: $('f-date'), cat: $('f-cat'), tags: $('f-tags'), excerpt: $('f-excerpt'),
    series: $('f-series'), part: $('f-part'), cover: $('f-cover'), coverAlt: $('f-coveralt'), comments: $('f-comments'),
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
  const EDITED = ['title', 'slug', 'date', 'category', 'tags', 'excerpt', 'featured', 'draft', 'series', 'seriesOrder', 'cover', 'coverAlt', 'comments'];
  function collect() {
    const title = el.title.value.trim();
    return {
      ...cur.extra, title, slug: el.slug.value.trim() || slugify(title), date: el.date.value, category: el.cat.value.trim() || state.defaultCategory,
      tags: el.tags.value.split(',').map((t) => t.trim()).filter(Boolean), excerpt: el.excerpt.value.trim(),
      featured: el.featured.checked, draft: el.draft.checked,
      series: el.series.value.trim(), seriesOrder: el.part.value ? Number(el.part.value) : '', cover: el.cover.value.trim(), coverAlt: el.coverAlt.value.trim(),
      comments: el.comments.checked,
    };
  }
  function fill(file, front, body) {
    cur = { file, extra: Object.fromEntries(Object.entries(front).filter(([k]) => !EDITED.includes(k))) };
    el.title.value = front.title || ''; el.slug.value = front.slug || ''; el.date.value = front.date || today();
    el.cat.value = front.category || state.defaultCategory; el.tags.value = (front.tags || []).join(', ');
    el.excerpt.value = front.excerpt || ''; el.featured.checked = front.featured === true; el.draft.checked = front.draft === true;
    el.series.value = front.series || ''; el.part.value = front.seriesOrder || ''; el.cover.value = front.cover || ''; el.coverAlt.value = front.coverAlt || '';
    el.comments.checked = front.comments !== false;
    el.body.value = body || '';
    slugTouched = !!file;
    dirty = false; counters(); renderPreview(); buttons(); highlight(); updateGoal();
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
    const target = cur, version = edits, body = el.body.value;
    say('Saving…');
    const run = (async () => {
      const r = target.file ? await send(`/api/articles/${encodeURIComponent(target.file)}`, 'PUT', { front, body })
        : await send('/api/articles', 'POST', { front, body });
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
  };
  $('toolbar').addEventListener('click', (e) => { const b = e.target.closest('button[data-act]'); if (b) ACTIONS[b.dataset.act](); });

  async function uploadImage(file) {
    say('Saving image…');
    try {
      const r = await api(`/api/images?name=${encodeURIComponent(file.name || 'image')}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      const alt = 'Describe the image', s = el.body.selectionStart;
      insert(s, el.body.selectionEnd, `![${alt}](${r.url})`, s + 2, s + 2 + alt.length);
      say(`Image saved as ${r.name} — upload it to your site's public/images folder too.`, 'ok');
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
  for (const k of ['date', 'cat', 'tags', 'excerpt', 'featured', 'draft', 'body', 'series', 'part', 'cover', 'coverAlt', 'comments']) el[k].addEventListener('input', changed);
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
      fill(null, { date: today(), category: state.defaultCategory }, '');
      say(`Ready. ${list.length} article${list.length === 1 ? '' : 's'} in your folder.`);
    } catch (e) { say(e.message, 'err'); }
  })();
})();
