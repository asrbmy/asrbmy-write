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
  draw();
})();
