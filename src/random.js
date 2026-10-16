// "Read a random article": picks one from the search index. Without JavaScript the link goes to the full list.
(() => {
  'use strict';
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[data-random]');
    if (!link || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    fetch(link.dataset.index).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((list) => {
      const here = location.pathname;
      const pool = list.filter((a) => a.u !== here);
      if (!pool.length) throw new Error('none');
      location.href = pool[Math.floor(Math.random() * pool.length)].u;
    }).catch(() => { location.href = link.href; });
  });
})();
