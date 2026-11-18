// Navigation, events and actions.
import { st, meta, active, hooks, load, put, del, setSettings, setActive, saveActive, setMeta, replaceAll, persistNow, newExercise, findExByName, routineList, mergeImported, mergeProgram, bodyList, DEFAULT_SETTINGS } from './store.js';
import { startWorkout, editSession, addExercise, toggleSet, finishWorkout, discardWorkout, newEntry, targetFor, warmRecords } from './workout.js';
import * as V from './views.js';
import { startTimer, stopTimer, adjust, wakeOn, wakeOff } from './timer.js';
import { SY, initSync, syncNow, schedule, signIn, signOut } from './sync.js';
import { download, backupText, csvText, bodyCsvText, parseImport } from './io.js';
import { today, num, round, uid, mmss, fmt, esc, timeLbl } from './util.js';
import { historyOf, planOf } from './engine.js';

const CFG = window.DP_CONFIG || {};
const ui = { tab: 'oggi', stack: [], err: '' };
const $ = id => document.getElementById(id);
const screen = () => ui.stack[ui.stack.length - 1] || null;

/* ---------- navigation ---------- */
function go(tab) { ui.tab = tab; ui.stack = []; ui.err = ''; ui.confirmDel = null; ui.finishing = false; render(); window.scrollTo(0, 0); }
function push(s) { ui.stack.push(s); ui.err = ''; ui.confirmDel = null; try { history.pushState({ n: ui.stack.length }, ''); } catch (e) { } render(); window.scrollTo(0, 0); }
function pop() { if (ui.stack.length) { ui.stack.pop(); ui.err = ''; ui.confirmDel = null; render(); window.scrollTo(0, 0); } }
function back() { if (ui.stack.length) { try { history.back(); } catch (e) { pop(); } } }
window.addEventListener('popstate', () => { if (ui.stack.length) pop(); });

function toast(msg, kind) {
  const t = $('toast'); t.innerHTML = msg; t.className = 'toast' + (kind ? ' ' + kind : ''); t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, kind === 'pr' ? 4000 : 2800);
}

/* ---------- render ---------- */
function render() {
  const a = document.activeElement, aid = a && a.id, sel = a && typeof a.selectionStart === 'number' && a.type !== 'date' && a.type !== 'checkbox' ? [a.selectionStart, a.selectionEnd] : null;
  const s = screen();
  let html;
  if (s) html = ({ workout: V.vWorkout, summary: V.vSummary, session: V.vSession, routine: V.vRoutineForm, exercise: V.vExerciseForm, picker: V.vPicker, body: V.vBodyForm, cardio: V.vCardioForm }[s.name] || V.vOggi)(Object.assign(ui, s));
  else html = ({ oggi: V.vOggi, storico: V.vStorico, progressi: V.vProgressi, corpo: V.vCorpo, gestisci: V.vGestisci }[ui.tab])(ui);
  $('view').innerHTML = html;
  $('topbar').hidden = !!s;
  $('pageTitle').textContent = { oggi: 'Progressio', storico: 'Storico', progressi: 'Progressi', corpo: 'Corpo', gestisci: 'Gestisci' }[ui.tab];
  $('syncSlot').innerHTML = V.syncBadge();
  document.querySelectorAll('.nav button').forEach(b => b.setAttribute('aria-current', String(!s && b.dataset.id === ui.tab || (s && s.name === 'workout' && b.dataset.id === 'oggi'))));
  const bar = $('activeBar'); bar.hidden = !active || (s && s.name === 'workout');
  document.body.classList.toggle('has-active', !bar.hidden);
  if (!bar.hidden) bar.querySelector('b').textContent = active.name;
  tickClock();
  if (aid) { const el = $(aid); if (el) { try { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) el.setSelectionRange(sel[0], sel[1]); } catch (e) { } } }
}
function tickClock() {
  if (!active) return;
  const t = active.mode === 'edit' ? '' : mmss((Date.now() - new Date(active.start)) / 1000);
  const c = $('wClock'); if (c) c.textContent = t;
  const b = $('activeTime'); if (b) b.textContent = t;
}
setInterval(tickClock, 1000);
function applyTheme() {
  const t = st.settings.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}

/* ---------- forms ---------- */
const blank = v => v == null ? '' : fmt(v);
function openBody(id) { const b = id && st.body[id]; ui.bform = b ? { id, date: b.date, weight: blank(b.weight), fat: blank(b.fat), waist: blank(b.waist), hips: blank(b.hips), chest: blank(b.chest), arm: blank(b.arm), thigh: blank(b.thigh), notes: b.notes || '' } : { id: null, date: today(), weight: '', fat: '', waist: '', hips: '', chest: '', arm: '', thigh: '', notes: '' }; push({ name: 'body' }); }
function saveBody() {
  const f = ui.bform, o = { id: f.id || uid('bd'), date: f.date || today(), notes: (f.notes || '').trim() };
  for (const k of ['weight', 'fat', 'waist', 'hips', 'chest', 'arm', 'thigh']) { const v = num(f[k]); o[k] = isNaN(v) ? null : round(v, 2); }
  if (o.weight != null && (o.weight < 25 || o.weight > 300)) { ui.err = 'Il peso deve essere tra 25 e 300 kg.'; return render(); }
  if (o.fat != null && (o.fat < 2 || o.fat > 70)) { ui.err = 'La massa grassa deve essere tra 2 e 70%.'; return render(); }
  if (['weight', 'fat', 'waist', 'hips', 'chest', 'arm', 'thigh'].every(k => o[k] == null)) { ui.err = 'Inserisci almeno un valore.'; return render(); }
  put('body', o); toast('Misurazione salvata'); back();
}
function openCardio(id, preset) { const c = id && st.cardio[id]; ui.cform = preset ? { id: null, date: preset.date || today(), type: preset.type, minutes: String(preset.minutes || ''), km: '', hr: '', kcal: '', notes: preset.notes || '' } : c ? { id, date: c.date, type: c.type, minutes: String(c.minutes || ''), km: blank(c.km), hr: c.hr ? String(c.hr) : '', kcal: c.kcal ? String(c.kcal) : '', notes: c.notes || '' } : { id: null, date: today(), type: (Object.values(st.cardio).sort((a, b) => b.date.localeCompare(a.date))[0] || {}).type || 'Camminata veloce', minutes: '', km: '', hr: '', kcal: '', notes: '' }; push({ name: 'cardio' }); }
function saveCardio() {
  const f = ui.cform, m = parseInt(f.minutes, 10);
  if (!(m > 0 && m < 1000)) { ui.err = 'Inserisci la durata in minuti.'; return render(); }
  const km = num(f.km), hr = parseInt(f.hr, 10), kcal = parseInt(f.kcal, 10);
  put('cardio', { id: f.id || uid('cd'), date: f.date || today(), type: f.type, minutes: m, km: isNaN(km) ? null : round(km, 2), hr: isNaN(hr) ? null : hr, kcal: isNaN(kcal) ? null : kcal, notes: (f.notes || '').trim() });
  toast('Cardio registrato'); back();
}
const planStr = plan => plan.map(p => ({ type: p.type === 'w' ? 'w' : 'n', kg: p.kg == null ? '' : fmt(p.kg), repMin: String(p.repMin), repMax: String(p.repMax) }));
function openRoutine(id) {
  const r = id && st.routines[id];
  ui.rform = r ? { id, name: r.name, day: r.day || 0, cardio: (r.cardio || []).map(c => ({ ...c, min: String(c.min), max: String(c.max) })), items: r.items.map(i => ({ eid: i.eid, ss: !!i.ss, rest: i.rest ? String(i.rest) : '', plan: planStr(planOf(i)) })) }
    : { id: null, name: '', day: 0, cardio: [], items: [] };
  push({ name: 'routine' });
}
function saveRoutine() {
  const f = ui.rform, name = f.name.trim();
  if (!name) { ui.err = 'Dai un nome alla seduta.'; return render(); }
  if (Object.values(st.routines).some(r => r.id !== f.id && r.name.toLowerCase() === name.toLowerCase())) { ui.err = 'Esiste già una seduta con questo nome.'; return render(); }
  const items = [];
  for (const it of f.items) {
    const plan = [];
    for (const p of it.plan) {
      const mn = parseInt(p.repMin, 10), mx = parseInt(p.repMax, 10), kg = num(p.kg);
      if (!(mn >= 1) || !(mx >= mn)) { ui.err = exNameOf(it.eid) + ': ogni serie deve avere ripetizioni minime e massime (massimo ≥ minimo).'; return render(); }
      plan.push({ type: p.type, kg: isNaN(kg) ? null : round(kg, 2), repMin: mn, repMax: mx });
    }
    const work = plan.filter(p => p.type !== 'w');
    if (!work.length) { ui.err = exNameOf(it.eid) + ': serve almeno una serie di lavoro.'; return render(); }
    const rest = parseInt(it.rest, 10);
    items.push({ eid: it.eid, plan, sets: work.length, repMin: work[0].repMin, repMax: work[0].repMax, rest: rest >= 10 ? rest : 0, ss: !!it.ss });
  }
  if (items.length) items[items.length - 1].ss = false;
  const cardio = [];
  for (const c of f.cardio) { const mn = parseInt(c.min, 10), mx = parseInt(c.max, 10); if (!(mn > 0)) { ui.err = 'Cardio: indica i minuti.'; return render(); } cardio.push({ type: c.type, min: mn, max: mx >= mn ? mx : mn, note: (c.note || '').trim() }); }
  const old = f.id && st.routines[f.id];
  put('routines', { id: f.id || uid('rt'), name, day: +f.day || 0, cardio, items, order: old ? old.order : routineList().reduce((m, r) => Math.max(m, r.order || 0), 0) + 1 });
  toast('Seduta salvata'); back();
}
const exNameOf = eid => st.exercises[eid] ? st.exercises[eid].name : 'Esercizio';
function openExercise(id, preset) { const e = id && st.exercises[id]; ui.xform = e ? { ...e, secondary: [...(e.secondary || [])], inc: fmt(e.inc) } : { ...newExercise({ name: preset || '' }), id: null, inc: '2,5' }; push({ name: 'exercise' }); }
function saveExercise() {
  const f = ui.xform, name = (f.name || '').trim(), inc = num(f.inc);
  if (!name) { ui.err = 'Dai un nome all\'esercizio.'; return render(); }
  const dup = findExByName(name); if (dup && dup.id !== f.id) { ui.err = 'Esiste già un esercizio con questo nome' + (dup.archived ? ' (archiviato)' : '') + '.'; return render(); }
  if (!(inc > 0 && inc <= 50)) { ui.err = 'L\'aumento di carico deve essere tra 0,25 e 50 kg.'; return render(); }
  const e = { ...(f.id ? st.exercises[f.id] : newExercise({})), name, muscle: f.muscle, secondary: f.secondary.filter(m => m !== f.muscle), equipment: f.equipment, kind: f.kind, prog: f.kind === 'time' && f.prog !== 'none' ? 'none' : f.prog, inc: round(inc, 2), notes: (f.notes || '').trim(), archived: !!f.archived };
  if (!f.id) e.id = uid('ex');
  put('exercises', e); toast('Esercizio salvato');
  const prev = ui.stack[ui.stack.length - 2];
  if (prev && prev.name === 'picker' && !f.id) ui.picked = (ui.picked || []).concat(e.id);
  back();
}
function template() {
  const T = [['A – Petto, spalle e dorso', [['Chest press', 3, 8, 12, 90], ['Lat machine', 3, 8, 12, 90], ['Shoulder press', 3, 8, 12, 90], ['Pulley basso', 3, 8, 12, 90], ['Alzate laterali', 3, 12, 15, 60]]],
    ['B – Gambe e braccia', [['Leg press', 3, 10, 15, 120], ['Leg extension', 3, 10, 12, 75], ['Leg curl', 3, 10, 12, 75], ['Curl con manubri', 3, 10, 12, 60, true], ['Push down al cavo', 3, 10, 12, 60]]]];
  let o = routineList().length;
  T.forEach(([name, xs]) => {
    if (Object.values(st.routines).some(r => r.name === name)) return;
    put('routines', { id: uid('rt'), name, order: ++o, items: xs.map(([n, sets, mn, mx, rest, ss]) => { const e = findExByName(n); return e && { eid: e.id, sets, repMin: mn, repMax: mx, rest, ss: !!ss }; }).filter(Boolean) });
  });
  toast('Sedute di esempio create: modificale da Gestisci › Sedute'); render();
}
function moveRoutine(id, d) { const rs = routineList(), i = rs.findIndex(r => r.id === id), j = i + d; if (j < 0 || j >= rs.length) return; [rs[i], rs[j]] = [rs[j], rs[i]]; rs.forEach((r, k) => { if (r.order !== k + 1) put('routines', { ...r, order: k + 1 }); }); render(); }

/* ---------- workout ---------- */
function onSetDone(ei, si) {
  const r = toggleSet(ei, si);
  if (!r.ok) { toast(esc(r.msg), 'warn'); return; }
  render();
  if (r.undone) return;
  if (r.prs && r.prs.length) toast('<b>Nuovo record</b> ' + esc(r.prs[0]), 'pr');
  const en = active.entries[ei], set = en.sets[si];
  const nextEn = active.entries[ei + 1];
  if (en.ss && nextEn) { if (!(r.prs && r.prs.length)) toast('Superserie: passa a ' + esc(exNameOf(nextEn.eid))); return; }
  let rest = en.target.rest || st.settings.rest;
  if (set.type === 'w') rest = Math.min(60, Math.round(rest / 2));
  const left = en.sets.filter(x => !x.done).length;
  // in a superset the rest belongs to the group: name it after the first exercise
  let first = ei; while (first > 0 && active.entries[first - 1].ss) first--;
  startTimer(rest, exNameOf(active.entries[first].eid), left ? 'Serie ' + (si + 1) + ' di ' + en.sets.length + ' fatta' : (nextEn && !en.ss ? 'Prossimo: ' + exNameOf(nextEn.eid) : 'Esercizio completato'));
}
function setAt(el) { const row = el.closest('.set'); return row ? [+row.dataset.e, +row.dataset.s] : [null, null]; }
function entryAt(el) { const c = el.closest('article.ex'); return c ? +c.id.slice(3) : null; }

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const act = b.dataset.act, id = b.dataset.id;
  switch (act) {
    case 'nav': go(id); break;
    case 'tab-oggi': if (ui.stack.length) { ui.stack = []; } go('oggi'); break;
    case 'tab-storico': ui.stack = []; go('storico'); break;
    case 'back': back(); break;
    case 'go-workout': if (active) { ui.stack = []; ui.tab = 'oggi'; push({ name: 'workout' }); } break;
    case 'go-sync': ui.tab = 'gestisci'; ui.gsub = 'set'; ui.stack = []; render(); setTimeout(() => { const s = [...document.querySelectorAll('h2.sec')].find(x => x.textContent.includes('OneDrive')); if (s) s.scrollIntoView({ block: 'start' }); }, 0); break;
    // today / workout
    case 'start': if (!active) { startWorkout(id || null); push({ name: 'workout' }); wakeOn(); } break;
    case 'finish': ui.finishing = true; ui.confirmDiscard = false; render(); window.scrollTo(0, 0); break;
    case 'finish-no': ui.finishing = false; render(); break;
    case 'finish-ok': { const mode = active.mode; const sid = finishWorkout(); ui.finishing = false; stopTimer(); wakeOff(); ui.stack = []; if (mode === 'edit') { toast('Modifiche salvate'); push({ name: 'session', sid }); } else push({ name: 'summary', sid }); break; }
    case 'discard': ui.confirmDiscard = true; render(); break;
    case 'discard-ok': { const wasEdit = active.mode === 'edit', sid = active.id; discardWorkout(); ui.finishing = false; stopTimer(); wakeOff(); ui.stack = []; if (wasEdit) push({ name: 'session', sid }); else go('oggi'); toast(wasEdit ? 'Modifiche annullate' : 'Allenamento scartato'); break; }
    case 'set-done': { const [ei, si] = setAt(b); onSetDone(ei, si); break; }
    case 'set-type': { const [ei, si] = setAt(b); const s = active.entries[ei].sets[si]; s.type = { n: 'w', w: 'd', d: 'f', f: 'n' }[s.type || 'n']; saveActive(); render(); break; }
    case 'rep-': case 'rep+': { const [ei, si] = setAt(b); const s = active.entries[ei].sets[si]; const v = parseInt(s.reps, 10) || 0; s.reps = String(Math.max(0, v + (act === 'rep+' ? 1 : -1))); $('r-' + ei + '-' + si).value = s.reps; saveActive(); break; }
    case 'set-add': { const ei = entryAt(b), en = active.entries[ei]; const l = en.sets.filter(x => x.type !== 'w').pop() || en.sets[en.sets.length - 1] || { kg: '', reps: '10' }; en.sets.push({ kg: l.kg, reps: l.reps, type: 'n', rpe: '', done: false }); saveActive(); render(); break; }
    case 'set-warm': { const ei = entryAt(b), en = active.entries[ei]; const w = en.sets.find(x => x.type !== 'w'); const k = num(w && w.kg); en.sets.splice(en.sets.filter(x => x.type === 'w').length, 0, { kg: isNaN(k) ? '' : fmt(Math.max(0, Math.round(k * 0.5 / 2.5) * 2.5)), reps: '10', type: 'w', rpe: '', done: false }); saveActive(); render(); break; }
    case 'set-del': { const ei = entryAt(b), en = active.entries[ei]; for (let i = en.sets.length - 1; i >= 0; i--) if (!en.sets[i].done) { en.sets.splice(i, 1); break; } saveActive(); render(); break; }
    case 'rest': { const ei = entryAt(b), en = active.entries[ei]; startTimer(en.target.rest || st.settings.rest, exNameOf(en.eid), 'Recupero ' + mmss(en.target.rest || st.settings.rest)); break; }
    case 'en-tools': { const ei = entryAt(b); active.entries[ei].open = !active.entries[ei].open; render(); break; }
    case 'en-up': case 'en-down': { const ei = entryAt(b), j = ei + (act === 'en-up' ? -1 : 1); const E = active.entries; if (j < 0 || j >= E.length) break; [E[ei], E[j]] = [E[j], E[ei]]; E[E.length - 1].ss = false; saveActive(); render(); break; }
    case 'en-del': { const ei = entryAt(b); active.entries.splice(ei, 1); if (active.entries.length) active.entries[active.entries.length - 1].ss = false; saveActive(); render(); break; }
    case 'pick-workout': ui.picked = []; ui.pq = ''; ui.pm = ''; push({ name: 'picker', pickFor: 'workout' }); break;
    case 'pick-routine': ui.picked = []; ui.pq = ''; ui.pm = ''; push({ name: 'picker', pickFor: 'routine' }); break;
    case 'pick': { const p = ui.picked || (ui.picked = []); const i = p.indexOf(id); if (i >= 0) p.splice(i, 1); else p.push(id); render(); break; }
    case 'pm': ui.pm = id; render(); break;
    case 'pick-create': openExercise(null, ui.pq || ''); break;
    case 'pick-done': {
      const s = screen(); const p = ui.picked || [];
      if (s && s.pickFor === 'workout') p.forEach(eid => addExercise(eid));
      else if (s && s.pickFor === 'routine') p.forEach(eid => ui.rform.items.push({ eid, rest: '', ss: false, plan: planStr(planOf(null)) }));
      ui.picked = []; back(); break;
    }
    // history
    case 'cal-prev': case 'cal-next': { const n = new Date(); let y = ui.calY ?? n.getFullYear(), m = (ui.calM ?? n.getMonth()) + (act === 'cal-prev' ? -1 : 1); if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } ui.calY = y; ui.calM = m; render(); break; }
    case 'session-open': push({ name: 'session', sid: id }); break;
    case 'session-edit': if (!active) { editSession(id); ui.stack = []; push({ name: 'workout' }); } break;
    case 'session-del': ui.confirmDel = id; render(); break;
    case 'session-del-ok': del('sessions', id); toast('Allenamento eliminato'); ui.stack = []; go('storico'); break;
    // progress
    case 'psub': ui.psub = id; render(); break;
    case 'pper': ui.pper = id; render(); break;
    case 'pmet': ui.pmet = id; render(); break;
    case 'pwk': ui.pwk = Math.max(0, +id); render(); break;
    // body & cardio
    case 'bm': ui.bm = id; render(); break;
    case 'body-new': openBody(null); break;
    case 'body-edit': openBody(id); break;
    case 'body-save': saveBody(); break;
    case 'body-del': ui.confirmDel = ui.bform.id; render(); break;
    case 'body-del-ok': del('body', ui.bform.id); toast('Misurazione eliminata'); back(); break;
    case 'cardio-new': openCardio(null); break;
    case 'cardio-edit': openCardio(id); break;
    case 'cardio-save': saveCardio(); break;
    case 'cardio-del': ui.confirmDel = ui.cform.id; render(); break;
    case 'cardio-del-ok': del('cardio', ui.cform.id); toast('Attività eliminata'); back(); break;
    // manage
    case 'gsub': ui.gsub = id; render(); break;
    case 'routine-new': openRoutine(null); break;
    case 'routine-edit': openRoutine(id); break;
    case 'routine-template': template(); break;
    case 'routine-up': moveRoutine(id, -1); break;
    case 'routine-down': moveRoutine(id, 1); break;
    case 'routine-save': saveRoutine(); break;
    case 'routine-del': ui.confirmDel = ui.rform.id; render(); break;
    case 'routine-del-ok': del('routines', ui.rform.id); toast('Seduta eliminata'); back(); break;
    case 'ri-up': case 'ri-down': { const i = +b.dataset.i, j = i + (act === 'ri-up' ? -1 : 1), I = ui.rform.items; [I[i], I[j]] = [I[j], I[i]]; render(); break; }
    case 'ri-del': ui.rform.items.splice(+b.dataset.i, 1); render(); break;
    case 'rp-type': { const r = b.closest('.plan-r'), P = ui.rform.items[+r.dataset.i].plan, p = P[+r.dataset.j]; p.type = p.type === 'w' ? 'n' : 'w'; render(); break; }
    case 'rp-del': { const r = b.closest('.plan-r'); ui.rform.items[+r.dataset.i].plan.splice(+r.dataset.j, 1); render(); break; }
    case 'rp-add': { const P = ui.rform.items[+b.dataset.i].plan; const l = P.filter(p => p.type !== 'w').pop() || { kg: '', repMin: '8', repMax: '12' }; P.push({ type: 'n', kg: l.kg, repMin: l.repMin, repMax: l.repMax }); render(); break; }
    case 'rp-warm': { const P = ui.rform.items[+b.dataset.i].plan; const nw = P.filter(p => p.type === 'w').length; P.splice(nw, 0, { type: 'w', kg: '', repMin: '10', repMax: '10' }); render(); break; }
    case 'rc-add': ui.rform.cardio.push({ type: 'Tapis roulant', min: '15', max: '20', note: '' }); render(); break;
    case 'rc-del': ui.rform.cardio.splice(+b.dataset.c, 1); render(); break;
    case 'cardio-plan': { const rt = st.routines[active.routineId]; const c = rt && rt.cardio[+b.dataset.i]; if (c) openCardio(null, { type: c.type, minutes: c.min, notes: c.note, date: active.date }); break; }
    case 'exercise-new': openExercise(null); break;
    case 'exercise-edit': openExercise(id); break;
    case 'exercise-save': saveExercise(); break;
    case 'exercise-arch': ui.xform.archived = !ui.xform.archived; saveExercise(); break;
    case 'exercise-del': ui.confirmDel = ui.xform.id; render(); break;
    case 'exercise-del-ok': { const eid = ui.xform.id; Object.values(st.routines).forEach(r => { if (r.items.some(i => i.eid === eid)) put('routines', { ...r, items: r.items.filter(i => i.eid !== eid) }); }); del('exercises', eid); toast('Esercizio eliminato'); back(); break; }
    case 'xf-sec': { const s = ui.xform.secondary, i = s.indexOf(id); if (i >= 0) s.splice(i, 1); else s.push(id); render(); break; }
    case 'exm': ui.exm = id; render(); break;
    // data
    case 'backup': download('progressio-backup-' + today() + '.json', backupText(), 'application/json'); setMeta({ lastBackup: today() }); toast('Backup salvato in Download'); render(); break;
    case 'csv': download('allenamenti-' + today() + '.csv', csvText(), 'text/csv'); toast('CSV salvato in Download'); break;
    case 'csv-body': download('corpo-e-cardio-' + today() + '.csv', bodyCsvText(), 'text/csv'); toast('CSV salvato in Download'); break;
    case 'import': $('fileIn').click(); break;
    case 'imp-no': ui.pending = null; render(); break;
    case 'imp-ok': {
      const p = ui.pending; ui.pending = null;
      if (p.kind === 'backup') { replaceAll(p.data, true); setMeta({ forcePush: true }); applyTheme(); toast('Backup ripristinato'); }
      else if (p.kind === 'program') { const r = mergeProgram(p.prog); toast('Scheda caricata: ' + r.routines + ' sedute, ' + r.exercises + ' esercizi'); go('oggi'); return; }
      else { const n = mergeImported(p.conv); toast(n + ' allenamenti importati'); }
      render(); break;
    }
    case 'ms-in': signIn(); break;
    case 'ms-out': signOut().then(() => { toast('OneDrive scollegato. I dati restano sul telefono.'); render(); }); break;
    case 'ms-sync': syncNow(); break;
    // timer
    case 't-plus': adjust(15); break;
    case 't-minus': adjust(-15); break;
    case 't-stop': stopTimer(); break;
  }
});

document.addEventListener('input', e => {
  const el = e.target, f = el.dataset && el.dataset.f; if (!f) return;
  const v = el.value;
  switch (f) {
    case 'set-kg': case 'set-reps': case 'set-rpe': { const [ei, si] = setAt(el); active.entries[ei].sets[si][f === 'set-kg' ? 'kg' : f === 'set-reps' ? 'reps' : 'rpe'] = v; saveActive(); break; }
    case 'w-name': active.name = v; saveActive(); break;
    case 'w-notes': active.notes = v; saveActive(); break;
    case 'en-note': active.entries[entryAt(el)].note = v; saveActive(); break;
    case 'bform': ui.bform[el.dataset.k] = v; break;
    case 'cform': ui.cform[el.dataset.k] = v; break;
    case 'xform': ui.xform[el.dataset.k] = v; if (el.tagName === 'SELECT') render(); break;
    case 'rform-name': ui.rform.name = v; break;
    case 'ri': { const i = +el.id.split('-').pop(); ui.rform.items[i][el.dataset.k] = v; break; }
    case 'rp': { const r = el.closest('.plan-r'); ui.rform.items[+r.dataset.i].plan[+r.dataset.j][el.dataset.k] = v; break; }
    case 'rc': ui.rform.cardio[+el.dataset.c][el.dataset.k] = v; break;
    case 'exq': ui.exq = v; render(); break;
    case 'pq': ui.pq = v; render(); break;
    case 'setnum': { const n = parseInt(v, 10); const lim = { weekGoal: [1, 14], cardioGoal: [0, 2000], rest: [10, 900] }[el.dataset.k]; if (n >= lim[0] && n <= lim[1]) setSettings({ [el.dataset.k]: n }); break; }
  }
});
document.addEventListener('change', e => {
  const el = e.target, f = el.dataset && el.dataset.f; if (!f) return;
  switch (f) {
    case 'w-date': if (el.value) { active.date = el.value > today() ? today() : el.value; saveActive(); } break;
    case 'en-ss': active.entries[entryAt(el)].ss = el.checked; saveActive(); render(); break;
    case 'ri-ss': ui.rform.items[+el.dataset.i].ss = el.checked; render(); break;
    case 'rform-day': ui.rform.day = +el.value; break;
    case 'rc': ui.rform.cardio[+el.dataset.c][el.dataset.k] = el.value; break;
    case 'pex': ui.pex = el.value; render(); break;
    case 'setbool': setSettings({ [el.dataset.k]: el.checked }); render(); break;
    case 'settheme': setSettings({ theme: el.value }); applyTheme(); break;
    case 'showArch': ui.showArch = el.checked; render(); break;
    case 'cform': case 'bform': case 'xform': (f === 'cform' ? ui.cform : f === 'bform' ? ui.bform : ui.xform)[el.dataset.k] = el.value; if (f === 'xform') render(); break;
  }
});
$('fileIn').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
  try { ui.pending = parseImport(await file.text()); ui.tab = 'gestisci'; ui.gsub = 'set'; ui.stack = []; render(); window.scrollTo(0, 0); }
  catch (err) { toast(esc(err.message || 'File non leggibile.'), 'warn'); }
});

/* ---------- boot ---------- */
hooks.onChange = () => { schedule(); };
hooks.onSaveError = () => toast('Non riesco a salvare sul telefono: controlla lo spazio libero.', 'warn');
SY.onState = () => { const s = screen(); $('syncSlot').innerHTML = V.syncBadge(); if (!s && ui.tab === 'gestisci' && ui.gsub === 'set' && !(document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))) render(); };
SY.onData = () => { applyTheme(); const s = screen(); if (!s || s.name === 'session' || s.name === 'summary') render(); };

(async function boot() {
  await load();
  applyTheme();
  if (active) warmRecords();
  render();
  initSync();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
  if (CFG.goatcounter && location.protocol === 'https:') {
    const sc = document.createElement('script'); sc.async = true; sc.src = 'https://gc.zgo.at/count.js'; sc.dataset.goatcounter = 'https://' + CFG.goatcounter + '.goatcounter.com/count'; document.body.appendChild(sc);
  }
})();
