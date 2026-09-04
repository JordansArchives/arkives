// Arkives — entry point. Imports every module, wires side effects in a fixed
// order, exposes the namespace used by tests and the console, then boots.
import { state } from './state.js';
import { db } from './lib/sb.js';
import { _showSaveError } from './lib/toast.js';
import * as stores from './stores/index.js';
import { getHash, navigate } from './router.js';
import { checkSession, showApp, showAuthScreen, updateSidebarUser } from './views/auth.js';
import * as actions from './lib/actions.js';
import * as esc from './lib/esc.js';
import * as format from './lib/format.js';
import * as icons from './lib/icons.js';
import * as sb from './lib/sb.js';
import * as share from './lib/share.js';
import * as storage from './lib/storage.js';
import * as toast from './lib/toast.js';
import * as router from './router.js';
import * as analytics from './views/analytics.js';
import * as auth from './views/auth.js';
import * as boards from './views/boards.js';
import * as calendar from './views/calendar.js';
import * as contracts from './views/contracts.js';
import * as dashboard from './views/dashboard.js';
import * as inbox from './views/inbox.js';
import * as invoices from './views/invoices.js';
import * as mediakit from './views/mediakit.js';
import * as outreach from './views/outreach.js';
import * as revenue from './views/revenue.js';
import * as scripts from './views/scripts.js';
import * as settings from './views/settings.js';
import * as tasks from './views/tasks.js';

async function boot() {
  try {
    // Public shared-link routes — skip auth entirely
    var hash = getHash();
    if (hash.startsWith('shared/') || hash.startsWith('bshared/')) {
      showApp();
      navigate(hash);
    } else {
      // Check for existing auth session
      var session = await checkSession();
      if (session && session.user) {
        state._authUser = session.user;
        showApp();
        // Load the profile and only what the first route needs; the logo
        // loader stays up until it lands. On a very slow connection paint
        // after 20s anyway: navigate() paints the view when its data arrives.
        var loaded = false;
        var loadP = stores.profile.load().then(function() { return stores.loadFor(hash); }).then(function() { loaded = true; });
        await Promise.race([loadP, new Promise(function(r) { setTimeout(r, 20000); })]);
        if (!loaded) _showSaveError('Still loading your data. The view will refresh when it arrives.');
        updateSidebarUser();
        navigate(hash);
      } else {
        // No session — show login screen
        showAuthScreen();
      }
    }
  } catch (e) {
    console.error('Init error:', e);
    // If we were on a shared route, still try to render it
    var h = getHash();
    if (h.startsWith('shared/') || h.startsWith('bshared/')) {
      showApp();
      try { navigate(h); } catch (_) {}
    } else {
      showAuthScreen();
    }
  }

  state._booted = true;

  // Dismiss loader
  var overlay = document.getElementById('loaderOverlay');
  if (overlay) {
    setTimeout(function() {
      overlay.classList.add('hiding');
      setTimeout(function() { overlay.remove(); }, 450);
    }, 300);
  }
}

// Side effects (listeners, the Supabase client) run here, in this order.
actions.__init();
sb.__init();
auth.__init();
router.__init();
share.__init();
boards.__init();
scripts.__init();
tasks.__init();

// window.__arkives: every export of every module, plus state and db. The
// tests drive the app through it; it is also handy in the console.
const __arkives = { state, db, stores };
for (const m of [actions, esc, format, icons, sb, share, storage, toast, router, analytics, auth, boards, calendar, contracts, dashboard, inbox, invoices, mediakit, outreach, revenue, scripts, settings, tasks]) for (const k of Object.keys(m)) if (k !== '__init') __arkives[k] = m[k];
window.__arkives = __arkives;

boot();
