// Comments (Giscus). Loads only after the reader presses the button, so nothing contacts GitHub by default.
(() => {
  'use strict';
  const btn = document.getElementById('load-comments');
  const box = document.getElementById('giscus-box');
  if (!btn || !box) return;
  const theme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  btn.addEventListener('click', () => {
    const s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    const d = btn.dataset;
    const set = {
      'data-repo': d.repo, 'data-repo-id': d.repoId, 'data-category': d.category, 'data-category-id': d.categoryId,
      'data-mapping': d.mapping, 'data-strict': '0', 'data-reactions-enabled': d.reactions, 'data-emit-metadata': '0',
      'data-input-position': 'top', 'data-theme': theme(), 'data-lang': d.lang, 'data-loading': 'lazy',
    };
    for (const k in set) s.setAttribute(k, set[k]);
    s.crossOrigin = 'anonymous'; s.async = true;
    box.append(s);
    btn.hidden = true;
    // keep the comment box in step with the site's light/dark switch
    new MutationObserver(() => {
      const f = document.querySelector('iframe.giscus-frame');
      if (f) f.contentWindow.postMessage({ giscus: { setConfig: { theme: theme() } } }, 'https://giscus.app');
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  });
})();
