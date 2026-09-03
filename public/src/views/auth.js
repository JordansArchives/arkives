// Arkives — Auth screens, session handling and logout/reset.
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { act } from '../lib/actions.js';
import { _showSaveSuccess } from '../lib/toast.js';
import { getHash, navigate } from '../router.js';
import { resetInvoiceViewState } from './invoices.js';
import { resetOutreachViewState } from './outreach.js';


async function checkSession() {
  if (!state._sb) return null;
  try {
    const { data: { session } } = await state._sb.auth.getSession();
    return session;
  } catch (e) {
    console.error('checkSession error:', e);
    return null;
  }
}

function showAuthScreen() {
  var authEl = document.getElementById('authScreen');
  var appEl = document.getElementById('appShell');
  var loaderEl = document.getElementById('loaderOverlay');
  if (authEl) authEl.style.display = 'flex';
  if (appEl) appEl.style.display = 'none';
  if (loaderEl) loaderEl.style.display = 'none';
}

function showApp() {
  var authEl = document.getElementById('authScreen');
  var appEl = document.getElementById('appShell');
  if (authEl) authEl.style.display = 'none';
  if (appEl) appEl.style.display = '';
}

// One auth panel visible at a time: login, signup, forgot, recovery, or
// the "check your email" confirmation.
function _authShow(id) {
  ['loginForm', 'signupForm', 'forgotForm', 'recoveryForm', 'authConfirmMsg'].forEach(function(p) {
    var el = document.getElementById(p);
    if (el) el.style.display = (p === id) ? '' : 'none';
  });
  ['loginError', 'signupError', 'forgotError', 'recoveryError'].forEach(function(p) {
    var el = document.getElementById(p);
    if (el) el.style.display = 'none';
  });
}
function showLogin(e) { if (e) e.preventDefault(); _authShow('loginForm'); }
function showSignUp(e) { if (e) e.preventDefault(); _authShow('signupForm'); }
function showForgot(e) { if (e) e.preventDefault(); _authShow('forgotForm'); }
function showRecovery() { _authShow('recoveryForm'); }
function _authConfirm(text) {
  _authShow('authConfirmMsg');
  var msg = document.getElementById('authConfirmText');
  if (msg) msg.textContent = text;
}

async function handleForgot(e) {
  e.preventDefault();
  var email = document.getElementById('forgotEmail').value.trim();
  var errEl = document.getElementById('forgotError');
  var btn = document.getElementById('forgotBtn');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Sending...';
  try {
    var res = await state._sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
    if (res.error) {
      errEl.textContent = res.error.message || 'Could not send the reset email';
      errEl.style.display = 'block';
    } else {
      _authConfirm('We sent a password reset link. Open it on this device to choose a new password.');
    }
  } catch (err) {
    errEl.textContent = 'Connection error. Please try again.';
    errEl.style.display = 'block';
  }
  btn.disabled = false;
  btn.textContent = 'Send reset link';
}

async function handleSetPassword(e) {
  e.preventDefault();
  var pw = document.getElementById('recoveryPassword').value;
  var confirmPw = document.getElementById('recoveryConfirm').value;
  var errEl = document.getElementById('recoveryError');
  var btn = document.getElementById('recoveryBtn');
  errEl.style.display = 'none';
  if (pw !== confirmPw) { errEl.textContent = 'Passwords do not match'; errEl.style.display = 'block'; return; }
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    var res = await state._sb.auth.updateUser({ password: pw });
    if (res.error) {
      errEl.textContent = res.error.message || 'Could not update the password';
      errEl.style.display = 'block';
    } else {
      state._authUser = (res.data && res.data.user) || state._authUser;
      updateSidebarUser();
      showApp();
      if (!state.CREATOR._sbId) await db.sbFetchAllData();
      navigate(getHash());
      _showSaveSuccess();
    }
  } catch (err) {
    errEl.textContent = 'Connection error. Please try again.';
    errEl.style.display = 'block';
  }
  btn.disabled = false;
  btn.textContent = 'Set new password';
}

async function handleLogin(e) {
  e.preventDefault();
  var email = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value;
  var errEl = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Signing in...';
  try {
    var { data, error } = await state._sb.auth.signInWithPassword({ email: email, password: password });
    if (error) {
      errEl.textContent = error.message || 'Invalid credentials';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }
    state._authUser = data.user;
    updateSidebarUser();
    showApp();
    // Load data and navigate
    await db.sbFetchAllData();
    navigate(getHash());
  } catch (err) {
    errEl.textContent = 'Connection error. Please try again.';
    errEl.style.display = 'block';
  }
  btn.disabled = false;
  btn.textContent = 'Sign In';
}

async function handleSignUp(e) {
  e.preventDefault();
  var email = document.getElementById('signupEmail').value.trim();
  var password = document.getElementById('signupPassword').value;
  var confirm = document.getElementById('signupConfirm').value;
  var errEl = document.getElementById('signupError');
  var btn = document.getElementById('signupBtn');
  errEl.style.display = 'none';
  if (password !== confirm) {
    errEl.textContent = 'Passwords do not match';
    errEl.style.display = 'block';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Creating account...';
  try {
    var { data, error } = await state._sb.auth.signUp({ email: email, password: password });
    if (error) {
      errEl.textContent = error.message || 'Sign up failed';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Create Account';
      return;
    }
    // If email confirmation is required
    if (data.user && !data.session) {
      _authConfirm('We sent a confirmation link. Click it to activate your account, then come back here to sign in.');
    } else if (data.session) {
      // Auto-confirmed — go directly to app
      state._authUser = data.user;
      updateSidebarUser();
      showApp();
      await db.sbFetchAllData();
      navigate(getHash());
    }
  } catch (err) {
    errEl.textContent = 'Connection error. Please try again.';
    errEl.style.display = 'block';
  }
  btn.disabled = false;
  btn.textContent = 'Create Account';
}

async function handleLogout() {
  if (!state._sb) return;
  try { await state._sb.auth.signOut(); } catch (e) { console.error('signOut:', e); }
  resetAllState();
  showAuthScreen();
}

// Everything a logged-in session put in memory or in the DOM goes here, so
// a second account on the same device never sees the first one's data.
function resetAllState() {
  state._authUser = null;
  state.CREATOR = {
    name: "", brand: "", entity: "", email: "", niche: "",
    platforms: {
      instagram: { handle: "", followers: "0", followersNum: 0, engagement: "0%", tier: "", posts: 0, verified: false },
      tiktok: { handle: "", followers: "0", followersNum: 0, likes: "0" },
      youtube: { handle: "", followers: "0", followersNum: 0, videos: 0 },
      twitter: { handle: "", followers: "0", followersNum: 0, status: "new" },
      linkedin: { handle: "", followers: "0", followersNum: 0, connections: 0 }
    }
  };
  state.RATE_CARD = { organic: [], ugc: [], tiktok: [], youtube: [], addOns: [], bundles: [], minimumRate: 0, pricingRule: "" };
  state.AUDIENCE_DATA.topAge = ''; state.AUDIENCE_DATA.ageRange = '';
  state.AUDIENCE_DATA.gender = { male: 0, female: 0 };
  state.AUDIENCE_DATA.topCountries = []; state.AUDIENCE_DATA.topCities = {}; state.AUDIENCE_DATA.interests = [];
  state.DEALS = []; state.INBOX_ITEMS = []; state.CALENDAR_EVENTS = []; state.INVOICE_DATA = [];
  state.MONTHLY_REVENUE = []; state.CAMPAIGN_RESULTS = [];
  state.TASKS = []; state._tasksTableMissing = false;
  state._taskComposerOpen = false; state._tasksCompletedOpen = false; state._editingTaskId = null;
  state.CLIENTS = []; state._invoicingMigrationMissing = false;
  state.OUTREACH_TARGETS = []; state.OUTREACH_LISTS = []; state._outreachMigrationMissing = false;
  state._scriptsCache = []; state._currentScriptId = null; state._currentScriptRow = null; state._currentScenes = [];
  state._sharedScriptToken = null; state._sceneDirty = {}; state._titleDirty = null;
  if (typeof state.BOARDS !== 'undefined') { state.BOARDS = []; state._bdBoard = null; state._bdItems = []; state._bdSignedUrls = {}; }
  if (typeof resetInvoiceViewState === 'function') resetInvoiceViewState();
  if (typeof resetOutreachViewState === 'function') resetOutreachViewState();
  document.querySelectorAll('.view').forEach(function(v) { v.innerHTML = ''; });
  updateSidebarUser();
}

function updateSidebarUser() {
  var nameEl = document.getElementById('sidebarUserName');
  var labelEl = document.getElementById('sidebarUserLabel');
  var avatarEl = document.getElementById('sidebarAvatar');
  if (!nameEl) return;
  // Use profile name if loaded, otherwise email
  if (state.CREATOR.name) {
    nameEl.textContent = state.CREATOR.name;
    labelEl.textContent = state.CREATOR.brand || '';
    var initials = state.CREATOR.name.split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
    avatarEl.textContent = initials || 'U';
  } else if (state._authUser) {
    nameEl.textContent = state._authUser.email.split('@')[0];
    labelEl.textContent = state._authUser.email;
    avatarEl.textContent = state._authUser.email[0].toUpperCase();
  }
}

/* ---- SIDE EFFECTS ---- Registered from main.js in a fixed order, not at import time. */
export function __init() {
  /* ---- AUTH EVENTS ---- */
  // PASSWORD_RECOVERY: the user arrived from a reset-password email; show
  // the new-password form. SIGNED_OUT: the session was revoked, expired, or
  // its refresh failed; go back to the login screen instead of leaving a
  // dead app where every save fails.
  if (state._sb) {
    state._sb.auth.onAuthStateChange(function(event, session) {
      if (event === 'PASSWORD_RECOVERY') {
        state._authUser = session ? session.user : null;
        showAuthScreen();
        showRecovery();
      } else if (event === 'SIGNED_OUT') {
        var appEl = document.getElementById('appShell');
        if (appEl && appEl.style.display !== 'none') { resetAllState(); showAuthScreen(); }
      }
    });
  }
}

act({ handleForgot, handleLogin, handleLogout, handleSetPassword, handleSignUp, showForgot, showLogin, showSignUp });

export { _authConfirm, _authShow, checkSession, handleForgot, handleLogin, handleLogout, handleSetPassword, handleSignUp, resetAllState, showApp, showAuthScreen, showForgot, showLogin, showRecovery, showSignUp, updateSidebarUser };
