// Arkives — Settings > Connections: Google Calendar + the brand-deal inbox
// forwarding address. Each account connects its own Google account and
// gets its own address; nothing here is shared between accounts.
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { _showSaveError, _showSaveSuccess } from '../lib/toast.js';

export const INBOX_DOMAIN = 'arkives.xyz';

const ERRORS = {
  denied: 'Google connection cancelled.',
  state: 'That Google sign-in link expired. Try Connect again.',
  exchange: 'Google did not finish the connection. Try again.',
  scope: 'Arkives needs the calendar box ticked on Google\'s screen. Try Connect again and leave it ticked.',
  not_configured: 'Google connection is not set up on the server yet.',
  expired: 'That connection took too long. Try Connect again.',
  forbidden: 'Google Calendar is not enabled for this account.',
};

function inboxAddress() {
  return state.INBOX_ADDRESS ? 'deals-' + state.INBOX_ADDRESS + '@' + INBOX_DOMAIN : '';
}

function _googleBody() {
  if (state._googleMissing) {
    return `<p class="settings-help">Connections need database update 029. Run <code>migrations/029_google_and_inbox.sql</code> in Supabase, then reload.</p>`;
  }
  const g = state.GOOGLE;
  if (g === undefined) return `<p class="settings-help">Checking…</p>`;
  if (g && g.status === 'active') {
    const since = g.connected_at ? new Date(g.connected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `
      <div class="conn-row">
        <span class="conn-dot conn-on" aria-hidden="true"></span>
        <div class="conn-text"><strong>Connected</strong>${g.email ? ' as ' + _esc(g.email) : ''}${since ? `<span class="conn-meta">since ${_esc(since)}</span>` : ''}</div>
      </div>
      <p class="settings-help">Your Google events show on the Calendar. Arkives events can be added to your Google Calendar from the Add Event form.</p>
      <div class="settings-actions">
        <button class="btn btn-secondary" data-action="disconnectGoogle">Disconnect</button>
      </div>`;
  }
  const revoked = g && g.status === 'revoked';
  return `
    ${revoked ? `<div class="conn-row"><span class="conn-dot conn-warn" aria-hidden="true"></span><div class="conn-text"><strong>Google access expired</strong>${g.email ? ' for ' + _esc(g.email) : ''}</div></div>` : ''}
    <p class="settings-help">See your Google events on the Arkives calendar and add Arkives deadlines to Google. Arkives can only see and change events on calendars you own. It never reads your email.</p>
    <div class="settings-actions">
      <button class="btn btn-primary" data-action="connectGoogle">${revoked ? 'Reconnect' : 'Connect'} Google Calendar</button>
    </div>`;
}

function _inboxBody() {
  if (state._googleMissing) return `<p class="settings-help">Needs database update 029 (see above).</p>`;
  const addr = inboxAddress();
  if (!addr) return `<p class="settings-help">Loading your address…</p>`;
  return `
    <p class="settings-help">Arkives never connects to your Gmail. Instead, Gmail forwards brand emails here, and they land in your Inbox for triage.</p>
    <div class="conn-address">
      <code id="inboxAddress">${_esc(addr)}</code>
      <button class="btn btn-secondary btn-sm" data-action="copyInboxAddress">Copy</button>
    </div>
    <ol class="conn-steps">
      <li>In Gmail, open <strong>Settings › Forwarding and POP/IMAP › Add a forwarding address</strong> and paste the address above.</li>
      <li>Gmail sends a confirmation code. It appears in your Arkives Inbox within a minute: enter it back in Gmail.</li>
      <li>Create a Gmail filter for brand emails (for example, Has the words: <code>collab OR partnership OR sponsorship OR campaign</code>) and choose <strong>Forward it to</strong> this address. Only matching emails are sent.</li>
    </ol>
    <p class="settings-help">Arkives keeps the sender, subject and the first part of the message. Attachments are never stored.</p>
    <div class="settings-actions">
      <button class="btn btn-secondary btn-sm" data-action="rotateInboxAddress">Get a new address</button>
    </div>`;
}

function renderConnectionsSettings() {
  return `
    <div class="settings-card" id="connGoogleCard">
      <h3>Google Calendar</h3>
      <div id="connGoogleBody">${_googleBody()}</div>
    </div>
    <div class="settings-card" id="connInboxCard">
      <h3>Brand-Deal Inbox</h3>
      <div id="connInboxBody">${_inboxBody()}</div>
    </div>`;
}

function _paint() {
  const g = document.getElementById('connGoogleBody');
  if (g) g.innerHTML = _googleBody();
  const i = document.getElementById('connInboxBody');
  if (i) i.innerHTML = _inboxBody();
}

async function loadConnections() {
  await db.sbGoogleStatus();
  if (!state._googleMissing && !state.INBOX_ADDRESS) await db.sbInboxAddress(false);
  _paint();
}

async function connectGoogle() {
  const out = await db.sbGoogleConnect();
  if (out && out.ok && /^https:\/\/accounts\.google\.com\//.test(out.url || '')) {
    window.location.assign(out.url);
    return;
  }
  _showSaveError(ERRORS[out && out.error] || 'Could not start the Google connection.');
}

async function disconnectGoogle() {
  if (!confirm('Disconnect Google Calendar? Arkives will stop showing your Google events. Events already added to Google stay there.')) return;
  const out = await db.sbGoogleDisconnect();
  if (!out || !out.ok) { _showSaveError('Could not disconnect. Try again.'); return; }
  state.GOOGLE = null;
  state.GCAL_EVENTS = {};
  _paint();
  _showSaveSuccess();
}

async function copyInboxAddress() {
  const addr = inboxAddress();
  if (!addr) return;
  try { await navigator.clipboard.writeText(addr); _showSaveSuccess(); } catch (e) { _showSaveError('Copy failed: select the address and copy it.'); }
}

async function rotateInboxAddress() {
  if (!confirm('Get a new address? The current one stops working right away, so update your Gmail forwarding to the new one.')) return;
  const t = await db.sbInboxAddress(true);
  if (!t) { _showSaveError('Could not create a new address.'); return; }
  _paint();
  _showSaveSuccess();
}

// Google sends the browser back to /?google=finish#settings (or
// google=error&reason=...). Strip the query first so a reload never
// replays it, then finish or explain. Returns true when it handled one.
async function handleGoogleReturn() {
  const q = new URLSearchParams(window.location.search);
  const result = q.get('google');
  if (!result) return false;
  history.replaceState(null, '', window.location.pathname + window.location.hash);
  if (result === 'finish') {
    const out = await db.sbGoogleFinish();
    if (out && out.ok) _showSaveSuccess();
    else _showSaveError(ERRORS[out && out.error] || 'Could not save the Google connection.');
    state.GCAL_EVENTS = {};
    state.GOOGLE = undefined;
    await loadConnections();
  } else {
    _showSaveError(ERRORS[q.get('reason')] || 'Google connection failed.');
  }
  return true;
}

act({ connectGoogle, copyInboxAddress, disconnectGoogle, rotateInboxAddress });

export { connectGoogle, copyInboxAddress, disconnectGoogle, handleGoogleReturn, inboxAddress, loadConnections, renderConnectionsSettings, rotateInboxAddress };
