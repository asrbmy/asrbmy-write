// Font Tester — try heading/body fonts, then copy the matching site.config.js setting.
(() => {
  'use strict';
  const root = document.getElementById('fonttester');
  if (!root) return;
  const presets = JSON.parse(root.dataset.presets);
  const families = JSON.parse(root.dataset.families);
  const current = JSON.parse(root.dataset.current);
  const $ = (id) => document.getElementById(id);
  root.querySelector('form').addEventListener('submit', (e) => e.preventDefault());
  const el = {
    preset: $('ft-preset'), head: $('ft-head'), body: $('ft-body'), size: $('ft-size'), lead: $('ft-lead'),
    weight: $('ft-weight'), track: $('ft-track'), sample: $('ft-sample'), headText: $('ft-headtext'),
    out: $('ft-snippet'), copy: $('ft-copy'), status: $('ft-status'), card: $('ft-card'),
    sizeV: $('ft-size-v'), leadV: $('ft-lead-v'), trackV: $('ft-track-v'),
  };

  // Is the first family of a stack installed on this device? (canvas width test)
  const ctx = document.createElement('canvas').getContext('2d');
  const probe = 'mmmmmmmmmmlli WwQq 0123';
  const width = (font) => { ctx.font = `72px ${font}`; return ctx.measureText(probe).width; };
  const installed = (stack) => {
    const first = stack.split(',')[0].trim();
    if (/^(system-ui|ui-monospace|serif|sans-serif|monospace)$/.test(first)) return true;
    return ['monospace', 'serif', 'sans-serif'].some((base) => width(`${first}, ${base}`) !== width(base));
  };

  // Fill the selects
  const fill = (select) => families.forEach((f, i) => {
    const o = document.createElement('option');
    o.value = f.stack; o.textContent = f.label + (installed(f.stack) ? '' : '  (not on this device)');
    select.append(o);
  });
  fill(el.head); fill(el.body);
  Object.entries(presets).forEach(([id, p]) => {
    const o = document.createElement('option'); o.value = id; o.textContent = p.label; el.preset.append(o);
  });
  const custom = document.createElement('option'); custom.value = 'custom'; custom.textContent = 'Custom mix'; el.preset.append(custom);

  const setSelect = (select, stack) => {
    let i = families.findIndex((f) => f.stack === stack);
    if (i < 0) { const o = document.createElement('option'); o.value = stack; o.textContent = 'Current site font'; select.prepend(o); select.value = stack; }
    else select.value = families[i].stack;
  };

  function apply() {
    const s = root.style;
    s.setProperty('--ft-head', el.head.value);
    s.setProperty('--ft-body', el.body.value);
    s.setProperty('--ft-size', el.size.value + 'px');
    s.setProperty('--ft-lead', el.lead.value);
    s.setProperty('--ft-weight', el.weight.value);
    s.setProperty('--ft-track', el.track.value + 'em');
    el.sizeV.textContent = el.size.value + 'px';
    el.leadV.textContent = Number(el.lead.value).toFixed(2);
    el.trackV.textContent = el.track.value + 'em';
    $('ft-title').textContent = el.headText.value || 'Your heading here';
    $('ft-text').textContent = el.sample.value;
    snippet();
  }

  function snippet() {
    const match = Object.entries(presets).find(([, p]) => p.head === el.head.value && p.body === el.body.value);
    el.preset.value = match ? match[0] : 'custom';
    const lines = ['typography: {'];
    if (match) lines.push(`  preset: '${match[0]}',`);
    else { lines.push(`  head: "${el.head.value}",`); lines.push(`  body: "${el.body.value}",`); }
    lines.push(`  size: '${el.size.value}px',`, `  lineHeight: ${Number(el.lead.value).toFixed(2).replace(/0$/, '')},`, `  headingWeight: ${el.weight.value},`, '},');
    el.out.textContent = lines.join('\n');
  }

  el.preset.addEventListener('change', () => {
    const p = presets[el.preset.value]; if (!p) return;
    setSelect(el.head, p.head); setSelect(el.body, p.body); apply();
  });
  for (const k of ['head', 'body', 'size', 'lead', 'weight', 'track', 'sample', 'headText']) el[k].addEventListener('input', apply);

  el.copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(el.out.textContent); el.status.textContent = 'Copied. Paste it into site.config.js, replacing the existing typography block.'; }
    catch { el.status.textContent = 'Select the text above and copy it manually.'; }
  });

  // Start from the fonts the site uses now
  setSelect(el.head, current.head); setSelect(el.body, current.body);
  el.size.value = parseInt(current.size, 10) || 18; el.lead.value = current.lineHeight; el.weight.value = current.weight;
  apply();
})();
