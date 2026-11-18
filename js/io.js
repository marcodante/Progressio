// Backup, CSV export and import of current and older formats.
import { st, fromLegacy, newExercise, findExByName, guessMuscle, sessionList, exList } from './store.js';
import { uid, today, fmt, num, round, norm } from './util.js';

export function download(name, text, type) {
  const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function backupText() { return JSON.stringify({ app: 'doppia-progressione', ...st, exported: new Date().toISOString() }); }
const TYPE_NAMES = { n: 'lavoro', w: 'riscaldamento', d: 'drop', f: 'cedimento' };
const TYPE_CODES = { lavoro: 'n', riscaldamento: 'w', drop: 'd', cedimento: 'f' };
const cell = v => { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
export function csvText() {
  const rows = [['data', 'seduta', 'esercizio', 'serie', 'tipo', 'kg', 'ripetizioni', 'rpe']];
  sessionList().slice().reverse().forEach(s => s.entries.forEach(en => {
    const ex = st.exercises[en.eid]; let i = 0;
    en.sets.filter(x => x.done).forEach(x => rows.push([s.date, s.name || '', ex ? ex.name : '?', ++i, TYPE_NAMES[x.type] || 'lavoro', fmt(+x.kg || 0), x.reps, x.rpe || '']));
  }));
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
}
export function bodyCsvText() {
  const rows = [['data', 'peso', 'grasso_%', 'vita', 'fianchi', 'petto', 'braccio', 'coscia', 'note']];
  Object.values(st.body).sort((a, b) => a.date.localeCompare(b.date)).forEach(b => rows.push([b.date, fmt(b.weight), fmt(b.fat), fmt(b.waist), fmt(b.hips), fmt(b.chest), fmt(b.arm), fmt(b.thigh), b.notes || '']));
  rows.push([]); rows.push(['data', 'cardio', 'minuti', 'km', 'fc_media', 'kcal', 'note']);
  Object.values(st.cardio).sort((a, b) => a.date.localeCompare(b.date)).forEach(c => rows.push([c.date, c.type, c.minutes, fmt(c.km), c.hr || '', c.kcal || '', c.notes || '']));
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
}

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
/** CSV of any app version → {exercises, routines, sessions} ready for mergeImported. */
function fromCsv(text) {
  const rows = parseCsv(text); const head = (rows.shift() || []).map(x => x.trim().toLowerCase());
  const ix = k => head.indexOf(k);
  const iD = ix('data'), iE = ix('esercizio'), iW = ix('seduta'), iS = ix('scheda'), iN = ix('serie'), iT = ix('tipo'), iK = ix('kg'), iR = ix('ripetizioni'), iP = ix('rpe');
  if ([iD, iE, iK, iR].some(i => i < 0)) throw new Error('Il CSV deve avere almeno le colonne data, esercizio, kg, ripetizioni.');
  const out = { exercises: {}, routines: {}, sessions: {} };
  const exBy = {}, rtBy = {}, ssBy = {};
  rows.forEach(r => {
    const name = (r[iE] || '').trim(), d = (r[iD] || '').trim(); const kg = num(r[iK]), reps = parseInt(r[iR], 10);
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(reps)) return;
    const rn = iW >= 0 && (r[iW] || '').trim() ? r[iW].trim() : iS >= 0 && (r[iS] || '').trim() ? 'Seduta ' + r[iS].trim() : 'Importati';
    let ex = exBy[norm(name)];
    if (!ex) { const have = findExByName(name); ex = have ? { ...have } : newExercise({ name, muscle: guessMuscle(name) }); exBy[norm(name)] = ex; out.exercises[ex.id] = ex; }
    let rt = rtBy[norm(rn)]; if (!rt) { rt = rtBy[norm(rn)] = { id: uid('rt') + Object.keys(rtBy).length, name: rn, order: Object.keys(rtBy).length + 1, items: [] }; out.routines[rt.id] = rt; }
    let it = rt.items.find(i => i.eid === ex.id); if (!it) { it = { eid: ex.id, sets: 0, repMin: 8, repMax: 12, rest: 0, ss: false }; rt.items.push(it); }
    const key = d + '|' + rt.id;
    let s = ssBy[key]; if (!s) { s = ssBy[key] = { id: uid('ss') + Object.keys(ssBy).length, routineId: rt.id, name: rn, date: d, start: d + 'T18:00:00', end: null, notes: '', entries: [] }; out.sessions[s.id] = s; }
    let en = s.entries.find(e => e.eid === ex.id); if (!en) { en = { eid: ex.id, note: '', sets: [] }; s.entries.push(en); }
    const type = iT >= 0 ? (TYPE_CODES[norm(r[iT])] || 'n') : 'n';
    en.sets.push({ kg: isNaN(kg) ? 0 : round(kg), reps, type, rpe: iP >= 0 && r[iP] ? num(r[iP]) || null : null, done: true });
    if (type === 'n') it.sets = Math.max(it.sets, en.sets.filter(x => x.type === 'n').length);
  });
  Object.values(out.routines).forEach(rt => rt.items.forEach(i => { if (!i.sets) i.sets = 3; }));
  if (!Object.keys(out.sessions).length) throw new Error('Nel CSV non ho trovato allenamenti validi.');
  return out;
}
const summary = c => Object.keys(c.sessions).length + ' allenamenti, ' + Object.keys(c.routines).length + ' sedute e ' + Object.keys(c.exercises).length + ' esercizi';

export function parseImport(text) {
  if (/^\s*\{/.test(text)) {
    const j = JSON.parse(text);
    if (j.app !== 'doppia-progressione') throw new Error('Questo file JSON non è un backup di Progressio.');
    if (j.kind === 'program') return { kind: 'program', prog: j, summary: 'Scheda “' + (j.name || 'senza nome') + '”: ' + (j.routines || []).length + ' sedute e ' + (j.exercises || []).length + ' esercizi' + (j.settings ? '. Imposta anche gli obiettivi settimanali (' + (j.settings.weekGoal || '?') + ' allenamenti, ' + (j.settings.cardioGoal || '?') + ' minuti di cardio)' : '') + '.' };
    if (j.schema === 3) return { kind: 'backup', data: j, summary: 'Backup del ' + String(j.exported || '').slice(0, 10) + ': ' + Object.keys(j.sessions || {}).length + ' allenamenti, ' + Object.keys(j.routines || {}).length + ' sedute, ' + Object.keys(j.body || {}).length + ' misurazioni e ' + Object.keys(j.cardio || {}).length + ' attività cardio.' };
    if (Array.isArray(j.exercises)) { const c = fromLegacy(j.workouts || [], j.exercises); return { kind: 'merge', conv: c, summary: 'Backup della versione precedente: ' + summary(c) + '.' }; }
    throw new Error('Formato del backup non riconosciuto.');
  }
  const c = fromCsv(text); return { kind: 'merge', conv: c, summary: 'CSV: ' + summary(c) + '.' };
}
