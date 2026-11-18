// Small shared helpers: dates, numbers, escaping.
export const pad = n => String(n).padStart(2, '0');
export const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = () => dstr(new Date());
export const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); };
export const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
/** Monday of the week containing date string s. */
export const weekStart = s => { const d = parseD(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return dstr(d); };

export const round = (v, p = 2) => { const f = Math.pow(10, p); return Math.round(v * f) / f; };
export const roundTo = (v, step) => step > 0 ? round(Math.round(v / step) * step) : round(v);
export const fmt = (n, d = 2) => (n === null || n === undefined || n === '' || isNaN(n)) ? '' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: d });
export const fmtInt = n => fmt(Math.round(n), 0);
export const num = v => { let s = String(v == null ? '' : v).trim(); if (!s) return NaN; if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); return parseFloat(s); };
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = p => (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const mmss = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60); };
export const durLbl = min => { min = Math.round(min); if (min < 60) return min + ' min'; return Math.floor(min / 60) + ' h ' + pad(min % 60); };

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
export const dLbl = s => { const d = parseD(s); return d.getDate() + ' ' + MESI[d.getMonth()]; };
export const dLblY = s => { const d = parseD(s); return d.getDate() + ' ' + MESI[d.getMonth()] + ' ' + d.getFullYear(); };
export const dLblW = s => { const d = parseD(s); return GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()]; };
export const monthLbl = (y, m) => new Date(y, m, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
export const relDay = s => { const n = daysBetween(s, today()); return n === 0 ? 'oggi' : n === 1 ? 'ieri' : n < 7 ? n + ' giorni fa' : dLbl(s); };
export const timeLbl = iso => { const d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export const sum = a => a.reduce((x, y) => x + y, 0);
export const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
export const norm = s => String(s || '').trim().toLowerCase();
