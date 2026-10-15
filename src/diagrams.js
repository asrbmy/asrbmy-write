// Diagrams: loads the Mermaid library (served from this site, not a CDN) only on pages that contain a diagram.
(() => {
  'use strict';
  const blocks = [...document.querySelectorAll('pre.mermaid')];
  if (!blocks.length) return;
  blocks.forEach((b) => { b.dataset.src = b.textContent; });
  const current = document.currentScript || document.querySelector('script[src*="diagrams.js"]');
  const base = current.src.replace(/diagrams\.js.*$/, '');
  const theme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default');
  let ready = null;

  const draw = async () => {
    const m = window.mermaid;
    m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme(), fontFamily: 'inherit' });
    blocks.forEach((b) => { b.removeAttribute('data-processed'); b.textContent = b.dataset.src; });
    try { await m.run({ nodes: blocks }); }
    catch { blocks.forEach((b) => { b.textContent = b.dataset.src; b.classList.add('mermaid--failed'); }); }
  };
  const s = document.createElement('script');
  s.src = `${base}vendor/mermaid.min.js`;
  s.onload = () => { ready = draw(); };
  s.onerror = () => blocks.forEach((b) => b.classList.add('mermaid--failed'));
  document.head.append(s);
  // redraw in the new colours when the reader switches theme
  new MutationObserver(() => { if (window.mermaid && ready) ready = ready.then(draw); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
