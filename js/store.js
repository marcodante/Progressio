// App state, persistence in IndexedDB, mutations with timestamps (for sync) and seed data.
import { uid, today, norm, byOrder } from './util.js';

export const MUSCLES = ['Petto', 'Dorso', 'Spalle', 'Bicipiti', 'Tricipiti', 'Avambracci', 'Quadricipiti', 'Femorali', 'Glutei', 'Polpacci', 'Addome', 'Lombari'];
export const EQUIP = ['Macchina', 'Cavi', 'Bilanciere', 'Manubri', 'Kettlebell', 'Corpo libero', 'Elastici', 'Altro'];
export const KINDS = { weight: 'Con carico', bodyweight: 'Corpo libero (+ zavorra)', assisted: 'Assistito (es. trazioni assistite)', time: 'A tempo (secondi)' };
export const PROGS = { double: 'Doppia progressione', linear: 'Lineare', none: 'Nessuna (solo registro)' };
export const CARDIO = ['Camminata veloce', 'Corsa', 'Tapis roulant', 'Cyclette', 'Bici', 'Ellittica', 'Vogatore', 'Stepper', 'Nuoto', 'Altro'];
export const SET_TYPES = { n: { short: '', label: 'Serie di lavoro' }, w: { short: 'R', label: 'Riscaldamento' }, d: { short: 'D', label: 'Drop set' }, f: { short: 'C', label: 'A cedimento' } };

const SEED = [
  ['Chest press', 'Petto', ['Tricipiti', 'Spalle'], 'Macchina'],
  ['Panca piana con bilanciere', 'Petto', ['Tricipiti', 'Spalle'], 'Bilanciere'],
  ['Panca inclinata con manubri', 'Petto', ['Spalle', 'Tricipiti'], 'Manubri'],
  ['Pectoral machine', 'Petto', [], 'Macchina'],
  ['Croci ai cavi', 'Petto', [], 'Cavi'],
  ['Dip alle parallele', 'Petto', ['Tricipiti'], 'Corpo libero', 'bodyweight'],
  ['Lat machine', 'Dorso', ['Bicipiti'], 'Macchina'],
  ['Pulley basso', 'Dorso', ['Bicipiti'], 'Cavi'],
  ['Low row', 'Dorso', ['Bicipiti'], 'Macchina'],
  ['Rematore con manubrio', 'Dorso', ['Bicipiti'], 'Manubri'],
  ['Rematore con bilanciere', 'Dorso', ['Bicipiti', 'Lombari'], 'Bilanciere'],
  ['Trazioni alla sbarra', 'Dorso', ['Bicipiti'], 'Corpo libero', 'bodyweight'],
  ['Trazioni assistite', 'Dorso', ['Bicipiti'], 'Macchina', 'assisted'],
  ['Pullover ai cavi', 'Dorso', [], 'Cavi'],
  ['Shoulder press', 'Spalle', ['Tricipiti'], 'Macchina'],
  ['Lento avanti con manubri', 'Spalle', ['Tricipiti'], 'Manubri'],
  ['Alzate laterali', 'Spalle', [], 'Manubri', 'weight', 1],
  ['Alzate laterali ai cavi', 'Spalle', [], 'Cavi', 'weight', 1.25],
  ['Rear delt machine', 'Spalle', ['Dorso'], 'Macchina'],
  ['Face pull', 'Spalle', ['Dorso'], 'Cavi'],
  ['Curl con manubri', 'Bicipiti', ['Avambracci'], 'Manubri', 'weight', 1],
  ['Curl al cavo', 'Bicipiti', [], 'Cavi'],
  ['Curl con bilanciere', 'Bicipiti', ['Avambracci'], 'Bilanciere'],
  ['Arm curl machine', 'Bicipiti', [], 'Macchina'],
  ['Push down al cavo', 'Tricipiti', [], 'Cavi'],
  ['French press', 'Tricipiti', [], 'Bilanciere'],
  ['Arm extension machine', 'Tricipiti', [], 'Macchina'],
  ['Leg press', 'Quadricipiti', ['Glutei', 'Femorali'], 'Macchina', 'weight', 5],
  ['Squat con bilanciere', 'Quadricipiti', ['Glutei', 'Lombari'], 'Bilanciere'],
  ['Leg extension', 'Quadricipiti', [], 'Macchina'],
  ['Affondi con manubri', 'Quadricipiti', ['Glutei'], 'Manubri', 'weight', 1],
  ['Leg curl', 'Femorali', [], 'Macchina'],
  ['Stacco rumeno', 'Femorali', ['Glutei', 'Lombari'], 'Bilanciere'],
  ['Hip thrust', 'Glutei', ['Femorali'], 'Bilanciere', 'weight', 5],
  ['Abductor machine', 'Glutei', [], 'Macchina'],
  ['Adductor machine', 'Quadricipiti', [], 'Macchina'],
  ['Calf raise', 'Polpacci', [], 'Macchina', 'weight', 5],
  ['Crunch machine', 'Addome', [], 'Macchina'],
  ['Crunch a terra', 'Addome', [], 'Corpo libero', 'bodyweight'],
  ['Plank', 'Addome', [], 'Corpo libero', 'time'],
  ['Hyperextension', 'Lombari', ['Glutei', 'Femorali'], 'Corpo libero', 'bodyweight'],
];

export const DEFAULT_SETTINGS = { sound: true, rest: 90, rpe: false, theme: 'auto', weekGoal: 3, cardioGoal: 120, updatedAt: 0 };

function emptyState() { return { schema: 3, exercises: {}, routines: {}, sessions: {}, body: {}, cardio: {}, settings: { ...DEFAULT_SETTINGS }, deleted: {}, updatedAt: 0 }; }

export const st = emptyState();      // synced data
export const meta = { dirty: false, lastSync: '', lastBackup: '', migrated: false };   // device-only
export let active = null;            // workout being logged (device-only)

/* ---------- IndexedDB ---------- */
let dbp = null;
function idb() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open('doppia-progressione', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function idbGet(k) { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function idbPut(k, v) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }

let saveT = null, actT = null;
export const hooks = { onChange: () => {}, onSaveError: () => {} };
export function persistNow() {
  clearTimeout(saveT); saveT = null;
  return Promise.all([idbPut('state', st), idbPut('meta', meta)]).catch(e => hooks.onSaveError(e));
}
function persistActive() { clearTimeout(actT); actT = null; return idbPut('active', active).catch(e => hooks.onSaveError(e)); }
function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(persistNow, 40); }
function scheduleActive() { clearTimeout(actT); actT = setTimeout(persistActive, 200); }
function flush() { if (saveT) persistNow(); if (actT) persistActive(); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
window.addEventListener('pagehide', flush);

/* ---------- mutations ---------- */
function touch(markDirty = true) { st.updatedAt = Date.now(); if (markDirty) meta.dirty = true; scheduleSave(); if (markDirty) hooks.onChange(); }
export function put(coll, obj) { obj.updatedAt = Date.now(); st[coll][obj.id] = obj; touch(); return obj; }
export function del(coll, id) { delete st[coll][id]; st.deleted[id] = Date.now(); touch(); }
export function setSettings(patch) { Object.assign(st.settings, patch, { updatedAt: Date.now() }); touch(); }
export function setActive(a) { active = a; persistActive(); }
export function saveActive() { scheduleActive(); }
export function setMeta(patch) { Object.assign(meta, patch); scheduleSave(); }
/** Replace the whole data set (restore, sync download). */
export function replaceAll(data, markDirty) {
  const fresh = emptyState();
  for (const k of ['exercises', 'routines', 'sessions', 'body', 'cardio', 'deleted']) fresh[k] = data[k] || {};
  fresh.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  fresh.updatedAt = data.updatedAt || Date.now();
  Object.keys(st).forEach(k => delete st[k]); Object.assign(st, fresh);
  st.updatedAt = data.updatedAt || Date.now();
  meta.dirty = !!markDirty; scheduleSave(); if (markDirty) hooks.onChange();
}

/* ---------- queries ---------- */
export const exList = (incArchived) => Object.values(st.exercises).filter(e => incArchived || !e.archived).sort((a, b) => a.name.localeCompare(b.name, 'it'));
export const routineList = () => Object.values(st.routines).sort(byOrder);
export const sessionList = () => Object.values(st.sessions).sort((a, b) => (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')));
export const bodyList = () => Object.values(st.body).sort((a, b) => a.date.localeCompare(b.date));
export const cardioList = () => Object.values(st.cardio).sort((a, b) => b.date.localeCompare(a.date));
export function findExByName(name) { const n = norm(name); return Object.values(st.exercises).find(e => norm(e.name) === n); }

export function newExercise(p) {
  return { id: uid('ex'), name: p.name, muscle: p.muscle || 'Petto', secondary: p.secondary || [], equipment: p.equipment || 'Macchina',
    kind: p.kind || 'weight', inc: p.inc || 2.5, prog: p.prog || (p.kind === 'time' ? 'none' : 'double'), notes: p.notes || '', archived: false };
}
function seedLibrary() {
  SEED.forEach(([name, muscle, secondary, equipment, kind, inc]) => {
    const e = newExercise({ name, muscle, secondary, equipment, kind: kind || 'weight', inc: inc || 2.5 });
    e.seed = true; e.updatedAt = 1; st.exercises[e.id] = e;
  });
}

/* ---------- legacy (previous versions) ---------- */
/** Converts the data model of the earlier versions (exercise with embedded history, grouped by workout or "scheda"). */
export function fromLegacy(workouts, exercises) {
  const out = { exercises: {}, routines: {}, sessions: {} };
  const libByName = n => Object.values(out.exercises).find(e => norm(e.name) === n) || findExByName(n);
  const wmap = {};
  (workouts || []).forEach((w, i) => { wmap[w.id] = { id: uid('rt') + i, name: w.name, order: w.order || i + 1, items: [] }; });
  const byName = {};
  (exercises || []).forEach((le, i) => {
    let w = le.wid && wmap[le.wid];
    if (!w) { const nm = (le.scheda || '').trim() ? 'Seduta ' + le.scheda.trim() : 'Seduta 1'; w = byName[nm] || Object.values(wmap).find(x => x.name === nm); if (!w) { w = { id: uid('rt') + 'x' + i, name: nm, order: Object.keys(wmap).length + 1, items: [] }; wmap['_' + nm] = w; } byName[nm] = w; }
    let ex = libByName(norm(le.name));
    if (!ex) { ex = newExercise({ name: le.name, inc: le.step || 2.5, notes: le.note || '' }); ex.muscle = guessMuscle(le.name); }
    else if (!out.exercises[ex.id]) { ex = { ...ex, inc: le.step || ex.inc, notes: le.note || ex.notes }; }
    out.exercises[ex.id] = ex;
    w.items.push({ eid: ex.id, sets: le.sets || 3, repMin: le.repMin || 8, repMax: le.repMax || 12, rest: le.rest || 0, order: le.order || i, ss: false });
    (le.history || []).forEach(h => {
      const key = h.d + '|' + w.id;
      let s = out.sessions[key];
      if (!s) s = out.sessions[key] = { id: uid('ss') + Object.keys(out.sessions).length, routineId: w.id, name: w.name, date: h.d, start: h.d + 'T18:00:00', end: null, notes: '', entries: [] };
      s.entries.push({ eid: ex.id, note: '', sets: (h.s || []).map(x => ({ kg: x[0], reps: x[1], type: 'n', rpe: null, done: true })) });
    });
  });
  Object.values(wmap).forEach(w => { w.items.sort((a, b) => a.order - b.order).forEach(it => delete it.order); out.routines[w.id] = w; });
  const sess = {}; Object.values(out.sessions).forEach(s => { sess[s.id] = s; }); out.sessions = sess;
  return out;
}
export function guessMuscle(name) {
  const n = norm(name);
  const rules = [[/chest|panca|pector|croci|dip/, 'Petto'], [/lat|pulley|row|remator|trazion|pullover/, 'Dorso'], [/shoulder|alzat|lento|delt|face/, 'Spalle'],
    [/curl(?!.*leg)|bicip/, 'Bicipiti'], [/push ?down|french|tricip|extension machine|arm ext/, 'Tricipiti'], [/leg press|squat|leg ext|affond|adduct/, 'Quadricipiti'],
    [/leg curl|rumeno|stacco/, 'Femorali'], [/hip|glut|abduct/, 'Glutei'], [/calf|polpac/, 'Polpacci'], [/crunch|plank|addom/, 'Addome'], [/hyper|lomb/, 'Lombari']];
  for (const [re, m] of rules) if (re.test(n)) return m;
  return 'Petto';
}
/** Merges converted legacy data into the state (library by name, routines by name, sessions by date+routine). */
export function mergeImported(conv) {
  const idMap = {};
  Object.values(conv.exercises).forEach(e => {
    const ex = st.exercises[e.id] || findExByName(e.name);
    if (ex) { idMap[e.id] = ex.id; if ((e.inc && e.inc !== ex.inc) || (e.notes && e.notes !== ex.notes)) put('exercises', { ...ex, inc: e.inc || ex.inc, notes: e.notes || ex.notes }); }
    else { put('exercises', e); idMap[e.id] = e.id; }
  });
  const rmap = {};
  Object.values(conv.routines).forEach(r => {
    const ex = Object.values(st.routines).find(x => norm(x.name) === norm(r.name));
    const items = r.items.map(it => ({ ...it, eid: idMap[it.eid] || it.eid }));
    if (ex) { rmap[r.id] = ex.id; const have = new Set(ex.items.map(i => i.eid)); items.forEach(i => { if (!have.has(i.eid)) ex.items.push(i); }); put('routines', ex); }
    else { r.order = Object.keys(st.routines).length + 1; r.items = items; put('routines', r); rmap[r.id] = r.id; }
  });
  let n = 0;
  Object.values(conv.sessions).forEach(s => {
    s.routineId = rmap[s.routineId] || s.routineId;
    s.entries.forEach(en => en.eid = idMap[en.eid] || en.eid);
    const dup = Object.values(st.sessions).find(x => x.date === s.date && x.routineId === s.routineId);
    if (dup) { s.id = dup.id; }
    put('sessions', s); n++;
  });
  return n;
}

/** A training program (routines + exercises, no history): exercises matched by name, routines replaced by name. */
export function mergeProgram(prog) {
  let ne = 0;
  const idOf = {};
  (prog.exercises || []).forEach(d => {
    const have = findExByName(d.name);
    const base = have || newExercise({ name: d.name });
    const e = { ...base, name: d.name, muscle: d.muscle || base.muscle, secondary: d.secondary || base.secondary || [], equipment: d.equipment || base.equipment,
      kind: d.kind || base.kind, inc: d.inc || base.inc, prog: d.prog || base.prog, notes: d.notes != null ? d.notes : base.notes, archived: false };
    put('exercises', e); idOf[norm(d.name)] = e.id; ne++;
  });
  let order = Object.keys(st.routines).length, nr = 0;
  (prog.routines || []).forEach(r => {
    const items = (r.items || []).map(it => {
      const eid = idOf[norm(it.exercise)] || (findExByName(it.exercise) || {}).id; if (!eid) return null;
      const work = (it.plan || []).filter(p => p.type !== 'w');
      return { eid, plan: it.plan, sets: work.length || 3, repMin: (work[0] || {}).repMin || 8, repMax: (work[0] || {}).repMax || 12, rest: it.rest || 0, ss: !!it.ss };
    }).filter(Boolean);
    const old = Object.values(st.routines).find(x => norm(x.name) === norm(r.name));
    put('routines', { id: old ? old.id : uid('rt'), name: r.name, day: r.day || 0, cardio: r.cardio || [], items, order: old ? old.order : ++order });
    nr++;
  });
  if (prog.settings) setSettings(prog.settings);
  return { routines: nr, exercises: ne };
}

/* ---------- boot ---------- */
export async function load() {
  let data = null, m = null, a = null;
  try { [data, m, a] = await Promise.all([idbGet('state'), idbGet('meta'), idbGet('active')]); } catch (e) { hooks.onSaveError(e); }
  if (data && data.schema === 3) replaceAll(data, false);
  else { seedLibrary(); st.updatedAt = 0; }
  if (m) Object.assign(meta, m);
  if (a) active = a;
  // data from the previous version of the app, kept in localStorage
  if (!meta.migrated) {
    try {
      const ex = JSON.parse(localStorage.getItem('dp-local-exercises') || '[]');
      const ws = JSON.parse(localStorage.getItem('dp-workouts') || '[]');
      if (Array.isArray(ex) && ex.length) mergeImported(fromLegacy(ws, ex));
    } catch (e) { }
    meta.migrated = true; scheduleSave();
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
}
export { today };
