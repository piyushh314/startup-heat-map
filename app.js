/* India Startup Atlas - Built by Piyush Yadav (BMS, SSCBS, Delhi University) */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const A = window.ATLAS;
const fail = m => { $('#intro').innerHTML = `<p class="err">${m}</p>`; };
if (!A) return fail('Data file <code>data/atlas-data.js</code> is missing. Run <code>python preprocess.py</code> first.');
if (!window.maplibregl) return fail('The map library could not load. Check your internet connection and reload.');
const fmt = n => n == null ? '—' : Number(n).toLocaleString('en-IN');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = A.states, M = A.meta, NAT = M.national_per_lakh;
const D = A.districts.features.map(f => ({ ...f.properties, c: f.geometry.coordinates }));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stByName = Object.fromEntries(S.map(s => [s.state, s]));
let metric = 'total', gap = false, lbTab = 'states', sel = null;
const sval = s => metric === 'total' ? s.official : s.per_lakh;

// ---------- static text from data ----------
$('#asof').textContent = `Official count as on ${M.official_asof}`;
const noteTxt = `Registered startups, not a guarantee they are active. Official: ${M.sources.official}. Districts: ${M.sources.portal}, ${M.portal_asof}.`;
$('#note').textContent = noteTxt; document.querySelector('.note-m').textContent = noteTxt;
$('#aboutData').textContent = `State counts: ${M.sources.official} (as on ${M.official_asof}). District counts: ${M.sources.portal}, snapshot ${M.portal_asof}. Coordinates and 2011 populations: ${M.sources.coordinates_population}. The two counts are different bases, so they are never mixed. A registration does not mean the startup is still active.`;
const noPop = S.filter(s => s.per_lakh == null).map(s => s.state);
$('#perNote').textContent = `Official count ÷ Census 2011 population (approximate).${noPop.length ? ' Missing population: ' + noPop.join(', ') + '.' : ''}`;
$('#gapTip').textContent = `How it works: we divide each state's official startups by its 2011 population, compare that with India's overall rate (${NAT} per lakh people), and mark states below half the national rate as Underserved. It measures people, not sectors, because the data has no sector column.`;
$('#unm').textContent = `${M.districts_total - M.districts_plotted} districts (${fmt(M.unmatched_startups)} registrations) have no coordinates yet and are not drawn. They are included in the CSV.`;
const count = (el, to, d = 1500) => { if (reduce) { el.textContent = fmt(to); return; } const t0 = performance.now(); (function f(t) { const p = Math.min(1, (t - t0) / d); el.textContent = fmt(Math.round(to * (1 - (1 - p) ** 3))); if (p < 1) requestAnimationFrame(f); })(t0); };

// ---------- map ----------
const map = new maplibregl.Map({ container: 'map', style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [79, 22.5], zoom: 4.2, minZoom: 3.4, maxZoom: 12, maxBounds: [[60, 3], [104, 40]], preserveDrawingBuffer: true, attributionControl: { compact: true } });
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
setTimeout(() => { if (!map.isStyleLoaded()) $('#note').textContent = 'The basemap could not load. Check your connection. ' + noteTxt; }, 12000);
const OR = '#ff6a00', OR2 = '#ff8c1a', sq = ['sqrt', ['get', 'registered']];
const dotR = k => ['interpolate', ['linear'], ['zoom'], 5, ['*', k, ['+', 3, ['*', 0.06, sq]]], 10, ['*', k, ['+', 4, ['*', 0.25, sq]]]];

function stFC() {
  const vs = S.filter(s => s.center && sval(s) != null);
  return { type: 'FeatureCollection', features: vs.map(s => ({ type: 'Feature', geometry: { type: 'Point', coordinates: s.center },
    properties: { name: s.state, v: sval(s), under: gap && s.underserved ? 1 : 0,
      lab: (metric === 'total' ? fmt(s.official) : s.per_lakh.toFixed(1)) + (gap && s.underserved ? '\nUnderserved' : '') } })) };
}
function refreshStates() {
  const src = map.getSource('states'); if (!src) return;
  src.setData(stFC());
  const mx = Math.max(...S.filter(s => sval(s) != null).map(sval)), k = 44 / Math.sqrt(mx), r = ['sqrt', ['get', 'v']];
  map.setPaintProperty('sbub', 'circle-radius', ['interpolate', ['linear'], ['zoom'], 3, ['max', 7, ['*', r, k * 0.7]], 6, ['max', 9, ['*', r, k * 1.3]]]);
}
map.on('load', () => {
  map.addSource('dheat', { type: 'geojson', data: A.districts });
  map.addSource('dsrc', { type: 'geojson', data: A.districts, cluster: true, clusterRadius: 42, clusterMaxZoom: 7, clusterProperties: { sum: ['+', ['get', 'registered']] } });
  map.addSource('states', { type: 'geojson', data: stFC() });
  map.addLayer({ id: 'heat', type: 'heatmap', source: 'dheat', paint: {
    'heatmap-weight': ['interpolate', ['linear'], ['sqrt', ['get', 'registered']], 5, 0.08, 185, 1],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 16, 7, 42], 'heatmap-intensity': 1.2,
    'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.95, 7, 0.55, 9.5, 0],
    'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(255,106,0,0)', 0.2, 'rgba(120,40,0,.5)', 0.5, 'rgba(255,106,0,.75)', 0.8, 'rgba(255,170,60,.9)', 1, 'rgba(255,235,200,1)'] } });
  const fade = ['interpolate', ['linear'], ['zoom'], 5.8, 1, 7, 0];
  map.addLayer({ id: 'sbub', type: 'circle', source: 'states', paint: { 'circle-color': 'rgba(255,106,0,.14)', 'circle-opacity': fade,
    'circle-stroke-color': ['case', ['==', ['get', 'under'], 1], '#ffffff', OR], 'circle-stroke-width': ['case', ['==', ['get', 'under'], 1], 2.5, 1.4], 'circle-stroke-opacity': fade } });
  map.addLayer({ id: 'slab', type: 'symbol', source: 'states', layout: { 'text-field': ['get', 'lab'], 'text-font': ['Montserrat Regular'], 'text-size': 11, 'text-allow-overlap': true },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': fade } });
  map.addLayer({ id: 'clu', type: 'circle', source: 'dsrc', minzoom: 5, filter: ['has', 'point_count'], paint: {
    'circle-color': 'rgba(255,106,0,.28)', 'circle-stroke-color': OR2, 'circle-stroke-width': 1.5, 'circle-blur': 0.2,
    'circle-radius': ['interpolate', ['linear'], ['get', 'sum'], 25, 12, 60000, 38] } });
  map.addLayer({ id: 'cluL', type: 'symbol', source: 'dsrc', minzoom: 5, filter: ['has', 'point_count'], layout: { 'text-field': ['number-format', ['get', 'sum'], {}], 'text-font': ['Montserrat Regular'], 'text-size': 11, 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } });
  map.addLayer({ id: 'glow', type: 'circle', source: 'dsrc', minzoom: 5, filter: ['!', ['has', 'point_count']], paint: { 'circle-color': OR, 'circle-opacity': 0.25, 'circle-blur': 1, 'circle-radius': dotR(2.6) } });
  map.addLayer({ id: 'pulse', type: 'circle', source: 'dsrc', minzoom: 5, filter: ['!', ['has', 'point_count']], paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': dotR(1.5), 'circle-stroke-color': OR2, 'circle-stroke-width': 1.2, 'circle-stroke-opacity': 0.4 } });
  map.addLayer({ id: 'dots', type: 'circle', source: 'dsrc', minzoom: 5, filter: ['!', ['has', 'point_count']], paint: { 'circle-color': OR2, 'circle-radius': dotR(1), 'circle-stroke-color': '#ffd2a8', 'circle-stroke-width': 0.8 } });
  refreshStates();
  $('#intro').classList.add('go'); setTimeout(() => { $('#intro').remove(); count($('#bigNum'), M.official_total); }, reduce ? 0 : 1300);
  if (!reduce) requestAnimationFrame(pulse);
});
// soft pulsing animation on district dots (~20 fps, skipped if reduced motion)
let last = 0, t0 = performance.now();
function pulse(now) {
  requestAnimationFrame(pulse); if (now - last < 50 || !map.getLayer('pulse')) return; last = now;
  const ph = ((now - t0) / 2400) % 1, e = 1 + ph * 1.1;
  map.setPaintProperty('pulse', 'circle-radius', ['interpolate', ['linear'], ['zoom'], 5, ['*', e * 1.5, ['+', 3, ['*', 0.06, sq]]], 10, ['*', e * 1.5, ['+', 4, ['*', 0.25, sq]]]]);
  map.setPaintProperty('pulse', 'circle-stroke-opacity', 0.6 * (1 - ph));
}
// hover / tap cards
const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14 });
const card = (l, html, f) => { map.getCanvas().style.cursor = 'pointer'; pop.setLngLat(f.geometry.coordinates).setHTML(html).addTo(map); };
map.on('mousemove', 'dots', e => { const p = e.features[0].properties; card('d', `<b>${esc(p.name)}</b><br>${esc(p.state)}<br>${fmt(p.registered)} registered · #${p.rank_india} in India`, e.features[0]); });
map.on('mousemove', 'sbub', e => { if (map.getZoom() > 6.5) return; const s = stByName[e.features[0].properties.name]; card('s', `<b>${esc(s.state)}</b><br>${fmt(s.official)} DPIIT-recognised${s.per_lakh != null ? `<br>${s.per_lakh} per lakh people` : ''}`, e.features[0]); });
['dots', 'sbub'].forEach(l => map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; pop.remove(); }));
map.on('click', 'dots', e => { const p = e.features[0].properties; show('D|' + p.state + '|' + p.name, false); });
map.on('click', 'sbub', e => { if (map.getZoom() <= 6.5) show('S|' + e.features[0].properties.name, false); });
map.on('click', 'clu', async e => { const f = e.features[0]; const z = await map.getSource('dsrc').getClusterExpansionZoom(f.properties.cluster_id); map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.3 }); });

// ---------- details ----------
const bars = (rows, hi) => { const mx = Math.max(...rows.map(r => r[1]), 1); return `<ul class="bars">${rows.map(r => `<li class="${r[0] === hi ? 'hi' : ''}"><span>${esc(r[0])}</span><b>${fmt(r[1])}</b><i style="--w:${(r[1] / mx * 100).toFixed(1)}%"></i></li>`).join('')}</ul>`; };
const tile = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
const parse = id => { const p = id.split('|'); return p[0] === 'S' ? { t: 'S', s: stByName[p[1]] } : { t: 'D', d: D.find(x => x.state === p[1] && x.name === p[2]) }; };
function detail(id) {
  const o = parse(id); let h = '';
  if (o.t === 'S') {
    const s = o.s, ds = D.filter(d => d.state === s.state).sort((a, b) => b.registered - a.registered), top = ds[0];
    let ins = `${s.state} has ${fmt(s.official)} DPIIT-recognised startups, ${(s.pct_india * 100).toFixed(1)}% of India's total.`;
    if (s.per_lakh != null) { const r = s.per_lakh / NAT; ins += ` That is ${s.per_lakh} per lakh people, ${r >= 1 ? r.toFixed(1) + '× the' : 'about ' + Math.round(r * 100) + '% of the'} national rate.`; }
    else ins += ' Population data is missing for this state, so per-capita is not shown.';
    if (top && s.portal_sum) ins += ` ${top.name} holds ${Math.round(top.registered / s.portal_sum * 100)}% of the registrations in its listed districts.`;
    h = `<h2>${esc(s.state)}${gap && s.underserved ? '<span class="tag">Underserved</span>' : ''}</h2><div class="tiles">${tile(fmt(s.official), 'DPIIT-recognised')}${tile(s.per_lakh ?? '—', 'per lakh people')}${tile(fmt(s.portal_sum), 'portal-registered*')}${tile(s.districts_listed, 'districts listed')}</div>
      <p class="insight">${ins}</p><h3>Top districts (portal-registered)</h3>${ds.length ? bars(ds.slice(0, 8).map(d => [d.name, d.registered])) : '<p class="hint">No district in this state has 25+ registered startups.</p>'}
      <p class="hint">*Districts with 25+ startups only. A different base from the official count.</p><button class="btn" data-cmp="${esc(id)}">Compare…</button>`;
  } else {
    const d = o.d, s = stByName[d.state], ds = D.filter(x => x.state === d.state).sort((a, b) => b.registered - a.registered);
    let ins = `${d.name} ranks #${d.rank_india} in India by registered startups and #${d.rank_state} in ${d.state}, holding ${(d.share_state * 100).toFixed(1)}% of the state's listed total.`;
    if (d.dpiit) ins += ` ${fmt(d.dpiit)} of them are DPIIT-recognised.`;
    h = `<h2>${esc(d.name)}</h2><p class="hint">${esc(d.state)}</p><div class="tiles">${tile(fmt(d.registered), 'registered on portal')}${tile('#' + d.rank_india, 'rank in India')}${tile('#' + d.rank_state, 'rank in state')}${tile(d.dpiit ? fmt(d.dpiit) : '—', 'DPIIT-recognised')}</div>
      <p class="insight">${ins}</p><h3>In ${esc(d.state)}</h3>${bars(ds.slice(0, 8).map(x => [x.name, x.registered]), d.name)}<button class="btn" data-cmp="${esc(id)}">Compare…</button>`;
  }
  $('#dBody').innerHTML = h; $('#detail').classList.add('open');
  const b = $('#dBody [data-cmp]'); if (b) b.onclick = () => openCmp(b.dataset.cmp);
}
function show(id, fly = true) {
  sel = id; detail(id); const o = parse(id);
  if (fly) { if (o.t === 'S' && o.s.center) map.flyTo({ center: o.s.center, zoom: 6, duration: 1400 }); if (o.t === 'D') map.flyTo({ center: o.d.c, zoom: 9, duration: 1400 }); }
  if (o.t === 'S' && !o.s.center) $('#dBody').insertAdjacentHTML('beforeend', '<p class="hint">This state has no plotted districts, so it has no map position.</p>');
}
$('#dClose').onclick = () => { $('#detail').classList.remove('open'); sel = null; };

// ---------- controls ----------
const setMetric = m => { metric = m; $('#mTotal').setAttribute('aria-pressed', m === 'total'); $('#mPer').setAttribute('aria-pressed', m !== 'total'); refreshStates(); lb(); };
$('#mTotal').onclick = () => setMetric('total'); $('#mPer').onclick = () => setMetric('per');
$('#gap').onchange = e => { gap = e.target.checked; if (gap) setMetric('per'); else refreshStates(); if (sel) detail(sel); };
$('#gapInfo').onclick = e => { const t = $('#gapTip'); t.hidden = !t.hidden; e.currentTarget.setAttribute('aria-expanded', !t.hidden); };
$('#tS').onclick = () => { lbTab = 'states'; $('#tS').setAttribute('aria-pressed', true); $('#tD').setAttribute('aria-pressed', false); lb(); };
$('#tD').onclick = () => { lbTab = 'districts'; $('#tD').setAttribute('aria-pressed', true); $('#tS').setAttribute('aria-pressed', false); lb(); };
function lb() {
  let rows = lbTab === 'states'
    ? S.filter(s => sval(s) != null).sort((a, b) => sval(b) - sval(a)).slice(0, 10).map(s => ['S|' + s.state, s.state, sval(s), metric === 'total' ? fmt(s.official) : s.per_lakh.toFixed(1)])
    : [...D].sort((a, b) => b.registered - a.registered).slice(0, 10).map(d => ['D|' + d.state + '|' + d.name, d.name, d.registered, fmt(d.registered)]);
  const mx = Math.max(...rows.map(r => r[2]), 1);
  $('#lb').innerHTML = rows.length ? rows.map(r => `<li><button data-id="${esc(r[0])}"><span>${esc(r[1])}</span><b>${r[3]}</b><i style="--w:${(r[2] / mx * 100).toFixed(1)}%"></i></button></li>`).join('') : '<li class="hint">No data to rank.</li>';
  document.querySelectorAll('#lb button').forEach(b => b.onclick = () => show(b.dataset.id));
}
lb();
$('#handle').onclick = () => { const d = $('#dock'); d.classList.toggle('open'); $('#handle').setAttribute('aria-expanded', d.classList.contains('open')); };

// ---------- search ----------
const idx = [...S.map(s => ({ id: 'S|' + s.state, n: s.state, sub: 'State' })), ...D.map(d => ({ id: 'D|' + d.state + '|' + d.name, n: d.name, sub: d.state }))];
function search() {
  const q = $('#q').value.trim().toLowerCase(), ul = $('#res');
  if (!q) { ul.hidden = true; return; }
  const m = idx.filter(i => i.n.toLowerCase().includes(q)).sort((a, b) => (b.n.toLowerCase().startsWith(q)) - (a.n.toLowerCase().startsWith(q))).slice(0, 8);
  ul.innerHTML = m.length ? m.map(i => `<li><button data-id="${esc(i.id)}">${esc(i.n)} <small>${esc(i.sub)}</small></button></li>`).join('') : '<li class="hint" style="padding:8px 10px">No match. Try a state or district from the data.</li>';
  ul.hidden = false; ul.querySelectorAll('button').forEach(b => b.onclick = () => { show(b.dataset.id); ul.hidden = true; $('#q').value = ''; });
}
$('#q').oninput = search; $('#q').onkeydown = e => { if (e.key === 'Escape') { $('#res').hidden = true; } if (e.key === 'Enter') { const b = $('#res button'); if (b) b.click(); } };

// ---------- compare ----------
const ents = [...S.map(s => ({ id: 'S|' + s.state, label: s.state + ' (state)', v: { Type: 'State', 'Registered on portal': s.portal_sum, 'DPIIT-recognised (official)': s.official, 'Per lakh people': s.per_lakh, 'Districts listed': s.districts_listed, 'Biggest district': s.top_district } })),
  ...D.map(d => ({ id: 'D|' + d.state + '|' + d.name, label: d.name + ', ' + d.state, v: { Type: 'District', 'Registered on portal': d.registered, 'Rank in India': d.rank_india, 'Share of state total': (d.share_state * 100).toFixed(1) + '%' } }))];
const ROWS = ['Type', 'Registered on portal', 'DPIIT-recognised (official)', 'Per lakh people', 'Rank in India', 'Share of state total', 'Districts listed', 'Biggest district'];
const opts = sel0 => ['State', 'District'].map(t => `<optgroup label="${t}s">${ents.filter(e => e.v.Type === t).map(e => `<option value="${esc(e.id)}"${e.id === sel0 ? ' selected' : ''}>${esc(e.label)}</option>`).join('')}</optgroup>`).join('');
function renderCmp() {
  const a = ents.find(e => e.id === $('#cA').value), b = ents.find(e => e.id === $('#cB').value);
  if (a.id === b.id) { $('#cBody').innerHTML = '<p class="hint">Pick two different places to compare.</p>'; return; }
  const cell = (x, y, r) => { const v = x.v[r], o = y.v[r], num = typeof v === 'number' && typeof o === 'number'; return `<td class="${num && r !== 'Rank in India' && v > o ? 'w' : ''}">${v == null ? '—' : typeof v === 'number' ? fmt(v) : esc(v)}</td>`; };
  $('#cBody').innerHTML = `<table class="ct"><tr><td></td><td><b>${esc(a.label)}</b></td><td><b>${esc(b.label)}</b></td></tr>${ROWS.filter(r => r in a.v || r in b.v).map(r => `<tr><td>${r}</td>${cell(a, b, r)}${cell(b, a, r)}</tr>`).join('')}</table><p class="hint">Highlight marks the larger value. Rank is lower-is-better. A dash means the figure does not apply or is missing.</p>`;
}
function openCmp(a) { $('#cA').innerHTML = opts(a || 'S|Maharashtra'); $('#cB').innerHTML = opts('S|Karnataka'); $('#cmp').hidden = false; renderCmp(); }
$('#cmpBtn').onclick = () => openCmp(sel); $('#cA').onchange = $('#cB').onchange = renderCmp; $('#cClose').onclick = () => { $('#cmp').hidden = true; };

// ---------- export ----------
const dl = (name, href) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); };
$('#png').onclick = () => {
  map.once('render', () => {
    const c = map.getCanvas(), k = c.width / c.clientWidth, o = document.createElement('canvas'), x = o.getContext('2d');
    o.width = c.width; o.height = c.height + 64 * k; x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0);
    x.fillStyle = '#ff8c1a'; x.font = `700 ${18 * k}px sans-serif`; x.fillText('India Startup Atlas', 16 * k, c.height + 26 * k);
    x.fillStyle = '#9b9b9b'; x.font = `${11 * k}px sans-serif`; x.fillText('Registered startups, not a guarantee they are active. Official data: DPIIT, ' + M.official_asof + '. Built by Piyush Yadav, SSCBS.', 16 * k, c.height + 48 * k);
    dl('india-startup-atlas.png', o.toDataURL('image/png'));
  }); map.triggerRepaint();
};
$('#csv').onclick = () => {
  const st = sel ? (parse(sel).s?.state || parse(sel).d.state) : null, q = v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  const rows = [['state', 'district', 'registered_on_portal', 'dpiit_recognised_top12_only', 'rank_india', 'rank_state', 'share_of_state_listed', 'lat', 'lon', 'note']];
  D.filter(d => !st || d.state === st).forEach(d => rows.push([d.state, d.name, d.registered, d.dpiit, d.rank_india, d.rank_state, d.share_state, d.c[1], d.c[0], '']));
  M.report.unmatched.filter(u => !st || u.state === st).forEach(u => rows.push([u.state, u.city, u.registered, '', '', '', '', '', '', 'no coordinates; not on map']));
  dl(`india-startups-${st ? st.toLowerCase().replace(/\W+/g, '-') : 'all'}.csv`, URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv' })));
};

// ---------- about, creator, keys ----------
$('#aboutBtn').onclick = () => $('#about').showModal(); $('#aboutClose').onclick = () => $('#about').close();
$('#madeTab').onclick = () => { const m = $('#made'); m.classList.toggle('open'); $('#madeTab').setAttribute('aria-expanded', m.classList.contains('open')); };
addEventListener('keydown', e => { if (e.key === 'Escape') { $('#cmp').hidden = true; $('#detail').classList.remove('open'); } });
})();
