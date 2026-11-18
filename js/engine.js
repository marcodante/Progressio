// Training logic: loads, estimated 1RM, progression suggestions, records and statistics.
import { st, bodyList, sessionList } from './store.js';
import { round, roundTo, fmt, dLbl, weekStart, addDays, today, sum } from './util.js';

export const isWork = s => s.done && (s.type === 'n' || s.type === 'f');
export const isHard = s => s.done && s.type !== 'w';

export function bodyWeightAt(date) {
  const b = bodyList().filter(x => x.weight && (!date || x.date <= date));
  return b.length ? b[b.length - 1].weight : (bodyList().find(x => x.weight) || {}).weight || null;
}
/** Effective external load of a set, used for 1RM and volume. */
export function loadOf(ex, set, bw) {
  const kg = +set.kg || 0;
  if (!ex || ex.kind === 'weight') return kg;
  if (ex.kind === 'bodyweight') return bw ? bw + kg : kg;
  if (ex.kind === 'assisted') return bw ? Math.max(0, bw - kg) : null;
  return null;
}
export const e1rm = (load, reps) => (load == null || !reps) ? null : reps <= 1 ? load : load * (1 + reps / 30);

/** All logged performances of one exercise, oldest first. */
export function historyOf(eid, excludeId) {
  const out = [];
  Object.values(st.sessions).forEach(s => {
    if (s.id === excludeId) return;
    s.entries.forEach(en => { if (en.eid === eid) { const sets = en.sets.filter(x => x.done); if (sets.length) out.push({ sid: s.id, date: s.date, start: s.start || '', sets, note: en.note }); } });
  });
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}
export function setsTxt(ex, sets) {
  const ws = sets.filter(x => x.type !== 'w'); if (!ws.length) return '';
  const unit = ex && ex.kind === 'time' ? '″' : '';
  const kgs = ws.map(x => +x.kg || 0), same = kgs.every(k => k === kgs[0]);
  const lw = k => ex && ex.kind === 'assisted' ? '−' + fmt(k) + ' kg' : ex && ex.kind === 'bodyweight' ? (k ? '+' + fmt(k) + ' kg' : 'corpo libero') : fmt(k) + ' kg';
  if (ex && ex.kind === 'time' && kgs.every(k => !k)) return ws.map(x => x.reps + unit).join(' · ');
  return same ? lw(kgs[0]) + ' × ' + ws.map(x => x.reps + unit).join(' · ') : ws.map(x => lw(+x.kg || 0) + '×' + x.reps + unit).join(' · ');
}

/* ---------- progression ---------- */
/** Planned sets of a routine item. Older items only had sets × repMin–repMax: expand them. */
export function planOf(item) {
  if (item && Array.isArray(item.plan) && item.plan.some(p => p.type !== 'w')) return item.plan;
  const n = (item && item.sets) || 3, mn = (item && item.repMin) || 8, mx = Math.max(mn, (item && item.repMax) || 12);
  return Array.from({ length: n }, () => ({ type: 'n', kg: null, repMin: mn, repMax: mx }));
}
export function planLbl(item, ex) {
  const p = planOf(item), w = p.filter(x => x.type !== 'w'), wu = p.length - w.length;
  const u = ex && ex.kind === 'time' ? ' s' : '';
  const groups = []; w.forEach(x => { const k = x.repMin + '–' + x.repMax; const g = groups[groups.length - 1]; if (g && g.k === k) g.n++; else groups.push({ k, n: 1, x }); });
  return groups.map(g => g.n + ' × ' + g.x.repMin + (g.x.repMax > g.x.repMin ? '–' + g.x.repMax : '') + u).join(' + ') + (wu ? ' · ' + wu + ' risc.' : '');
}
/**
 * Next workout for one exercise: the sets to do (prefilled) and the advice.
 * Working sets are grouped by load ("tiers": a top set and lighter back-off sets in a reverse pyramid,
 * or a single tier for straight sets). Each tier progresses on its own: double progression adds reps
 * up to the top of each set's range, then raises that tier's load and restarts from the bottom.
 */
export function prescribe(ex, item, hist) {
  const plan = planOf(item), inc = ex.inc || 2.5, harder = ex.kind === 'assisted' ? -1 : 1;
  const prog = ex.kind === 'time' ? 'none' : (ex.prog || 'double');
  const pw = plan.filter(p => p.type !== 'w'), pwu = plan.filter(p => p.type === 'w');
  const lw = k => ex.kind === 'assisted' ? fmt(k) + ' kg di assistenza' : ex.kind === 'bodyweight' ? (k ? '+' + fmt(k) + ' kg di zavorra' : 'corpo libero') : fmt(k) + ' kg';
  const last = hist[hist.length - 1];
  const lastWork = last ? last.sets.filter(x => x.type === 'n' || x.type === 'f') : [];
  if (!last || !lastWork.length) {
    const sets = plan.map(p => ({ type: p.type === 'w' ? 'w' : 'n', kg: p.kg, reps: p.repMin }));
    if (pw.some(p => p.kg != null)) return { type: 'plan', label: 'Dalla scheda', sets, text: 'Prima volta nell\'app: carichi e ripetizioni presi dalla scheda.' };
    return { type: 'start', label: 'Primo test', sets, text: ex.kind === 'time' ? 'Prima volta: tieni la posizione il più a lungo possibile con buona tecnica.' : 'Prima volta: scegli un carico con cui chiudi le ripetizioni previste lasciando 1–2 ripetizioni di margine.' };
  }
  const head = 'Ultima volta (' + dLbl(last.date) + '): ' + setsTxt(ex, last.sets) + '. ';
  // last performance mapped onto the planned working sets, in order
  const rows = pw.map((p, i) => { const l = lastWork[i] || null; const prevKg = i ? (lastWork[i - 1] ? +lastWork[i - 1].kg || 0 : null) : null; return { p, kg: l ? (+l.kg || 0) : (prevKg != null ? prevKg : (p.kg || 0)), reps: l ? (+l.reps || 0) : 0 }; });
  const tiers = []; rows.forEach((r, i) => { let t = tiers.find(x => x.kg === r.kg); if (!t) { t = { kg: r.kg, idx: [] }; tiers.push(t); } t.idx.push(i); });
  const prevSets = h => h ? h.sets.filter(x => x.type === 'n' || x.type === 'f') : [];
  const failedBefore = (h, t) => { const ps = prevSets(h); return t.idx.some(i => ps[i] && (+ps[i].kg || 0) === t.kg && (+ps[i].reps || 0) < rows[i].p.repMin); };
  const out = rows.map(r => ({ type: 'n', kg: r.kg, reps: r.reps }));
  const acts = [];
  tiers.forEach(t => {
    const R = t.idx.map(i => rows[i]);
    let act = 'rep', nk = t.kg;
    if (prog === 'none') { act = 'none'; t.idx.forEach(i => out[i].reps = rows[i].reps || rows[i].p.repMin); }
    else if (prog === 'linear') {
      if (R.every(r => r.reps >= r.p.repMin)) { act = 'up'; nk = round(t.kg + harder * inc); t.idx.forEach(i => out[i].reps = rows[i].p.repMin); }
      else {
        let fails = 1; for (let k = hist.length - 2; k >= 0 && fails < 3; k--) { if (failedBefore(hist[k], t)) fails++; else break; }
        if (fails >= 3) { act = 'down'; nk = harder > 0 ? roundTo(t.kg * 0.9, inc) : roundTo(t.kg + Math.max(inc, t.kg * 0.1), inc); }
        else act = 'hold';
        t.idx.forEach(i => out[i].reps = rows[i].p.repMin);
      }
    } else {
      if (R.every(r => r.reps >= r.p.repMax)) { act = 'up'; nk = round(t.kg + harder * inc); t.idx.forEach(i => out[i].reps = rows[i].p.repMin); }
      else if (R.some(r => r.reps < r.p.repMin)) {
        if (failedBefore(hist[hist.length - 2], t) && (harder < 0 || t.kg - inc > 0)) { act = 'down'; nk = round(t.kg - harder * inc); t.idx.forEach(i => out[i].reps = rows[i].p.repMin); }
        else { act = 'hold'; t.idx.forEach(i => out[i].reps = Math.max(rows[i].reps, rows[i].p.repMin)); }
      } else t.idx.forEach(i => out[i].reps = Math.min(rows[i].reps + 1, rows[i].p.repMax));
    }
    if (nk < 0) nk = 0;
    t.idx.forEach(i => out[i].kg = nk);
    acts.push({ act, from: t.kg, to: nk, n: t.idx.length });
  });
  // warm-up: same as last time (or the plan), scaled if the top load changes
  const top = acts.reduce((a, b) => (harder > 0 ? b.from > a.from : b.from < a.from) ? b : a, acts[0]);
  const lastWu = last.sets.filter(x => x.type === 'w');
  const wuSrc = lastWu.length ? lastWu.map(x => ({ kg: +x.kg || 0, reps: +x.reps || 0 })) : pwu.map(p => ({ kg: p.kg, reps: p.repMin }));
  const ratio = top && top.from > 0 && top.to !== top.from ? top.to / top.from : 1;
  const wus = wuSrc.map(w => ({ type: 'w', kg: w.kg == null ? null : (ratio === 1 ? w.kg : Math.max(0, roundTo(w.kg * ratio, inc))), reps: w.reps }));
  const sets = wus.concat(out);
  const rank = { down: 4, up: 3, hold: 2, rep: 1, none: 0 };
  const main = acts.slice().sort((a, b) => rank[b.act] - rank[a.act] || b.from - a.from)[0];
  const multi = tiers.length > 1;
  const tierLbl = a => multi ? (a === top ? 'serie principale' : 'serie a ' + lw(a.from)) : 'tutte le serie';
  const msg = { up: a => 'Ripetizioni complete per ' + tierLbl(a) + ': passa a <strong>' + lw(a.to) + '</strong>' + (multi ? '' : ' e riparti dal minimo'),
    down: a => (prog === 'linear' ? 'Tre sedute senza completare ' : 'Seconda seduta sotto il minimo per ') + tierLbl(a) + ': scarica a <strong>' + lw(a.to) + '</strong>',
    hold: a => 'Resta a <strong>' + lw(a.from) + '</strong> per ' + tierLbl(a) + ' e porta ogni serie almeno al minimo',
    rep: a => 'Resta a <strong>' + lw(a.from) + '</strong> e aggiungi una ripetizione' + (multi ? ' (' + tierLbl(a) + ')' : ''),
    none: () => 'Prova a fare meglio dell\'ultima volta' };
  const parts = acts.filter(a => a.act !== 'rep' || !acts.some(b => b.act !== 'rep')).filter((a, i, arr) => a.act !== 'none' || i === 0).map(a => msg[a.act](a));
  const labels = { up: ex.kind === 'assisted' ? 'Meno assistenza' : 'Aumenta carico', down: 'Scarica', hold: 'Consolida', rep: '+1 ripetizione', none: 'Registro' };
  return { type: main.act === 'none' ? 'none' : main.act, label: labels[main.act], sets, text: head + parts.map((t, i) => i ? t.charAt(0).toLowerCase() + t.slice(1) : t).join('; ') + '.' };
}

/* ---------- records ---------- */
export function recordsOf(eid, excludeId) {
  const ex = st.exercises[eid]; const rec = { e1rm: null, e1rmDate: '', load: null, loadDate: '', reps: {}, vol: null, volDate: '', maxReps: null, maxRepsDate: '' };
  if (!ex) return rec;
  historyOf(eid, excludeId).forEach(h => {
    const bw = bodyWeightAt(h.date); let vol = 0;
    h.sets.filter(x => x.type !== 'w').forEach(x => {
      const L = loadOf(ex, x, bw), reps = +x.reps || 0;
      if (ex.kind === 'time' || L == null) { if (reps > (rec.maxReps || 0)) { rec.maxReps = reps; rec.maxRepsDate = h.date; } return; }
      vol += L * reps;
      const e = e1rm(L, reps); if (e > (rec.e1rm || 0)) { rec.e1rm = e; rec.e1rmDate = h.date; }
      if (L > (rec.load || 0)) { rec.load = L; rec.loadDate = h.date; }
      if (reps >= 1 && reps <= 15 && (!rec.reps[reps] || L > rec.reps[reps].load)) rec.reps[reps] = { load: L, date: h.date };
      if (reps > (rec.maxReps || 0)) { rec.maxReps = reps; rec.maxRepsDate = h.date; }
    });
    if (vol > (rec.vol || 0)) { rec.vol = vol; rec.volDate = h.date; }
  });
  return rec;
}
/** Records a single set would beat (compared to everything before this session). */
export function setPRs(ex, set, rec, bw) {
  if (!set.done || set.type === 'w' || !rec) return [];
  const reps = +set.reps || 0, out = [];
  if (ex.kind === 'time') { if (rec.maxReps != null && reps > rec.maxReps) out.push('Tempo record: ' + reps + '″'); return out; }
  const L = loadOf(ex, set, bw); if (L == null || !reps) return out;
  const hasHistory = rec.e1rm != null;
  if (!hasHistory) return out;
  const e = e1rm(L, reps);
  if (e > rec.e1rm + 0.01) out.push('1RM stimato ' + fmt(round(e, 1)) + ' kg');
  if (L > (rec.load || 0) + 0.01) out.push('Carico massimo ' + fmt(L) + ' kg');
  else if (rec.reps[reps] && L > rec.reps[reps].load + 0.01) out.push('Record a ' + reps + ' rip.: ' + fmt(L) + ' kg');
  return out;
}

/* ---------- session statistics ---------- */
export function sessionStats(s) {
  let sets = 0, vol = 0, reps = 0;
  const bw = bodyWeightAt(s.date);
  s.entries.forEach(en => {
    const ex = st.exercises[en.eid];
    en.sets.filter(isHard).forEach(x => { sets++; reps += ex && ex.kind === 'time' ? 0 : (+x.reps || 0); const L = loadOf(ex, x, bw); if (L && ex.kind !== 'time') vol += L * (+x.reps || 0); });
  });
  const min = s.start && s.end ? Math.max(0, (new Date(s.end) - new Date(s.start)) / 60000) : null;
  return { sets, vol, reps, min, exercises: s.entries.filter(en => en.sets.some(x => x.done)).length };
}
/** Hard sets per muscle in the date range [from, to]: primary muscle 1, secondary 0.5. */
export function muscleSets(from, to) {
  const m = {};
  Object.values(st.sessions).forEach(s => {
    if (s.date < from || s.date > to) return;
    s.entries.forEach(en => {
      const ex = st.exercises[en.eid]; if (!ex) return;
      const n = en.sets.filter(isHard).length; if (!n) return;
      m[ex.muscle] = (m[ex.muscle] || 0) + n;
      (ex.secondary || []).forEach(x => { m[x] = (m[x] || 0) + n * 0.5; });
    });
  });
  return m;
}
export function weeks(n) { const w0 = weekStart(today()); return Array.from({ length: n }, (_, i) => addDays(w0, -7 * (n - 1 - i))); }
export function weeklyTotals(n) {
  return weeks(n).map(w => {
    const end = addDays(w, 6);
    const ss = Object.values(st.sessions).filter(s => s.date >= w && s.date <= end);
    const cs = Object.values(st.cardio).filter(c => c.date >= w && c.date <= end);
    return { week: w, sessions: ss.length, vol: sum(ss.map(s => sessionStats(s).vol)), sets: sum(ss.map(s => sessionStats(s).sets)), cardioMin: sum(cs.map(c => +c.minutes || 0)) };
  });
}
/** Consecutive weeks (ending this or last week) that reached the weekly goal. */
export function streak(goal) {
  const ws = weeklyTotals(52); let n = 0; let i = ws.length - 1;
  if (ws[i].sessions < goal) i--;
  for (; i >= 0 && ws[i].sessions >= goal; i--) n++;
  return n;
}
/** Routine whose last session is the oldest (the one "due" next). */
export function nextRoutine(routines) {
  if (!routines.length) return null;
  const wd = ((new Date().getDay() + 6) % 7) + 1;
  const todays = routines.find(r => +r.day === wd); if (todays) return todays;
  if (routines.some(r => r.day)) { // fixed weekly plan: next planned day
    for (let k = 1; k <= 7; k++) { const d = ((wd - 1 + k) % 7) + 1; const r = routines.find(x => +x.day === d); if (r) return r; }
  }
  const last = id => { const s = sessionList().find(x => x.routineId === id); return s ? s.date : ''; };
  return routines.slice().sort((a, b) => { const la = last(a.id), lb = last(b.id); return la < lb ? -1 : la > lb ? 1 : (a.order || 0) - (b.order || 0); })[0];
}
export function lastRoutineDate(id) { const s = sessionList().find(x => x.routineId === id); return s ? s.date : ''; }
/** Records set in a saved session (for history and summary). */
export function sessionPRs(s) {
  const out = [];
  s.entries.forEach(en => {
    const ex = st.exercises[en.eid]; if (!ex) return;
    const rec = recordsOf(en.eid, s.id); const bw = bodyWeightAt(s.date);
    const prev = { ...rec, reps: { ...rec.reps } };
    const found = new Set();
    en.sets.forEach(x => setPRs(ex, x, prev, bw).forEach(p => {
      const key = p.split(' ')[0] + p.split(' ')[1]; if (!found.has(key)) { found.add(key); out.push({ ex: ex.name, txt: p }); }
      const L = loadOf(ex, x, bw), e = e1rm(L, +x.reps);
      if (e > (prev.e1rm || 0)) prev.e1rm = e; if (L > (prev.load || 0)) prev.load = L;
    }));
  });
  // keep the best one per exercise and kind
  const best = {}; out.forEach(p => { const k = p.ex + p.txt.split(/\d/)[0]; best[k] = p; });
  return Object.values(best);
}
