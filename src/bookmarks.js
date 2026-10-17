// Reading list page: shows the articles this reader saved. Everything stays in this browser's localStorage.
(() => {
  'use strict';
  const root = document.getElementById('bookmarks');
  if (!root) return;
  const KEY = 'asrbmy-bookmarks';
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const save = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked */ } };
  const safe = (b) => b && typeof b.u === 'string' && b.u.startsWith('/') && !b.u.startsWith('//') && typeof b.t === 'string';

  function draw() {
    const list = load().filter(safe);
    root.textContent = '';
    if (!list.length) {
      const p = document.createElement('p');
      p.textContent = 'Nothing saved yet. Open an article and press “Save for later”. ';
      const a = document.createElement('a'); a.href = root.dataset.home || '/'; a.textContent = 'Browse the writing'; p.append(a, '.');
      root.append(p);
      return;
    }
    const ul = document.createElement('ul'); ul.className = 'readlist';
    for (const b of list) {
      const li = document.createElement('li');
      const a = document.createElement('a'); a.href = b.u; a.textContent = b.t;
      const small = document.createElement('small'); small.textContent = b.d ? `Saved ${b.d}` : '';
      const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'share__btn'; rm.textContent = 'Remove'; rm.setAttribute('aria-label', `Remove ${b.t} from the reading list`);
      rm.addEventListener('click', () => { save(load().filter((x) => x.u !== b.u)); draw(); });
      li.append(a, small, rm); ul.append(li);
    }
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'share__btn'; clear.textContent = 'Clear the list';
    clear.addEventListener('click', () => { if (confirm('Remove every saved article?')) { save([]); draw(); } });
    root.append(ul, clear);
  }
  // Back up / restore the list as a small file (it lives only in this browser, so this is the way to move it)
  const tools = document.getElementById('bookmarks-tools');
  if (tools) {
    const ex = document.createElement('button'); ex.type = 'button'; ex.className = 'share__btn'; ex.textContent = 'Export list';
    ex.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify({ asrbmy: 'reading-list', saved: load().filter(safe) }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'reading-list.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const label = document.createElement('label'); label.className = 'share__btn'; label.textContent = 'Import list ';
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json'; inp.className = 'sr-only';
    const msg = document.createElement('span'); msg.className = 'share__status'; msg.setAttribute('role', 'status');
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        if (f.size > 1e6) throw new Error('big');
        const j = JSON.parse(await f.text());
        const incoming = (Array.isArray(j) ? j : j.saved || []).filter(safe).map((b) => ({ u: b.u, t: b.t.slice(0, 300), d: typeof b.d === 'string' ? b.d.slice(0, 10) : '' }));
        const have = load(); const seen = new Set(have.map((b) => b.u));
        const merged = have.concat(incoming.filter((b) => !seen.has(b.u))).slice(0, 200);
        save(merged); draw(); msg.textContent = `Imported ${merged.length - have.length} article${merged.length - have.length === 1 ? '' : 's'}.`;
      } catch { msg.textContent = 'That file is not a reading-list export.'; }
      inp.value = '';
    });
    label.append(inp); tools.append(ex, label, msg);
  }
  draw();
})();
