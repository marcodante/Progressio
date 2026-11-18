// The workout being logged: start from a routine or empty, edit sets, save as a session.
import { st, active, setActive, saveActive, put } from './store.js';
import { historyOf, prescribe, recordsOf, setPRs, bodyWeightAt, sessionPRs, planOf } from './engine.js';
import { uid, today, fmt, num, round } from './util.js';

export const recCache = {};   // records before this workout, per exercise (for live PR detection)
export function warmRecords() { if (!active) return; active.entries.forEach(en => { if (!recCache[en.eid]) recCache[en.eid] = recordsOf(en.eid, active.id); }); }

/** The routine item for an exercise (planned sets and rest); a default when it is not in the routine. */
export function targetFor(eid, routine) {
  const it = routine && routine.items.find(i => i.eid === eid);
  if (it) return { plan: planOf(it).map(p => ({ ...p })), rest: it.rest || 0 };
  // not in the routine: reuse the plan from any routine that has it
  const other = Object.values(st.routines).flatMap(r => r.items).find(i => i.eid === eid);
  return other ? { plan: planOf(other).map(p => ({ ...p })), rest: other.rest || 0 } : { plan: planOf(null), rest: 0 };
}
export function newEntry(eid, target, excludeId) {
  const ex = st.exercises[eid];
  const pr = prescribe(ex, target, historyOf(eid, excludeId));
  const sets = pr.sets.map(x => ({ kg: x.kg == null ? '' : fmt(x.kg), reps: String(x.reps || ''), type: x.type, rpe: '', done: false }));
  return { eid, target, ss: false, note: '', sets, open: false };
}
export function startWorkout(routineId) {
  const r = routineId ? st.routines[routineId] : null;
  const id = uid('ss');
  const a = { id, mode: 'new', routineId: r ? r.id : null, name: r ? r.name : 'Allenamento libero', date: today(), start: new Date().toISOString(), notes: '', entries: [] };
  if (r) r.items.forEach(it => { if (!st.exercises[it.eid]) return; const en = newEntry(it.eid, targetFor(it.eid, r), id); en.ss = !!it.ss; a.entries.push(en); });
  Object.keys(recCache).forEach(k => delete recCache[k]);
  setActive(a); warmRecords();
}
export function editSession(sid) {
  const s = st.sessions[sid]; if (!s) return;
  const r = s.routineId && st.routines[s.routineId];
  const a = { id: s.id, mode: 'edit', routineId: s.routineId, name: s.name, date: s.date, start: s.start, end: s.end, notes: s.notes || '',
    entries: s.entries.map(en => ({ eid: en.eid, target: targetFor(en.eid, r), ss: !!en.ss, note: en.note || '', open: false,
      sets: en.sets.map(x => ({ kg: fmt(x.kg), reps: String(x.reps), type: x.type || 'n', rpe: x.rpe ? fmt(x.rpe) : '', done: true })) })) };
  Object.keys(recCache).forEach(k => delete recCache[k]);
  setActive(a); warmRecords();
}
export function addExercise(eid) {
  if (!active) return;
  const r = active.routineId && st.routines[active.routineId];
  active.entries.push(newEntry(eid, targetFor(eid, r), active.id));
  recCache[eid] = recordsOf(eid, active.id); saveActive();
}
/** Validates and marks one set done; returns {ok, msg, prs}. */
export function toggleSet(ei, si) {
  const en = active.entries[ei], set = en.sets[si], ex = st.exercises[en.eid];
  if (set.done) { set.done = false; saveActive(); return { ok: true, undone: true }; }
  const reps = parseInt(set.reps, 10); let kg = num(set.kg);
  if (isNaN(reps) || reps < 1) return { ok: false, msg: ex.kind === 'time' ? 'Inserisci i secondi della serie.' : 'Inserisci le ripetizioni della serie.' };
  if (isNaN(kg)) { if (ex.kind === 'weight') return { ok: false, msg: 'Inserisci il carico della serie.' }; kg = 0; set.kg = '0'; }
  set.done = true; saveActive();
  const rec = recCache[en.eid] || (recCache[en.eid] = recordsOf(en.eid, active.id));
  const sv = { kg, reps, type: set.type, done: true };
  const prs = setPRs(ex, sv, rec, bodyWeightAt(active.date));
  if (prs.length) { // raise the bar so the same record is not announced twice
    const L = ex.kind === 'weight' ? kg : null;
    if (L != null) { const e = L * (1 + reps / 30); if (e > (rec.e1rm || 0)) rec.e1rm = e; if (L > (rec.load || 0)) rec.load = L; if (!rec.reps[reps] || L > rec.reps[reps].load) rec.reps[reps] = { load: L, date: active.date }; }
    if (ex.kind === 'time' && reps > (rec.maxReps || 0)) rec.maxReps = reps;
  }
  return { ok: true, prs };
}
export const doneCount = () => active ? active.entries.reduce((n, en) => n + en.sets.filter(x => x.done).length, 0) : 0;

export function finishWorkout() {
  const a = active; if (!a) return null;
  const s = { id: a.id, routineId: a.routineId, name: (a.name || '').trim() || 'Allenamento', date: a.date, notes: (a.notes || '').trim(),
    entries: a.entries.map(en => ({ eid: en.eid, ss: !!en.ss, note: (en.note || '').trim(),
      sets: en.sets.filter(x => x.done).map(x => ({ kg: round(num(x.kg) || 0), reps: parseInt(x.reps, 10) || 0, type: x.type || 'n', rpe: num(x.rpe) || null, done: true })) }))
      .filter(en => en.sets.length) };
  if (a.mode === 'edit') { s.start = a.start; s.end = a.end; if (a.start && a.start.slice(0, 10) !== a.date) { s.start = a.date + 'T18:00:00'; s.end = null; } }
  else if (a.date === today()) { s.start = a.start; s.end = new Date().toISOString(); }
  else { s.start = a.date + 'T18:00:00'; s.end = null; }
  s.prs = sessionPRs(s);
  put('sessions', s);
  setActive(null);
  return s.id;
}
export function discardWorkout() { setActive(null); }
