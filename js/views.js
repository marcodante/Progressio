// Every screen, rendered as HTML strings from the state and the UI state.
import { st, meta, active, MUSCLES, EQUIP, KINDS, PROGS, CARDIO, SET_TYPES, exList, routineList, sessionList, bodyList, cardioList } from './store.js';
import { historyOf, prescribe, planOf, planLbl, recordsOf, sessionStats, muscleSets, weeklyTotals, streak, nextRoutine, lastRoutineDate, setsTxt, e1rm, loadOf, bodyWeightAt, weeks, isHard } from './engine.js';
import { lineChart, columns } from './charts.js';
import { esc, fmt, fmtInt, round, today, dLbl, dLblY, dLblW, relDay, weekStart, addDays, parseD, dstr, monthLbl, mmss, durLbl, sum, timeLbl, daysBetween } from './util.js';
import { SY, syncConfigured } from './sync.js';
import { doneCount } from './workout.js';

const CFG = window.DP_CONFIG || {};
const pill = (cls, t) => '<span class="pill p-' + cls + '">' + t + '</span>';
const btn = (act, label, cls, attrs) => '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '"' + (attrs || '') + '>' + label + '</button>';
const field = (id, label, value, o = {}) => '<div class="field' + (o.cls ? ' ' + o.cls : '') + '"><label for="' + id + '">' + label + '</label><input id="' + id + '" data-f="' + (o.f || id) + '"' + (o.k ? ' data-k="' + o.k + '"' : '') + ' inputmode="' + (o.mode || 'text') + '"' + (o.type ? ' type="' + o.type + '"' : '') + ' autocomplete="off" value="' + esc(value == null ? '' : value) + '"' + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '></div>';
const select = (id, label, opts, value, o = {}) => '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '" data-f="' + (o.f || id) + '"' + (o.k ? ' data-k="' + o.k + '"' : '') + '>' + opts.map(([v, t]) => '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></div>';
const head = (title, back, right) => '<header class="scr-head">' + (back ? '<button type="button" class="back" data-act="' + back + '" aria-label="Indietro">‹</button>' : '') + '<h2 class="scr-title">' + title + '</h2>' + (right || '') + '</header>';
const exName = eid => st.exercises[eid] ? st.exercises[eid].name : 'Esercizio eliminato';
const loadLbl = (ex, k) => ex.kind === 'assisted' ? '−' + fmt(k) + ' kg' : ex.kind === 'bodyweight' ? (k ? '+' + fmt(k) + ' kg' : 'corpo libero') : fmt(k) + ' kg';
export const DAYS = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const todayWd = () => ((new Date().getDay() + 6) % 7) + 1;
const kgUnit = ex => ex.kind === 'assisted' ? 'assist.' : ex.kind === 'bodyweight' ? '+kg' : 'kg';

/* =================== OGGI =================== */
export function vOggi(ui) {
  let h = '';
  if (active) h += '<section class="panel hero-active"><div><p class="eyebrow">Allenamento in corso</p><h2 class="h2">' + esc(active.name) + '</h2><p class="meta num">' + doneCount() + ' serie fatte · iniziato alle ' + timeLbl(active.start) + '</p></div>' + btn('go-workout', 'Riprendi', 'primary') + '</section>';
  h += vWeek();
  const rs = routineList(), nx = nextRoutine(rs);
  if (!active) {
    h += '<section class="stack-s"><h2 class="sec">Inizia un allenamento</h2>';
    if (!rs.length) h += '<div class="empty"><p>Non hai ancora sedute. Crea la tua prima seduta (per esempio “A – Petto e dorso”) scegliendo gli esercizi dal catalogo, oppure parti da un esempio.</p><div class="row">' + btn('routine-new', 'Crea una seduta', 'primary') + btn('routine-template', 'Usa sedute di esempio') + '</div></div>';
    rs.forEach(r => {
      const ld = lastRoutineDate(r.id), due = nx && nx.id === r.id;
      const isToday = +r.day === todayWd();
      h += '<div class="rcard' + (due ? ' is-due' : '') + '"><div class="rinfo"><div class="rname">' + esc(r.name) + (due ? ' ' + pill('rep', isToday ? 'Oggi' : r.day ? 'Prossima' : 'Tocca a questa') : '') + '</div><div class="meta">' + (r.day ? DAYS[r.day] + ' · ' : '') + r.items.length + ' esercizi' + ((r.cardio || []).length ? ' + cardio' : '') + ' · ' + (ld ? 'ultima ' + relDay(ld) : 'mai fatta') + '</div><div class="rlist">' + esc(r.items.slice(0, 5).map(i => exName(i.eid)).join(' · ') + (r.items.length > 5 ? ' …' : '')) + '</div></div>' + btn('start', 'Inizia', due ? 'primary' : '', ' data-id="' + r.id + '"') + '</div>';
    });
    h += '<div class="row">' + btn('start', 'Allenamento libero', 'ghost', ' data-id=""') + '</div></section>';
  }
  h += '<section class="row quick">' + btn('cardio-new', 'Registra cardio') + btn('body-new', 'Registra peso e misure') + '</section>';
  const prs = sessionList().filter(s => daysBetween(s.date, today()) <= 30).flatMap(s => (s.prs || []).map(p => ({ ...p, date: s.date }))).slice(0, 6);
  if (prs.length) h += '<section class="panel"><h2 class="sec">Record degli ultimi 30 giorni</h2><ul class="prlist">' + prs.map(p => '<li><span class="pr-badge">PR</span><div><b>' + esc(p.ex) + '</b><span>' + esc(p.txt) + ' · ' + dLbl(p.date) + '</span></div></li>').join('') + '</ul></section>';
  const last = sessionList()[0];
  if (!prs.length && last) { const ss = sessionStats(last); h += '<section class="panel"><h2 class="sec">Ultimo allenamento</h2><p class="meta">' + esc(last.name) + ' · ' + dLblW(last.date) + ' · ' + ss.sets + ' serie · ' + fmtInt(ss.vol) + ' kg di volume</p><div class="row">' + btn('session-open', 'Vedi dettaglio', 'small ghost', ' data-id="' + last.id + '"') + '</div></section>'; }
  return h;
}
function vWeek() {
  const w0 = weekStart(today()), days = Array.from({ length: 7 }, (_, i) => addDays(w0, i));
  const ss = Object.values(st.sessions), cs = Object.values(st.cardio);
  const wt = ss.filter(s => s.date >= w0 && s.date <= days[6]).length, cm = sum(cs.filter(c => c.date >= w0 && c.date <= days[6]).map(c => +c.minutes || 0));
  const sk = streak(st.settings.weekGoal || 3);
  const L = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  return '<section class="panel week"><div class="week-days">' + days.map((d, i) => {
    const hasW = ss.some(s => s.date === d), hasC = cs.some(c => c.date === d);
    return '<div class="wd' + (d === today() ? ' is-today' : '') + (d > today() ? ' is-future' : '') + '"><span>' + L[i] + '</span><b class="num">' + parseD(d).getDate() + '</b><i class="dots">' + (hasW ? '<em class="dot-w"></em>' : '') + (hasC ? '<em class="dot-c"></em>' : '') + '</i></div>';
  }).join('') + '</div><div class="week-stats num"><div><b>' + wt + '/' + (st.settings.weekGoal || 3) + '</b><span>allenamenti pesi</span><i class="meter"><em style="width:' + Math.min(100, wt / (st.settings.weekGoal || 3) * 100) + '%"></em></i></div><div><b>' + cm + '/' + (st.settings.cardioGoal || 120) + '</b><span>minuti di cardio</span><i class="meter c"><em style="width:' + Math.min(100, cm / (st.settings.cardioGoal || 120) * 100) + '%"></em></i></div><div><b>' + sk + '</b><span>' + (sk === 1 ? 'settimana' : 'settimane') + ' di fila con l\'obiettivo</span></div></div></section>';
}

/* =================== WORKOUT =================== */
export function vWorkout(ui) {
  const a = active; if (!a) return head('Allenamento', 'tab-oggi') + '<div class="empty"><p>Nessun allenamento in corso.</p></div>';
  const el = a.mode === 'edit' ? '' : '<span class="clock num" id="wClock">' + mmss((Date.now() - new Date(a.start)) / 1000) + '</span>';
  let h = '<header class="scr-head wk-head"><button type="button" class="back" data-act="tab-oggi" aria-label="Indietro">‹</button><div class="grow" style="min-width:0"><input class="title-in" id="w-name" data-f="w-name" value="' + esc(a.name) + '" aria-label="Nome allenamento"><div class="meta num"><input type="date" id="w-date" data-f="w-date" class="date-in" value="' + a.date + '" max="' + today() + '" aria-label="Data"> ' + el + '</div></div>' + btn('finish', a.mode === 'edit' ? 'Salva' : 'Termina', 'primary') + '</header>';
  if (ui.finishing) {
    const n = doneCount();
    h += '<section class="panel finish"><h2 class="sec">' + (a.mode === 'edit' ? 'Salvare le modifiche?' : 'Terminare l\'allenamento?') + '</h2><p class="meta">' + (n ? 'Hai completato ' + n + ' serie. Le serie non spuntate non vengono salvate.' : 'Non hai ancora spuntato nessuna serie: spunta ✓ le serie fatte per poterle salvare.') + '</p><div class="row">' + btn('finish-ok', a.mode === 'edit' ? 'Salva modifiche' : 'Salva allenamento', 'primary', n ? '' : ' disabled') + btn('finish-no', 'Continua', 'ghost') + '<span class="grow"></span>'
      + (ui.confirmDiscard ? btn('discard-ok', a.mode === 'edit' ? 'Annulla le modifiche' : 'Scarta tutto', 'danger') : btn('discard', a.mode === 'edit' ? 'Annulla modifiche' : 'Scarta', 'ghost')) + '</div></section>';
  }
  h += '<div class="list">';
  a.entries.forEach((en, ei) => {
    const prevSS = ei > 0 && a.entries[ei - 1].ss;
    h += entryCard(a, en, ei, prevSS);
  });
  h += '</div><div class="row" style="margin-top:12px">' + btn('pick-workout', '+ Aggiungi esercizio') + '</div>';
  const rt = a.routineId && st.routines[a.routineId];
  if (rt && (rt.cardio || []).length) {
    const doneC = Object.values(st.cardio).filter(c => c.date === a.date);
    h += '<section class="panel" style="margin-top:12px"><h2 class="sec">Cardio previsto</h2><div class="list">' + rt.cardio.map((c, i) => {
      const done = doneC.find(x => x.type === c.type);
      return '<div class="crow"><div class="grow" style="min-width:0"><b>' + esc(c.type) + '</b><div class="meta">' + c.min + (c.max > c.min ? '–' + c.max : '') + ' min' + (c.note ? ' · ' + esc(c.note) : '') + '</div></div>' + (done ? pill('done', done.minutes + ' min fatti') : btn('cardio-plan', 'Registra', 'small', ' data-i="' + i + '"')) + '</div>';
    }).join('') + '</div></section>';
  }
  h += '<div class="field" style="margin-top:14px"><label for="w-notes">Note dell\'allenamento</label><textarea id="w-notes" data-f="w-notes" rows="2" placeholder="Come ti sei sentito, sonno, energia…">' + esc(a.notes) + '</textarea></div>';
  return h;
}
function entryCard(a, en, ei, prevSS) {
  const ex = st.exercises[en.eid]; if (!ex) return '';
  const hist = historyOf(en.eid, a.id); const sug = prescribe(ex, en.target, hist);
  const allDone = en.sets.length && en.sets.every(x => x.done);
  const ssCls = (en.ss ? ' ss-top' : '') + (prevSS ? ' ss-bottom' : '');
  let h = '<article class="ex' + ssCls + (allDone ? ' is-complete' : '') + '" id="en-' + ei + '">';
  if (en.ss || prevSS) h += '<div class="ss-tag">Superserie</div>';
  h += '<div class="ex-head"><div><h3>' + esc(ex.name) + '</h3><p class="meta num">' + esc(ex.muscle) + ' · ' + planLbl(en.target, ex) + ' · rec. ' + mmss(en.target.rest || st.settings.rest) + '</p></div>' + (allDone ? pill('done', 'Fatto') : pill(sug.type, sug.label)) + '</div>';
  if (ex.notes) h += '<p class="note">' + esc(ex.notes) + '</p>';
  if (a.mode !== 'edit') h += '<p class="advice t-' + sug.type + '">' + sug.text + '</p>';
  const rpe = st.settings.rpe;
  h += '<div class="sets' + (rpe ? ' has-rpe' : '') + '">';
  let wn = 0;
  en.sets.forEach((s, si) => {
    const t = s.type || 'n'; if (t !== 'w') wn++;
    h += '<div class="set' + (s.done ? ' is-done' : '') + ' t-' + t + '" data-e="' + ei + '" data-s="' + si + '">'
      + '<button type="button" class="stype" data-act="set-type" aria-label="Tipo di serie: ' + SET_TYPES[t].label + '. Tocca per cambiare">' + (t === 'n' ? wn : SET_TYPES[t].short) + '</button>'
      + '<label class="kg"><input id="kg-' + ei + '-' + si + '" data-f="set-kg" inputmode="decimal" autocomplete="off" placeholder="' + (ex.kind === 'weight' ? '—' : '0') + '" value="' + esc(s.kg) + '" aria-label="Carico"><span>' + kgUnit(ex) + '</span></label>'
      + '<div class="reps"><button type="button" data-act="rep-" aria-label="Meno">−</button><input id="r-' + ei + '-' + si + '" data-f="set-reps" inputmode="numeric" autocomplete="off" value="' + esc(s.reps) + '" aria-label="' + (ex.kind === 'time' ? 'Secondi' : 'Ripetizioni') + '"><button type="button" data-act="rep+" aria-label="Più">+</button></div>'
      + (rpe ? '<input class="rpe" id="p-' + ei + '-' + si + '" data-f="set-rpe" inputmode="decimal" placeholder="RPE" value="' + esc(s.rpe) + '" aria-label="RPE">' : '')
      + '<button type="button" class="chk" data-act="set-done" aria-pressed="' + !!s.done + '" aria-label="Serie fatta">✓</button></div>';
    const pp = t !== 'w' ? planOf(en.target).filter(x => x.type !== 'w')[wn - 1] : null;
    if (pp && !s.done) h += '<span class="tgt num">obiettivo ' + pp.repMin + (pp.repMax > pp.repMin ? '–' + pp.repMax : '') + (ex.kind === 'time' ? ' s' : ' rip.') + '</span>';
  });
  h += '</div>';
  if (hist.length) { const last = hist[hist.length - 1]; h += '<p class="prev num">Ultima volta, ' + relDay(last.date) + ': ' + esc(setsTxt(ex, last.sets)) + '</p>'; }
  h += '<div class="row tools">' + btn('set-add', '+ Serie', 'ghost small') + btn('set-warm', '+ Riscaldamento', 'ghost small') + btn('rest', '⏱ ' + mmss(en.target.rest || st.settings.rest), 'ghost small') + btn('en-tools', en.open ? 'Chiudi' : 'Altro', 'ghost small') + '</div>';
  if (en.open) {
    h += '<div class="tools-more stack-s"><div class="field"><label for="en-note-' + ei + '">Nota su questo esercizio</label><input id="en-note-' + ei + '" data-f="en-note" value="' + esc(en.note) + '" placeholder="Sedile 4, presa stretta…"></div>'
      + '<label class="toggle"><input type="checkbox" data-f="en-ss" id="en-ss-' + ei + '"' + (en.ss ? ' checked' : '') + (ei === a.entries.length - 1 ? ' disabled' : '') + '> In superserie con l\'esercizio successivo (il recupero parte dopo il secondo)</label>'
      + '<div class="row">' + btn('set-del', '− Ultima serie', 'ghost small') + btn('en-up', '↑ Su', 'ghost small', ei === 0 ? ' disabled' : '') + btn('en-down', '↓ Giù', 'ghost small', ei === a.entries.length - 1 ? ' disabled' : '') + btn('en-del', 'Rimuovi', 'ghost small danger-t') + '</div>'
      + '<p class="hint">Tocca il numero della serie per cambiarne il tipo: R riscaldamento (esclusa dai calcoli), D drop set, C a cedimento.</p></div>';
  }
  return h + '</article>';
}
export function vSummary(ui) {
  const s = st.sessions[ui.sid]; if (!s) return vOggi(ui);
  const ss = sessionStats(s);
  let h = head('Allenamento salvato', 'tab-oggi');
  h += '<section class="tiles num">' + tile(ss.min != null ? durLbl(ss.min) : '—', 'durata') + tile(ss.sets, 'serie') + tile(fmtInt(ss.vol) + ' kg', 'volume') + tile((s.prs || []).length, 'record') + '</section>';
  if ((s.prs || []).length) h += '<section class="panel"><h2 class="sec">Nuovi record</h2><ul class="prlist">' + s.prs.map(p => '<li><span class="pr-badge">PR</span><div><b>' + esc(p.ex) + '</b><span>' + esc(p.txt) + '</span></div></li>').join('') + '</ul></section>';
  h += '<section class="panel"><h2 class="sec">Rispetto alla volta scorsa</h2><table class="cmp num"><tbody>' + s.entries.map(en => {
    const ex = st.exercises[en.eid]; const prev = historyOf(en.eid, s.id).filter(x => x.date <= s.date).pop();
    const top = sets => { const bw = bodyWeightAt(s.date); let b = null; sets.filter(x => x.type !== 'w').forEach(x => { const v = ex && ex.kind !== 'time' ? e1rm(loadOf(ex, x, bw), x.reps) : x.reps; if (v != null && (b == null || v > b)) b = v; }); return b; };
    const now = top(en.sets), was = prev ? top(prev.sets) : null;
    const d = now != null && was != null ? now - was : null;
    return '<tr><td><b>' + esc(exName(en.eid)) + '</b><span>' + esc(setsTxt(ex, en.sets)) + '</span></td><td class="delta ' + (d == null ? '' : d > 0.05 ? 'up' : d < -0.05 ? 'down' : '') + '">' + (d == null ? 'prima volta' : (d > 0 ? '+' : '') + fmt(round(d, 1)) + (ex.kind === 'time' ? ' s' : ' kg 1RM')) + '</td></tr>';
  }).join('') + '</tbody></table></section>';
  h += '<div class="row">' + btn('tab-oggi', 'Fatto', 'primary') + btn('session-open', 'Vedi dettaglio', 'ghost', ' data-id="' + s.id + '"') + '</div>';
  return h;
}
const tile = (v, l) => '<div class="tile"><b>' + v + '</b><span>' + l + '</span></div>';

/* =================== STORICO =================== */
export function vStorico(ui) {
  const now = new Date(); const y = ui.calY ?? now.getFullYear(), m = ui.calM ?? now.getMonth();
  const first = new Date(y, m, 1), startOff = (first.getDay() + 6) % 7, nd = new Date(y, m + 1, 0).getDate();
  const ms = dstr(first).slice(0, 7);
  const ss = sessionList().filter(s => s.date.startsWith(ms)), cs = cardioList().filter(c => c.date.startsWith(ms));
  let h = '<section class="panel"><div class="cal-head"><button type="button" class="icon" data-act="cal-prev" aria-label="Mese precedente">‹</button><h2 class="sec cap">' + monthLbl(y, m) + '</h2><button type="button" class="icon" data-act="cal-next" aria-label="Mese successivo"' + (y === now.getFullYear() && m === now.getMonth() ? ' disabled' : '') + '>›</button></div>';
  h += '<div class="cal num">' + ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(d => '<span class="cal-dow">' + d + '</span>').join('');
  for (let i = 0; i < startOff; i++) h += '<span></span>';
  for (let d = 1; d <= nd; d++) {
    const ds = ms + '-' + String(d).padStart(2, '0');
    const w = ss.some(s => s.date === ds), c = cs.some(x => x.date === ds);
    h += '<span class="cal-d' + (ds === today() ? ' is-today' : '') + (w ? ' has-w' : '') + '">' + d + '<i class="dots">' + (w ? '<em class="dot-w"></em>' : '') + (c ? '<em class="dot-c"></em>' : '') + '</i></span>';
  }
  h += '</div><p class="meta num" style="margin-top:8px">' + ss.length + ' allenamenti pesi · ' + cs.length + ' attività cardio (' + sum(cs.map(c => +c.minutes || 0)) + ' min)</p></section>';
  const items = ss.map(s => ({ d: s.date + (s.start || ''), s })).concat(cs.map(c => ({ d: c.date + 'T00', c }))).sort((a, b) => b.d.localeCompare(a.d));
  if (!items.length) h += '<div class="empty"><p>Nessuna attività registrata in questo mese.</p></div>';
  h += '<div class="list">' + items.map(it => {
    if (it.s) { const s = it.s, st2 = sessionStats(s); return '<button type="button" class="hitem" data-act="session-open" data-id="' + s.id + '"><span class="hdate num">' + dLblW(s.date) + '</span><b>' + esc(s.name) + '</b><span class="meta num">' + st2.exercises + ' esercizi · ' + st2.sets + ' serie · ' + fmtInt(st2.vol) + ' kg' + (st2.min ? ' · ' + durLbl(st2.min) : '') + ((s.prs || []).length ? ' · ' + s.prs.length + ' PR' : '') + '</span></button>'; }
    const c = it.c; return '<button type="button" class="hitem is-cardio" data-act="cardio-edit" data-id="' + c.id + '"><span class="hdate num">' + dLblW(c.date) + '</span><b>' + esc(c.type) + '</b><span class="meta num">' + (c.minutes || 0) + ' min' + (c.km ? ' · ' + fmt(c.km) + ' km' : '') + (c.hr ? ' · FC ' + c.hr : '') + (c.kcal ? ' · ' + c.kcal + ' kcal' : '') + '</span></button>';
  }).join('') + '</div>';
  return h;
}
export function vSession(ui) {
  const s = st.sessions[ui.sid]; if (!s) return head('Allenamento', 'tab-storico') + '<div class="empty"><p>Allenamento non trovato.</p></div>';
  const ss = sessionStats(s);
  let h = head(esc(s.name), 'tab-storico');
  h += '<p class="meta num" style="margin:-4px 0 12px">' + dLblW(s.date) + (s.start && s.end ? ' · ' + timeLbl(s.start) + '–' + timeLbl(s.end) : '') + '</p>';
  h += '<section class="tiles num">' + tile(ss.min != null ? durLbl(ss.min) : '—', 'durata') + tile(ss.sets, 'serie') + tile(fmtInt(ss.vol) + ' kg', 'volume') + tile((s.prs || []).length, 'record') + '</section>';
  if (s.notes) h += '<p class="note">' + esc(s.notes) + '</p>';
  h += '<div class="list">' + s.entries.map(en => {
    const ex = st.exercises[en.eid];
    return '<article class="ex"><h3>' + esc(exName(en.eid)) + '</h3>' + (en.note ? '<p class="note">' + esc(en.note) + '</p>' : '') + '<table class="sets-t num"><tbody>' + en.sets.map((x, i) => '<tr class="t-' + x.type + '"><td>' + (x.type === 'n' ? '' : SET_TYPES[x.type].short) + '</td><td>' + (ex ? loadLbl(ex, x.kg) : fmt(x.kg) + ' kg') + '</td><td>× ' + x.reps + (ex && ex.kind === 'time' ? ' s' : '') + '</td><td>' + (x.rpe ? 'RPE ' + fmt(x.rpe) : '') + '</td></tr>').join('') + '</tbody></table></article>';
  }).join('') + '</div>';
  if ((s.prs || []).length) h += '<section class="panel"><h2 class="sec">Record</h2><ul class="prlist">' + s.prs.map(p => '<li><span class="pr-badge">PR</span><div><b>' + esc(p.ex) + '</b><span>' + esc(p.txt) + '</span></div></li>').join('') + '</ul></section>';
  h += '<div class="row" style="margin-top:12px">' + btn('session-edit', 'Modifica', '', ' data-id="' + s.id + '"' + (active ? ' disabled' : '')) + '<span class="grow"></span>' + (ui.confirmDel === s.id ? btn('session-del-ok', 'Elimina definitivamente', 'danger', ' data-id="' + s.id + '"') : btn('session-del', 'Elimina', 'ghost', ' data-id="' + s.id + '"')) + '</div>';
  if (active) h += '<p class="hint">Termina l\'allenamento in corso per poter modificare questo.</p>';
  return h;
}

/* =================== PROGRESSI =================== */
export function vProgressi(ui) {
  const sub = ui.psub || 'ex';
  let h = '<div class="seg3" role="tablist">' + [['ex', 'Esercizi'], ['mus', 'Muscoli'], ['gen', 'Generale']].map(([k, l]) => '<button type="button" role="tab" data-act="psub" data-id="' + k + '" aria-selected="' + (sub === k) + '">' + l + '</button>').join('') + '</div>';
  if (sub === 'ex') h += vProgEx(ui); else if (sub === 'mus') h += vProgMus(ui); else h += vProgGen(ui);
  return h;
}
function vProgEx(ui) {
  const withHist = exList(true).filter(e => Object.values(st.sessions).some(s => s.entries.some(en => en.eid === e.id)));
  if (!withHist.length) return '<div class="empty"><p>I grafici compaiono dopo il primo allenamento registrato.</p></div>';
  if (!ui.pex || !withHist.find(e => e.id === ui.pex)) ui.pex = withHist[0].id;
  const ex = st.exercises[ui.pex], hist = historyOf(ex.id), rec = recordsOf(ex.id);
  const groups = MUSCLES.map(m => [m, withHist.filter(e => e.muscle === m)]).filter(g => g[1].length);
  let h = '<section class="panel"><div class="field"><label for="pex">Esercizio</label><select id="pex" data-f="pex">' + groups.map(([m, es]) => '<optgroup label="' + m + '">' + es.map(e => '<option value="' + e.id + '"' + (e.id === ex.id ? ' selected' : '') + '>' + esc(e.name) + '</option>').join('') + '</optgroup>').join('') + '</select></div>';
  const timeK = ex.kind === 'time';
  h += '<div class="tiles num">' + (timeK ? tile((rec.maxReps || 0) + ' s', 'record di tempo') : tile(rec.e1rm ? fmt(round(rec.e1rm, 1)) + ' kg' : '—', '1RM stimato migliore') + tile(rec.load ? fmt(rec.load) + ' kg' : '—', 'carico massimo')) + tile(hist.length, 'sedute') + tile(hist.length ? relDay(hist[hist.length - 1].date) : '—', 'ultima volta') + '</div>';
  const period = ui.pper || '6m', metric = timeK ? 'reps' : (ui.pmet || 'e1rm');
  const from = period === 'all' ? '0000' : addDays(today(), -({ '3m': 91, '6m': 182, '1y': 365 }[period]));
  h += '<div class="chips">' + [['3m', '3 mesi'], ['6m', '6 mesi'], ['1y', '1 anno'], ['all', 'Tutto']].map(([k, l]) => '<button type="button" class="chip" data-act="pper" data-id="' + k + '" aria-pressed="' + (period === k) + '">' + l + '</button>').join('') + '</div>';
  if (!timeK) h += '<div class="chips">' + [['e1rm', '1RM stimato'], ['top', 'Carico di lavoro'], ['vol', 'Volume']].map(([k, l]) => '<button type="button" class="chip" data-act="pmet" data-id="' + k + '" aria-pressed="' + (metric === k) + '">' + l + '</button>').join('') + '</div>';
  const pts = hist.filter(x => x.date >= from).map(x => {
    const bw = bodyWeightAt(x.date), ws = x.sets.filter(s => s.type !== 'w');
    if (metric === 'reps') return { d: x.date, y: Math.max(...ws.map(s => +s.reps || 0)) };
    if (metric === 'vol') return { d: x.date, y: sum(ws.map(s => (loadOf(ex, s, bw) || 0) * (+s.reps || 0))) };
    if (metric === 'top') return { d: x.date, y: Math.max(...ws.map(s => loadOf(ex, s, bw) || 0)) };
    return { d: x.date, y: round(Math.max(...ws.map(s => e1rm(loadOf(ex, s, bw), +s.reps) || 0)), 1) };
  }).filter(p => isFinite(p.y));
  h += lineChart([{ pts, color: 'var(--accent)', area: true, dots: true }], { unit: metric === 'reps' ? '' : '', aria: 'Andamento ' + ex.name });
  h += '</section>';
  if (!timeK) {
    const reps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15].filter(r => rec.reps[r]);
    if (reps.length) h += '<section class="panel"><h2 class="sec">Record per ripetizioni</h2><table class="rt num"><thead><tr><th>Ripetizioni</th><th>Carico migliore</th><th>Data</th></tr></thead><tbody>' + reps.map(r => '<tr><td>' + r + '</td><td><b>' + fmt(rec.reps[r].load) + ' kg</b></td><td>' + dLbl(rec.reps[r].date) + '</td></tr>').join('') + '</tbody></table>' + (ex.kind !== 'weight' ? '<p class="hint">Per gli esercizi a corpo libero il carico include il tuo peso corporeo registrato in Corpo.</p>' : '') + '</section>';
  }
  h += '<section class="panel"><h2 class="sec">Storico</h2><table class="hist num"><tbody>' + hist.slice().reverse().slice(0, 15).map(x => '<tr><td>' + dLbl(x.date) + '</td><td>' + esc(setsTxt(ex, x.sets)) + '</td></tr>').join('') + '</tbody></table></section>';
  return h;
}
function vProgMus(ui) {
  const wk = ui.pwk || 0; const w0 = addDays(weekStart(today()), -7 * wk), w1 = addDays(w0, 6);
  const cur = muscleSets(w0, w1), avg = {};
  for (let i = 1; i <= 4; i++) { const a = addDays(w0, -7 * i); const m = muscleSets(a, addDays(a, 6)); Object.entries(m).forEach(([k, v]) => avg[k] = (avg[k] || 0) + v / 4); }
  const max = Math.max(20, ...Object.values(cur), ...Object.values(avg));
  let h = '<section class="panel"><div class="cal-head"><button type="button" class="icon" data-act="pwk" data-id="' + (wk + 1) + '" aria-label="Settimana precedente">‹</button><h2 class="sec">' + (wk === 0 ? 'Questa settimana' : wk === 1 ? 'Settimana scorsa' : 'Settimana del ' + dLbl(w0)) + '</h2><button type="button" class="icon" data-act="pwk" data-id="' + (wk - 1) + '" aria-label="Settimana successiva"' + (wk === 0 ? ' disabled' : '') + '>›</button></div>';
  h += '<p class="hint">Serie allenanti per gruppo muscolare (escluso il riscaldamento). I muscoli secondari contano mezza serie. La fascia verde è l\'intervallo 10–20 serie a settimana, indicato da molte ricerche per l\'ipertrofia.</p><div class="mbars num">';
  MUSCLES.forEach(m => {
    const v = round(cur[m] || 0, 1), a = round(avg[m] || 0, 1);
    h += '<div class="mbar"><span class="mname">' + m + '</span><div class="mtrack"><i class="zone" style="left:' + (10 / max * 100) + '%;width:' + (10 / max * 100) + '%"></i><em style="width:' + (v / max * 100) + '%" class="' + (v >= 10 && v <= 20 ? 'ok' : v > 20 ? 'hi' : '') + '"></em>' + (a ? '<b class="avg" style="left:' + (a / max * 100) + '%" title="media 4 settimane"></b>' : '') + '</div><span class="mval">' + fmt(v, 1) + '</span></div>';
  });
  h += '</div><div class="legend"><span><i style="background:var(--accent)"></i>Serie della settimana</span><span><i style="background:var(--ink);width:3px;height:12px"></i>Media delle 4 settimane prima</span></div></section>';
  return h;
}
function vProgGen() {
  const wt = weeklyTotals(12), lbl = w => parseD(w).getDate() + '/' + (parseD(w).getMonth() + 1);
  const all = Object.values(st.sessions); const tot = all.map(sessionStats);
  let h = '<section class="tiles num">' + tile(all.length, 'allenamenti totali') + tile(fmt(round(sum(tot.map(t => t.vol)) / 1000, 1)) + ' t', 'tonnellate sollevate') + tile(durLbl(sum(tot.map(t => t.min || 0))), 'tempo in sala') + tile(Object.keys(st.cardio).length, 'sessioni di cardio') + '</section>';
  h += '<section class="panel"><h2 class="sec">Allenamenti pesi a settimana</h2>' + columns(wt.map((w, i) => ({ label: lbl(w.week), v: w.sessions, hl: i === wt.length - 1 })), { goal: st.settings.weekGoal || 3, aria: 'Allenamenti per settimana' }) + '<p class="hint">La linea verde è il tuo obiettivo settimanale.</p></section>';
  h += '<section class="panel"><h2 class="sec">Volume settimanale (kg × ripetizioni)</h2>' + columns(wt.map((w, i) => ({ label: lbl(w.week), v: round(w.vol / 1000, 1), hl: i === wt.length - 1 })), { aria: 'Volume per settimana in tonnellate' }) + '<p class="hint">In tonnellate. Escluse le serie di riscaldamento.</p></section>';
  h += '<section class="panel"><h2 class="sec">Minuti di cardio a settimana</h2>' + columns(wt.map((w, i) => ({ label: lbl(w.week), v: w.cardioMin, hl: i === wt.length - 1 })), { goal: st.settings.cardioGoal || 120, aria: 'Minuti di cardio per settimana' }) + '</section>';
  return h;
}

/* =================== CORPO =================== */
export function vCorpo(ui) {
  const b = bodyList();
  let h = '<div class="row" style="margin-bottom:12px">' + btn('body-new', 'Nuova misurazione', 'primary') + btn('cardio-new', 'Registra cardio') + '</div>';
  if (!b.length) return h + '<div class="empty"><p>Registra peso, percentuale di grasso e circonferenze una volta a settimana, alla stessa ora e nelle stesse condizioni (per esempio il lunedì appena sveglio). In una ricomposizione corporea il peso cambia poco: vita e circonferenze dicono di più.</p></div>';
  const wts = b.filter(x => x.weight), lastW = wts[wts.length - 1];
  const avg7 = d => { const xs = wts.filter(x => x.date <= d && x.date > addDays(d, -7)); return xs.length ? sum(xs.map(x => x.weight)) / xs.length : null; };
  const back = lastW ? wts.filter(x => x.date <= addDays(lastW.date, -28)).pop() : null;
  const lastOf = k => { const xs = b.filter(x => x[k]); return xs.length ? xs[xs.length - 1] : null; };
  const firstOf = k => b.find(x => x[k]);
  const delta = (k, unit) => { const l = lastOf(k), f = firstOf(k); if (!l || !f || l === f) return ''; const d = round(l[k] - f[k], 1); return '<span class="dl ' + (d < 0 ? 'neg' : d > 0 ? 'pos' : '') + '">' + (d > 0 ? '+' : '') + fmt(d) + unit + ' dall\'inizio</span>'; };
  h += '<section class="tiles num">'
    + '<div class="tile"><b>' + (lastW ? fmt(lastW.weight) + ' kg' : '—') + '</b><span>peso' + (lastW ? ' · ' + relDay(lastW.date) : '') + '</span>' + (back && lastW ? '<span class="dl">' + (lastW.weight - back.weight > 0 ? '+' : '') + fmt(round(lastW.weight - back.weight, 1)) + ' kg in 4 settimane</span>' : '') + '</div>'
    + '<div class="tile"><b>' + (lastOf('fat') ? fmt(lastOf('fat').fat) + '%' : '—') + '</b><span>massa grassa</span>' + delta('fat', ' punti') + '</div>'
    + '<div class="tile"><b>' + (lastOf('waist') ? fmt(lastOf('waist').waist) + ' cm' : '—') + '</b><span>vita</span>' + delta('waist', ' cm') + '</div>'
    + '<div class="tile"><b>' + (lastOf('arm') ? fmt(lastOf('arm').arm) + ' cm' : '—') + '</b><span>braccio</span>' + delta('arm', ' cm') + '</div></section>';
  if (wts.length >= 2) h += '<section class="panel"><h2 class="sec">Peso</h2>' + lineChart([{ pts: wts.map(x => ({ d: x.date, y: x.weight })), color: 'var(--muted)', width: 1.5, dots: true, label: 'Pesate', opacity: .5, dash: false }, { pts: wts.map(x => ({ d: x.date, y: round(avg7(x.date), 2) })), color: 'var(--accent)', label: 'Media 7 giorni' }], { aria: 'Andamento del peso', zero: false }) + '</section>';
  const mk = ui.bm || 'waist'; const M = { waist: 'Vita', hips: 'Fianchi', chest: 'Petto', arm: 'Braccio', thigh: 'Coscia', fat: 'Massa grassa %' };
  h += '<section class="panel"><h2 class="sec">Misure</h2><div class="chips">' + Object.entries(M).map(([k, l]) => '<button type="button" class="chip" data-act="bm" data-id="' + k + '" aria-pressed="' + (mk === k) + '">' + l + '</button>').join('') + '</div>' + lineChart([{ pts: b.filter(x => x[mk]).map(x => ({ d: x.date, y: x[mk] })), color: 'var(--up)', dots: true, area: true }], { aria: M[mk], zero: false }) + '</section>';
  h += '<section class="panel"><h2 class="sec">Registro</h2><div class="list">' + b.slice().reverse().map(x => '<button type="button" class="hitem" data-act="body-edit" data-id="' + x.id + '"><span class="hdate num">' + dLblW(x.date) + '</span><b class="num">' + (x.weight ? fmt(x.weight) + ' kg' : 'Misure') + '</b><span class="meta num">' + [x.fat && fmt(x.fat) + '% grasso', x.waist && 'vita ' + fmt(x.waist), x.hips && 'fianchi ' + fmt(x.hips), x.chest && 'petto ' + fmt(x.chest), x.arm && 'braccio ' + fmt(x.arm), x.thigh && 'coscia ' + fmt(x.thigh)].filter(Boolean).join(' · ') + '</span></button>').join('') + '</div></section>';
  return h;
}
export function vBodyForm(ui) {
  const f = ui.bform;
  let h = head(f.id ? 'Modifica misurazione' : 'Nuova misurazione', 'back') + '<section class="panel stack">';
  h += field('bf-date', 'Data', f.date, { f: 'bform', k: 'date', type: 'date' });
  h += '<div class="grid2">' + field('bf-weight', 'Peso (kg)', f.weight, { f: 'bform', k: 'weight', mode: 'decimal', ph: '79,0' }) + field('bf-fat', 'Massa grassa (%)', f.fat, { f: 'bform', k: 'fat', mode: 'decimal', ph: 'facoltativo' }) + '</div>';
  h += '<p class="hint">Circonferenze in cm, tutte facoltative. Misura sempre nello stesso punto: vita all\'altezza dell\'ombelico, braccio e coscia nel punto più largo.</p>';
  h += '<div class="grid2">' + field('bf-waist', 'Vita', f.waist, { f: 'bform', k: 'waist', mode: 'decimal' }) + field('bf-hips', 'Fianchi', f.hips, { f: 'bform', k: 'hips', mode: 'decimal' }) + field('bf-chest', 'Petto', f.chest, { f: 'bform', k: 'chest', mode: 'decimal' }) + field('bf-arm', 'Braccio', f.arm, { f: 'bform', k: 'arm', mode: 'decimal' }) + field('bf-thigh', 'Coscia', f.thigh, { f: 'bform', k: 'thigh', mode: 'decimal' }) + '</div>';
  h += field('bf-notes', 'Note', f.notes, { f: 'bform', k: 'notes' });
  h += (ui.err ? '<p class="err">' + esc(ui.err) + '</p>' : '') + '<div class="row">' + btn('body-save', 'Salva', 'primary') + btn('back', 'Annulla', 'ghost') + '<span class="grow"></span>' + (f.id ? (ui.confirmDel === f.id ? btn('body-del-ok', 'Elimina definitivamente', 'danger') : btn('body-del', 'Elimina', 'ghost')) : '') + '</div></section>';
  return h;
}
export function vCardioForm(ui) {
  const f = ui.cform;
  let h = head(f.id ? 'Modifica cardio' : 'Registra cardio', 'back') + '<section class="panel stack">';
  h += '<div class="grid2">' + field('cf-date', 'Data', f.date, { f: 'cform', k: 'date', type: 'date' }) + select('cf-type', 'Attività', CARDIO.map(c => [c, c]), f.type, { f: 'cform', k: 'type' }) + '</div>';
  h += '<div class="grid2">' + field('cf-min', 'Durata (minuti)', f.minutes, { f: 'cform', k: 'minutes', mode: 'numeric', ph: '30' }) + field('cf-km', 'Distanza (km)', f.km, { f: 'cform', k: 'km', mode: 'decimal', ph: 'facoltativa' }) + field('cf-hr', 'FC media (bpm)', f.hr, { f: 'cform', k: 'hr', mode: 'numeric', ph: 'facoltativa' }) + field('cf-kcal', 'Calorie', f.kcal, { f: 'cform', k: 'kcal', mode: 'numeric', ph: 'facoltative' }) + '</div>';
  h += field('cf-notes', 'Note', f.notes, { f: 'cform', k: 'notes', ph: 'Pendenza 8%, velocità 6 km/h…' });
  h += (ui.err ? '<p class="err">' + esc(ui.err) + '</p>' : '') + '<div class="row">' + btn('cardio-save', 'Salva', 'primary') + btn('back', 'Annulla', 'ghost') + '<span class="grow"></span>' + (f.id ? (ui.confirmDel === f.id ? btn('cardio-del-ok', 'Elimina definitivamente', 'danger') : btn('cardio-del', 'Elimina', 'ghost')) : '') + '</div></section>';
  return h;
}

/* =================== GESTISCI =================== */
export function vGestisci(ui) {
  const sub = ui.gsub || 'rt';
  let h = '<div class="seg3" role="tablist">' + [['rt', 'Sedute'], ['ex', 'Esercizi'], ['set', 'Impostazioni']].map(([k, l]) => '<button type="button" role="tab" data-act="gsub" data-id="' + k + '" aria-selected="' + (sub === k) + '">' + l + '</button>').join('') + '</div>';
  if (sub === 'rt') {
    const rs = routineList();
    h += '<div class="row" style="margin-bottom:12px">' + btn('routine-new', 'Nuova seduta', 'primary') + (rs.length ? '' : btn('routine-template', 'Usa sedute di esempio')) + '</div>';
    if (!rs.length) h += '<div class="empty"><p>Una seduta è un elenco di esercizi che fai nello stesso allenamento, con serie, ripetizioni e recupero per ciascuno.</p></div>';
    h += '<div class="list">' + rs.map((r, i) => '<div class="rcard"><div class="rinfo"><div class="rname">' + esc(r.name) + '</div><div class="meta">' + (r.day ? DAYS[r.day] + ' · ' : '') + r.items.length + ' esercizi · ' + (lastRoutineDate(r.id) ? 'ultima ' + relDay(lastRoutineDate(r.id)) : 'mai fatta') + '</div><div class="rlist">' + esc(r.items.map(it => exName(it.eid)).join(' · ')) + '</div></div><div class="col-btns"><button type="button" class="icon" data-act="routine-up" data-id="' + r.id + '" aria-label="Sposta su"' + (i === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="icon" data-act="routine-down" data-id="' + r.id + '" aria-label="Sposta giù"' + (i === rs.length - 1 ? ' disabled' : '') + '>↓</button>' + btn('routine-edit', 'Modifica', 'small', ' data-id="' + r.id + '"') + '</div></div>').join('') + '</div>';
  } else if (sub === 'ex') {
    const q = (ui.exq || '').toLowerCase(), mf = ui.exm || '';
    const list = exList(ui.showArch).filter(e => (!q || e.name.toLowerCase().includes(q)) && (!mf || e.muscle === mf));
    h += '<div class="row" style="margin-bottom:10px">' + btn('exercise-new', 'Nuovo esercizio', 'primary') + '</div>';
    h += '<div class="field"><label for="exq">Cerca</label><input id="exq" data-f="exq" value="' + esc(ui.exq || '') + '" placeholder="Nome dell\'esercizio" autocomplete="off"></div>';
    h += '<div class="chips scroll">' + ['', ...MUSCLES].map(m => '<button type="button" class="chip" data-act="exm" data-id="' + m + '" aria-pressed="' + (mf === m) + '">' + (m || 'Tutti') + '</button>').join('') + '</div>';
    h += '<div class="panel">' + (list.length ? list.map(e => { const n = historyOf(e.id).length; return '<button type="button" class="exrow" data-act="exercise-edit" data-id="' + e.id + '"><div class="info"><div class="name">' + esc(e.name) + (e.archived ? ' <span class="meta">(archiviato)</span>' : '') + '</div><div class="sub">' + esc(e.muscle) + ' · ' + esc(e.equipment) + ' · ' + PROGS[e.prog].split(' ')[0].toLowerCase() + ' · +' + fmt(e.inc) + ' kg' + (n ? ' · ' + n + ' sedute' : '') + '</div></div><span class="chev">›</span></button>'; }).join('') : '<p class="hint">Nessun esercizio trovato.</p>') + '</div>';
    h += '<label class="toggle" style="margin-top:10px"><input type="checkbox" data-f="showArch" id="showArch"' + (ui.showArch ? ' checked' : '') + '> Mostra anche gli esercizi archiviati</label>';
  } else h += vSettings(ui);
  return h;
}
export function vRoutineForm(ui) {
  const f = ui.rform;
  let h = head(f.id ? 'Modifica seduta' : 'Nuova seduta', 'back') + '<section class="panel stack">';
  h += field('rf-name', 'Nome della seduta', f.name, { f: 'rform-name', ph: 'Petto + tricipiti' });
  h += select('rf-day', 'Giorno della settimana', DAYS.map((d, i) => [i, i ? d : 'Nessuno (a rotazione)']), f.day || 0, { f: 'rform-day' });
  h += '</section><p class="hint" style="margin:4px 2px 10px">Per ogni esercizio imposta le serie previste: carico di partenza (facoltativo) e range di ripetizioni. Tocca il cerchio per passare da serie di lavoro (numero) a riscaldamento (R).</p><div class="list">';
  f.items.forEach((it, i) => {
    const ex = st.exercises[it.eid]; let wn = 0;
    const tk = ex && ex.kind === 'time';
    h += '<article class="ex' + (it.ss ? ' ss-top' : '') + (i > 0 && f.items[i - 1].ss ? ' ss-bottom' : '') + '"><div class="ex-head"><div><h3>' + esc(exName(it.eid)) + '</h3><p class="meta">' + (ex ? esc(ex.muscle) + ' · ' + esc(ex.equipment) + ' · ' + PROGS[ex.prog].toLowerCase() : '') + '</p></div><div class="col-btns"><button type="button" class="icon" data-act="ri-up" data-i="' + i + '" aria-label="Su"' + (i === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="icon" data-act="ri-down" data-i="' + i + '" aria-label="Giù"' + (i === f.items.length - 1 ? ' disabled' : '') + '>↓</button><button type="button" class="icon" data-act="ri-del" data-i="' + i + '" aria-label="Rimuovi">✕</button></div></div>';
    h += '<div class="plan"><div class="plan-h"><span></span><span>' + (ex && ex.kind === 'assisted' ? 'Assist. kg' : 'Carico kg') + '</span><span>' + (tk ? 'Sec. min' : 'Rip. min') + '</span><span>' + (tk ? 'Sec. max' : 'Rip. max') + '</span><span></span></div>';
    it.plan.forEach((p, j) => {
      if (p.type !== 'w') wn++;
      h += '<div class="plan-r t-' + (p.type === 'w' ? 'w' : 'n') + '" data-i="' + i + '" data-j="' + j + '"><button type="button" class="stype" data-act="rp-type" aria-label="Cambia tipo di serie">' + (p.type === 'w' ? 'R' : wn) + '</button>'
        + '<input id="rp-kg-' + i + '-' + j + '" data-f="rp" data-k="kg" inputmode="decimal" placeholder="—" value="' + esc(p.kg) + '" aria-label="Carico">'
        + '<input id="rp-mn-' + i + '-' + j + '" data-f="rp" data-k="repMin" inputmode="numeric" value="' + esc(p.repMin) + '" aria-label="Minimo">'
        + '<input id="rp-mx-' + i + '-' + j + '" data-f="rp" data-k="repMax" inputmode="numeric" value="' + esc(p.repMax) + '" aria-label="Massimo">'
        + '<button type="button" class="icon" data-act="rp-del" aria-label="Togli serie"' + (it.plan.length < 2 ? ' disabled' : '') + '>✕</button></div>';
    });
    h += '</div><div class="row">' + btn('rp-add', '+ Serie', 'ghost small', ' data-i="' + i + '"') + btn('rp-warm', '+ Riscaldamento', 'ghost small', ' data-i="' + i + '"') + '<span class="grow"></span><div class="field rest-f"><label for="ri-rest-' + i + '">Recupero (s)</label><input id="ri-rest-' + i + '" data-f="ri" data-k="rest" inputmode="numeric" value="' + esc(it.rest || '') + '" placeholder="' + st.settings.rest + '"></div></div>'
      + (i < f.items.length - 1 ? '<label class="toggle"><input type="checkbox" data-f="ri-ss" data-i="' + i + '" id="ri-ss-' + i + '"' + (it.ss ? ' checked' : '') + '> In superserie con il successivo</label>' : '') + '</article>';
  });
  h += '</div><div class="row" style="margin-top:12px">' + btn('pick-routine', '+ Aggiungi esercizi') + '</div>';
  h += '<section class="panel stack" style="margin-top:12px"><h2 class="sec" style="margin:0">Cardio della seduta</h2>' + (f.cardio.length ? '' : '<p class="hint">Facoltativo: durante l\'allenamento compare come promemoria da registrare.</p>')
    + f.cardio.map((c, k) => '<div class="cplan"><div class="field"><label for="rc-t-' + k + '">Attività</label><select id="rc-t-' + k + '" data-f="rc" data-k="type" data-c="' + k + '">' + CARDIO.map(x => '<option' + (x === c.type ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div>'
      + '<div class="field"><label for="rc-mn-' + k + '">Minuti da</label><input id="rc-mn-' + k + '" data-f="rc" data-k="min" data-c="' + k + '" inputmode="numeric" value="' + esc(c.min) + '"></div><div class="field"><label for="rc-mx-' + k + '">a</label><input id="rc-mx-' + k + '" data-f="rc" data-k="max" data-c="' + k + '" inputmode="numeric" value="' + esc(c.max) + '"></div>'
      + '<button type="button" class="icon" data-act="rc-del" data-c="' + k + '" aria-label="Togli cardio">✕</button><div class="field cnote"><label for="rc-n-' + k + '">Nota</label><input id="rc-n-' + k + '" data-f="rc" data-k="note" data-c="' + k + '" value="' + esc(c.note || '') + '" placeholder="Intensità moderata"></div></div>').join('')
    + '<div class="row">' + btn('rc-add', '+ Cardio', 'ghost small') + '</div></section>';
  h += (ui.err ? '<p class="err">' + esc(ui.err) + '</p>' : '') + '<div class="row" style="margin-top:16px">' + btn('routine-save', 'Salva seduta', 'primary') + btn('back', 'Annulla', 'ghost') + '<span class="grow"></span>' + (f.id ? (ui.confirmDel === f.id ? btn('routine-del-ok', 'Elimina seduta', 'danger') : btn('routine-del', 'Elimina', 'ghost')) : '') + '</div>';
  if (f.id && ui.confirmDel === f.id) h += '<p class="hint">Gli allenamenti già registrati con questa seduta restano nello storico.</p>';
  return h;
}
export function vExerciseForm(ui) {
  const f = ui.xform; const n = f.id ? historyOf(f.id).length : 0;
  let h = head(f.id ? 'Modifica esercizio' : 'Nuovo esercizio', 'back') + '<section class="panel stack">';
  h += field('xf-name', 'Nome', f.name, { f: 'xform', k: 'name', ph: 'Chest press' });
  h += '<div class="grid2">' + select('xf-muscle', 'Muscolo principale', MUSCLES.map(m => [m, m]), f.muscle, { f: 'xform', k: 'muscle' }) + select('xf-eq', 'Attrezzo', EQUIP.map(m => [m, m]), f.equipment, { f: 'xform', k: 'equipment' }) + '</div>';
  h += '<div class="field"><span class="lbl">Muscoli secondari</span><div class="chips">' + MUSCLES.filter(m => m !== f.muscle).map(m => '<button type="button" class="chip" data-act="xf-sec" data-id="' + m + '" aria-pressed="' + f.secondary.includes(m) + '">' + m + '</button>').join('') + '</div></div>';
  h += '<div class="grid2">' + select('xf-kind', 'Tipo', Object.entries(KINDS), f.kind, { f: 'xform', k: 'kind' }) + select('xf-prog', 'Progressione', Object.entries(PROGS), f.prog, { f: 'xform', k: 'prog' }) + '</div>';
  h += field('xf-inc', f.kind === 'assisted' ? 'Riduzione assistenza a ogni passo (kg)' : 'Aumento di carico a ogni passo (kg)', f.inc, { f: 'xform', k: 'inc', mode: 'decimal', ph: '2,5' });
  h += '<p class="hint">' + ({ double: 'Doppia: resti allo stesso carico aggiungendo ripetizioni fino al massimo del range in tutte le serie, poi aumenti il carico e riparti dal minimo.', linear: 'Lineare: ripetizioni fisse (il minimo del range); ogni volta che completi tutte le serie aumenti il carico. Dopo tre sedute mancate propone uno scarico del 10%.', none: 'Nessuna: registri e basta, l\'app ti mostra solo l\'ultima prestazione.' }[f.prog]) + '</p>';
  h += field('xf-notes', 'Note e regolazioni macchina', f.notes, { f: 'xform', k: 'notes', ph: 'Sedile 4, schienale 2' });
  h += (ui.err ? '<p class="err">' + esc(ui.err) + '</p>' : '') + '<div class="row">' + btn('exercise-save', 'Salva', 'primary') + btn('back', 'Annulla', 'ghost') + '<span class="grow"></span>';
  if (f.id) h += n ? btn('exercise-arch', f.archived ? 'Ripristina' : 'Archivia', 'ghost') : (ui.confirmDel === f.id ? btn('exercise-del-ok', 'Elimina definitivamente', 'danger') : btn('exercise-del', 'Elimina', 'ghost'));
  h += '</div>' + (f.id && n ? '<p class="hint">Ha ' + n + ' sedute nello storico: puoi archiviarlo (sparisce dagli elenchi ma lo storico resta).</p>' : '') + '</section>';
  return h;
}
export function vPicker(ui) {
  const q = (ui.pq || '').toLowerCase(), mf = ui.pm || '';
  const list = exList().filter(e => (!q || e.name.toLowerCase().includes(q)) && (!mf || e.muscle === mf));
  const chosen = ui.picked || [];
  let h = head('Aggiungi esercizi', 'pick-done', btn('pick-done', 'Fine' + (chosen.length ? ' (' + chosen.length + ')' : ''), 'primary small'));
  h += '<div class="field"><label for="pq">Cerca</label><input id="pq" data-f="pq" value="' + esc(ui.pq || '') + '" placeholder="Nome dell\'esercizio" autocomplete="off"></div>';
  h += '<div class="chips scroll">' + ['', ...MUSCLES].map(m => '<button type="button" class="chip" data-act="pm" data-id="' + m + '" aria-pressed="' + (mf === m) + '">' + (m || 'Tutti') + '</button>').join('') + '</div>';
  h += '<div class="panel">' + list.map(e => '<button type="button" class="exrow' + (chosen.includes(e.id) ? ' is-picked' : '') + '" data-act="pick" data-id="' + e.id + '"><div class="info"><div class="name">' + esc(e.name) + '</div><div class="sub">' + esc(e.muscle) + ' · ' + esc(e.equipment) + '</div></div><span class="chev">' + (chosen.includes(e.id) ? '✓' : '+') + '</span></button>').join('') + (list.length ? '' : '<p class="hint">Nessun esercizio trovato.</p>') + '</div>';
  h += '<div class="row" style="margin-top:12px">' + btn('pick-create', '+ Crea un esercizio nuovo' + (ui.pq ? ': “' + esc(ui.pq) + '”' : ''), 'ghost') + '</div>';
  return h;
}

/* =================== IMPOSTAZIONI =================== */
function vSettings(ui) {
  const s = st.settings;
  let h = '';
  if (ui.pending) h += '<section class="panel stack"><h2 class="sec">Conferma importazione</h2><p style="margin:0">' + esc(ui.pending.summary) + '</p><p class="hint">' + (ui.pending.kind === 'backup' ? 'Il backup sostituisce tutti i dati presenti ora su questo telefono' + (SY.account ? ' e su OneDrive' : '') + '.' : ui.pending.kind === 'program' ? 'Le sedute con lo stesso nome vengono sostituite, gli esercizi esistenti aggiornati. Lo storico degli allenamenti non viene toccato.' : 'I dati vengono aggiunti a quelli presenti: esercizi e sedute con lo stesso nome vengono uniti.') + '</p><div class="row">' + btn('imp-ok', ui.pending.kind === 'backup' ? 'Sostituisci i dati' : ui.pending.kind === 'program' ? 'Carica la scheda' : 'Importa', 'primary') + btn('imp-no', 'Annulla', 'ghost') + '</div></section>';
  h += '<section class="panel stack"><h2 class="sec">Allenamento</h2>'
    + '<div class="grid2">' + field('st-goal', 'Allenamenti pesi a settimana', s.weekGoal, { f: 'setnum', k: 'weekGoal', mode: 'numeric' }) + field('st-cardio', 'Minuti di cardio a settimana', s.cardioGoal, { f: 'setnum', k: 'cardioGoal', mode: 'numeric' }) + field('st-rest', 'Recupero predefinito (s)', s.rest, { f: 'setnum', k: 'rest', mode: 'numeric' }) + '</div>'
    + '<label class="toggle"><input type="checkbox" data-f="setbool" data-k="rpe" id="st-rpe"' + (s.rpe ? ' checked' : '') + '> Registra l\'RPE (sforzo percepito da 1 a 10) per ogni serie</label>'
    + '<label class="toggle"><input type="checkbox" data-f="setbool" data-k="sound" id="st-sound"' + (s.sound ? ' checked' : '') + '> Suono a fine recupero (la vibrazione resta sempre attiva)</label>'
    + select('st-theme', 'Tema', [['auto', 'Come il telefono'], ['light', 'Chiaro'], ['dark', 'Scuro']], s.theme, { f: 'settheme' }) + '</section>';
  h += vSync();
  h += '<section class="panel stack"><h2 class="sec">Dati e backup</h2><p class="hint">' + (SY.account ? 'I dati sono sul telefono e su OneDrive. Un backup a mano ogni tanto resta comunque una buona idea.' : 'Senza sincronizzazione i dati sono solo su questo telefono: se disinstalli l\'app o cancelli i dati di Chrome li perdi. Esporta un backup ogni tanto.') + (meta.lastBackup ? ' Ultimo backup: ' + dLbl(meta.lastBackup) + '.' : '') + '</p>'
    + '<div class="row">' + btn('backup', 'Esporta backup') + btn('csv', 'CSV allenamenti') + btn('csv-body', 'CSV corpo e cardio') + '</div><div class="row">' + btn('import', 'Importa backup o CSV', 'ghost') + '</div>'
    + '<p class="hint">Puoi importare anche i dati delle versioni precedenti dell'app (backup o CSV, anche dalla versione web Doppia Progressione).</p></section>';
  h += '<section class="panel stack"><h2 class="sec">Informazioni</h2><p class="hint">Progressio 3.0. I tuoi dati restano sul tuo telefono' + (syncConfigured() ? ' e, se colleghi l\'account, in una cartella privata della tua OneDrive' : '') + '. ' + (CFG.goatcounter ? 'L\'app conta le aperture in forma anonima (senza cookie né dati personali) per sapere quante persone la usano.' : 'L\'app non raccoglie statistiche.') + '</p></section>';
  return h;
}
function vSync() {
  let h = '<section class="panel stack"><h2 class="sec">Sincronizzazione OneDrive</h2>';
  if (!syncConfigured()) return h + '<p class="hint">Non attiva. Si attiva registrando l\'app su Microsoft (gratis, una volta sola) e inserendo l\'ID applicazione nel file config.js: vedi la guida di installazione.</p></section>';
  if (!SY.account) return h + '<p class="hint">Collega il tuo account Microsoft personale: ogni modifica viene copiata in un file privato nella cartella App della tua OneDrive. Su un telefono nuovo ritrovi tutto accedendo con lo stesso account.</p>' + (SY.state === 'error' && SY.msg ? '<p class="err">' + esc(SY.msg) + '</p>' : '') + '<div class="row">' + btn('ms-in', 'Accedi con Microsoft', 'primary') + '</div></section>';
  const when = meta.lastSync ? new Date(meta.lastSync).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'mai';
  h += '<p style="margin:0">Collegato come <strong>' + esc(SY.account.username || SY.account.name || 'account Microsoft') + '</strong></p><p class="hint">Ultima sincronizzazione: ' + esc(when) + (meta.dirty ? ' · modifiche in attesa di invio' : '') + '.</p>';
  if (SY.state === 'login') h += '<p class="err">' + esc(SY.msg) + '</p><div class="row">' + btn('ms-in', 'Accedi di nuovo', 'primary') + '</div>';
  else if (SY.state === 'error') h += '<p class="err">' + esc(SY.msg) + '</p>';
  return h + '<div class="row">' + btn('ms-sync', SY.state === 'busy' ? 'Sincronizzo…' : 'Sincronizza ora', '', SY.state === 'busy' ? ' disabled' : '') + btn('ms-out', 'Scollega', 'ghost') + '</div></section>';
}
export function syncBadge() {
  if (!SY.account) return '';
  const t = SY.state === 'busy' ? 'Sincronizzo…' : SY.state === 'login' ? 'Accesso scaduto' : SY.state === 'error' ? 'Non sincronizzato' : meta.dirty ? 'Da sincronizzare' : 'Sincronizzato';
  const c = SY.state === 'login' || SY.state === 'error' ? 'warn' : meta.dirty || SY.state === 'busy' ? 'busy' : 'ok';
  return '<button type="button" class="sync s-' + c + '" data-act="go-sync">☁ ' + t + '</button>';
}
