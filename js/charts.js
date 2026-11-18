// Small SVG charts drawn to scale, coloured from theme tokens.
import { fmt, round, parseD, dLbl } from './util.js';

function niceStep(raw) { const mag = Math.pow(10, Math.floor(Math.log10(raw || 1))); return [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw; }

/** Time series. series: [{pts:[{d:'YYYY-MM-DD', y}], color, label, area, dash, dots}] */
export function lineChart(series, opt = {}) {
  const W = 600, H = opt.h || 220, L = 46, R = 14, T = 12, B = 28;
  const all = series.flatMap(s => s.pts);
  if (all.length < 2) return '<p class="hint">Il grafico compare quando ci sono almeno due valori.</p>';
  const xs = all.map(p => parseD(p.d).getTime()), x0 = Math.min(...xs), x1 = Math.max(...xs) === x0 ? x0 + 86400000 : Math.max(...xs);
  let lo = Math.min(...all.map(p => p.y)), hi = Math.max(...all.map(p => p.y));
  const span = (hi - lo) || Math.max(Math.abs(hi) * 0.1, 1); lo -= span * 0.12; hi += span * 0.12; if (lo < 0 && opt.zero !== false && Math.min(...all.map(p => p.y)) >= 0) lo = 0;
  const stp = niceStep((hi - lo) / 4); lo = Math.floor(lo / stp) * stp; hi = Math.ceil(hi / stp) * stp;
  const x = d => L + (parseD(d).getTime() - x0) * (W - L - R) / (x1 - x0), y = v => T + (hi - v) * (H - T - B) / (hi - lo);
  let g = '';
  for (let v = lo; v <= hi + 1e-9; v += stp) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--line)" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="12" fill="var(--muted)">' + fmt(round(v, 1)) + (opt.unit || '') + '</text>';
  let p = '';
  series.forEach(s => {
    const pts = s.pts.slice().sort((a, b) => a.d.localeCompare(b.d)); if (!pts.length) return;
    const path = pts.map((q, i) => (i ? 'L' : 'M') + x(q.d).toFixed(1) + ' ' + y(q.y).toFixed(1)).join(' ');
    if (s.area && pts.length > 1) p += '<path d="M' + x(pts[0].d).toFixed(1) + ' ' + y(lo) + ' ' + pts.map(q => 'L' + x(q.d).toFixed(1) + ' ' + y(q.y).toFixed(1)).join(' ') + ' L' + x(pts[pts.length - 1].d).toFixed(1) + ' ' + y(lo) + ' Z" fill="' + s.color + '" fill-opacity="0.08"/>';
    p += '<path d="' + path + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.width || 2.5) + '" stroke-linejoin="round" stroke-linecap="round"' + (s.dash ? ' stroke-dasharray="5 5"' : '') + (s.opacity ? ' stroke-opacity="' + s.opacity + '"' : '') + '/>';
    if (s.dots) pts.forEach(q => { p += '<circle cx="' + x(q.d).toFixed(1) + '" cy="' + y(q.y).toFixed(1) + '" r="2.5" fill="' + s.color + '" fill-opacity="0.6"/>'; });
    const lq = pts[pts.length - 1]; if (!s.dash) p += '<circle cx="' + x(lq.d).toFixed(1) + '" cy="' + y(lq.y).toFixed(1) + '" r="4.5" fill="' + s.color + '"/>';
  });
  const d0 = all.reduce((a, b) => a.d < b.d ? a : b).d, d1 = all.reduce((a, b) => a.d > b.d ? a : b).d;
  const legend = series.filter(s => s.label).map(s => '<span><i style="background:' + s.color + (s.dash ? ';opacity:.6' : '') + '"></i>' + s.label + '</span>').join('');
  return '<svg class="chart num" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (opt.aria || 'Grafico') + '">' + g + p
    + '<text x="' + L + '" y="' + (H - 6) + '" font-size="12" fill="var(--muted)">' + dLbl(d0) + '</text><text x="' + (W - R) + '" y="' + (H - 6) + '" font-size="12" text-anchor="end" fill="var(--muted)">' + dLbl(d1) + '</text></svg>'
    + (legend ? '<div class="legend">' + legend + '</div>' : '');
}

/** Vertical columns, e.g. one per week. bars: [{label, v, hl}] */
export function columns(bars, opt = {}) {
  const W = 600, H = opt.h || 170, L = 40, R = 8, T = 14, B = 24;
  const max = Math.max(opt.goal || 0, ...bars.map(b => b.v), 0) || 1;
  const stp = niceStep(max / 3), hi = Math.ceil(max / stp) * stp;
  const bw = (W - L - R) / bars.length, y = v => T + (hi - v) * (H - T - B) / hi;
  let g = '';
  for (let v = 0; v <= hi + 1e-9; v += stp) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="12" fill="var(--muted)">' + fmt(v, 1) + '</text>';
  if (opt.goal) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(opt.goal).toFixed(1) + '" y2="' + y(opt.goal).toFixed(1) + '" stroke="var(--up)" stroke-dasharray="5 4" stroke-width="1.5"/>';
  bars.forEach((b, i) => {
    const h = y(0) - y(b.v), cx = L + i * bw;
    g += '<rect x="' + (cx + bw * 0.18).toFixed(1) + '" y="' + y(b.v).toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" rx="3" fill="' + (b.hl ? 'var(--accent)' : 'var(--accent-mute)') + '"/>';
    if (b.label && (bars.length <= 12 || i % 2 === bars.length % 2)) g += '<text x="' + (cx + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" font-size="11" text-anchor="middle" fill="var(--muted)">' + b.label + '</text>';
  });
  return '<svg class="chart num" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (opt.aria || 'Grafico a colonne') + '">' + g + '</svg>';
}
