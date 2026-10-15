// Arkives — privacy mode, for screen recording and screen sharing.
// When on, sensitive values are never put in the page at all: pv()
// renders a same-shape placeholder (digits -> 8, letters -> x) under a
// blur, so neither zooming a recording nor opening the inspector can
// reveal them. Remembered per device; toggled from the dashboard eye
// button or Option+B anywhere in the app.
import { state } from '../state.js';
import { showToast } from './toast.js';
import { act } from './actions.js';

const KEY = 'arkives.privacy';

function isPrivate() { return !!state._privacy; }

// html: already-escaped text. Returns it unchanged, or a masked stand-in.
function pv(html) {
  if (!state._privacy) return html;
  const plain = String(html).replace(/<[^>]*>/g, '').replace(/&[#a-z0-9]+;/gi, 'x');
  const mask = plain.replace(/[0-9]/g, '8').replace(/[A-Za-zÀ-ɏ]/g, 'x').slice(0, 60);
  return `<span class="pv-mask" aria-label="Hidden">${mask || 'xxxx'}</span>`;
}

function setPrivacy(on) {
  state._privacy = !!on;
  try { localStorage.setItem(KEY, state._privacy ? '1' : '0'); } catch (e) { /* private window: session only */ }
  document.body.classList.toggle('privacy-on', state._privacy);
  window.dispatchEvent(new CustomEvent('arkives:privacy', { detail: state._privacy }));
}

function togglePrivacy() {
  setPrivacy(!state._privacy);
  showToast(state._privacy ? 'Privacy mode on: amounts and names hidden' : 'Privacy mode off');
}

function privacyButtonHtml() {
  const on = isPrivate();
  const eye = on
    ? '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c5.5 0 9.3 4.6 10 7-.3.9-1 2.2-2.1 3.4"/><path d="M6.6 6.6C4.1 8.1 2.5 10.6 2 12c.7 2.4 4.5 7 10 7 1.8 0 3.4-.5 4.8-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'
    : '<path d="M2 12c.7-2.4 4.5-7 10-7s9.3 4.6 10 7c-.7 2.4-4.5 7-10 7S2.7 14.4 2 12z"/><circle cx="12" cy="12" r="3"/>';
  return `<button class="btn btn-secondary btn-sm privacy-btn ${on ? 'is-on' : ''}" data-action="togglePrivacy" aria-pressed="${on}" title="Hide amounts and names for screen recording (⌥B)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${eye}</svg>${on ? 'Hidden' : 'Hide'}</button>`;
}

// Read the saved choice before the first paint; bind the shortcut
function __init() {
  let saved = false;
  try { saved = localStorage.getItem(KEY) === '1'; } catch (e) { saved = false; }
  state._privacy = saved;
  document.body.classList.toggle('privacy-on', saved);
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === 'KeyB') { e.preventDefault(); togglePrivacy(); }
  });
}

act({ togglePrivacy });

export { __init, isPrivate, privacyButtonHtml, pv, setPrivacy, togglePrivacy };
