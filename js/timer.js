// Rest timer: countdown dock, vibration and beep at the end, screen kept awake while it runs.
import { mmss, esc } from './util.js';
import { st } from './store.js';

const T = { end: 0, total: 0, name: '', sub: '', int: null, over: false, wake: null, audio: null };
const $ = id => document.getElementById(id);

function audioCtx() { try { if (!T.audio) T.audio = new (window.AudioContext || window.webkitAudioContext)(); if (T.audio.state === 'suspended') T.audio.resume(); } catch (e) { } return T.audio; }
function beep() {
  const ctx = audioCtx(); if (!ctx || !st.settings.sound) return;
  [0, 0.25, 0.5].forEach((t, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
  });
}
export async function wakeOn() { try { if (navigator.wakeLock && !T.wake && document.visibilityState === 'visible') { T.wake = await navigator.wakeLock.request('screen'); T.wake.addEventListener('release', () => { T.wake = null; }); } } catch (e) { } }
export function wakeOff() { try { if (T.wake) T.wake.release(); } catch (e) { } T.wake = null; }

export function startTimer(secs, name, sub) {
  audioCtx();
  T.total = secs; T.end = Date.now() + secs * 1000; T.name = name; T.sub = sub || ''; T.over = false;
  $('timer').hidden = false; document.body.classList.add('has-timer'); $('timer').classList.remove('is-over');
  clearInterval(T.int); T.int = setInterval(tick, 250); tick(); wakeOn();
}
export function stopTimer() { clearInterval(T.int); T.int = null; T.end = 0; $('timer').hidden = true; document.body.classList.remove('has-timer'); $('timer').classList.remove('is-over'); }
export function adjust(sec) {
  if (!T.end) return;
  if (sec > 0 && T.over) { T.over = false; T.end = Date.now(); $('timer').classList.remove('is-over'); }
  if (sec < 0 && T.over) return;
  T.end += sec * 1000; T.total = Math.max(T.total, (T.end - Date.now()) / 1000); tick();
}
export const timerRunning = () => !!T.end;
function tick() {
  const left = (T.end - Date.now()) / 1000;
  if (left <= 0 && !T.over) {
    T.over = true; $('timer').classList.add('is-over'); beep();
    try { if (navigator.vibrate) navigator.vibrate([350, 150, 350, 150, 350]); } catch (e) { }
  }
  $('tTime').textContent = T.over ? '0:00' : mmss(Math.ceil(left));
  $('tLbl').innerHTML = '<b>' + esc(T.name) + '</b>' + (T.over ? 'Recupero finito: vai!' : esc(T.sub || ('Recupero ' + mmss(T.total))));
  $('tBar').style.transform = 'scaleX(' + (T.over ? 1 : Math.max(0, left / T.total)) + ')';
  if (T.over && left < -20) stopTimer();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && T.end) { tick(); wakeOn(); } });
