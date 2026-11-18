// Optional sync with a private file in the user's OneDrive app folder (Microsoft Graph, personal account).
// Data always lives on the phone first; the cloud copy is merged item by item (newest wins, deletions win).
import { st, meta, replaceAll, setMeta } from './store.js';

const CFG = window.DP_CONFIG || {};
const SCOPES = ['Files.ReadWrite.AppFolder'];
const FILE = 'https://graph.microsoft.com/v1.0/me/drive/special/approot:/doppia-progressione.json';
const COLLS = ['exercises', 'routines', 'sessions', 'body', 'cardio'];
export const SY = { msal: null, account: null, state: 'off', msg: '', timer: null, busy: false, again: false, onState: () => {} };
export const syncConfigured = () => !!CFG.clientId;

function set(state, msg) { SY.state = state; SY.msg = msg || ''; SY.onState(); }

export function merge(a, b) {
  const out = { schema: 3, deleted: {}, updatedAt: Date.now() };
  let fromB = false, fromA = false;
  const del = out.deleted;
  for (const src of [a.deleted || {}, b.deleted || {}]) for (const [k, v] of Object.entries(src)) del[k] = Math.max(del[k] || 0, v);
  for (const c of COLLS) {
    const A = a[c] || {}, B = b[c] || {}, R = out[c] = {};
    for (const id of new Set([...Object.keys(A), ...Object.keys(B)])) {
      if (del[id]) { if (A[id]) fromB = true; if (B[id]) fromA = true; continue; }
      const x = A[id], y = B[id];
      if (x && y) { if ((y.updatedAt || 0) > (x.updatedAt || 0)) { R[id] = y; fromB = true; } else { R[id] = x; if ((x.updatedAt || 0) > (y.updatedAt || 0)) fromA = true; } }
      else if (x) { R[id] = x; fromA = true; } else { R[id] = y; fromB = true; }
    }
  }
  for (const id of Object.keys(del)) { if (!(a.deleted || {})[id]) fromB = true; if (!(b.deleted || {})[id]) fromA = true; }
  const sa = a.settings || {}, sb = b.settings || {};
  if ((sb.updatedAt || 0) > (sa.updatedAt || 0)) { out.settings = sb; fromB = true; } else { out.settings = sa; if ((sa.updatedAt || 0) > (sb.updatedAt || 0)) fromA = true; }
  return { data: out, fromA, fromB };
}

async function token() {
  try { return (await SY.msal.acquireTokenSilent({ scopes: SCOPES, account: SY.account })).accessToken; }
  catch (e) {
    if (e instanceof msal.InteractionRequiredAuthError || /interaction_required|login_required|consent_required|no_tokens_found|monitor_window_timeout/i.test(e.errorCode || '')) {
      let tried = ''; try { tried = sessionStorage.getItem('dp-auto-login') || ''; } catch (x) { }
      if (!tried && document.visibilityState === 'visible') {
        try { sessionStorage.setItem('dp-auto-login', '1'); } catch (x) { }
        await SY.msal.acquireTokenRedirect({ scopes: SCOPES, account: SY.account, prompt: 'none' });
        return null;
      }
      set('login', 'L\'accesso a Microsoft è scaduto. I dati restano sul telefono: accedi di nuovo e si sincronizzano da soli.');
      return null;
    }
    throw e;
  }
}
const g = (url, opt, tk) => fetch(url, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + tk }, (opt && opt.headers) || {}) }));

export async function syncNow(force) {
  if (!SY.account) return;
  if (!navigator.onLine) { set('error', 'Sei offline: sincronizzo appena torna la connessione.'); return; }
  if (SY.busy) { SY.again = true; return; }
  SY.busy = true; set('busy');
  try {
    const tk = await token(); if (!tk) { SY.busy = false; return; }
    let remote = null;
    const m = await g(FILE, { cache: 'no-store' }, tk);
    if (m.ok) {
      const j = await m.json(); const dl = j['@microsoft.graph.downloadUrl'];
      const r = dl ? await fetch(dl, { cache: 'no-store' }) : await g(FILE + ':/content', { cache: 'no-store' }, tk);
      if (!r.ok) throw new Error('Download da OneDrive non riuscito (' + r.status + ').');
      remote = await r.json();
      if (!remote || remote.schema !== 3) remote = null;
    } else if (m.status !== 404) throw new Error('OneDrive ha risposto ' + m.status + '.');
    let upload = null;
    if (!remote || meta.forcePush) upload = st;
    else {
      const { data, fromA, fromB } = merge(st, remote);
      if (fromB) { replaceAll(data, false); SY.onData && SY.onData(); }
      if (fromA || meta.dirty) upload = data;
    }
    if (upload) {
      const body = JSON.stringify({ ...upload, schema: 3, updatedAt: Date.now() });
      const put = await g(FILE + ':/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body }, tk);
      if (!put.ok) throw new Error('Salvataggio su OneDrive non riuscito (' + put.status + ').');
    }
    setMeta({ dirty: false, forcePush: false, lastSync: new Date().toISOString() });
    set('ok');
  } catch (e) { set('error', (e && e.message) || 'Sincronizzazione non riuscita.'); }
  SY.busy = false;
  if (SY.again) { SY.again = false; schedule(500); }
}
export function schedule(ms) { if (!SY.account) return; clearTimeout(SY.timer); SY.timer = setTimeout(syncNow, ms == null ? 3000 : ms); }

export async function initSync() {
  if (!CFG.clientId) { set('off'); return; }
  if (!window.msal) { set('error', 'La libreria di accesso Microsoft non è stata caricata.'); return; }
  try {
    SY.msal = new msal.PublicClientApplication({
      auth: { clientId: CFG.clientId, authority: CFG.authority || 'https://login.microsoftonline.com/consumers', redirectUri: location.origin + location.pathname.replace(/index\.html$/, ''), navigateToLoginRequestUrl: false },
      cache: { cacheLocation: 'localStorage' }
    });
    await SY.msal.initialize();
    let res = null;
    try { res = await SY.msal.handleRedirectPromise(); } catch (e) { if (!SY.msal.getAllAccounts().length) throw e; }
    SY.account = (res && res.account) || SY.msal.getAllAccounts()[0] || null;
    if (SY.account) { set('ok'); syncNow(); } else set('off');
  } catch (e) { set('error', 'Accesso a Microsoft non riuscito: ' + ((e && (e.errorMessage || e.message)) || e)); }
}
export async function signIn() { if (!SY.msal) return; try { sessionStorage.removeItem('dp-auto-login'); } catch (x) { } try { await SY.msal.loginRedirect({ scopes: SCOPES, prompt: 'select_account' }); } catch (e) { set('error', 'Accesso non avviato: ' + (e.message || e)); } }
export async function signOut() { if (!SY.msal || !SY.account) return; try { await SY.msal.clearCache({ account: SY.account }); } catch (e) { } SY.account = null; set('off'); }
window.addEventListener('online', () => schedule(500));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(400); });
