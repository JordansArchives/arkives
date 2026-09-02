/* ===========================================
   Arkives — Creator Partnership CRM
   App Logic, Data, Routing, Charts
   =========================================== */

const API_BASE = "__PORT_8000__";

/* ---- DATA ---- */
let CREATOR = {
  name: "", brand: "", entity: "", email: "", niche: "",
  platforms: {
    instagram: { handle: "", followers: "0", followersNum: 0, engagement: "0%", tier: "", posts: 0, verified: false },
    tiktok: { handle: "", followers: "0", followersNum: 0, likes: "0" },
    youtube: { handle: "", followers: "0", followersNum: 0, videos: 0 },
    twitter: { handle: "", followers: "0", followersNum: 0, status: "new" },
    linkedin: { handle: "", followers: "0", followersNum: 0, connections: 0 }
  }
};

let RATE_CARD = {
  organic: [], ugc: [], tiktok: [], youtube: [], addOns: [], bundles: [],
  minimumRate: 0, pricingRule: ""
};

const PIPELINE_STATUSES = ["Lead", "Qualifying", "Rates Sent", "Negotiating", "Contract", "Active", "Completed", "Declined"];

const STATUS_MAP = {
  "SIGNED": "Active",
  "ACTIVE - In Production": "Active",
  "ACTIVE — In Production": "Active",
  "Revised Contract Drafted": "Contract",
  "Follow-Up Sent": "Negotiating",
  "Rates Sent": "Rates Sent",
  "Counter Sent": "Negotiating",
  "Questions Sent": "Qualifying",
  "Meeting Scheduled": "Qualifying",
  "Cold": "Lead",
  "Declined": "Declined",
  "Pointed to Shawn": "Qualifying",
  "Completed": "Completed"
};

function mapStatus(raw) {
  if (!raw) return "Lead";
  for (const key of Object.keys(STATUS_MAP)) {
    if (raw.toUpperCase().includes(key.toUpperCase())) return STATUS_MAP[key];
  }
  return "Lead";
}

function parseValue(val) {
  if (typeof val === "number") return val;
  if (!val || val === "TBD") return 0;
  const str = String(val).replace(/[^0-9.-]/g, "");
  const nums = str.split("-").map(Number).filter(n => !isNaN(n));
  return nums.length > 0 ? nums[0] : 0;
}

function formatCurrency(num, allowZero) {
  if (num === 0 && !allowZero) return "TBD";
  return "$" + num.toLocaleString("en-US");
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - d) / (1000 * 60 * 60 * 24));
}

function todayStr() {
  const d = new Date();
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Alias used by simplified dashboard
function formatDate(d) {
  if (!d) return '';
  d = (d instanceof Date) ? d : new Date(d);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// Toast helper (used by Settings + Contracts)
function showToast(msg, type) {
  if (type === 'error') return _showSaveError(msg);
  var el = document.getElementById('sb-save-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sb-save-toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2A6B5A;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-family:var(--font-body,sans-serif);z-index:10000;opacity:0;transition:opacity 0.3s;pointer-events:none;max-width:90vw;text-align:center;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = '#2A6B5A';
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(function() { el.style.opacity = '0'; }, 2000);
}

function todayISO() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function daysClass(days) {
  if (days <= 3) return "recent";
  if (days >= 7) return "overdue";
  return "";
}

let DEALS = [];


/* ---- LATEST EMAIL UPDATES (populated by morning scan) ---- */

/* ---- ACTION ITEMS ---- */

/* ---- CONTENT DEADLINES (populated by morning scan) ---- */

let CAMPAIGN_RESULTS = [];

let OUTREACH_TEMPLATES = {};

let CALENDAR_EVENTS = [];

/* ---- SUPABASE CLIENT ---- */
const SUPABASE_URL = 'https://wqblmehsqcmsdstyweus.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jYnmjabjsjkfnBvo1Eii0g_c3aKkCf2';
let _sb = null;
try {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    console.log('Supabase client created successfully');
  } else {
    console.error('Supabase library not loaded. typeof supabase:', typeof supabase);
  }
} catch (initErr) {
  console.error('Supabase client init error:', initErr);
  _sb = null;
}

/* ---- AUTH STATE ---- */
let _authUser = null;

async function checkSession() {
  if (!_sb) return null;
  try {
    const { data: { session } } = await _sb.auth.getSession();
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

function showLogin(e) {
  if (e) e.preventDefault();
  document.getElementById('loginForm').style.display = '';
  document.getElementById('signupForm').style.display = 'none';
  document.getElementById('authConfirmMsg').style.display = 'none';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('signupError').style.display = 'none';
}

function showSignUp(e) {
  if (e) e.preventDefault();
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('signupForm').style.display = '';
  document.getElementById('authConfirmMsg').style.display = 'none';
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('signupError').style.display = 'none';
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
    var { data, error } = await _sb.auth.signInWithPassword({ email: email, password: password });
    if (error) {
      errEl.textContent = error.message || 'Invalid credentials';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }
    _authUser = data.user;
    updateSidebarUser();
    showApp();
    // Load data and navigate
    await sbFetchAllData();
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
    var { data, error } = await _sb.auth.signUp({ email: email, password: password });
    if (error) {
      errEl.textContent = error.message || 'Sign up failed';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Create Account';
      return;
    }
    // If email confirmation is required
    if (data.user && !data.session) {
      document.getElementById('signupForm').style.display = 'none';
      document.getElementById('authConfirmMsg').style.display = 'block';
    } else if (data.session) {
      // Auto-confirmed — go directly to app
      _authUser = data.user;
      updateSidebarUser();
      showApp();
      await sbFetchAllData();
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
  if (!_sb) return;
  await _sb.auth.signOut();
  _authUser = null;
  // Reset data
  DEALS = []; INBOX_ITEMS = []; CALENDAR_EVENTS = []; INVOICE_DATA = [];
  MONTHLY_REVENUE = []; CAMPAIGN_RESULTS = []; OUTREACH_TEMPLATES = {};
  TASKS = []; _tasksTableMissing = false;
  _taskComposerOpen = false; _tasksCompletedOpen = false; _editingTaskId = null;
  CLIENTS = []; _invoicingMigrationMissing = false;
  OUTREACH_TARGETS = []; OUTREACH_LISTS = []; _outreachMigrationMissing = false;
  if (typeof resetInvoiceViewState === 'function') resetInvoiceViewState();
  if (typeof resetOutreachViewState === 'function') resetOutreachViewState();
  showAuthScreen();
}

function updateSidebarUser() {
  var nameEl = document.getElementById('sidebarUserName');
  var labelEl = document.getElementById('sidebarUserLabel');
  var avatarEl = document.getElementById('sidebarAvatar');
  if (!nameEl) return;
  // Use profile name if loaded, otherwise email
  if (CREATOR.name) {
    nameEl.textContent = CREATOR.name;
    labelEl.textContent = CREATOR.brand || '';
    var initials = CREATOR.name.split(' ').map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
    avatarEl.textContent = initials || 'U';
  } else if (_authUser) {
    nameEl.textContent = _authUser.email.split('@')[0];
    labelEl.textContent = _authUser.email;
    avatarEl.textContent = _authUser.email[0].toUpperCase();
  }
}

/* ---- TASK STATE (loaded from Supabase) ---- */
let CONTRACT_RULES = [];
let TASKS = [];
let _tasksTableMissing = false;

let _sbReady = false;

/* ---- SAVE STATUS TOAST ---- */
function _showSaveError(msg) {
  var el = document.getElementById('sb-save-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sb-save-toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#C73539;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-family:var(--font-body,sans-serif);z-index:10000;opacity:0;transition:opacity 0.3s;pointer-events:none;max-width:90vw;text-align:center;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(function() { el.style.opacity = '0'; }, 4000);
}

function _showSaveSuccess() {
  var el = document.getElementById('sb-save-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sb-save-toast';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#2A6B5A;color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-family:var(--font-body,sans-serif);z-index:10000;opacity:0;transition:opacity 0.3s;pointer-events:none;max-width:90vw;text-align:center;';
    document.body.appendChild(el);
  }
  el.textContent = 'Saved';
  el.style.background = '#2A6B5A';
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(function() { el.style.opacity = '0'; }, 1500);
}

/* ---- SKETCHY ICONS (Hand-Drawn Style) ---- */
const SKETCHY_ICONS = {
  chevron: '<svg class="widget-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.2 9.1l5.9 5.8 5.8-5.9"/></svg>',
  instagram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.2" y="2.1" width="19.6" height="19.8" rx="5.2"/><circle cx="12" cy="12.1" r="5.1"/><circle cx="17.6" cy="6.5" r="1.3" fill="currentColor" stroke="none"/></svg>',
  tiktok: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.2 12.1a4.1 4.1 0 1 0 4.1 4.1V2.2"/><path d="M13.3 6.2c1.2 1.4 3 2.2 5 2.2"/></svg>',
  youtube: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.2 7.8c.2-1.6 1.4-2.8 3-3 2.2-.3 4.6-.4 6.8-.4s4.6.1 6.8.4c1.6.2 2.8 1.4 3 3 .3 1.4.4 2.8.4 4.2s-.1 2.8-.4 4.2c-.2 1.6-1.4 2.8-3 3-2.2.3-4.6.4-6.8.4s-4.6-.1-6.8-.4c-1.6-.2-2.8-1.4-3-3-.3-1.4-.4-2.8-.4-4.2s.1-2.8.4-4.2z"/><path d="M10.2 8.8l5.6 3.2-5.6 3.2z"/></svg>',
  twitter: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.1 3.2l6.8 9.2"/><path d="M4.1 20.8l8.2-9.2"/><path d="M13.2 11.6L20.1 20.8"/><path d="M10.9 12.4L19.9 3.2"/></svg>',
  linkedin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16.2 8.2c3.2 0 4.6 2.1 4.6 5.3v7.3h-3.6v-5.5c0-1.8-.7-2.9-2.1-2.9-1.3 0-2.1 1-2.1 2.9v5.5h-3.6V8.2h3.6v1.5c.6-.9 1.8-1.5 3.2-1.5z"/><path d="M3.2 20.8h3.6V8.2H3.2z"/><circle cx="5" cy="4.8" r="2.1"/></svg>',
  instagramSmall: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.2" y="2.1" width="19.6" height="19.8" rx="5.2"/><circle cx="12" cy="12.1" r="5.1"/><circle cx="17.6" cy="6.5" r="1.3" fill="currentColor" stroke="none"/></svg>',
  tiktokSmall: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.2 12.1a4.1 4.1 0 1 0 4.1 4.1V2.2"/><path d="M13.3 6.2c1.2 1.4 3 2.2 5 2.2"/></svg>',
  youtubeSmall: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.2 7.8c.2-1.6 1.4-2.8 3-3 2.2-.3 4.6-.4 6.8-.4s4.6.1 6.8.4c1.6.2 2.8 1.4 3 3 .3 1.4.4 2.8.4 4.2s-.1 2.8-.4 4.2c-.2 1.6-1.4 2.8-3 3-2.2.3-4.6.4-6.8.4s-4.6-.1-6.8-.4c-1.6-.2-2.8-1.4-3-3-.3-1.4-.4-2.8-.4-4.2s.1-2.8.4-4.2z"/><path d="M10.2 8.8l5.6 3.2-5.6 3.2z"/></svg>',
  twitterSmall: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.1 3.2l6.8 9.2"/><path d="M4.1 20.8l8.2-9.2"/><path d="M13.2 11.6L20.1 20.8"/><path d="M10.9 12.4L19.9 3.2"/></svg>',
  linkedinSmall: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.2 8.2c3.2 0 4.6 2.1 4.6 5.3v7.3h-3.6v-5.5c0-1.8-.7-2.9-2.1-2.9-1.3 0-2.1 1-2.1 2.9v5.5h-3.6V8.2h3.6v1.5c.6-.9 1.8-1.5 3.2-1.5z"/><path d="M3.2 20.8h3.6V8.2H3.2z"/><circle cx="5" cy="4.8" r="2.1"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.2 13.2l3-3c1.6-1.6 1.6-4.1 0-5.7s-4.1-1.6-5.7 0l-3 3"/><path d="M5.8 10.8l-3 3c-1.6 1.6-1.6 4.1 0 5.7s4.1 1.6 5.7 0l3-3"/><path d="M8.5 15.5l7-7"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.2v15.6"/><path d="M4.2 12h15.6"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 6.2h17.6"/><path d="M8.2 6.2V4.2c0-1.1.9-2 2-2h3.6c1.1 0 2 .9 2 2v2"/><path d="M5.2 6.2l1 14c.1 1 .9 1.8 2 1.8h7.6c1 0 1.9-.8 2-1.8l1-14"/><path d="M10.2 10.8v6"/><path d="M13.8 10.8v6"/></svg>',
  share: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4"/><path d="M15.4 6.5l-6.8 4"/></svg>',
  chevronLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
};

/* ---- ROUTING ---- */
/* ---- SUPABASE MASTER DATA LOADER ---- */
async function sbFetchAllData() {
  if (!_sb) {
    console.warn('Supabase not available — app will show empty data');
    return;
  }

  try {
    // Show loading state
    const loadingEl = document.getElementById('sb-loading-overlay');
    if (loadingEl) loadingEl.style.display = 'flex';

    // Fetch profile — strictly by auth_user_id; create a fresh one if missing.
    // Never claim an existing unlinked profile: that allowed a new signup to
    // inherit another tenant's account.
    var profileRes;
    if (_authUser && _authUser.id) {
      profileRes = await _sb.from('profiles').select('*').eq('auth_user_id', _authUser.id).limit(1).maybeSingle();
      if (!profileRes.data) {
        var newProfile = await _sb.from('profiles').insert({
          name: _authUser.email.split('@')[0],
          email: _authUser.email,
          auth_user_id: _authUser.id
        }).select().single();
        if (newProfile.error) {
          console.error('Profile creation failed:', newProfile.error);
          _showSaveError('Could not set up your account. Please refresh and try again.');
          return;
        }
        profileRes = { data: newProfile.data };
      }
    } else {
      // No authenticated user: nothing to load (RLS blocks all reads anyway)
      profileRes = { data: null };
    }
    if (profileRes.data) {
      CREATOR.name = profileRes.data.name || '';
      CREATOR.brand = profileRes.data.brand || '';
      CREATOR.entity = profileRes.data.entity || '';
      CREATOR.email = profileRes.data.email || '';
      CREATOR.niche = profileRes.data.niche || '';
      // Media-kit copy (migration 013) — undefined pre-migration, defaults cover it
      CREATOR.mkAlignYes = Array.isArray(profileRes.data.mk_align_yes) ? profileRes.data.mk_align_yes : [];
      CREATOR.mkAlignNo = Array.isArray(profileRes.data.mk_align_no) ? profileRes.data.mk_align_no : [];
      CREATOR.mkInterests = Array.isArray(profileRes.data.mk_interests) ? profileRes.data.mk_interests : [];
      CREATOR.mkContactEmail = profileRes.data.mk_contact_email || '';
      // Invoicing fields (migration 011) — undefined pre-migration, defaults cover it
      CREATOR.businessAddress = profileRes.data.business_address || '';
      CREATOR.bankName = profileRes.data.bank_name || '';
      CREATOR.bankAccountHolder = profileRes.data.bank_account_holder || '';
      CREATOR.bankAccountNumber = profileRes.data.bank_account_number || '';
      CREATOR.bankRoutingNumber = profileRes.data.bank_routing_number || '';
      CREATOR.bankAccountType = profileRes.data.bank_account_type || '';
      CREATOR.invoiceNumbering = profileRes.data.invoice_numbering || 'per_client';
      CREATOR.invoicePrefix = profileRes.data.invoice_prefix || 'INV';
      // Document template (migration 015) — undefined pre-migration, defaults to classic
      CREATOR.invoiceTemplate = profileRes.data.invoice_template || 'classic';
      CREATOR._sbId = profileRes.data.id;
    }

    // Fetch platforms
    const platRes = await _sb.from('platforms').select('*').eq('user_id', CREATOR._sbId);
    if (platRes.data) {
      platRes.data.forEach(p => {
        const key = p.platform;
        if (CREATOR.platforms[key]) {
          CREATOR.platforms[key].handle = p.handle || '';
          CREATOR.platforms[key].followers = p.followers_display || String(p.followers);
          CREATOR.platforms[key].followersNum = p.followers || 0;
          CREATOR.platforms[key].engagement = p.engagement_rate ? p.engagement_rate + '%' : '0%';
          CREATOR.platforms[key].tier = p.tier || '';
          CREATOR.platforms[key].posts = p.posts || 0;
          CREATOR.platforms[key].likes = p.likes || '0';
          CREATOR.platforms[key].videos = p.videos || 0;
          CREATOR.platforms[key].connections = p.connections || 0;
          CREATOR.platforms[key].verified = p.verified || false;
          CREATOR.platforms[key].status = p.status || '';
          CREATOR.platforms[key].profileUrl = p.profile_url || '';
          CREATOR.platforms[key]._sbId = p.id;
        }
      });
    }

    // Fetch rate card settings
    const rcsRes = await _sb.from('rate_card_settings').select('*').eq('user_id', CREATOR._sbId).limit(1).single();
    if (rcsRes.data) {
      RATE_CARD.minimumRate = rcsRes.data.minimum_rate || 0;
      RATE_CARD.pricingRule = rcsRes.data.pricing_rule || '';
    }

    // Fetch rate cards
    const rcRes = await _sb.from('rate_cards').select('*').eq('user_id', CREATOR._sbId).order('sort_order');
    if (rcRes.data) {
      RATE_CARD.organic = []; RATE_CARD.ugc = []; RATE_CARD.tiktok = [];
      RATE_CARD.youtube = []; RATE_CARD.addOns = []; RATE_CARD.bundles = [];
      rcRes.data.forEach(r => {
        const item = { id: r.item_id, name: r.name, rate: r.rate || 0, platform: r.platform || '', pct: r.pct || null, range: r.rate_range || null, _sbId: r.id };
        if (RATE_CARD[r.category]) RATE_CARD[r.category].push(item);
      });
    }

    // Fetch deals + deal_history
    const dealsRes = await _sb.from('deals').select('*, deal_history(*)').eq('user_id', CREATOR._sbId).order('sort_order');
    if (dealsRes.data) {
      DEALS = dealsRes.data.map(d => ({
        _sbId: d.id,
        brand: d.brand || '',
        status: d.status || 'Lead',
        value: d.value || 0,
        contact: d.contact || '',
        email: d.email || '',
        agency: d.agency || '',
        campaign: d.campaign || '',
        scope: d.scope || '',
        deliverables: d.deliverables || '',
        term: d.term || '',
        notes: d.notes || '',
        lastContact: d.last_contact || '',
        contractStatus: d.contract_status || '',
        invoiced: d.invoiced || 0,
        paid: d.paid || 0,
        outstanding: d.outstanding || 0,
        negotiationHistory: (d.deal_history || [])
          .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.created_at || '').localeCompare(b.created_at || ''))
          .map(h => ({ date: h.date, text: h.text }))
      }));
    }


    // Fetch campaign results
    const crRes = await _sb.from('campaign_results').select('*').eq('user_id', CREATOR._sbId);
    if (crRes.data) {
      CAMPAIGN_RESULTS = crRes.data.map(c => ({
        _sbId: c.id, brand: c.brand || '', views: c.views || 0,
        ctr: c.ctr || null, conversion: c.conversion || null, revenue: c.revenue || 0
      }));
    }

    // Fetch outreach templates
    const otRes = await _sb.from('outreach_templates').select('*').eq('user_id', CREATOR._sbId).order('sort_order');
    if (otRes.data) {
      OUTREACH_TEMPLATES = {};
      otRes.data.forEach(t => {
        OUTREACH_TEMPLATES[t.template_key] = { title: t.title, body: t.body, _sbId: t.id };
      });
    }

    // Fetch calendar events
    const ceRes = await _sb.from('calendar_events').select('*').eq('user_id', CREATOR._sbId).order('date');
    if (ceRes.data) {
      CALENDAR_EVENTS = ceRes.data.map(e => ({
        _sbId: e.id, date: e.date || '', brand: e.brand || '',
        type: e.type || '', platform: e.platform || '', status: e.status || 'draft'
      }));
    }

    // Fetch monthly revenue
    const mrRes = await _sb.from('monthly_revenue').select('*').eq('user_id', CREATOR._sbId).order('year').order('created_at');
    if (mrRes.data) {
      MONTHLY_REVENUE = mrRes.data.map(r => ({
        _sbId: r.id, month: r.month + ' ' + r.year, earned: r.amount || 0
      }));
    }

    // Fetch audience data
    const adRes = await _sb.from('audience_data').select('*').eq('user_id', CREATOR._sbId);
    if (adRes.data) {
      adRes.data.forEach(row => {
        if (row.category === 'age') {
          const ageData = row.data || {};
          const entries = Object.entries(ageData).sort((a, b) => b[1] - a[1]);
          AUDIENCE_DATA.topAge = entries.length > 0 ? entries[0][0] + ' (' + entries[0][1] + '%)' : '';
          AUDIENCE_DATA.ageRange = entries.length >= 2 ? entries[0][0].split('-')[0] + '-' + entries[1][0].split('-')[1] : '';
        }
        if (row.category === 'gender') {
          const g = row.data || {};
          AUDIENCE_DATA.gender = { male: g.Male || 0, female: g.Female || 0 };
        }
        if (row.category === 'topCountries') {
          const c = row.data || {};
          AUDIENCE_DATA.topCountries = Object.entries(c).map(([name, pct]) => ({ name, pct })).sort((a, b) => b.pct - a.pct);
        }
        if (row.category === 'topCities') {
          // Store for future use
          AUDIENCE_DATA.topCities = row.data || {};
        }
      });
      // Interests live on the profile (mk_interests, migration 013)
      if (!AUDIENCE_DATA.interests || AUDIENCE_DATA.interests.length === 0) {
        AUDIENCE_DATA.interests = CREATOR.mkInterests || [];
      }
    }

    // Fetch inbox items
    const ibRes = await _sb.from('inbox_items').select('*').eq('user_id', CREATOR._sbId).order('created_at', { ascending: false });
    if (ibRes.data) {
      INBOX_ITEMS = ibRes.data.map((item, idx) => ({
        _sbId: item.id, id: idx + 1, brand: item.brand || '', contact: item.from_name || '',
        email: item.from_email || '', subject: item.subject || '', time: item.date + (item.time ? ', ' + item.time : ''),
        snippet: item.preview || '', status: item.status === 'new' ? 'needs_reply' : (item.status || 'read'),
        priority: 'medium', suggestedAction: item.suggested_action || 'reply',
        context: item.body || item.preview || ''
      }));
    }


    // Fetch contract rules
    const ctRes = await _sb.from('contract_rules').select('*').eq('user_id', CREATOR._sbId).order('sort_order');
    if (ctRes.data) {
      CONTRACT_RULES = ctRes.data.map(r => ({ _sbId: r.id, rule: r.rule }));
    }

    // Fetch tasks — table added in migration 010; tolerate a missing
    // table so the Tasks view can show setup instructions instead of erroring
    const tkRes = await _sb.from('tasks').select('*').eq('user_id', CREATOR._sbId).order('created_at', { ascending: false });
    if (tkRes.error) {
      // 42P01 = Postgres undefined_table, PGRST205 = PostgREST table not in schema cache
      _tasksTableMissing = (tkRes.error.code === '42P01' || tkRes.error.code === 'PGRST205');
      if (!_tasksTableMissing) console.error('tasks fetch error:', tkRes.error);
      TASKS = [];
    } else {
      _tasksTableMissing = false;
      TASKS = (tkRes.data || []).map(t => ({
        _sbId: t.id, title: t.title || '', details: t.details || '',
        dueDate: t.due_date || '', starred: !!t.starred, completed: !!t.completed,
        completedAt: t.completed_at || '', createdAt: t.created_at || ''
      }));
    }

    // Fetch clients — table added in migration 011; a missing table means
    // the invoicing migration hasn't run, so the Invoices editor shows
    // setup instructions instead of erroring
    const clRes = await _sb.from('clients').select('*').eq('user_id', CREATOR._sbId).order('name');
    if (clRes.error) {
      _invoicingMigrationMissing = (clRes.error.code === '42P01' || clRes.error.code === 'PGRST205');
      if (!_invoicingMigrationMissing) console.error('clients fetch error:', clRes.error);
      CLIENTS = [];
    } else {
      _invoicingMigrationMissing = false;
      CLIENTS = (clRes.data || []).map(c => ({
        _sbId: c.id, name: c.name || '', company: c.company || '', email: c.email || '',
        billingAddress: c.billing_address || '', invoicePrefix: c.invoice_prefix || ''
      }));
    }

    // Fetch outreach lists + targets — tables added in migration 012; a
    // missing table means the outreach migration hasn't run, so the
    // Outreach tab shows setup instructions instead of erroring
    const orlRes = await _sb.from('outreach_lists').select('*').eq('user_id', CREATOR._sbId).order('sort_order');
    if (orlRes.error) {
      _outreachMigrationMissing = (orlRes.error.code === '42P01' || orlRes.error.code === 'PGRST205');
      if (!_outreachMigrationMissing) console.error('outreach_lists fetch error:', orlRes.error);
      OUTREACH_LISTS = [];
    } else {
      _outreachMigrationMissing = false;
      OUTREACH_LISTS = (orlRes.data || []).map(l => ({
        _sbId: l.id, name: l.name || '', sortOrder: l.sort_order || 0
      }));
    }
    if (!_outreachMigrationMissing) {
      const ortRes = await _sb.from('outreach_targets').select('*').eq('user_id', CREATOR._sbId).order('name');
      if (ortRes.error) {
        _outreachMigrationMissing = (ortRes.error.code === '42P01' || ortRes.error.code === 'PGRST205');
        if (!_outreachMigrationMissing) console.error('outreach_targets fetch error:', ortRes.error);
        OUTREACH_TARGETS = [];
      } else {
        OUTREACH_TARGETS = (ortRes.data || []).map(_mapOutreachRow);
      }
    } else {
      OUTREACH_TARGETS = [];
    }

    // Fetch invoices (table exists since 001; new 011 columns are simply
    // absent pre-migration and the mapper defaults them)
    const invRes = await _sb.from('invoices').select('*').eq('user_id', CREATOR._sbId).order('date', { ascending: false });
    if (invRes.error) {
      console.error('invoices fetch error:', invRes.error);
      INVOICE_DATA = [];
    } else {
      INVOICE_DATA = (invRes.data || []).map(_mapInvoiceRow);
    }

    // Update sidebar with loaded profile data
    updateSidebarUser();

    console.log('All data loaded from Supabase:', {
      profile: CREATOR.name,
      deals: DEALS.length,
      inbox: INBOX_ITEMS.length,
      invoices: (INVOICE_DATA || []).length,
      calendar: CALENDAR_EVENTS.length,
      rateCards: RATE_CARD.organic.length + '+' + RATE_CARD.ugc.length,
      monthlyRev: MONTHLY_REVENUE.length
    });

  } catch (err) {
    console.error('sbFetchAllData error:', err);
    _showSaveError('Failed to load data: ' + (err.message || 'Unknown error'));
  } finally {
    const loadingEl = document.getElementById('sb-loading-overlay');
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

/* ---- SUPABASE CRUD: DEALS ---- */
async function sbAddDeal(dealData) {
  if (!_sb || !CREATOR._sbId) return null;
  const { data, error } = await _sb.from('deals').insert({
    user_id: CREATOR._sbId, brand: dealData.brand, status: dealData.status || 'Lead',
    mapped_status: mapStatus(dealData.status || 'Lead'), value: dealData.value || 0,
    contact: dealData.contact || '', email: dealData.email || '', agency: dealData.agency || '',
    campaign: dealData.campaign || '', scope: dealData.scope || '', deliverables: dealData.deliverables || '',
    term: dealData.term || '', notes: dealData.notes || '', last_contact: dealData.lastContact || todayISO(),
    contract_status: dealData.contractStatus || '', invoiced: dealData.invoiced || 0,
    paid: dealData.paid || 0, outstanding: dealData.outstanding || 0,
    sort_order: DEALS.length
  }).select().single();
  if (error) { _showSaveError('Failed to add deal'); console.error(error); return null; }
  _showSaveSuccess();
  return data;
}

async function sbUpdateDeal(sbId, updates) {
  if (!_sb) return false;
  const mapped = {};
  if ('status' in updates) { mapped.status = updates.status; mapped.mapped_status = mapStatus(updates.status); }
  if ('value' in updates) mapped.value = updates.value;
  if ('contact' in updates) mapped.contact = updates.contact;
  if ('email' in updates) mapped.email = updates.email;
  if ('notes' in updates) mapped.notes = updates.notes;
  if ('lastContact' in updates) mapped.last_contact = updates.lastContact;
  if ('paid' in updates) mapped.paid = updates.paid;
  if ('outstanding' in updates) mapped.outstanding = updates.outstanding;
  if ('invoiced' in updates) mapped.invoiced = updates.invoiced;
  if ('contractStatus' in updates) mapped.contract_status = updates.contractStatus;
  if ('scope' in updates) mapped.scope = updates.scope;
  if ('deliverables' in updates) mapped.deliverables = updates.deliverables;
  if ('term' in updates) mapped.term = updates.term;
  if ('agency' in updates) mapped.agency = updates.agency;
  if ('campaign' in updates) mapped.campaign = updates.campaign;
  if ('brand' in updates) mapped.brand = updates.brand;
  const { error } = await _sb.from('deals').update(mapped).eq('id', sbId);
  if (error) { _showSaveError('Failed to update deal'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbAddDealHistory(dealSbId, date, text) {
  if (!_sb) return;
  const { error } = await _sb.from('deal_history').insert({ deal_id: dealSbId, date: date, text: text });
  if (error) console.error('deal_history insert error:', error);
}

/* ---- SUPABASE CRUD: INBOX ---- */
async function sbUpdateInboxStatus(sbId, status) {
  if (!_sb) return;
  await _sb.from('inbox_items').update({ status: status }).eq('id', sbId);
  _showSaveSuccess();
}

/* ---- SUPABASE CRUD: CALENDAR EVENTS ---- */
async function sbAddCalendarEvent(data) {
  if (!_sb || !CREATOR._sbId) return null;
  const { data: row, error } = await _sb.from('calendar_events').insert({
    user_id: CREATOR._sbId, date: data.date, brand: data.brand || '',
    type: data.type || '', platform: data.platform || '', status: data.status || 'draft'
  }).select().single();
  if (error) { _showSaveError('Failed to add event'); return null; }
  _showSaveSuccess();
  return row;
}

async function sbDeleteCalendarEvent(sbId) {
  if (!_sb) return;
  await _sb.from('calendar_events').delete().eq('id', sbId);
  _showSaveSuccess();
}

/* ---- SUPABASE CRUD: TASKS ---- */
async function sbAddTask(data) {
  if (!_sb || !CREATOR._sbId) return null;
  // user_id is stamped by the DB default (current_profile_id) per the
  // multi-tenancy rules — inserts must not pass it manually
  const { data: row, error } = await _sb.from('tasks').insert({
    title: data.title, details: data.details || '', due_date: data.dueDate || null
  }).select().single();
  if (error) { _showSaveError('Failed to add task'); console.error(error); return null; }
  _showSaveSuccess();
  return row;
}

async function sbUpdateTask(sbId, updates) {
  if (!_sb || !sbId) return false;
  const { error } = await _sb.from('tasks').update(updates).eq('id', sbId);
  if (error) { _showSaveError('Failed to update task'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbDeleteTasks(sbIds) {
  if (!_sb || !sbIds.length) return false;
  const { error } = await _sb.from('tasks').delete().in('id', sbIds);
  if (error) { _showSaveError('Failed to delete'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

/* ---- SUPABASE CRUD: INVOICES ---- */
// user_id is stamped by the DB default (current_profile_id) per the
// multi-tenancy rules — inserts must not pass it manually
async function sbAddInvoice(payload) {
  if (!_sb || !CREATOR._sbId) return null;
  const { data: row, error } = await _sb.from('invoices').insert(payload).select().single();
  if (error) { _showSaveError('Failed to add invoice'); console.error(error); return null; }
  _showSaveSuccess();
  return row;
}

async function sbUpdateInvoice(sbId, updates) {
  if (!_sb || !sbId) return false;
  const { error } = await _sb.from('invoices').update(updates).eq('id', sbId);
  if (error) { _showSaveError('Failed to update invoice'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbDeleteInvoice(sbId) {
  if (!_sb || !sbId) return false;
  const { error } = await _sb.from('invoices').delete().eq('id', sbId);
  if (error) { _showSaveError('Failed to delete invoice'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

/* ---- SUPABASE CRUD: CLIENTS ---- */
async function sbAddClient(data) {
  if (!_sb || !CREATOR._sbId) return null;
  const { data: row, error } = await _sb.from('clients').insert({
    name: data.name, company: data.company || '', email: data.email || '',
    billing_address: data.billingAddress || '', invoice_prefix: data.invoicePrefix || ''
  }).select().single();
  if (error) { _showSaveError('Failed to add client'); console.error(error); return null; }
  _showSaveSuccess();
  return row;
}

async function sbUpdateClient(sbId, updates) {
  if (!_sb || !sbId) return false;
  const { error } = await _sb.from('clients').update(updates).eq('id', sbId);
  if (error) { _showSaveError('Failed to update client'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbDeleteClient(sbId) {
  if (!_sb || !sbId) return false;
  const { error } = await _sb.from('clients').delete().eq('id', sbId);
  if (error) { _showSaveError('Failed to delete client'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

/* ---- SUPABASE CRUD: OUTREACH ---- */
// user_id is stamped by the DB default (current_profile_id) per the
// multi-tenancy rules — inserts must not pass it manually
async function sbAddOutreachTarget(payload) {
  if (!_sb || !CREATOR._sbId) return null;
  const { data: row, error } = await _sb.from('outreach_targets').insert(payload).select().single();
  if (error) { _showSaveError('Failed to add target'); console.error(error); return null; }
  _showSaveSuccess();
  return row;
}

async function sbUpdateOutreachTarget(sbId, updates) {
  if (!_sb || !sbId) return false;
  const { error } = await _sb.from('outreach_targets').update(updates).eq('id', sbId);
  if (error) { _showSaveError('Failed to update target'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbDeleteOutreachTarget(sbId) {
  if (!_sb || !sbId) return false;
  const { error } = await _sb.from('outreach_targets').delete().eq('id', sbId);
  if (error) { _showSaveError('Failed to delete target'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbAddOutreachList(name, sortOrder) {
  if (!_sb || !CREATOR._sbId) return null;
  const { data: row, error } = await _sb.from('outreach_lists').insert({
    name: name, sort_order: sortOrder || 0
  }).select().single();
  if (error) { _showSaveError('Failed to add list'); console.error(error); return null; }
  _showSaveSuccess();
  return row;
}

async function sbUpdateOutreachList(sbId, updates) {
  if (!_sb || !sbId) return false;
  const { error } = await _sb.from('outreach_lists').update(updates).eq('id', sbId);
  if (error) { _showSaveError('Failed to update list'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbDeleteOutreachList(sbId) {
  if (!_sb || !sbId) return false;
  const { error } = await _sb.from('outreach_lists').delete().eq('id', sbId);
  if (error) { _showSaveError('Failed to delete list'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

/* ---- SUPABASE CRUD: PROFILE ---- */
async function sbUpdateProfile(updates) {
  if (!_sb || !CREATOR._sbId) return false;
  const { error } = await _sb.from('profiles').update(updates).eq('id', CREATOR._sbId);
  if (error) { _showSaveError('Failed to update profile'); return false; }
  _showSaveSuccess();
  return true;
}

/* ---- SUPABASE CRUD: PLATFORM STATS ---- */
async function sbUpdatePlatform(platformKey, updates) {
  if (!_sb || !CREATOR.platforms[platformKey]?._sbId) return false;
  const { error } = await _sb.from('platforms').update(updates).eq('id', CREATOR.platforms[platformKey]._sbId);
  if (error) { _showSaveError('Failed to update platform'); return false; }
  _showSaveSuccess();
  return true;
}

/* ---- SUPABASE CRUD: RATE CARDS ---- */
async function sbUpdateRateCard(sbId, updates) {
  if (!_sb) return false;
  const { error } = await _sb.from('rate_cards').update(updates).eq('id', sbId);
  if (error) { _showSaveError('Failed to update rate'); return false; }
  _showSaveSuccess();
  return true;
}


function getHash() {
  return (window.location.hash || "#dashboard").replace("#", "");
}

function navigate(view) {
  /* Handle sub-routes: board/UUID, script/UUID, shared/TOKEN, bshared/TOKEN */
  if (view.startsWith('bshared/')) {
    // Public shared-board link — works logged out, sidebar hidden
    var bsClean = view.split('?')[0];
    var bsToken = bsClean.split('/')[1];
    var bsMode = bsClean.split('/')[2] || 'view';
    document.querySelectorAll('.view').forEach(function(v) { v.style.display = 'none'; v.classList.remove('active'); });
    var bsEl = document.getElementById('view-board-editor');
    if (bsEl) { bsEl.style.display = 'block'; bsEl.classList.add('active'); }
    document.getElementById('sidebar').style.display = 'none';
    var bsMc = document.querySelector('.main') || document.getElementById('mainContent');
    if (bsMc) bsMc.style.marginLeft = '0';
    if (typeof renderSharedBoard === 'function') renderSharedBoard(bsToken, bsMode);
    return;
  }
  if (view.startsWith('board/')) {
    var boardId = view.split('/')[1];
    document.querySelectorAll('.view').forEach(function(v) { v.style.display = 'none'; v.classList.remove('active'); });
    var bdEl = document.getElementById('view-board-editor');
    if (bdEl) { bdEl.style.display = 'block'; bdEl.classList.add('active'); }
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    var navB = document.querySelector('[data-view="boards"]');
    if (navB) navB.classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    var ovB = document.querySelector('.sidebar-overlay'); if (ovB) ovB.classList.remove('open');
    if (typeof renderBoardEditor === 'function') renderBoardEditor(boardId);
    return;
  }
  if (view.startsWith('script/')) {
    var scriptId = view.split('/')[1];
    document.querySelectorAll('.view').forEach(function(v) { v.style.display = 'none'; v.classList.remove('active'); });
    var edEl = document.getElementById('view-script-editor');
    if (edEl) { edEl.style.display = 'block'; edEl.classList.add('active'); }
    document.querySelectorAll('.nav-item').forEach(function(n) { n.classList.remove('active'); });
    var navS = document.querySelector('[data-view="scripts"]');
    if (navS) navS.classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    var ov = document.querySelector('.sidebar-overlay'); if (ov) ov.classList.remove('open');
    renderScriptEditor(scriptId);
    return;
  }
  if (view.startsWith('shared/')) {
    // Strip any query string that may have gotten into the hash
    var cleanView = view.split('?')[0];
    var shareToken = cleanView.split('/')[1];
    var shareMode = (cleanView.split('/')[2]) || 'view';
    document.querySelectorAll('.view').forEach(function(v) { v.style.display = 'none'; v.classList.remove('active'); });
    var shEl = document.getElementById('view-shared-script');
    if (shEl) { shEl.style.display = 'block'; shEl.classList.add('active'); }
    document.getElementById('sidebar').style.display = 'none';
    var mc = document.querySelector('.main') || document.getElementById('mainContent');
    if (mc) mc.style.marginLeft = '0';
    renderSharedScript(shareToken, shareMode);
    return;
  }

  /* Restore sidebar if it was hidden by shared view */
  document.getElementById('sidebar').style.display = '';
  var mc2 = document.querySelector('.main') || document.getElementById('mainContent');
  if (mc2) mc2.style.marginLeft = '';

  document.querySelectorAll(".view").forEach(v => {
    v.style.display = "none";
    v.classList.remove("active");
  });
  const el = document.getElementById("view-" + view);
  if (el) {
    el.style.display = "block";
    el.classList.add("active");
  }
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const navEl = document.querySelector('[data-view="' + view + '"]');
  if (navEl) navEl.classList.add("active");

  // Close mobile sidebar
  document.getElementById("sidebar").classList.remove("open");
  const overlay = document.querySelector(".sidebar-overlay");
  if (overlay) overlay.classList.remove("open");

  renderView(view);
}

window.addEventListener("hashchange", function() {
  // Only navigate if the app shell is visible (user is authenticated)
  var appEl = document.getElementById('appShell');
  if (appEl && appEl.style.display !== 'none') navigate(getHash());
});

/* ---- THEME ---- */
document.getElementById("themeToggle").addEventListener("click", () => {
  const html = document.documentElement;
  const isDark = html.getAttribute("data-theme") === "dark";
  html.setAttribute("data-theme", isDark ? "light" : "dark");
  // Re-render charts if on dashboard
  if (getHash() === "dashboard") renderDashboard();
});

/* ---- MOBILE NAV ---- */
(function initMobileNav() {
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  document.body.appendChild(overlay);

  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
    overlay.classList.toggle("open");
  });
  overlay.addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("open");
    overlay.classList.remove("open");
  });
})();

/* ---- RENDER VIEWS ---- */
let chartsRendered = {};

function renderView(view) {
  switch (view) {
    case "dashboard": renderDashboard(); break;
    case "revenue": renderRevenue(); break;
    case "mediakit": renderMediaKit(); break;
    case "analytics": renderAnalytics(); break;
    case "outreach": if (typeof renderOutreach === "function") renderOutreach(); break;
    case "inbox": renderInbox(); break;
    case "calendar": renderCalendar(); break;
    case "settings": renderSettings(); break;
    case "scripts": renderScripts(); break;
    case "boards": if (typeof renderBoards === "function") renderBoards(); break;
    case "contracts": renderContracts(); break;
    case "invoices": renderInvoices(); break;
    case "tasks": renderTasks(); break;
  }
}

/* ---- DASHBOARD ---- */

function renderDashboard() {
  const container = document.getElementById("view-dashboard");

  // Compute KPIs from DEALS
  const signedRevenue = DEALS.filter(d => ["SIGNED", "ACTIVE - In Production", "ACTIVE — In Production", "Completed"].includes(d.status))
    .reduce((s, d) => s + parseValue(d.value), 0);
  const totalPaid = DEALS.reduce((s, d) => s + (Number(d.paid) || 0), 0);
  const totalOutstanding = DEALS.reduce((s, d) => s + (Number(d.outstanding) || 0), 0);
  const activeDealCount = DEALS.filter(d => d.status && !["Declined", "Dead", "Lost"].includes(d.status)).length;
  const avgValue = activeDealCount ? (DEALS.filter(d => d.value).reduce((s, d) => s + parseValue(d.value), 0) / DEALS.filter(d => d.value).length) : 0;

  // Upcoming events from CALENDAR_EVENTS
  const today = new Date().toISOString().split('T')[0];
  const upcoming = (CALENDAR_EVENTS || [])
    .filter(e => e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Dashboard</h1>
        <p class="view-subtitle">${formatDate(new Date())}</p>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="dashboard-kpis">
      <div class="kpi-card kpi-primary">
        <span class="kpi-label">Signed Revenue</span>
        <span class="kpi-value">${formatCurrency(signedRevenue)}</span>
        <span class="kpi-sub">${DEALS.filter(d => ["SIGNED","Completed"].includes(d.status)).length} deals closed</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Paid</span>
        <span class="kpi-value">${formatCurrency(totalPaid)}</span>
        <span class="kpi-sub">payments received</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Outstanding</span>
        <span class="kpi-value">${formatCurrency(totalOutstanding)}</span>
        <span class="kpi-sub">awaiting payment</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Active Deals</span>
        <span class="kpi-value">${activeDealCount}</span>
        <span class="kpi-sub">avg ${formatCurrency(avgValue)}</span>
      </div>
    </div>

    <!-- Monthly revenue chart -->
    <div class="dashboard-row">
      <div class="dashboard-card dashboard-chart-card">
        <div class="dashboard-card-header">
          <h3>Monthly Revenue</h3>
          <a href="#revenue" class="dashboard-card-link">View Revenue →</a>
        </div>
        <div class="chart-wrap">
          <canvas id="dashboardRevChart" height="180"></canvas>
        </div>
      </div>

      <!-- Upcoming from calendar -->
      <div class="dashboard-card dashboard-upcoming-card">
        <div class="dashboard-card-header">
          <h3>Upcoming</h3>
          <a href="#calendar" class="dashboard-card-link">Calendar →</a>
        </div>
        <div class="dashboard-upcoming">
          ${upcoming.length === 0 ? `
            <div class="dashboard-empty">
              <p>Nothing scheduled.</p>
              <a href="#calendar" class="btn btn-secondary btn-sm">Add event</a>
            </div>
          ` : upcoming.map(e => `
            <div class="upcoming-item">
              <div class="upcoming-date">
                <span class="upcoming-month">${_shortMonth(e.date)}</span>
                <span class="upcoming-day">${_shortDay(e.date)}</span>
              </div>
              <div class="upcoming-body">
                <div class="upcoming-brand">${_esc(e.brand || 'Event')}</div>
                <div class="upcoming-meta">${_esc(e.type || '')}${e.platform ? ' · ' + _esc(e.platform) : ''}</div>
              </div>
              <span class="upcoming-status status-${_slug(e.status || 'draft')}">${_esc(e.status || 'draft')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Draw the revenue chart
  setTimeout(() => renderDashboardRevChart(), 30);
}

function renderDashboardRevChart() {
  const canvas = document.getElementById('dashboardRevChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const data = MONTHLY_REVENUE || [];
  const labels = data.map(m => m.month);
  const values = data.map(m => Number(m.earned) || 0);

  try {
    if (canvas._chartInstance) canvas._chartInstance.destroy();
  } catch (e) {}

  const isDark = document.documentElement.dataset.theme === 'dark';
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#C73539';
  const teal = getComputedStyle(document.documentElement).getPropertyValue('--teal').trim() || '#2A6B5A';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#B8B4AC' : '#5C5852';

  canvas._chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Revenue',
        data: values,
        backgroundColor: teal + '80',
        borderColor: teal,
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatCurrency(ctx.parsed.y)
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 11 }, callback: v => '$' + (v/1000).toFixed(0) + 'K' },
          beginAtZero: true
        }
      }
    }
  });
}

function _shortMonth(iso) {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleString('en-US', { month: 'short' });
  } catch { return ''; }
}
function _shortDay(iso) {
  try {
    return new Date(iso + 'T00:00:00').getDate();
  } catch { return ''; }
}
function _slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/* ---- REVENUE TRACKER ---- */
let MONTHLY_REVENUE = [];

function renderRevenue() {
  const container = document.getElementById("view-revenue");
  const totalPaid = DEALS.reduce((s, d) => s + (d.paid || 0), 0);
  const totalOutstanding = DEALS.reduce((s, d) => s + (d.outstanding || 0), 0);
  const totalInvoiced = DEALS.reduce((s, d) => s + (d.invoiced || 0), 0);
  const projectedPipeline = DEALS.filter(d => !["Declined", "Completed", "Cold"].includes(mapStatus(d.status))).reduce((s, d) => s + parseValue(d.value), 0);
  const invoicedDeals = DEALS.filter(d => (d.invoiced || 0) > 0);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Revenue</h1>
        <p class="view-subtitle">Track earnings, invoices, and financial performance</p>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total Earned</span>
        <span class="kpi-value" style="color:var(--green)">${formatCurrency(totalPaid)}</span>
        <span class="kpi-delta up">Payments received</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Outstanding</span>
        <span class="kpi-value" style="color:var(--accent)">${formatCurrency(totalOutstanding)}</span>
        <span class="kpi-delta neutral">Awaiting payment</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Total Invoiced</span>
        <span class="kpi-value">${formatCurrency(totalInvoiced)}</span>
        <span class="kpi-delta neutral">All time</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Pipeline Value</span>
        <span class="kpi-value" style="color:var(--teal)">${formatCurrency(projectedPipeline)}</span>
        <span class="kpi-delta up">Active deals</span>
      </div>
    </div>

    <div class="chart-row">
      <div class="card">
        <div class="card-header"><span class="card-title">Monthly Revenue</span></div>
        <div class="chart-container"><canvas id="chartMonthlyRevenue"></canvas></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Payment Status</span></div>
        <div class="chart-container"><canvas id="chartPaymentStatus"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Invoice Tracker</span>
        <span class="badge active">${invoicedDeals.length} invoiced</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Brand</th><th>Invoice Amount</th><th>Paid</th><th>Outstanding</th><th>Status</th><th>Contract</th></tr></thead>
          <tbody>
            ${invoicedDeals.map(d => {
              let payStatus = "Unpaid";
              let payClass = "followup";
              if ((d.paid || 0) >= (d.invoiced || 0) && (d.invoiced || 0) > 0) { payStatus = "Paid"; payClass = "active"; }
              else if ((d.paid || 0) > 0) { payStatus = "Partial"; payClass = "negotiating"; }
              return `<tr>
                <td style="font-weight:600;color:var(--text-primary)">${d.brand}</td>
                <td style="font-variant-numeric:tabular-nums">${formatCurrency(d.invoiced || 0)}</td>
                <td style="font-variant-numeric:tabular-nums;color:var(--green)">${formatCurrency(d.paid || 0)}</td>
                <td style="font-variant-numeric:tabular-nums;color:${(d.outstanding || 0) > 0 ? "var(--accent)" : "var(--text-muted)"}">${formatCurrency(d.outstanding || 0)}</td>
                <td><span class="badge ${payClass}">${payStatus}</span></td>
                <td style="color:var(--text-secondary)">${d.contractStatus || "N/A"}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Expense Tracking</span>
        <span class="badge" style="background:var(--purple-dim);color:var(--purple)">Coming Soon</span>
      </div>
      <div class="expense-placeholder">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
        <p style="color:var(--text-secondary);margin-top:12px">Track production costs, software subscriptions, and calculate net profit</p>
        <p style="color:var(--text-muted);font-size:12px;margin-top:4px">Automatically categorize expenses for tax-ready reporting</p>
      </div>
    </div>
  `;

  renderRevenueCharts(totalPaid, totalOutstanding, projectedPipeline - totalInvoiced);
}

function renderRevenueCharts(paid, outstanding, projected) {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const textColor = isDark ? "#a8a29e" : "#5a5550";

  if (chartsRendered.monthlyRev) chartsRendered.monthlyRev.destroy();
  if (chartsRendered.payStatus) chartsRendered.payStatus.destroy();

  const ctx1 = document.getElementById("chartMonthlyRevenue");
  if (ctx1) {
    chartsRendered.monthlyRev = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: MONTHLY_REVENUE.map(m => m.month),
        datasets: [{
          data: MONTHLY_REVENUE.map(m => m.earned),
          backgroundColor: MONTHLY_REVENUE.map(m => m.earned > 0 ? "#4f98a3" : "rgba(79,152,163,0.2)"),
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: "'General Sans'", size: 11 }, callback: function(v) { return "$" + (v / 1000) + "K"; } }
          },
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: "'General Sans'", size: 11 } }
          }
        }
      }
    });
  }

  const ctx2 = document.getElementById("chartPaymentStatus");
  if (ctx2) {
    chartsRendered.payStatus = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: ["Paid", "Outstanding", "Projected"],
        datasets: [{
          data: [paid, outstanding, Math.max(0, projected)],
          backgroundColor: ["#5db87a", "#d4a853", "rgba(79,152,163,0.4)"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: {
          legend: { position: "right", labels: { color: textColor, font: { family: "'General Sans'", size: 11 }, padding: 8, boxWidth: 12 } }
        }
      }
    });
  }
}

/* ---- MEDIA KIT ---- */
let AUDIENCE_DATA = {
  ageRange: "", topAge: "", gender: { male: 0, female: 0 },
  topCountries: [], interests: []
};

function renderMediaKit() {
  const container = document.getElementById("view-mediakit");
  const totalFollowers = Object.values(CREATOR.platforms).reduce((s, p) => s + p.followersNum, 0);

  // Identity comes from the profile + platforms — nothing hardcoded
  const mkBrand = CREATOR.brand || CREATOR.name || 'Your Brand';
  const mkInitials = (CREATOR.brand || CREATOR.name || '').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const mkIgHandle = (CREATOR.platforms.instagram.handle || '').replace(/^@/, '');
  const mkContact = CREATOR.mkContactEmail || CREATOR.email || '';
  const mkAlignYes = CREATOR.mkAlignYes || [];
  const mkAlignNo = CREATOR.mkAlignNo || [];

  const mkPlatformDefs = [
    { key: 'instagram', cls: 'ig', icon: SKETCHY_ICONS.instagram, label: 'Followers', sub: p => p.engagement + ' Engagement', url: h => 'https://instagram.com/' + h },
    { key: 'tiktok', cls: 'tt', icon: SKETCHY_ICONS.tiktok, label: 'Followers', sub: p => (p.likes || '0') + ' Total Likes', url: h => 'https://tiktok.com/@' + h },
    { key: 'youtube', cls: 'yt', icon: SKETCHY_ICONS.youtube, label: 'Subscribers', sub: p => (p.videos || 0) + ' Videos', url: h => 'https://youtube.com/@' + h },
    { key: 'twitter', cls: 'tw', icon: SKETCHY_ICONS.twitter, label: 'Followers', sub: () => '', url: h => 'https://x.com/' + h },
    { key: 'linkedin', cls: 'li', icon: SKETCHY_ICONS.linkedin, label: 'Followers', sub: p => (p.connections || 0) + ' Connections', url: h => 'https://linkedin.com/in/' + h }
  ];
  const mkPlatformCards = mkPlatformDefs
    .filter(d => { const p = CREATOR.platforms[d.key]; return p && (p.handle || p.followersNum > 0); })
    .map(d => {
      const p = CREATOR.platforms[d.key];
      const handle = (p.handle || '').replace(/^@/, '');
      const href = p.profileUrl || (handle ? d.url(handle) : '');
      const sub = d.sub(p);
      const inner = `
            <div class="platform-icon ${d.cls}">${d.icon}</div>
            <div class="mk-platform-details">
              <div class="mk-platform-stat">${_esc(p.followers)}</div>
              <div class="mk-platform-label">${d.label}</div>
              ${sub ? `<div class="mk-platform-er">${_esc(sub)}</div>` : ''}
            </div>`;
      return href
        ? `<a href="${_esc(href)}" target="_blank" rel="noopener" class="mk-platform-card mk-platform-link">${inner}</a>`
        : `<div class="mk-platform-card">${inner}</div>`;
    }).join('');

  const mkRateItems = [...RATE_CARD.organic, ...RATE_CARD.ugc, ...RATE_CARD.bundles];

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Media Kit</h1>
        <p class="view-subtitle">Share with brands to showcase your reach and rates</p>
      </div>
      <button class="btn-export-pdf" onclick="exportMediaKitPDF()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export PDF
      </button>
    </div>

    <div class="media-kit">
      <div class="mk-hero">
        <div class="mk-hero-left">
          <div class="mk-avatar">${_esc(mkInitials)}</div>
          <div>
            <div class="mk-brand-name">
              ${_esc(mkBrand)}
              ${CREATOR.platforms.instagram.verified ? '<svg class="mk-verified" width="18" height="18" viewBox="0 0 24 24" fill="var(--teal)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>' : ''}
            </div>
            ${mkIgHandle ? `<div class="mk-handle">@${_esc(mkIgHandle)}</div>` : ''}
            ${CREATOR.niche ? `<div class="mk-niche">${_esc(CREATOR.niche)}</div>` : '<div class="mk-niche" style="color:var(--text-faint)">Add your niche in Settings \u2192 Profile</div>'}
          </div>
        </div>
        <div class="mk-hero-stats">
          <div class="mk-total-reach">
            <span class="mk-reach-num">${(totalFollowers / 1000).toFixed(1)}K</span>
            <span class="mk-reach-label">Total Reach</span>
          </div>
        </div>
      </div>

      <div class="mk-section">
        <h3 class="mk-section-title">Platform Presence</h3>
        ${mkPlatformCards
          ? `<div class="mk-platforms">${mkPlatformCards}</div>`
          : '<p style="color:var(--text-muted);font-size:13px">No platforms added yet. Add your handles and stats in Settings → Platforms.</p>'}
      </div>

      <div class="mk-row">
        <div class="mk-section">
          <h3 class="mk-section-title">Audience Demographics</h3>
          ${(!AUDIENCE_DATA.ageRange && !AUDIENCE_DATA.topCountries.length && !AUDIENCE_DATA.gender.male && !AUDIENCE_DATA.gender.female)
            ? '<p style="color:var(--text-muted);font-size:13px">No audience data yet. Demographics will appear once audience data is added to your account.</p>'
            : `<div class="mk-demo-grid">
            <div class="mk-demo-item">
              <span class="mk-demo-label">Age Range</span>
              <span class="mk-demo-value">${AUDIENCE_DATA.ageRange}</span>
              <span class="mk-demo-detail">Core: ${AUDIENCE_DATA.topAge}</span>
            </div>
            <div class="mk-demo-item">
              <span class="mk-demo-label">Gender Split</span>
              <div class="mk-gender-bar">
                <div class="mk-gender-male" style="width:${AUDIENCE_DATA.gender.male}%">${AUDIENCE_DATA.gender.male}% M</div>
                <div class="mk-gender-female" style="width:${AUDIENCE_DATA.gender.female}%">${AUDIENCE_DATA.gender.female}% F</div>
              </div>
            </div>
            <div class="mk-demo-item">
              <span class="mk-demo-label">Top Locations</span>
              ${AUDIENCE_DATA.topCountries.map(c => `
                <div class="mk-country-row">
                  <span>${c.name}</span>
                  <div class="mk-country-bar"><div class="mk-country-fill" style="width:${c.pct}%"></div></div>
                  <span class="mk-country-pct">${c.pct}%</span>
                </div>
              `).join("")}
            </div>
          </div>`}
        </div>

        <div class="mk-section">
          <h3 class="mk-section-title">Brand Alignment</h3>
          <div class="mk-tags">
            ${AUDIENCE_DATA.interests.map(i => `<span class="mk-tag">${_esc(i)}</span>`).join("")}
          </div>
          ${(mkAlignYes.length || mkAlignNo.length) ? `
          <div class="mk-alignment-list">
            ${mkAlignYes.map(item => `<div class="mk-alignment-item mk-align-yes"><span class="mk-align-icon">\u2713</span><span>${_esc(item)}</span></div>`).join('')}
            ${mkAlignNo.map(item => `<div class="mk-alignment-item mk-align-no"><span class="mk-align-icon">\u2717</span><span>${_esc(item)}</span></div>`).join('')}
          </div>` : '<p style="color:var(--text-muted);font-size:13px">Tell brands what fits and what doesn\'t in Settings \u2192 Profile \u2192 Media Kit.</p>'}
        </div>
      </div>

      <div class="mk-section">
        <h3 class="mk-section-title">Campaign Performance</h3>
        ${!CAMPAIGN_RESULTS.length
          ? '<p style="color:var(--text-muted);font-size:13px">No campaign results yet. Past brand campaigns will show here.</p>'
          : `<div class="mk-campaigns">
          ${CAMPAIGN_RESULTS.map(c => `
            <div class="mk-campaign-card">
              <div class="mk-campaign-brand">${c.brand}</div>
              <div class="mk-campaign-stats">
                <div class="mk-camp-stat">
                  <span class="mk-camp-value">${c.views ? (c.views >= 1000000 ? (c.views / 1000000).toFixed(1) + "M" : (c.views / 1000).toFixed(0) + "K") : "\u2014"}</span>
                  <span class="mk-camp-label">Views</span>
                </div>
                <div class="mk-camp-stat">
                  <span class="mk-camp-value">${c.ctr || "\u2014"}</span>
                  <span class="mk-camp-label">CTR</span>
                </div>
                <div class="mk-camp-stat">
                  <span class="mk-camp-value">${c.conversion || "\u2014"}</span>
                  <span class="mk-camp-label">Conv.</span>
                </div>
                ${c.revenue ? `<div class="mk-camp-stat"><span class="mk-camp-value" style="color:var(--green)">${formatCurrency(c.revenue)}</span><span class="mk-camp-label">Revenue</span></div>` : ""}
              </div>
            </div>
          `).join("")}
        </div>`}
      </div>

      <div class="mk-section">
        <h3 class="mk-section-title">Rates</h3>
        ${mkRateItems.length ? `
        <div class="mk-rates">
          ${mkRateItems.map(r => `<div class="mk-rate-card"><div class="mk-rate-name">${_esc(r.name)}</div><div class="mk-rate-price">${r.rate ? '$' + r.rate.toLocaleString('en-US') : (r.range ? _esc(r.range) : "Let's talk")}</div></div>`).join('')}
        </div>
        <p style="color:var(--text-muted);font-size:12px;margin-top:12px">All pricing is flat-rate. Licensing, exclusivity, and paid ad usage rights available as add-ons.</p>
        ` : '<p style="color:var(--text-muted);font-size:13px">No rates set yet. Build your rate card in Settings → Rate Card.</p>'}
      </div>

      ${mkContact ? `
      <div class="mk-footer">
        <p>Contact: <a href="mailto:${_esc(mkContact)}" style="color:var(--accent)">${_esc(mkContact)}</a></p>
      </div>` : ''}
    </div>
  `;
}

/* ---- SOCIAL ANALYTICS (Live via Social Blade) ---- */
let analyticsData = null;
let analyticsPlatform = "instagram";
let analyticsTimePeriod = "3m";
let analyticsLoading = false;
let analyticsLastFetch = null;

function fmtNum(n) {
  if (n == null) return "--";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function filterHistoryByPeriod(history, period) {
  if (!history || !history.length) return [];
  const now = new Date();
  let cutoff = new Date();
  if (period === "3m") cutoff.setMonth(now.getMonth() - 3);
  else if (period === "6m") cutoff.setMonth(now.getMonth() - 6);
  else if (period === "12m") cutoff.setFullYear(now.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return history.filter(h => h.date >= cutoffStr);
}

function calcGrowth(history, key) {
  if (!history || history.length < 2) return { delta: 0, pct: 0 };
  const first = history[0][key];
  const last = history[history.length - 1][key];
  if (first == null || last == null) return { delta: 0, pct: 0 };
  const delta = last - first;
  const pct = first > 0 ? ((delta / first) * 100).toFixed(1) : 0;
  return { delta, pct };
}

async function fetchAnalyticsData(refresh = false) {
  analyticsLoading = true;
  if (refresh) renderAnalyticsLoading();
  try {
    // Load this user's payload from social_stats (migration 013).
    // No row / missing table = clean empty state, never someone
    // else's numbers — the payload used to ship as a public
    // static file with the owner's stats baked in.
    let cache = null;
    if (_sb && CREATOR._sbId) {
      const res = await _sb.from('social_stats').select('payload').eq('user_id', CREATOR._sbId).limit(1).maybeSingle();
      if (res.error) {
        const missing = (res.error.code === '42P01' || res.error.code === 'PGRST205');
        if (!missing) console.error('social_stats fetch error:', res.error);
      } else if (res.data && res.data.payload && res.data.payload.platforms) {
        cache = res.data.payload;
      }
    }
    if (cache) {
      // Transform: snapshots grouped by date -> history grouped by platform
      const history = { instagram: [], tiktok: [], youtube: [], twitter: [], linkedin: [] };
      (cache.snapshots || []).forEach(snap => {
        if (snap.platform && snap.date) {
          // Old flat format: { platform: 'instagram', date, followers }
          if (history[snap.platform]) history[snap.platform].push(snap);
        } else if (snap.platforms && snap.date) {
          // Unified format: { date, platforms: { instagram: {...}, ...} }
          Object.entries(snap.platforms).forEach(([plat, pdata]) => {
            if (history[plat]) {
              const followers = pdata.followers || pdata.subscribers || pdata.connections || 0;
              history[plat].push({ date: snap.date, followers });
            }
          });
        }
      });
      // Sort each platform's history by date
      Object.keys(history).forEach(p => history[p].sort((a,b) => (a.date||'').localeCompare(b.date||'')));
      analyticsData = { ...cache, history };
      analyticsLastFetch = cache.last_fetch;
    }
  } catch (e) {
    console.error("Analytics fetch error:", e);
  }
  analyticsLoading = false;
  renderAnalytics();
}

function renderAnalyticsLoading() {
  const content = document.getElementById("analyticsContent");
  if (content) {
    content.innerHTML = `
      <div class="card" style="padding:60px;text-align:center">
        <div class="loading-spinner" style="margin:0 auto 16px"></div>
        <p style="color:var(--text-secondary)">Loading your analytics...</p>
        <p style="color:var(--text-muted);font-size:12px;margin-top:4px">This may take a few seconds</p>
      </div>`;
  }
}

function renderAnalytics() {
  const container = document.getElementById("view-analytics");

  // Calculate totals from live data or show defaults
  const p = analyticsData ? analyticsData.platforms : {};
  const igFollowers = p.instagram ? p.instagram.followers : 0;
  const ttFollowers = p.tiktok ? p.tiktok.followers : 0;
  const ytSubscribers = p.youtube ? p.youtube.subscribers : 0;
  const totalReach = igFollowers + ttFollowers + ytSubscribers;
  const igER = p.instagram ? p.instagram.engagement_rate : 0;
  const sbGrade = p.instagram ? p.instagram.grade : "--";

  // Compute follower growth from history for the selected period (guard for no data)
  const igHistory = (analyticsData && analyticsData.history && analyticsData.history.instagram)
    ? filterHistoryByPeriod(analyticsData.history.instagram, analyticsTimePeriod)
    : [];
  const igGrowth = calcGrowth(igHistory, "followers");

  const lastFetchDisplay = analyticsLastFetch ? new Date(analyticsLastFetch).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

  container.innerHTML = `
    <div class="view-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <h1 class="view-title">Social Analytics</h1>
        <p class="view-subtitle">Live data via Social Blade &middot; Last updated: ${lastFetchDisplay}</p>
      </div>
      <button class="btn btn-primary" id="btnRefreshAnalytics" style="display:flex;align-items:center;gap:6px" ${analyticsLoading ? "disabled" : ""}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="${analyticsLoading ? 'animation:spin 1s linear infinite' : ''}">
          <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
        ${analyticsLoading ? "Refreshing..." : "Refresh Data"}
      </button>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total Reach</span>
        <span class="kpi-value">${fmtNum(totalReach)}</span>
        <span class="kpi-delta ${igGrowth.delta >= 0 ? 'up' : 'down'}">IG ${igGrowth.delta >= 0 ? '+' : ''}${fmtNum(igGrowth.delta)} (${igGrowth.pct}%)</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">IG Engagement</span>
        <span class="kpi-value">${igER}%</span>
        <span class="kpi-delta ${igER > 3 ? 'up' : ''}">Social Blade avg</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Social Blade Grade</span>
        <span class="kpi-value">${sbGrade}</span>
        <span class="kpi-delta up">Instagram</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">IG Avg Likes</span>
        <span class="kpi-value">${p.instagram ? fmtNum(p.instagram.average_likes) : "--"}</span>
        <span class="kpi-delta">${p.instagram ? fmtNum(p.instagram.average_comments) + " avg comments" : ""}</span>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:4px">
      <div class="analytics-tabs">
        <button class="analytics-tab ${analyticsPlatform === "instagram" ? "active" : ""}" data-ap="instagram">
          <span class="platform-icon ig" style="width:24px;height:24px">${SKETCHY_ICONS.instagramSmall}</span> Instagram
        </button>
        <button class="analytics-tab ${analyticsPlatform === "tiktok" ? "active" : ""}" data-ap="tiktok">
          <span class="platform-icon tt" style="width:24px;height:24px">${SKETCHY_ICONS.tiktokSmall}</span> TikTok
        </button>
        <button class="analytics-tab ${analyticsPlatform === "youtube" ? "active" : ""}" data-ap="youtube">
          <span class="platform-icon yt" style="width:24px;height:24px">${SKETCHY_ICONS.youtubeSmall}</span> YouTube
        </button>
        <button class="analytics-tab ${analyticsPlatform === "twitter" ? "active" : ""}" data-ap="twitter">
          <span class="platform-icon tw" style="width:24px;height:24px">${SKETCHY_ICONS.twitterSmall}</span> Twitter
        </button>
        <button class="analytics-tab ${analyticsPlatform === "linkedin" ? "active" : ""}" data-ap="linkedin">
          <span class="platform-icon li" style="width:24px;height:24px">${SKETCHY_ICONS.linkedinSmall}</span> LinkedIn
        </button>
      </div>
      <div class="analytics-period-btns">
        <button class="period-btn ${analyticsTimePeriod === '3m' ? 'active' : ''}" data-period="3m">3M</button>
        <button class="period-btn ${analyticsTimePeriod === '6m' ? 'active' : ''}" data-period="6m">6M</button>
        <button class="period-btn ${analyticsTimePeriod === '12m' ? 'active' : ''}" data-period="12m">12M</button>
      </div>
    </div>

    <div id="analyticsContent">
      ${analyticsData ? renderAnalyticsPlatform(analyticsPlatform) : '<div class="card" style="padding:60px;text-align:center"><p style="color:var(--text-secondary);font-weight:600;margin-bottom:6px">No analytics connected yet</p><p style="color:var(--text-muted);font-size:13px">Your social stats will appear here once analytics data is added to your account.</p></div>'}
    </div>
  `;

  // Refresh button
  document.getElementById("btnRefreshAnalytics").addEventListener("click", () => fetchAnalyticsData(true));

  // Platform tabs
  container.querySelectorAll(".analytics-tab").forEach(tab => {
    tab.addEventListener("click", function() {
      analyticsPlatform = this.dataset.ap;
      container.querySelectorAll(".analytics-tab").forEach(t => t.classList.remove("active"));
      this.classList.add("active");
      renderAnalyticsContent();
    });
  });

  // Period buttons
  container.querySelectorAll(".period-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      analyticsTimePeriod = this.dataset.period;
      container.querySelectorAll(".period-btn").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      renderAnalyticsContent();
    });
  });

  // If no data yet, load from cache first (fast), then user can manually refresh
  if (!analyticsData && !analyticsLoading) {
    fetchAnalyticsData(false);  // load from cache first
  } else if (analyticsData) {
    setTimeout(() => {
      if (document.getElementById("chartGrowth")) {
        renderGrowthChart(analyticsPlatform);
      }
      if (analyticsPlatform === "instagram" && document.getElementById("chartEngagement")) {
        renderEngagementChart();
      }
    }, 50);
  }
}

function renderAnalyticsContent() {
  const content = document.getElementById("analyticsContent");
  if (!content || !analyticsData) return;
  content.innerHTML = renderAnalyticsPlatform(analyticsPlatform);
  setTimeout(() => {
    // Render growth chart for any platform that has a canvas
    if (document.getElementById("chartGrowth")) {
      renderGrowthChart(analyticsPlatform);
    }
    if (analyticsPlatform === "instagram" && document.getElementById("chartEngagement")) {
      renderEngagementChart();
    }
  }, 50);
}

function renderAnalyticsPlatform(platform) {
  if (!analyticsData) return '<div class="card"><p class="text-muted" style="padding:20px">No data loaded yet. Click Refresh Data.</p></div>';

  const p = (analyticsData && analyticsData.platforms) ? analyticsData.platforms[platform] : null;
  const history = filterHistoryByPeriod((analyticsData && analyticsData.history && analyticsData.history[platform]) || [], analyticsTimePeriod);
  const periodLabel = analyticsTimePeriod === "3m" ? "3 Months" : analyticsTimePeriod === "6m" ? "6 Months" : "12 Months";

  if (platform === "instagram" && p) {
    const growth = calcGrowth(history, "followers");
    return `
      <div class="analytics-stats-row">
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.followers)}</div>
          <div class="analytics-stat-label">Followers</div>
          <div class="analytics-stat-delta ${growth.delta >= 0 ? 'up' : 'down'}">${growth.delta >= 0 ? '+' : ''}${fmtNum(growth.delta)} (${growth.pct}%)</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.engagement_rate}%</div>
          <div class="analytics-stat-label">Engagement Rate</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.average_likes)}</div>
          <div class="analytics-stat-label">Avg Likes</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.average_comments)}</div>
          <div class="analytics-stat-label">Avg Comments</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.media_count}</div>
          <div class="analytics-stat-label">Posts</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.grade}</div>
          <div class="analytics-stat-label">SB Grade</div>
        </div>
      </div>
      <div class="chart-row">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Follower Growth (${periodLabel})</span>
            <span class="card-subtitle">${history.length} data points &middot; ${history.length ? fmtDateShort(history[0].date) + ' — ' + fmtDateShort(history[history.length-1].date) : 'No data'}</span>
          </div>
          <div class="chart-container"><canvas id="chartGrowth"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">Engagement Rate Trend</span>
            <span class="card-subtitle">Daily engagement % from Social Blade</span>
          </div>
          <div class="chart-container"><canvas id="chartEngagement"></canvas></div>
        </div>
      </div>
      ${history.length < 5 ? `
      <div class="card" style="padding:16px;text-align:center;border:1px dashed var(--border)">
        <p style="color:var(--text-muted);font-size:13px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          Social Blade provides ~15 days of free history. Each time you refresh, new data points are saved and your history grows over time.
        </p>
      </div>` : ''}
    `;
  }

  if (platform === "tiktok" && p) {
    const growth = calcGrowth(history, "followers");
    return `
      <div class="analytics-stats-row">
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.followers)}</div>
          <div class="analytics-stat-label">Followers</div>
          <div class="analytics-stat-delta ${growth.delta >= 0 ? 'up' : 'down'}">${growth.delta >= 0 ? '+' : ''}${fmtNum(growth.delta)} (${growth.pct}%)</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.likes)}</div>
          <div class="analytics-stat-label">Total Likes</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.videos}</div>
          <div class="analytics-stat-label">Videos</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.grade}</div>
          <div class="analytics-stat-label">SB Grade</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Follower Growth (${periodLabel})</span>
          <span class="card-subtitle">${history.length} data points &middot; ${history.length ? fmtDateShort(history[0].date) + ' \u2014 ' + fmtDateShort(history[history.length-1].date) : 'No data'}</span>
        </div>
        <div class="chart-container"><canvas id="chartGrowth"></canvas></div>
      </div>
    `;
  }

  if (platform === "youtube" && p) {
    const growth = calcGrowth(history, "subscribers");
    return `
      <div class="analytics-stats-row">
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.subscribers)}</div>
          <div class="analytics-stat-label">Subscribers</div>
          <div class="analytics-stat-delta ${growth.delta >= 0 ? 'up' : 'down'}">${growth.delta >= 0 ? '+' : ''}${fmtNum(growth.delta)} (${growth.pct}%)</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.views)}</div>
          <div class="analytics-stat-label">Total Views</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.videos}</div>
          <div class="analytics-stat-label">Videos</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.grade}</div>
          <div class="analytics-stat-label">SB Grade</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Subscriber Growth (${periodLabel})</span>
          <span class="card-subtitle">${history.length} data points &middot; ${history.length ? fmtDateShort(history[0].date) + ' \u2014 ' + fmtDateShort(history[history.length-1].date) : 'No data'}</span>
        </div>
        <div class="chart-container"><canvas id="chartGrowth"></canvas></div>
      </div>
    `;
  }

  if (platform === "twitter" && p) {
    const growth = calcGrowth(history, "followers");
    return `
      <div class="analytics-stats-row">
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.followers)}</div>
          <div class="analytics-stat-label">Followers</div>
          <div class="analytics-stat-delta ${growth.delta >= 0 ? 'up' : 'down'}">${growth.delta >= 0 ? '+' : ''}${fmtNum(growth.delta)}</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.tweets || 0}</div>
          <div class="analytics-stat-label">Posts</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.grade || 'New'}</div>
          <div class="analytics-stat-label">Status</div>
          <div class="analytics-stat-delta">${p.handle ? '@' + p.handle.replace(/^@/, '') : '—'}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Follower Growth (${periodLabel})</span>
          <span class="card-subtitle">${history.length} data points &middot; ${history.length ? fmtDateShort(history[0].date) + ' \u2014 ' + fmtDateShort(history[history.length-1].date) : 'No data'}</span>
        </div>
        <div class="chart-container"><canvas id="chartGrowth"></canvas></div>
      </div>
      <div class="card" style="padding:16px;text-align:center;border:1px dashed var(--border)">
        <p style="color:var(--text-muted);font-size:13px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          X/Twitter is a new account &mdash; growth data is based on estimated milestones. Live tracking updates daily.
        </p>
      </div>
    `;
  }

  if (platform === "twitter" && !p) {
    return '<div class="card" style="padding:40px;text-align:center"><p style="color:var(--text-muted)">Click "Refresh Data" to load X/Twitter data</p></div>';
  }

  if (platform === "linkedin" && p) {
    const growth = calcGrowth(history, "followers");
    return `
      <div class="analytics-stats-row">
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.followers)}</div>
          <div class="analytics-stat-label">Followers</div>
          <div class="analytics-stat-delta ${growth.delta >= 0 ? 'up' : 'down'}">${growth.delta >= 0 ? '+' : ''}${fmtNum(growth.delta)} (${growth.pct}%)</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${fmtNum(p.connections || 0)}</div>
          <div class="analytics-stat-label">Connections</div>
        </div>
        <div class="card analytics-stat-card">
          <div class="analytics-stat-value">${p.grade || 'N/A'}</div>
          <div class="analytics-stat-label">Status</div>
          <div class="analytics-stat-delta">${p.handle ? '/in/' + p.handle.replace(/^@/, '') + '/' : '—'}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Follower Growth (${periodLabel})</span>
          <span class="card-subtitle">${history.length} data points &middot; ${history.length ? fmtDateShort(history[0].date) + ' \u2014 ' + fmtDateShort(history[history.length-1].date) : 'No data'}</span>
        </div>
        <div class="chart-container"><canvas id="chartGrowth"></canvas></div>
      </div>
      <div class="card" style="padding:16px;text-align:center;border:1px dashed var(--border)">
        <p style="color:var(--text-muted);font-size:13px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          LinkedIn growth is based on estimated milestones. Connect the LinkedIn API for live daily tracking.
        </p>
      </div>
    `;
  }

  if (platform === "linkedin" && !p) {
    return '<div class="card" style="padding:40px;text-align:center"><p style="color:var(--text-muted)">Click "Refresh Data" to load LinkedIn data</p></div>';
  }

  return '';
}

function renderGrowthChart(platform) {
  if (!analyticsData) return;
  let history = filterHistoryByPeriod((analyticsData && analyticsData.history && analyticsData.history[platform]) || [], analyticsTimePeriod);
  if (!history.length) return;

  // Downsample if too many points (keep first, last, and evenly spaced points)
  const maxPoints = analyticsTimePeriod === '12m' ? 52 : analyticsTimePeriod === '6m' ? 36 : 90;
  if (history.length > maxPoints) {
    const sampled = [history[0]];
    const step = (history.length - 1) / (maxPoints - 1);
    for (let i = 1; i < maxPoints - 1; i++) {
      sampled.push(history[Math.round(i * step)]);
    }
    sampled.push(history[history.length - 1]);
    history = sampled;
  }

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const textColor = isDark ? "#a8a29e" : "#5a5550";

  if (chartsRendered.growth) chartsRendered.growth.destroy();

  const ctx = document.getElementById("chartGrowth");
  if (!ctx) return;

  const platformColors = {
    instagram: "#E1306C",
    tiktok: "#69C9D0",
    youtube: "#FF0000",
    twitter: "#1DA1F2",
    linkedin: "#0A66C2"
  };

  const followerKey = platform === "youtube" ? "subscribers" : "followers";
  const followerLabel = platform === "youtube" ? "Subscribers" : platform === "linkedin" ? "Followers" : platform === "twitter" ? "Followers" : "Followers";
  const color = platformColors[platform] || "#4f98a3";

  chartsRendered.growth = new Chart(ctx, {
    type: "line",
    data: {
      labels: history.map(h => fmtDate(h.date)),
      datasets: [{
        label: platform === "youtube" ? "Subscribers" : "Followers",
        data: history.map(h => h[followerKey] || 0),
        borderColor: color,
        backgroundColor: color + "20",
        fill: true,
        tension: 0.4,
        pointRadius: history.length > 30 ? 0 : 4,
        pointHoverRadius: 6,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) { return fmtNum(ctx.raw) + (platform === "youtube" ? " subscribers" : " followers"); },
            title: function(items) { return items[0] ? items[0].label : ""; }
          }
        }
      },
      scales: {
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: "'General Sans'", size: 11 },
            callback: function(v) {
              if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
              if (v >= 1000) return (v / 1000).toFixed(0) + "K";
              return v;
            }
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { family: "'General Sans'", size: 11 },
            maxTicksLimit: 8
          }
        }
      }
    }
  });
}

function renderEngagementChart() {
  if (!analyticsData) return;
  const history = filterHistoryByPeriod((analyticsData && analyticsData.history && analyticsData.history.instagram) || [], analyticsTimePeriod);
  let erHistory = history.filter(h => h.engagement_rate != null);
  if (!erHistory.length) return;

  // Downsample if too many points
  const maxPoints = analyticsTimePeriod === '12m' ? 52 : analyticsTimePeriod === '6m' ? 36 : 90;
  if (erHistory.length > maxPoints) {
    const sampled = [erHistory[0]];
    const step = (erHistory.length - 1) / (maxPoints - 1);
    for (let i = 1; i < maxPoints - 1; i++) {
      sampled.push(erHistory[Math.round(i * step)]);
    }
    sampled.push(erHistory[erHistory.length - 1]);
    erHistory = sampled;
  }

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const textColor = isDark ? "#a8a29e" : "#5a5550";

  if (chartsRendered.engagement) chartsRendered.engagement.destroy();
  const ctx = document.getElementById("chartEngagement");
  if (!ctx) return;

  chartsRendered.engagement = new Chart(ctx, {
    type: "bar",
    data: {
      labels: erHistory.map(h => fmtDate(h.date)),
      datasets: [{
        label: "Engagement %",
        data: erHistory.map(h => h.engagement_rate),
        backgroundColor: erHistory.map(h => h.engagement_rate > 5 ? "#10b98140" : "#E1306C40"),
        borderColor: erHistory.map(h => h.engagement_rate > 5 ? "#10b981" : "#E1306C"),
        borderWidth: 1,
        borderRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) { return ctx.raw.toFixed(2) + "% engagement"; }
          }
        }
      },
      scales: {
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: "'General Sans'", size: 11 },
            callback: function(v) { return v + "%"; }
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { family: "'General Sans'", size: 11 },
            maxTicksLimit: 8
          }
        }
      }
    }
  });
}


function quickBrandMatch(brand) {
  const deal = DEALS.find(d => d.brand === brand);
  if (!deal) return;
  document.getElementById("bmBrand").value = deal.brand;
  document.getElementById("bmContact").value = deal.contact || "";
  document.getElementById("bmScope").value = deal.scope || "";
  document.getElementById("bmBudget").value = deal.value ? "$" + deal.value.toLocaleString() : "Not mentioned";
  document.getElementById("bmEmail").value = deal.notes || "";
  runBrandMatch();
}


/* ---- INBOX / DRAFT QUEUE ---- */
let INBOX_ITEMS = [];

let draftQueue = [];

function renderInbox() {
  const container = document.getElementById("view-inbox");
  const needsReply = INBOX_ITEMS.filter(i => i.status === "needs_reply").length;
  const needsAction = INBOX_ITEMS.filter(i => i.status === "needs_action").length;

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Inbox</h1>
        <p class="view-subtitle">Brand deal emails and AI-drafted responses</p>
      </div>
      <div class="briefing-badge">
        <span class="briefing-time">Last scan: ${todayStr()}</span>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr)">
      <div class="kpi-card">
        <span class="kpi-label">Needs Reply</span>
        <span class="kpi-value" style="color:var(--error)">${needsReply}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Needs Action</span>
        <span class="kpi-value" style="color:var(--accent)">${needsAction}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Draft Queue</span>
        <span class="kpi-value">${draftQueue.length}</span>
      </div>
    </div>

    <div class="inbox-layout">
      <div class="inbox-list-panel">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Email Queue</span>
            <span class="badge followup">${INBOX_ITEMS.length} items</span>
          </div>
          <div class="inbox-list">
            ${INBOX_ITEMS.map(item => {
              const priorityColors = { urgent: "var(--error)", high: "var(--accent)", medium: "var(--teal)", low: "var(--text-muted)" };
              const statusLabels = { needs_reply: "Reply Needed", needs_action: "Action Needed", waiting: "Waiting", drafted: "Draft Ready" };
              return `
                <div class="inbox-item priority-${item.priority}" onclick="selectInboxItem(${item.id})" id="inbox-item-${item.id}">
                  <div class="inbox-item-header">
                    <span class="inbox-brand">${item.brand}</span>
                    <span class="inbox-time">${item.time}</span>
                  </div>
                  <div class="inbox-subject">${item.subject}</div>
                  <div class="inbox-snippet">${item.snippet}</div>
                  <div class="inbox-item-footer">
                    <span class="inbox-status-badge" style="color:${priorityColors[item.priority]}">${statusLabels[item.status] || item.status}</span>
                    <span class="inbox-contact">${item.contact}</span>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>

      <div class="inbox-detail-panel" id="inboxDetail">
        <div class="card">
          <div style="padding:40px;text-align:center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
            <p style="color:var(--text-secondary);margin-top:16px">Select an email to view details and generate a draft</p>
          </div>
        </div>
      </div>
    </div>

    ${draftQueue.length > 0 ? `
    <div class="card" style="margin-top:24px">
      <div class="card-header">
        <span class="card-title">Draft Queue</span>
        <span class="badge active">${draftQueue.length} ready to review</span>
      </div>
      <div class="draft-queue-list">
        ${draftQueue.map((draft, i) => `
          <div class="draft-queue-item">
            <div class="draft-queue-header">
              <strong>${draft.brand}</strong>
              <span class="text-muted">${draft.summary}</span>
            </div>
            <div class="draft-queue-actions">
              <button class="btn btn-sm btn-primary" onclick="approveDraft(${i})">Approve &amp; Send</button>
              <button class="btn btn-sm btn-secondary" onclick="editDraft(${i})">Edit</button>
              <button class="btn btn-sm" style="color:var(--error)" onclick="discardDraft(${i})">Discard</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
    ` : ""}
  `;
}

function selectInboxItem(id) {
  const item = INBOX_ITEMS.find(i => i.id === id);
  if (!item) return;

  document.querySelectorAll(".inbox-item").forEach(el => el.classList.remove("selected"));
  const el = document.getElementById("inbox-item-" + id);
  if (el) el.classList.add("selected");

  const detailDiv = document.getElementById("inboxDetail");
  detailDiv.innerHTML = `
    <div class="card inbox-detail-card">
      <div class="inbox-detail-header">
        <h3>${item.brand}</h3>
        <span class="badge ${item.priority === "urgent" ? "followup" : item.priority === "high" ? "negotiating" : "active"}">${item.priority}</span>
      </div>
      <div class="inbox-detail-meta">
        <div><strong>From:</strong> ${item.contact} &lt;${item.email}&gt;</div>
        <div><strong>Subject:</strong> ${item.subject}</div>
        <div><strong>Received:</strong> ${item.time}</div>
      </div>
      <div class="inbox-detail-context">
        <h4>Context</h4>
        <p>${item.context}</p>
      </div>
      <div class="inbox-detail-actions">
        <button class="btn btn-primary" onclick="generateDraft(${item.id}, '${item.suggestedAction}')">Draft ${item.suggestedAction.replace(/_/g, " ")} response</button>
        <button class="btn btn-secondary" onclick="generateDraft(${item.id}, 'reply')">General Reply</button>
        <button class="btn btn-secondary" onclick="generateDraft(${item.id}, 'decline')">Decline</button>
      </div>
      <div id="draftOutput-${item.id}"></div>
    </div>
  `;
}

async function generateDraft(itemId, draftType) {
  const item = INBOX_ITEMS.find(i => i.id === itemId);
  if (!item) return;

  const outputDiv = document.getElementById("draftOutput-" + itemId);
  outputDiv.innerHTML = `
    <div class="research-loading" style="margin-top:16px">
      <div class="research-loading-spinner"></div>
      <p>Drafting ${draftType.replace(/_/g, " ")} for <strong>${item.brand}</strong>...</p>
    </div>
  `;

  try {
    const res = await fetch(API_BASE + "/api/draft-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: item.brand,
        contact: item.contact,
        email: item.email,
        context: item.context,
        draft_type: draftType
      })
    });
    const result = await res.json();

    if (!result.success) {
      outputDiv.innerHTML = `<div style="color:var(--error);margin-top:16px">Error: ${result.error}</div>`;
      return;
    }

    const d = result.data;
    outputDiv.innerHTML = `
      <div class="draft-preview" style="margin-top:20px">
        <div class="draft-preview-header">
          <h4>AI Draft</h4>
          <span class="badge ${d.confidence === "high" ? "active" : d.confidence === "medium" ? "negotiating" : "followup"}">${d.confidence} confidence</span>
        </div>
        <div class="draft-meta">
          <div><strong>To:</strong> ${d.to || item.email}</div>
          <div><strong>Subject:</strong> ${d.subject || item.subject}</div>
        </div>
        <div class="draft-body">
          <pre class="draft-text" id="draftText-${itemId}">${d.body}</pre>
        </div>
        ${d.notes ? `<div class="draft-notes"><strong>Note:</strong> ${d.notes}</div>` : ""}
        <div class="draft-actions">
          <button class="btn btn-primary btn-sm" onclick="addToDraftQueue(${itemId}, '${draftType}')">Add to Queue</button>
          <button class="btn btn-secondary btn-sm" onclick="copyDraftText(${itemId})">Copy</button>
          <button class="btn btn-secondary btn-sm" onclick="generateDraft(${itemId}, '${draftType}')">Regenerate</button>
        </div>
      </div>
    `;
  } catch (err) {
    outputDiv.innerHTML = `<div style="color:var(--error);margin-top:16px">Connection error: ${err.message}</div>`;
  }
}

function addToDraftQueue(itemId, draftType) {
  const item = INBOX_ITEMS.find(i => i.id === itemId);
  const textEl = document.getElementById("draftText-" + itemId);
  if (!item || !textEl) return;

  draftQueue.push({
    brand: item.brand,
    contact: item.contact,
    email: item.email,
    subject: item.subject,
    body: textEl.textContent,
    summary: draftType.replace(/_/g, " ") + " for " + item.brand,
    draftType
  });

  item.status = "drafted";
  renderInbox();
}

function copyDraftText(itemId) {
  const textEl = document.getElementById("draftText-" + itemId);
  if (!textEl) return;
  navigator.clipboard.writeText(textEl.textContent);
}

function approveDraft(index) {
  const draft = draftQueue[index];
  if (!draft) return;
  alert("Draft approved for " + draft.brand + ". In production, this would send via Gmail API.");
  draftQueue.splice(index, 1);
  renderInbox();
}

function editDraft(index) {
  const draft = draftQueue[index];
  if (!draft) return;
  const newBody = prompt("Edit the draft:", draft.body);
  if (newBody !== null) {
    draftQueue[index].body = newBody;
    renderInbox();
  }
}

function discardDraft(index) {
  draftQueue.splice(index, 1);
  renderInbox();
}

/* ---- CONTENT CALENDAR ---- */

let _calendarMonth = new Date().getMonth();
let _calendarYear = new Date().getFullYear();

function renderCalendar() {
  const container = document.getElementById("view-calendar");

  const now = new Date();
  const monthDate = new Date(_calendarYear, _calendarMonth, 1);
  const monthName = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const startDay = new Date(_calendarYear, _calendarMonth, 1).getDay(); // 0-6
  const daysInMonth = new Date(_calendarYear, _calendarMonth + 1, 0).getDate();

  // Group events by date string
  const eventsByDate = {};
  (CALENDAR_EVENTS || []).forEach(e => {
    if (!e.date) return;
    (eventsByDate[e.date] = eventsByDate[e.date] || []).push(e);
  });

  // Build 6-week grid (42 cells)
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ empty: true });
    } else {
      const iso = `${_calendarYear}-${String(_calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const isToday = (dayNum === now.getDate() && _calendarMonth === now.getMonth() && _calendarYear === now.getFullYear());
      cells.push({ day: dayNum, iso, isToday, events: eventsByDate[iso] || [] });
    }
  }

  // Split into weeks (6 rows of 7)
  const weeks = [];
  for (let i = 0; i < 6; i++) weeks.push(cells.slice(i*7, i*7+7));

  // Upcoming list
  const today = new Date().toISOString().split('T')[0];
  const upcoming = (CALENDAR_EVENTS || [])
    .filter(e => e.date && e.date >= today)
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Content Calendar</h1>
        <p class="view-subtitle">Publishing schedule and deal deliverables</p>
      </div>
      <div class="view-header-actions">
        <button class="btn btn-primary" onclick="openAddEventModal()">+ Add Event</button>
      </div>
    </div>

    <div class="calendar-container">
      <div class="calendar-main">
        <div class="calendar-toolbar">
          <button class="btn-icon" onclick="calendarPrev()" title="Previous month">‹</button>
          <h2 class="calendar-month-title">${monthName}</h2>
          <button class="btn-icon" onclick="calendarNext()" title="Next month">›</button>
          <button class="btn btn-secondary btn-sm" onclick="calendarToday()">Today</button>
        </div>

        <div class="calendar-grid">
          <div class="calendar-weekdays">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          ${weeks.map(week => `
            <div class="calendar-week">
              ${week.map(cell => cell.empty ? '<div class="calendar-cell empty"></div>' :
                `<div class="calendar-cell ${cell.isToday ? 'is-today' : ''}" onclick="openAddEventModal('${cell.iso}')">
                  <div class="calendar-day-num">${cell.day}</div>
                  ${cell.events.slice(0, 3).map(e => `
                    <div class="calendar-event status-${_slug(e.status || 'draft')}" title="${_esc(e.brand)} — ${_esc(e.type)}">
                      ${_esc(e.brand || 'Event')}
                    </div>
                  `).join('')}
                  ${cell.events.length > 3 ? `<div class="calendar-more">+${cell.events.length - 3} more</div>` : ''}
                </div>`
              ).join('')}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="calendar-sidebar">
        <h3>Upcoming</h3>
        ${upcoming.length === 0 ? `
          <div class="dashboard-empty">
            <p>Nothing coming up.</p>
          </div>
        ` : upcoming.map(e => `
          <div class="upcoming-item" data-id="${e._sbId || ''}">
            <div class="upcoming-date">
              <span class="upcoming-month">${_shortMonth(e.date)}</span>
              <span class="upcoming-day">${_shortDay(e.date)}</span>
            </div>
            <div class="upcoming-body">
              <div class="upcoming-brand">${_esc(e.brand || 'Event')}</div>
              <div class="upcoming-meta">${_esc(e.type || '')}${e.platform ? ' · ' + _esc(e.platform) : ''}</div>
            </div>
            <div class="upcoming-actions">
              <button class="btn-icon btn-danger" onclick="deleteCalendarEvent('${e._sbId}')" title="Delete">×</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Add Event modal -->
    <div class="modal-overlay" id="addEventModal" style="display:none;" onclick="closeAddEventModal(event)">
      <div class="modal-card" onclick="event.stopPropagation()">
        <h3>Add Calendar Event</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Date</label>
            <input type="date" id="evDate">
          </div>
          <div class="form-group">
            <label>Brand / Title</label>
            <input type="text" id="evBrand" placeholder="Brand or event name">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Type</label>
            <input type="text" id="evType" placeholder="Reel, Post, Story...">
          </div>
          <div class="form-group">
            <label>Platform</label>
            <input type="text" id="evPlatform" placeholder="Instagram, TikTok...">
          </div>
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="evStatus">
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div class="settings-actions">
          <button class="btn btn-secondary" onclick="closeAddEventModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveCalendarEvent()">Save Event</button>
        </div>
      </div>
    </div>
  `;
}

function calendarPrev() {
  _calendarMonth--;
  if (_calendarMonth < 0) { _calendarMonth = 11; _calendarYear--; }
  renderCalendar();
}
function calendarNext() {
  _calendarMonth++;
  if (_calendarMonth > 11) { _calendarMonth = 0; _calendarYear++; }
  renderCalendar();
}
function calendarToday() {
  const n = new Date();
  _calendarMonth = n.getMonth();
  _calendarYear = n.getFullYear();
  renderCalendar();
}

function openAddEventModal(prefillDate) {
  const modal = document.getElementById('addEventModal');
  if (!modal) return;
  document.getElementById('evDate').value = prefillDate || new Date().toISOString().split('T')[0];
  document.getElementById('evBrand').value = '';
  document.getElementById('evType').value = '';
  document.getElementById('evPlatform').value = '';
  document.getElementById('evStatus').value = 'draft';
  modal.style.display = 'flex';
}
function closeAddEventModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const m = document.getElementById('addEventModal');
  if (m) m.style.display = 'none';
}

async function saveCalendarEvent() {
  if (!_sb || !CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  const date = document.getElementById('evDate').value;
  const brand = document.getElementById('evBrand').value.trim();
  const type = document.getElementById('evType').value.trim();
  const platform = document.getElementById('evPlatform').value.trim();
  const status = document.getElementById('evStatus').value;
  if (!date || !brand) { _showSaveError('Date and brand are required'); return; }

  const { data, error } = await _sb.from('calendar_events').insert({
    user_id: CREATOR._sbId, date, brand, type, platform, status
  }).select().single();
  if (error) { _showSaveError('Failed: ' + error.message); return; }
  CALENDAR_EVENTS.push({ _sbId: data.id, date, brand, type, platform, status });
  closeAddEventModal();
  renderCalendar();
  _showSaveSuccess();
}

async function deleteCalendarEvent(sbId) {
  if (!_sb || !sbId) return;
  if (!confirm('Delete this event?')) return;
  const { error } = await _sb.from('calendar_events').delete().eq('id', sbId);
  if (error) { _showSaveError('Failed: ' + error.message); return; }
  CALENDAR_EVENTS = CALENDAR_EVENTS.filter(e => e._sbId !== sbId);
  renderCalendar();
  _showSaveSuccess();
}

/* ---- TASKS ---- */
let _tasksCompletedOpen = false;
let _taskComposerOpen = false;
let _editingTaskId = null;
let _taskSaving = false;
let _taskBusyIds = {};
let _taskComposerFocusPending = false;

// Local-calendar date, unlike todayISO() which is UTC — due dates come
// from <input type="date"> in the user's local calendar, so "Today"/
// overdue must compare in local time or they flip early every evening
function _localISODate(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _taskDueLabel(iso) {
  if (!iso) return '';
  const today = _localISODate();
  const t = new Date();
  t.setDate(t.getDate() + 1);
  const tomorrow = _localISODate(t);
  if (iso === today) return 'Today';
  if (iso === tomorrow) return 'Tomorrow';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  if (d.getFullYear() === new Date().getFullYear()) return fmtDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function _taskRowHTML(t) {
  const dueLabel = _taskDueLabel(t.dueDate);
  const overdue = t.dueDate && !t.completed && t.dueDate < _localISODate();
  const starSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (t.starred ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.2l3 6.1 6.8 1-4.9 4.8 1.2 6.7-6.1-3.2-6.1 3.2 1.2-6.7-4.9-4.8 6.8-1z"/></svg>';
  const checkSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 12.3l5 5.2 10.6-11"/></svg>';
  const dueSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 4.2h17.6c.6 0 1.1.5 1.1 1.1v14.5c0 .6-.5 1.1-1.1 1.1H3.2c-.6 0-1.1-.5-1.1-1.1V5.3c0-.6.5-1.1 1.1-1.1z"/><path d="M16.1 2.1v4.1"/><path d="M8 2.1v4.1"/><path d="M2.1 10.1h19.8"/></svg>';
  return `
    <div class="task-item ${t.completed ? 'completed' : ''}" data-id="${t._sbId}">
      <button class="task-check" onclick="toggleTaskComplete('${t._sbId}')" title="${t.completed ? 'Mark incomplete' : 'Mark complete'}" aria-label="${t.completed ? 'Mark incomplete' : 'Mark complete'}">${checkSvg}</button>
      <div class="task-body" role="button" tabindex="0" onclick="openEditTaskModal('${t._sbId}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openEditTaskModal('${t._sbId}');}">
        <div class="task-title">${_esc(t.title)}</div>
        ${t.details ? `<div class="task-details">${_esc(t.details)}</div>` : ''}
        ${dueLabel ? `<span class="task-due ${overdue ? 'overdue' : ''}">${dueSvg} ${dueLabel}</span>` : ''}
      </div>
      <div class="task-item-actions">
        <button class="task-star ${t.starred ? 'active' : ''}" onclick="toggleTaskStar('${t._sbId}')" title="${t.starred ? 'Unstar' : 'Star'}" aria-label="${t.starred ? 'Unstar' : 'Star'}">${starSvg}</button>
        <button class="task-delete" onclick="deleteTask('${t._sbId}')" title="Delete" aria-label="Delete task">&times;</button>
      </div>
    </div>`;
}

function renderTasks() {
  const container = document.getElementById('view-tasks');

  // Preserve unsaved composer/modal input across re-renders — every task
  // mutation rebuilds this view's innerHTML, and typed text must survive
  const prevFocusId = document.activeElement ? document.activeElement.id : '';
  let prevComposer = null;
  if (_taskComposerOpen && document.getElementById('taskNewTitle')) {
    prevComposer = {
      title: document.getElementById('taskNewTitle').value,
      details: document.getElementById('taskNewDetails').value,
      due: document.getElementById('taskNewDue').value
    };
  }
  let prevModal = null;
  const prevModalEl = document.getElementById('editTaskModal');
  if (_editingTaskId && prevModalEl && prevModalEl.style.display !== 'none') {
    prevModal = {
      title: document.getElementById('etTitle').value,
      details: document.getElementById('etDetails').value,
      due: document.getElementById('etDue').value
    };
  }

  const header = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Tasks</h1>
        <p class="view-subtitle">Quick to-dos. Add it, check it off, move on.</p>
      </div>
      <div class="view-header-actions">
        <button class="btn btn-primary" onclick="openTaskComposer()">+ Add Task</button>
      </div>
    </div>`;

  if (_tasksTableMissing) {
    container.innerHTML = header + `
      <div class="tasks-container">
        <div class="tasks-setup-card">
          <h3>One-time setup needed</h3>
          <p>The tasks table doesn't exist in Supabase yet. Run <code>migrations/010_tasks.sql</code> in the Supabase SQL editor, then refresh this page.</p>
        </div>
      </div>`;
    return;
  }

  const active = TASKS.filter(t => !t.completed).sort((a, b) =>
    (b.starred - a.starred) ||
    ((a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')) ||
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  const done = TASKS.filter(t => t.completed).sort((a, b) =>
    (b.completedAt || '').localeCompare(a.completedAt || '')
  );

  container.innerHTML = header + `
    <div class="tasks-container">
      <div class="tasks-card">
        <div class="task-composer" id="taskComposer" style="display:${_taskComposerOpen ? 'block' : 'none'}">
          <div class="form-group">
            <label for="taskNewTitle">Task</label>
            <input type="text" id="taskNewTitle" placeholder="What needs doing?" maxlength="500" onkeydown="if(event.key==='Enter'){event.preventDefault();saveNewTask();}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="taskNewDetails">Details (optional)</label>
              <input type="text" id="taskNewDetails" placeholder="Any extra context" maxlength="2000" onkeydown="if(event.key==='Enter'){event.preventDefault();saveNewTask();}">
            </div>
            <div class="form-group">
              <label for="taskNewDue">Due date (optional)</label>
              <input type="date" id="taskNewDue" min="1900-01-01" max="9999-12-31">
            </div>
          </div>
          <div class="task-composer-actions">
            <button class="btn btn-secondary btn-sm" onclick="closeTaskComposer()">Cancel</button>
            <button class="btn btn-primary btn-sm" onclick="saveNewTask()">Add Task</button>
          </div>
        </div>

        ${active.length === 0 && done.length === 0 ? `
          <div class="dashboard-empty tasks-empty">
            <p>No tasks yet. Hit "+ Add Task" and get the first one down.</p>
          </div>
        ` : ''}

        <div class="task-list">
          ${active.map(_taskRowHTML).join('')}
        </div>

        ${done.length > 0 ? `
          <div class="tasks-completed">
            <button class="tasks-completed-toggle" onclick="toggleCompletedTasks()" aria-expanded="${_tasksCompletedOpen}">
              <span class="tasks-completed-chevron ${_tasksCompletedOpen ? 'open' : ''}">&#8250;</span>
              Completed (${done.length})
            </button>
            ${_tasksCompletedOpen ? `
              <button class="btn btn-ghost btn-sm tasks-clear-btn" onclick="clearCompletedTasks()">Clear all</button>
              <div class="task-list task-list-completed">
                ${done.map(_taskRowHTML).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Edit Task modal -->
    <div class="modal-overlay" id="editTaskModal" style="display:none;" onclick="closeEditTaskModal(event)">
      <div class="modal-card" onclick="event.stopPropagation()">
        <h3>Edit Task</h3>
        <div class="form-group">
          <label for="etTitle">Task</label>
          <input type="text" id="etTitle" maxlength="500" onkeydown="if(event.key==='Enter'){event.preventDefault();saveTaskEdits();}">
        </div>
        <div class="form-group">
          <label for="etDetails">Details</label>
          <textarea id="etDetails" rows="3" maxlength="2000" placeholder="Any extra context"></textarea>
        </div>
        <div class="form-group">
          <label for="etDue">Due date</label>
          <input type="date" id="etDue" min="1900-01-01" max="9999-12-31">
        </div>
        <div class="settings-actions">
          <button class="btn btn-secondary" onclick="closeEditTaskModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveTaskEdits()">Save</button>
        </div>
      </div>
    </div>
  `;

  // Restore preserved input state after the rebuild
  if (prevComposer && _taskComposerOpen && document.getElementById('taskNewTitle')) {
    document.getElementById('taskNewTitle').value = prevComposer.title;
    document.getElementById('taskNewDetails').value = prevComposer.details;
    document.getElementById('taskNewDue').value = prevComposer.due;
  }
  if (_editingTaskId && !TASKS.some(t => t._sbId === _editingTaskId)) _editingTaskId = null;
  if (prevModal && _editingTaskId) {
    document.getElementById('etTitle').value = prevModal.title;
    document.getElementById('etDetails').value = prevModal.details;
    document.getElementById('etDue').value = prevModal.due;
    document.getElementById('editTaskModal').style.display = 'flex';
  }
  if (_taskComposerFocusPending) {
    _taskComposerFocusPending = false;
    const titleEl = document.getElementById('taskNewTitle');
    if (titleEl) titleEl.focus();
  } else if (['taskNewTitle', 'taskNewDetails', 'taskNewDue', 'etTitle', 'etDetails', 'etDue'].indexOf(prevFocusId) !== -1) {
    const el = document.getElementById(prevFocusId);
    if (el) el.focus();
  }
}

function openTaskComposer() {
  if (_tasksTableMissing) { _showSaveError('Run migrations/010_tasks.sql in Supabase first'); return; }
  _taskComposerOpen = true;
  _taskComposerFocusPending = true;
  renderTasks();
}

function closeTaskComposer() {
  _taskComposerOpen = false;
  renderTasks();
}

async function saveNewTask() {
  if (_taskSaving) return; // in-flight guard: double Enter / double click must not duplicate
  if (!_sb || !CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  const title = document.getElementById('taskNewTitle').value.trim();
  const details = document.getElementById('taskNewDetails').value.trim();
  const dueDate = document.getElementById('taskNewDue').value;
  if (!title) { _showSaveError('Task needs a title'); return; }

  _taskSaving = true;
  try {
    const row = await sbAddTask({ title, details, dueDate });
    if (!row) return;
    TASKS.unshift({
      _sbId: row.id, title: row.title || title, details: row.details || '',
      dueDate: row.due_date || '', starred: !!row.starred, completed: !!row.completed,
      completedAt: row.completed_at || '',
      createdAt: row.created_at || new Date().toISOString()
    });
    // Clear inputs before re-render (the preserve-state logic would
    // otherwise carry them over), then keep the composer open for
    // rapid entry, Google Tasks style
    document.getElementById('taskNewTitle').value = '';
    document.getElementById('taskNewDetails').value = '';
    document.getElementById('taskNewDue').value = '';
    _taskComposerFocusPending = true;
    renderTasks();
  } finally {
    _taskSaving = false;
  }
}

async function toggleTaskComplete(sbId) {
  const t = TASKS.find(x => x._sbId === sbId);
  if (!t || _taskBusyIds[sbId]) return;
  _taskBusyIds[sbId] = true;
  try {
    const completed = !t.completed;
    const completedAt = completed ? new Date().toISOString() : null;
    const ok = await sbUpdateTask(sbId, { completed: completed, completed_at: completedAt });
    if (!ok) return;
    t.completed = completed;
    t.completedAt = completedAt || '';
    renderTasks();
  } finally {
    delete _taskBusyIds[sbId];
  }
}

async function toggleTaskStar(sbId) {
  const t = TASKS.find(x => x._sbId === sbId);
  if (!t || _taskBusyIds[sbId]) return;
  _taskBusyIds[sbId] = true;
  try {
    const starred = !t.starred;
    const ok = await sbUpdateTask(sbId, { starred: starred });
    if (!ok) return;
    t.starred = starred;
    renderTasks();
  } finally {
    delete _taskBusyIds[sbId];
  }
}

async function deleteTask(sbId) {
  if (_taskBusyIds[sbId]) return;
  _taskBusyIds[sbId] = true;
  try {
    if (!confirm('Delete this task?')) return;
    const ok = await sbDeleteTasks([sbId]);
    if (!ok) return;
    TASKS = TASKS.filter(x => x._sbId !== sbId);
    renderTasks();
  } finally {
    delete _taskBusyIds[sbId];
  }
}

function toggleCompletedTasks() {
  _tasksCompletedOpen = !_tasksCompletedOpen;
  renderTasks();
}

async function clearCompletedTasks() {
  if (_taskSaving) return;
  const ids = TASKS.filter(t => t.completed).map(t => t._sbId);
  if (!ids.length) return;
  if (!confirm('Delete all ' + ids.length + ' completed task' + (ids.length === 1 ? '' : 's') + '?')) return;
  _taskSaving = true;
  try {
    const ok = await sbDeleteTasks(ids);
    if (!ok) return;
    // Prune by the ids actually deleted, not by completed-flag — a task
    // checked off while the delete was in flight must stay
    TASKS = TASKS.filter(t => ids.indexOf(t._sbId) === -1);
    renderTasks();
  } finally {
    _taskSaving = false;
  }
}

function openEditTaskModal(sbId) {
  const t = TASKS.find(x => x._sbId === sbId);
  if (!t) return;
  _editingTaskId = sbId;
  document.getElementById('etTitle').value = t.title;
  document.getElementById('etDetails').value = t.details;
  document.getElementById('etDue').value = t.dueDate || '';
  document.getElementById('editTaskModal').style.display = 'flex';
}

function closeEditTaskModal(event) {
  if (event && event.target !== event.currentTarget) return;
  _editingTaskId = null;
  const m = document.getElementById('editTaskModal');
  if (m) m.style.display = 'none';
}

async function saveTaskEdits() {
  const t = TASKS.find(x => x._sbId === _editingTaskId);
  if (!t) { closeEditTaskModal(); return; }
  if (_taskBusyIds[t._sbId]) return;
  const title = document.getElementById('etTitle').value.trim();
  const details = document.getElementById('etDetails').value.trim();
  const dueDate = document.getElementById('etDue').value;
  if (!title) { _showSaveError('Task needs a title'); return; }

  _taskBusyIds[t._sbId] = true;
  try {
    const ok = await sbUpdateTask(t._sbId, { title: title, details: details, due_date: dueDate || null });
    if (!ok) return;
    t.title = title;
    t.details = details;
    t.dueDate = dueDate || '';
    _editingTaskId = null;
    renderTasks();
  } finally {
    delete _taskBusyIds[t._sbId];
  }
}

/* ---- SETTINGS (Interactive, all-editable) ---- */
function renderSettings() {
  const container = document.getElementById("view-settings");

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Settings</h1>
        <p class="view-subtitle">Everything here is editable. Changes save to your account.</p>
      </div>
    </div>

    <div class="settings-tabs">
      <button class="settings-tab active" data-tab="profile" onclick="switchSettingsTab('profile')">Profile</button>
      <button class="settings-tab" data-tab="platforms" onclick="switchSettingsTab('platforms')">Platforms</button>
      <button class="settings-tab" data-tab="ratecard" onclick="switchSettingsTab('ratecard')">Rate Card</button>
      <button class="settings-tab" data-tab="contract" onclick="switchSettingsTab('contract')">Contract Defaults</button>
      <button class="settings-tab" data-tab="invoicing" onclick="switchSettingsTab('invoicing')">Invoicing</button>
      <button class="settings-tab" data-tab="audience" onclick="switchSettingsTab('audience')">Audience</button>
      <button class="settings-tab" data-tab="danger" onclick="switchSettingsTab('danger')">Account</button>
    </div>

    <div class="settings-panel" id="settings-panel-profile">
      ${renderProfileSettings()}
    </div>
    <div class="settings-panel" id="settings-panel-platforms" style="display:none;">
      ${renderPlatformsSettings()}
    </div>
    <div class="settings-panel" id="settings-panel-ratecard" style="display:none;">
      ${renderRateCardSettings()}
    </div>
    <div class="settings-panel" id="settings-panel-contract" style="display:none;">
      ${renderContractSettingsPanel()}
    </div>
    <div class="settings-panel" id="settings-panel-invoicing" style="display:none;">
      ${renderInvoicingSettings()}
    </div>
    <div class="settings-panel" id="settings-panel-audience" style="display:none;">
      ${renderAudienceSettings()}
    </div>
    <div class="settings-panel" id="settings-panel-danger" style="display:none;">
      ${renderDangerZone()}
    </div>
  `;
}

function switchSettingsTab(tab) {
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  ['profile','platforms','ratecard','contract','invoicing','audience','danger'].forEach(t => {
    const el = document.getElementById('settings-panel-' + t);
    if (el) el.style.display = (t === tab) ? '' : 'none';
  });
}

/* ---- SETTINGS: Profile tab ---- */
function renderProfileSettings() {
  const c = CREATOR || {};
  return `
    <div class="settings-card">
      <h3>Creator Profile</h3>
      <p class="settings-help">This information appears in your media kit, contracts, and invoices.</p>
      <div class="form-row">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="setProfileName" value="${_esc(c.name)}" placeholder="Your Name">
        </div>
        <div class="form-group">
          <label>Brand Name</label>
          <input type="text" id="setProfileBrand" value="${_esc(c.brand)}" placeholder="Your Brand">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Legal Entity</label>
          <input type="text" id="setProfileEntity" value="${_esc(c.entity)}" placeholder="Your Business LLC">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="setProfileEmail" value="${_esc(c.email)}" placeholder="you@example.com">
        </div>
      </div>
      <div class="form-group">
        <label>Niche / Description</label>
        <input type="text" id="setProfileNiche" value="${_esc(c.niche)}" placeholder="Creative animator, tech, lifestyle">
      </div>
      <div class="form-group">
        <label>Media Kit Contact Email</label>
        <input type="email" id="setMkContact" value="${_esc(c.mkContactEmail || '')}" placeholder="hello@yourbrand.com">
        <p class="settings-help" style="margin-top:4px">Shown on your media kit page and PDF. Falls back to your email above if empty.</p>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Brand Alignment — Good Fit (one per line)</label>
          <textarea id="setMkAlignYes" rows="4" placeholder="AI tools that enhance creativity&#10;Tech and productivity">${_esc((c.mkAlignYes || []).join('\n'))}</textarea>
        </div>
        <div class="form-group">
          <label>Brand Alignment — Not a Fit (one per line)</label>
          <textarea id="setMkAlignNo" rows="4" placeholder="Rev-share only deals">${_esc((c.mkAlignNo || []).join('\n'))}</textarea>
        </div>
      </div>
      <div class="form-group">
        <label>Audience Interest Tags (one per line)</label>
        <textarea id="setMkInterests" rows="3" placeholder="Photography&#10;Video Editing">${_esc((c.mkInterests || []).join('\n'))}</textarea>
      </div>
      <div class="settings-actions">
        <button class="btn btn-primary" onclick="saveProfile()">Save Profile</button>
      </div>
    </div>
  `;
}

function _mkLines(id) {
  const el = document.getElementById(id);
  if (!el) return [];
  return el.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20);
}

async function saveProfile() {
  if (!_sb || !CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  const updates = {
    name: document.getElementById('setProfileName').value.trim(),
    brand: document.getElementById('setProfileBrand').value.trim(),
    entity: document.getElementById('setProfileEntity').value.trim(),
    email: document.getElementById('setProfileEmail').value.trim(),
    niche: document.getElementById('setProfileNiche').value.trim(),
    mk_contact_email: document.getElementById('setMkContact').value.trim(),
    mk_align_yes: _mkLines('setMkAlignYes'),
    mk_align_no: _mkLines('setMkAlignNo'),
    mk_interests: _mkLines('setMkInterests'),
  };
  const { error } = await _sb.from('profiles').update(updates).eq('id', CREATOR._sbId);
  if (error) { _showSaveError('Failed: ' + error.message); return; }
  Object.assign(CREATOR, {
    name: updates.name, brand: updates.brand, entity: updates.entity,
    email: updates.email, niche: updates.niche,
    mkContactEmail: updates.mk_contact_email,
    mkAlignYes: updates.mk_align_yes, mkAlignNo: updates.mk_align_no,
    mkInterests: updates.mk_interests
  });
  updateSidebarUser();
  _showSaveSuccess();
}

/* ---- SETTINGS: Platforms tab ---- */
function renderPlatformsSettings() {
  const platformsObj = (CREATOR && CREATOR.platforms) || {};
  const platformOrder = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'];
  const rows = platformOrder.map(key => {
    const p = platformsObj[key] || {};
    return `
      <div class="platform-row" data-platform="${key}">
        <div class="platform-name">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
        <div class="form-row">
          <div class="form-group">
            <label>Handle</label>
            <input type="text" id="setPlat_${key}_handle" value="${_esc(p.handle)}" placeholder="@yourname">
          </div>
          <div class="form-group">
            <label>Followers</label>
            <input type="number" id="setPlat_${key}_followers" value="${p.followersNum || 0}" placeholder="0">
          </div>
        </div>
      </div>
    `;
  }).join('');
  return `
    <div class="settings-card">
      <h3>Platform Accounts</h3>
      <p class="settings-help">Your follower counts drive rate suggestions and appear in your media kit.</p>
      ${rows}
      <div class="settings-actions">
        <button class="btn btn-primary" onclick="savePlatforms()">Save Platforms</button>
      </div>
    </div>
  `;
}

async function savePlatforms() {
  if (!_sb || !CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  const keys = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'];
  let errors = 0;
  for (const key of keys) {
    const handle = document.getElementById(`setPlat_${key}_handle`)?.value.trim() || '';
    const followers = parseInt(document.getElementById(`setPlat_${key}_followers`)?.value) || 0;
    const p = CREATOR.platforms[key];
    if (!p) continue;

    const updates = { handle, followers, followers_display: _formatFollowers(followers) };
    if (p._sbId) {
      const { error } = await _sb.from('platforms').update(updates).eq('id', p._sbId);
      if (error) { errors++; continue; }
    } else {
      const { data, error } = await _sb.from('platforms').insert({
        user_id: CREATOR._sbId, platform: key, ...updates
      }).select().single();
      if (error) { errors++; continue; }
      if (data) p._sbId = data.id;
    }
    p.handle = handle;
    p.followersNum = followers;
    p.followers = _formatFollowers(followers);
  }
  if (errors > 0) _showSaveError(`${errors} platform(s) failed to save`);
  else _showSaveSuccess();
}

function _formatFollowers(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n/1000000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1000) return (n/1000).toFixed(1).replace('.0','') + 'K';
  return String(n);
}

/* ---- SETTINGS: Rate Card tab ---- */
function renderRateCardSettings() {
  const rc = RATE_CARD || {};
  const categories = [
    ['organic', 'Organic Content'],
    ['ugc', 'UGC'],
    ['tiktok', 'TikTok'],
    ['youtube', 'YouTube'],
    ['bundles', 'Bundles'],
  ];
  const sections = categories.map(([key, label]) => {
    const items = rc[key] || [];
    const rows = items.map((r, idx) => `
      <div class="rate-row" data-key="${key}" data-idx="${idx}" data-sbid="${r._sbId || ''}">
        <input type="text" class="rate-name" value="${_esc(r.name)}" placeholder="Deliverable">
        <input type="number" class="rate-value" value="${r.rate || 0}" placeholder="0">
        <button class="btn-icon btn-danger" onclick="deleteRateRow('${key}', ${idx})" title="Delete">×</button>
      </div>
    `).join('');
    return `
      <div class="rate-category">
        <div class="rate-cat-header">
          <h4>${label}</h4>
          <button class="btn btn-secondary btn-sm" onclick="addRateRow('${key}')">+ Add</button>
        </div>
        ${rows || '<p class="rate-empty">No rates. Click Add to create one.</p>'}
      </div>
    `;
  }).join('');

  return `
    <div class="settings-card">
      <h3>Rate Card</h3>
      <p class="settings-help">Set your rates for each deliverable type. These appear in your contracts and rate proposals.</p>

      <div class="form-row">
        <div class="form-group">
          <label>Minimum Rate ($)</label>
          <input type="number" id="setRateMin" value="${rc.minimumRate || ''}" placeholder="e.g. 15000">
        </div>
        <div class="form-group">
          <label>Pricing Rule</label>
          <input type="text" id="setRatePricingRule" value="${_esc(rc.pricingRule)}" placeholder="e.g. 6% of follower count">
        </div>
      </div>

      ${sections}

      <div class="settings-actions">
        <button class="btn btn-primary" onclick="saveRateCard()">Save All Rates</button>
      </div>
    </div>
  `;
}

function addRateRow(key) {
  RATE_CARD[key] = RATE_CARD[key] || [];
  RATE_CARD[key].push({ name: '', rate: 0, _new: true });
  renderSettings();
  switchSettingsTab('ratecard');
}

async function deleteRateRow(key, idx) {
  const item = RATE_CARD[key]?.[idx];
  if (!item) return;
  if (item._sbId && _sb) {
    await _sb.from('rate_cards').delete().eq('id', item._sbId);
  }
  RATE_CARD[key].splice(idx, 1);
  renderSettings();
  switchSettingsTab('ratecard');
}

async function saveRateCard() {
  if (!_sb || !CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  // Save minimum rate + pricing rule to rate_card_settings
  const minRate = parseInt(document.getElementById('setRateMin').value) || 15000;
  const pricingRule = document.getElementById('setRatePricingRule').value.trim();

  const settingsRes = await _sb.from('rate_card_settings').select('id').eq('user_id', CREATOR._sbId).maybeSingle();
  if (settingsRes.data) {
    await _sb.from('rate_card_settings').update({ minimum_rate: minRate, pricing_rule: pricingRule }).eq('id', settingsRes.data.id);
  } else {
    await _sb.from('rate_card_settings').insert({ user_id: CREATOR._sbId, minimum_rate: minRate, pricing_rule: pricingRule });
  }
  RATE_CARD.minimumRate = minRate;
  RATE_CARD.pricingRule = pricingRule;

  // Save each rate row
  const rows = document.querySelectorAll('.rate-row');
  let errors = 0;
  for (const row of rows) {
    const key = row.dataset.key;
    const idx = parseInt(row.dataset.idx);
    const sbId = row.dataset.sbid;
    const name = row.querySelector('.rate-name').value.trim();
    const rate = parseInt(row.querySelector('.rate-value').value) || 0;
    if (!name) continue; // skip empty rows

    if (sbId) {
      const { error } = await _sb.from('rate_cards').update({ name, rate }).eq('id', sbId);
      if (error) errors++;
      else if (RATE_CARD[key]?.[idx]) { RATE_CARD[key][idx].name = name; RATE_CARD[key][idx].rate = rate; }
    } else {
      const { data, error } = await _sb.from('rate_cards').insert({
        user_id: CREATOR._sbId, category: key, item_id: 'custom_' + Date.now(),
        name, rate, sort_order: idx
      }).select().single();
      if (error) errors++;
      else if (data && RATE_CARD[key]?.[idx]) {
        RATE_CARD[key][idx]._sbId = data.id;
        RATE_CARD[key][idx].name = name;
        RATE_CARD[key][idx].rate = rate;
        delete RATE_CARD[key][idx]._new;
      }
    }
  }
  if (errors > 0) _showSaveError(`${errors} rate(s) failed`);
  else _showSaveSuccess();
}

/* ---- SETTINGS: Contract Defaults tab ---- */
function renderContractSettingsPanel() {
  // CONTRACT_DEFAULTS is defined in toolkit-views.js
  const cd = (typeof CONTRACT_DEFAULTS !== 'undefined') ? CONTRACT_DEFAULTS : {
    creatorEntity: '', creatorDBA: '', creatorTitle: '', creatorState: '',
    revisionExtraCost: 500, paidMediaFloor: 5000, crossPostFee: 30,
    nonDisparagement: 6, mediationDays: 30, forceMajeureDays: 30,
    contentExclusions: '', invoiceMethod: 'email', paymentMethod: 'wire transfer or ACH',
    approvalConsequence: 'approval of the Content as delivered'
  };
  return `
    <div class="settings-card">
      <h3>Contract Defaults</h3>
      <p class="settings-help">These values are inserted into every contract you generate. Adjust them once, use them everywhere.</p>
      <div class="form-row">
        <div class="form-group"><label>Signing Entity</label><input type="text" id="cdEntity" value="${_esc(cd.creatorEntity)}"></div>
        <div class="form-group"><label>Doing Business As (DBA)</label><input type="text" id="cdDBA" value="${_esc(cd.creatorDBA)}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Signing Title</label><input type="text" id="cdTitle" value="${_esc(cd.creatorTitle)}"></div>
        <div class="form-group"><label>Home State</label><input type="text" id="cdState" value="${_esc(cd.creatorState)}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Extra Revision Cost ($)</label><input type="number" id="cdRevCost" value="${cd.revisionExtraCost}"></div>
        <div class="form-group"><label>Paid Media Floor ($/mo)</label><input type="number" id="cdPaidFloor" value="${cd.paidMediaFloor}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Cross-Post Fee (%)</label><input type="number" id="cdCrossPost" value="${cd.crossPostFee}"></div>
        <div class="form-group"><label>Non-Disparagement (months)</label><input type="number" id="cdNonDisp" value="${cd.nonDisparagement}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Mediation Period (days)</label><input type="number" id="cdMedDays" value="${cd.mediationDays}"></div>
        <div class="form-group"><label>Force Majeure Termination (days)</label><input type="number" id="cdFMDays" value="${cd.forceMajeureDays}"></div>
      </div>
      <div class="form-group">
        <label>Content Definition Exclusions</label>
        <input type="text" id="cdExclusions" value="${_esc(cd.contentExclusions)}">
      </div>
      <div class="form-row">
        <div class="form-group"><label>Invoice Method</label><input type="text" id="cdInvoiceMethod" value="${_esc(cd.invoiceMethod)}"></div>
        <div class="form-group"><label>Payment Method</label><input type="text" id="cdPaymentMethod" value="${_esc(cd.paymentMethod)}"></div>
      </div>
      <div class="form-group">
        <label>Approval Consequence (client misses deadline)</label>
        <input type="text" id="cdApprovalConsequence" value="${_esc(cd.approvalConsequence)}">
      </div>
      <div class="settings-actions">
        <button class="btn btn-primary" onclick="saveContractDefaults()">Save Contract Defaults</button>
      </div>
    </div>
  `;
}

/* ---- SETTINGS: Audience tab ---- */
function renderAudienceSettings() {
  const a = AUDIENCE_DATA || {};
  return `
    <div class="settings-card">
      <h3>Audience Demographics</h3>
      <p class="settings-help">Appears in your media kit and helps brands understand your fit.</p>
      <div class="form-row">
        <div class="form-group">
          <label>Primary Age Range</label>
          <input type="text" id="setAudAgeRange" value="${_esc(a.ageRange)}" placeholder="18-34">
        </div>
        <div class="form-group">
          <label>Top Age Group</label>
          <input type="text" id="setAudTopAge" value="${_esc(a.topAge)}" placeholder="25-34 (42%)">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Male %</label>
          <input type="number" id="setAudMale" value="${a.gender?.male || 0}" min="0" max="100">
        </div>
        <div class="form-group">
          <label>Female %</label>
          <input type="number" id="setAudFemale" value="${a.gender?.female || 0}" min="0" max="100">
        </div>
      </div>
      <div class="settings-actions">
        <button class="btn btn-primary" onclick="saveAudience()">Save Audience</button>
      </div>
    </div>
  `;
}

async function saveAudience() {
  if (!_sb || !CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  const ageRange = document.getElementById('setAudAgeRange').value.trim();
  const topAge = document.getElementById('setAudTopAge').value.trim();
  const male = parseInt(document.getElementById('setAudMale').value) || 0;
  const female = parseInt(document.getElementById('setAudFemale').value) || 0;

  AUDIENCE_DATA.ageRange = ageRange;
  AUDIENCE_DATA.topAge = topAge;
  AUDIENCE_DATA.gender = { male, female };

  // Upsert into audience_data rows keyed by category
  try {
    await _sb.from('audience_data').upsert({
      user_id: CREATOR._sbId, category: 'gender', data: { Male: male, Female: female }
    }, { onConflict: 'user_id,category' });
    _showSaveSuccess();
  } catch (e) {
    _showSaveError('Failed: ' + e.message);
  }
}

/* ---- SETTINGS: Danger Zone / Account tab ---- */
function renderDangerZone() {
  return `
    <div class="settings-card">
      <h3>Account</h3>
      <p class="settings-help">Signed in as <strong>${_esc(_authUser?.email || '—')}</strong></p>
      <div class="settings-actions">
        <button class="btn btn-secondary" onclick="exportAllData()">Export All Data (JSON)</button>
        <button class="btn btn-danger" onclick="handleLogout()">Sign Out</button>
      </div>
    </div>
  `;
}

async function exportAllData() {
  const dump = {
    exportedAt: new Date().toISOString(),
    profile: CREATOR,
    rateCard: RATE_CARD,
    deals: DEALS,
    invoices: INVOICE_DATA,
    audience: AUDIENCE_DATA,
    campaigns: CAMPAIGN_RESULTS,
    inbox: INBOX_ITEMS,
    calendarEvents: CALENDAR_EVENTS,
    monthlyRevenue: MONTHLY_REVENUE,
    outreachTemplates: OUTREACH_TEMPLATES,
    contractDefaults: (typeof CONTRACT_DEFAULTS !== 'undefined') ? CONTRACT_DEFAULTS : {},
  };
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `arkives-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  _showSaveSuccess();
}

/* Utility: escape for HTML attribute values */
function _esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---- SAFE STORAGE (works in sandboxed iframes) ---- */
const _memStore = {};
const _ls = (function(){ try { return window['local'+'Storage']; } catch(e){ return null; } })();
function safeGet(key) {
  try { if(_ls){ const v = _ls.getItem(key); if (v !== null) return v; } } catch(e) {}
  return _memStore[key] || null;
}
function safeSet(key, val) {
  _memStore[key] = val;
  try { if(_ls) _ls.setItem(key, val); } catch(e) {}
}

/* ---- INVOICES ----
   State lives here (loaded by sbFetchAllData); the view — list,
   two-pane editor, document render, print export — lives in
   invoices.js. */
let INVOICE_DATA = [];
let CLIENTS = [];
let _invoicingMigrationMissing = false;

/* ---- OUTREACH ----
   State lives here (loaded by sbFetchAllData); the view — the
   Analytics → Outreach tab: lists rail, table, detail drawer —
   lives in outreach.js. */
let OUTREACH_TARGETS = [];
let OUTREACH_LISTS = [];
let _outreachMigrationMissing = false;

function _mapOutreachRow(r) {
  return {
    _sbId: r.id,
    name: r.name || '',
    type: r.type || 'brand',
    website: r.website || '',
    pitch: r.pitch || '',
    status: r.status || 'not_contacted',
    initiatedBy: r.initiated_by || 'none',
    projects: Array.isArray(r.projects) ? r.projects : [],
    notes: r.notes || '',
    listIds: Array.isArray(r.list_ids) ? r.list_ids : [],
    createdAt: r.created_at || '',
    updatedAt: r.updated_at || ''
  };
}

function _mapInvoiceRow(r) {
  return {
    _sbId: r.id,
    invoiceNumber: r.invoice_number || '',
    brand: r.brand || '',
    clientId: r.client_id || null,
    billToName: r.bill_to_name || r.brand || '',
    billToAddress: r.bill_to_address || '',
    lineItems: Array.isArray(r.line_items) ? r.line_items : [],
    amount: Number(r.amount) || 0,
    amountPaid: Number(r.amount_paid) || 0,
    tax: Number(r.tax) || 0,
    date: r.date || '',
    dueDate: r.due_date || '',
    status: r.status || 'draft',
    description: r.description || '',
    paymentTerms: r.payment_terms || 'none',
    notes: r.notes || '',
    includePaymentInfo: r.include_payment_info !== false
  };
}

/* ---- MEDIA KIT PDF EXPORT ---- */
// Brand mark for PDF headers, fetched once and cached as a data URL
let _brandLogoDataUrl = null;
async function _getBrandLogoDataUrl() {
  if (_brandLogoDataUrl) return _brandLogoDataUrl;
  try {
    const resp = await fetch('logo-black.png');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    _brandLogoDataUrl = await new Promise(resolve => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch (e) { _brandLogoDataUrl = null; }
  return _brandLogoDataUrl;
}

async function exportMediaKitPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF library is still loading. Please try again in a moment.');
    return;
  }
  var brandLogo = await _getBrandLogoDataUrl();
  try {
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  // Identity comes from the profile + platforms — nothing hardcoded
  var mkBrand = CREATOR.brand || CREATOR.name || 'Media Kit';
  var mkIgHandle = (CREATOR.platforms.instagram.handle || '').replace(/^@/, '');
  var mkContact = CREATOR.mkContactEmail || CREATOR.email || '';
  var mkTagline = (CREATOR.niche || '').replace(/\s*·\s*/g, '  |  ');
  function mkPlatformUrl(key) {
    var p = CREATOR.platforms[key] || {};
    if (p.profileUrl) return p.profileUrl;
    var h = (p.handle || '').replace(/^@/, '');
    if (!h) return '';
    switch (key) {
      case 'instagram': return 'https://instagram.com/' + h;
      case 'tiktok': return 'https://tiktok.com/@' + h;
      case 'youtube': return 'https://youtube.com/@' + h;
      case 'twitter': return 'https://x.com/' + h;
      case 'linkedin': return 'https://linkedin.com/in/' + h;
    }
    return '';
  }
  var W = doc.internal.pageSize.getWidth();
  var H = doc.internal.pageSize.getHeight();
  var M = 50;
  var CW = W - M * 2;

  // Brand colors
  var CREAM = [245, 241, 237];
  var TEXT_DARK = [26, 23, 20];
  var RED = [199, 53, 57];
  var TEAL = [42, 107, 90];
  var MUTED = [122, 121, 116];
  var BORDER_C = [26, 23, 20];
  var LIGHT_BG = [251, 249, 245];
  var DIVIDER = [212, 209, 202];

  function setColor(c) { doc.setTextColor(c[0], c[1], c[2]); }
  function setDraw(c) { doc.setDrawColor(c[0], c[1], c[2]); }
  function setFill(c) { doc.setFillColor(c[0], c[1], c[2]); }

  function drawPageBg() {
    setFill(CREAM);
    doc.rect(0, 0, W, H, 'F');
    setFill(RED);
    doc.rect(0, 0, W, 5, 'F');
  }

  function drawCard(x, y, w, h) {
    setFill(LIGHT_BG);
    setDraw(BORDER_C);
    doc.setLineWidth(1.5);
    doc.rect(x, y, w, h, 'FD');
  }

  // Section title: clean, no underline — just a red square bullet
  function sectionTitle(title, y) {
    setFill(RED);
    doc.rect(M, y - 8, 4, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    setColor(TEXT_DARK);
    doc.text(title, M + 10, y);
    return y + 22;
  }

  function pageFooter(pageNum, totalPages) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(mkBrand + "  |  Media Kit  |  " + new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), W / 2, H - 22, { align: 'center' });
    doc.text(pageNum + ' / ' + totalPages, W - M, H - 22, { align: 'right' });
    setFill(RED);
    doc.rect(0, H - 5, W, 5, 'F');
  }

  var PLATFORM_URLS = {
    instagram: mkPlatformUrl('instagram'),
    tiktok: mkPlatformUrl('tiktok'),
    youtube: mkPlatformUrl('youtube'),
    twitter: mkPlatformUrl('twitter'),
    linkedin: mkPlatformUrl('linkedin')
  };

  // ==================== PAGE 1 ====================
  drawPageBg();
  var Y = 38;

  // Brand logo (box mark) — 905x729 source, kept to aspect
  if (brandLogo) doc.addImage(brandLogo, 'PNG', M, Y - 13, 20.4, 16.4);

  // Brand name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  setColor(TEXT_DARK);
  doc.text(mkBrand, brandLogo ? M + 30 : M, Y);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(MUTED);
  doc.text('MEDIA KIT  |  ' + new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), M + 28, Y + 13);

  Y += 32;

  // Divider
  setDraw(RED);
  doc.setLineWidth(2);
  doc.line(M, Y, M + 50, Y);
  setDraw(DIVIDER);
  doc.setLineWidth(0.5);
  doc.line(M + 52, Y, W - M, Y);

  Y += 18;

  // Creator info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(TEXT_DARK);
  if (mkIgHandle) doc.text('@' + mkIgHandle, M, Y);
  setColor(MUTED);
  if (mkTagline) doc.text(mkTagline, mkIgHandle ? M + 80 : M, Y);
  setColor(TEAL);
  if (mkContact) doc.text(mkContact, W - M, Y, { align: 'right' });

  Y += 24;

  // ---- TOTAL REACH BANNER ----
  var totalFollowers = Object.values(CREATOR.platforms).reduce(function(s, p) { return s + p.followersNum; }, 0);
  var reachStr = totalFollowers >= 1000000 ? (totalFollowers / 1000000).toFixed(1) + 'M' : (totalFollowers / 1000).toFixed(1) + 'K';

  drawCard(M, Y, CW, 48);

  // Left side: TOTAL REACH label + big number side by side
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(MUTED);
  doc.text('TOTAL REACH', M + 14, Y + 20);

  doc.setFontSize(22);
  setColor(RED);
  doc.text(reachStr, M + 14, Y + 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(MUTED);
  var reachNumW = doc.getTextWidth(reachStr);
  doc.setFontSize(22);
  reachNumW = doc.getTextWidth(reachStr);
  doc.setFontSize(9);
  doc.text('across all platforms', M + 16 + reachNumW + 8, Y + 38);

  // Right: engagement
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(TEAL);
  doc.text(CREATOR.platforms.instagram.engagement + ' IG Engagement', W - M - 14, Y + 30, { align: 'right' });

  Y += 68;

  // ---- PLATFORM PRESENCE ----
  Y = sectionTitle('Platform Presence', Y);

  var platforms = [
    { key: 'instagram', name: 'Instagram', followers: CREATOR.platforms.instagram.followers, detail: CREATOR.platforms.instagram.engagement + ' Engagement', icon: 'IG' },
    { key: 'tiktok', name: 'TikTok', followers: CREATOR.platforms.tiktok.followers, detail: CREATOR.platforms.tiktok.likes + ' Total Likes', icon: 'TT' },
    { key: 'youtube', name: 'YouTube', followers: CREATOR.platforms.youtube.followers, detail: CREATOR.platforms.youtube.videos + ' Videos', icon: 'YT' },
    { key: 'twitter', name: 'Twitter / X', followers: CREATOR.platforms.twitter.followers, detail: 'New Account', icon: 'X' },
    { key: 'linkedin', name: 'LinkedIn', followers: CREATOR.platforms.linkedin.followers, detail: CREATOR.platforms.linkedin.connections + ' Connections', icon: 'LI' }
  ];

  var cardW = (CW - 16) / 3;
  var cardH = 56;
  platforms.forEach(function(p, i) {
    var col = i % 3;
    var row = Math.floor(i / 3);
    var cx = M + col * (cardW + 8);
    var cy = Y + row * (cardH + 10);

    drawCard(cx, cy, cardW - 2, cardH);

    // Clickable link on the card (only when the platform has a URL)
    if (PLATFORM_URLS[p.key]) doc.link(cx, cy, cardW - 2, cardH, { url: PLATFORM_URLS[p.key] });

    // Icon circle
    var iconColors = { IG: [225, 48, 108], TT: [0, 0, 0], YT: [255, 0, 0], X: [0, 0, 0], LI: [0, 119, 181] };
    setFill(iconColors[p.icon] || TEXT_DARK);
    doc.circle(cx + 17, cy + 19, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(p.icon, cx + 17, cy + 21.5, { align: 'center' });

    // Follower count
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    setColor(TEXT_DARK);
    doc.text(String(p.followers), cx + 33, cy + 18);

    // Platform name
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setColor(MUTED);
    doc.text(p.name, cx + 33, cy + 29);

    // Detail stat
    doc.setFontSize(7);
    setColor(TEAL);
    doc.text(p.detail, cx + 33, cy + 40);
  });

  Y += Math.ceil(platforms.length / 3) * (cardH + 10) + 20;

  // ---- AUDIENCE DEMOGRAPHICS ----
  Y = sectionTitle('Audience Demographics', Y);

  var halfW = (CW - 14) / 2;

  // Left card: Age + Gender
  drawCard(M, Y, halfW, 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text('AGE RANGE', M + 12, Y + 16);
  doc.setFontSize(16);
  setColor(TEXT_DARK);
  doc.text(AUDIENCE_DATA.ageRange, M + 12, Y + 33);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text('Core: ' + AUDIENCE_DATA.topAge, M + 12, Y + 44);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text('GENDER', M + 12, Y + 62);
  var barX = M + 12;
  var barW = halfW - 24;
  var barY2 = Y + 68;
  var maleW = barW * (AUDIENCE_DATA.gender.male / 100);
  setFill(TEAL);
  doc.rect(barX, barY2, maleW, 12, 'F');
  setFill(RED);
  doc.rect(barX + maleW, barY2, barW - maleW, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(AUDIENCE_DATA.gender.male + '% M', barX + 6, barY2 + 9);
  doc.text(AUDIENCE_DATA.gender.female + '% F', barX + maleW + 6, barY2 + 9);

  // Right card: Top Locations (FIXED: bars stay inside card)
  var rX = M + halfW + 14;
  drawCard(rX, Y, halfW, 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(MUTED);
  doc.text('TOP LOCATIONS', rX + 12, Y + 16);

  var locLabelW = 70;
  var locPctW = 28;
  var locBarMaxW = halfW - locLabelW - locPctW - 30;
  AUDIENCE_DATA.topCountries.forEach(function(c, i) {
    var ly = Y + 30 + i * 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(TEXT_DARK);
    doc.text(c.name, rX + 12, ly);
    // Bar bg
    setFill([230, 226, 220]);
    doc.rect(rX + locLabelW + 14, ly - 5, locBarMaxW, 6, 'F');
    // Bar fill
    setFill(TEAL);
    doc.rect(rX + locLabelW + 14, ly - 5, locBarMaxW * (c.pct / 100), 6, 'F');
    // Pct
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setColor(MUTED);
    doc.text(c.pct + '%', rX + locLabelW + 14 + locBarMaxW + 4, ly);
  });

  Y += 122;

  // ---- BRAND ALIGNMENT ----
  Y = sectionTitle('Brand Alignment', Y);

  // Tags
  var tagX = M;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  AUDIENCE_DATA.interests.forEach(function(interest) {
    var tw = doc.getTextWidth(interest) + 14;
    if (tagX + tw > W - M) {
      tagX = M;
      Y += 18;
    }
    setFill([230, 226, 220]);
    setDraw(BORDER_C);
    doc.setLineWidth(0.7);
    doc.rect(tagX, Y - 8, tw, 16, 'FD');
    setColor(TEXT_DARK);
    doc.text(interest, tagX + 7, Y + 2);
    tagX += tw + 5;
  });

  Y += 22;

  var alignYes = CREATOR.mkAlignYes || [];
  var alignNo = CREATOR.mkAlignNo || [];

  alignYes.forEach(function(item) {
    setFill(TEAL);
    doc.circle(M + 5, Y - 2, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('+', M + 5, Y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setColor(TEXT_DARK);
    doc.text(item, M + 16, Y);
    Y += 13;
  });
  alignNo.forEach(function(item) {
    setFill(RED);
    doc.circle(M + 5, Y - 2, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('-', M + 5, Y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setColor(TEXT_DARK);
    doc.text(item, M + 16, Y);
    Y += 13;
  });

  pageFooter('1', '2');

  // ==================== PAGE 2 ====================
  doc.addPage();
  drawPageBg();
  Y = 36;

  // ---- CAMPAIGN PERFORMANCE ----
  Y = sectionTitle('Campaign Performance', Y);

  var campCardW = (CW - 16) / 3;
  var campCardH = 78;
  CAMPAIGN_RESULTS.forEach(function(c, i) {
    var cx = M + i * (campCardW + 8);
    drawCard(cx, Y, campCardW - 4, campCardH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(TEXT_DARK);
    doc.text(c.brand, cx + 10, Y + 16);

    var stats = [
      { label: 'Views', value: c.views ? (c.views >= 1000000 ? (c.views / 1000000).toFixed(1) + 'M' : (c.views / 1000).toFixed(0) + 'K') : '--' },
      { label: 'CTR', value: c.ctr || '--' },
      { label: 'Conv.', value: c.conversion || '--' }
    ];
    if (c.revenue) stats.push({ label: 'Revenue', value: '$' + (c.revenue / 1000).toFixed(0) + 'K' });

    var statSpacing = (campCardW - 24) / stats.length;
    stats.forEach(function(s, si) {
      var sx = cx + 10 + si * statSpacing;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      setColor(si === stats.length - 1 && c.revenue ? TEAL : TEXT_DARK);
      doc.text(s.value, sx, Y + 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      setColor(MUTED);
      doc.text(s.label, sx, Y + 54);
    });
  });

  Y += campCardH + 28;

  // ---- RATE CARD ----
  Y = sectionTitle('Rate Card', Y);

  // Organic
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(RED);
  doc.text('Organic Content', M, Y);
  Y += 14;

  setFill([230, 226, 220]);
  doc.rect(M, Y - 9, CW, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text('DELIVERABLE', M + 8, Y);
  doc.text('RATE', W - M - 8, Y, { align: 'right' });
  Y += 14;

  RATE_CARD.organic.forEach(function(r) {
    setDraw(DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(M, Y + 3, W - M, Y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(TEXT_DARK);
    doc.text(r.name, M + 8, Y);
    doc.setFont('helvetica', 'bold');
    doc.text('$' + r.rate.toLocaleString(), W - M - 8, Y, { align: 'right' });
    Y += 15;
  });

  Y += 16;

  // UGC
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(RED);
  doc.text('UGC Content', M, Y);
  Y += 14;

  setFill([230, 226, 220]);
  doc.rect(M, Y - 9, CW, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setColor(MUTED);
  doc.text('DELIVERABLE', M + 8, Y);
  doc.text('RATE', W - M - 8, Y, { align: 'right' });
  Y += 14;

  RATE_CARD.ugc.forEach(function(r) {
    setDraw(DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(M, Y + 3, W - M, Y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(TEXT_DARK);
    doc.text(r.name, M + 8, Y);
    doc.setFont('helvetica', 'bold');
    doc.text('$' + r.rate.toLocaleString(), W - M - 8, Y, { align: 'right' });
    Y += 15;
  });

  Y += 16;

  // Bundles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setColor(RED);
  doc.text('Bundles', M, Y);
  Y += 14;

  var bundleCardW = (CW - 10) / 2;
  RATE_CARD.bundles.forEach(function(b, i) {
    var col = i % 2;
    var row = Math.floor(i / 2);
    var bx = M + col * (bundleCardW + 10);
    var by = Y + row * 44;

    drawCard(bx, by, bundleCardW - 2, 36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(TEXT_DARK);
    doc.text(b.name, bx + 10, by + 15, { maxWidth: bundleCardW - 72 });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    setColor(RED);
    doc.text('$' + b.rate.toLocaleString(), bx + bundleCardW - 14, by + 18, { align: 'right' });
  });

  Y += Math.ceil(RATE_CARD.bundles.length / 2) * 44 + 16;

  // Terms
  drawCard(M, Y, CW, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setColor(MUTED);
  doc.text('All pricing is flat-rate. NET 30 terms. Licensing, exclusivity, and paid ad usage rights available as add-ons.', M + 12, Y + 12, { maxWidth: CW - 24 });

  Y += 44;

  // Contact footer
  setDraw(BORDER_C);
  doc.setLineWidth(1.5);
  doc.line(M, Y, W - M, Y);
  Y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(TEXT_DARK);
  doc.text("Let's Work Together", M, Y);
  Y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(TEAL);
  if (mkContact) doc.text(mkContact, M, Y);

  pageFooter('2', '2');

  doc.setProperties({
    title: mkBrand + ' - Media Kit',
    author: CREATOR.name || mkBrand,
    subject: 'Creator Media Kit',
    creator: 'Arkives CRM'
  });

  doc.save((mkBrand.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Media_Kit') + '_Media_Kit.pdf');
  } catch (err) {
    console.error('PDF export error:', err);
    alert('Error generating PDF: ' + err.message);
  }
}
/* =========================================
   SCRIPTS / STORYBOARD TOOL
   ========================================= */

var _scriptsCache = [];
var _currentScriptId = null;
var _currentScriptRow = null;   // full script row from renderScriptEditor (share popover needs share_token/mode)
var _currentScenes = [];
var _scriptAutoSaveTimer = null;

/* ---- SHARE POPOVER PLUMBING (shared by Boards and Scripts) ---- */

/* Link rows for a share popover: one row when mode=view, labeled
   view + edit rows when mode=edit. Copy handled by the global
   .bd-share-copy listener below. */
function _shareLinkRowsHtml(mode, viewLink, editLink) {
  function row(link) {
    return '<div class="bd-share-linkrow"><input type="text" readonly value="' + link + '">' +
      '<button class="btn btn-primary bd-share-copy" data-link="' + link + '">Copy</button></div>';
  }
  if (mode === 'edit') {
    return '<div class="bd-share-linklabel">View link</div>' + row(viewLink) +
           '<div class="bd-share-linklabel">Edit link</div>' + row(editLink);
  }
  return row(viewLink);
}

document.addEventListener('click', function(e) {
  /* Click outside a share popover closes it (both Boards and Scripts) */
  ['scSharePopover', 'bdSharePopover'].forEach(function(id) {
    var pop = document.getElementById(id);
    if (pop && pop.style.display !== 'none' &&
        !e.target.closest('#' + id + ', #scShareBtn, #bdShareBtn')) {
      pop.style.display = 'none';
    }
  });
  var btn = e.target.closest('.bd-share-copy');
  if (!btn) return;
  var link = btn.getAttribute('data-link');
  navigator.clipboard.writeText(link).then(function() {
    btn.textContent = 'Copied';
    setTimeout(function() { btn.textContent = 'Copy'; }, 1400);
  }).catch(function() {
    var input = btn.parentElement.querySelector('input');
    if (input) { input.select(); document.execCommand('copy'); }
  });
});
/* Shared-link session (#shared/TOKEN[/edit]): when set, every script
   read/write routes through the token-gated RPCs from migration 018
   instead of direct table access (which RLS blocks for anon). */
var _sharedScriptToken = null;
var _sharedScriptMode = 'view';

function _scriptRerender() {
  if (_sharedScriptToken) renderSharedScript(_sharedScriptToken, _sharedScriptMode);
  else renderScriptEditor(_currentScriptId);
}

/* Scene field saves route through here so shared-edit sessions work.
   fields may hold script_text / scene_description / thumbnail_data. */
async function _saveSceneFields(sceneId, fields) {
  if (!_sb) return;
  try {
    if (_sharedScriptToken) {
      var res = await _sb.rpc('patch_shared_scene', {
        p_token: _sharedScriptToken, p_scene_id: sceneId,
        p_script_text: ('script_text' in fields) ? fields.script_text : null,
        p_scene_description: ('scene_description' in fields) ? fields.scene_description : null,
        p_thumbnail_data: ('thumbnail_data' in fields) ? fields.thumbnail_data : null
      });
      if (res.error) throw res.error;
    } else {
      var res2 = await _sb.from('script_scenes').update(fields).eq('id', sceneId);
      if (res2.error) throw res2.error;
    }
  } catch (e) { console.error('scene save error:', e); throw e; }
}
var _dragSrcIdx = null;

/* ---- SUPABASE CRUD FOR SCRIPTS ---- */
async function sbFetchScripts() {
  if (!_sb) return [];
  try {
    var res = await _sb.from('scripts').select('*').order('updated_at', { ascending: false });
    if (res.error) { console.error('scripts fetch err:', res.error); return []; }
    _scriptsCache = res.data || [];
    return _scriptsCache;
  } catch (e) { console.error('scripts fetch exception:', e); return []; }
}

async function sbCreateScript(title) {
  if (!_sb) return null;
  try {
    var res = await _sb.from('scripts').insert({ title: title || 'Untitled Script' }).select().single();
    if (res.error) { console.error('script create err:', res.error); _showSaveError('Failed to create script'); return null; }
    /* Add one empty scene by default */
    await _sb.from('script_scenes').insert({ script_id: res.data.id, sort_order: 0, script_text: '', scene_description: '', thumbnail_data: '' });
    return res.data;
  } catch (e) { console.error('script create exception:', e); return null; }
}

async function sbDeleteScript(scriptId) {
  if (!_sb) return;
  try {
    await _sb.from('scripts').delete().eq('id', scriptId);
  } catch (e) { console.error('script delete exception:', e); }
}

async function sbUpdateScript(scriptId, updates) {
  if (!_sb) return;
  try {
    if (_sharedScriptToken) {
      // Shared editors may only rename; share_mode etc. stay owner-only
      if ('title' in updates) {
        await _sb.rpc('update_shared_script_title', { p_token: _sharedScriptToken, p_title: updates.title });
      }
      return;
    }
    await _sb.from('scripts').update(updates).eq('id', scriptId);
  } catch (e) { console.error('script update exception:', e); }
}

async function sbFetchScenes(scriptId) {
  if (!_sb) return [];
  try {
    if (_sharedScriptToken) {
      var shRes = await _sb.rpc('get_shared_script_scenes', { p_token: _sharedScriptToken });
      if (shRes.error) { console.error('shared scenes fetch err:', shRes.error); return []; }
      return shRes.data || [];
    }
    var res = await _sb.from('script_scenes').select('*').eq('script_id', scriptId).order('sort_order', { ascending: true });
    if (res.error) { console.error('scenes fetch err:', res.error); return []; }
    return res.data || [];
  } catch (e) { console.error('scenes fetch exception:', e); return []; }
}

async function sbUpsertScene(scene) {
  if (!_sb) return null;
  try {
    var res = await _sb.from('script_scenes').upsert(scene).select().single();
    if (res.error) { console.error('scene upsert err:', res.error); return null; }
    return res.data;
  } catch (e) { console.error('scene upsert exception:', e); return null; }
}

async function sbDeleteScene(sceneId) {
  if (!_sb) return;
  try {
    if (_sharedScriptToken) {
      await _sb.rpc('delete_shared_scene', { p_token: _sharedScriptToken, p_scene_id: sceneId });
      return;
    }
    await _sb.from('script_scenes').delete().eq('id', sceneId);
  } catch (e) { console.error('scene delete exception:', e); }
}

async function sbReorderScenes(scenes) {
  if (!_sb || !scenes.length) return;
  try {
    if (_sharedScriptToken) {
      await _sb.rpc('reorder_shared_scenes', {
        p_token: _sharedScriptToken,
        p_scene_ids: scenes.map(function(s) { return s.id; })
      });
      return;
    }
    var updates = scenes.map(function(s, i) { return { id: s.id, script_id: s.script_id, sort_order: i }; });
    await _sb.from('script_scenes').upsert(updates);
  } catch (e) { console.error('reorder exception:', e); }
}

async function sbFetchScriptByToken(token) {
  if (!_sb || !token) return null;
  // Strip any query string that may have leaked in from URL parsing
  var cleanToken = String(token).split('?')[0].split('&')[0].trim();
  if (!cleanToken) return null;
  try {
    // Token-gated RPC (018): works for logged-out visitors, where the
    // old direct table read came back empty under user-scoped RLS
    var res = await _sb.rpc('get_shared_script', { p_token: cleanToken });
    if (res.error) { console.error('sbFetchScriptByToken error:', res.error); return null; }
    return (res.data && res.data[0]) || null;
  } catch (e) { console.error('sbFetchScriptByToken exception:', e); return null; }
}

/* ---- SCRIPTS LIST VIEW ---- */
async function renderScripts() {
  var container = document.getElementById('view-scripts');
  container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:200px;border-radius:12px"></div></div>';
  var scripts = await sbFetchScripts();
  var html = '<div class="scripts-page">';
  html += '<div class="scripts-header">';
  html += '<div><h2 class="view-title" style="margin:0">Scripts</h2><p style="color:var(--text-secondary);margin:4px 0 0;font-size:13px">Storyboards and video scripts</p></div>';
  html += '<button class="btn btn-primary" onclick="_createNewScript()">+ New Script</button>';
  html += '</div>';

  if (scripts.length === 0) {
    html += '<div class="scripts-empty">';
    html += '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><path d="M4 3h12l4 4v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M7 8h6"/><path d="M7 12h10"/><path d="M7 16h10"/></svg>';
    html += '<p style="color:var(--text-secondary);font-size:15px;margin:12px 0 0">No scripts yet. Create your first storyboard.</p>';
    html += '</div>';
  } else {
    html += '<div class="scripts-grid">';
    scripts.forEach(function(s) {
      var date = new Date(s.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      var shareLabel = s.share_mode === 'none' ? 'Private' : (s.share_mode === 'view' ? 'View link' : 'Edit link');
      var shareDot = s.share_mode === 'none' ? 'var(--text-secondary)' : 'var(--teal)';
      html += '<div class="script-card" onclick="window.location.hash=\'script/' + s.id + '\';">';
      html += '<div class="script-card-title">' + _escHtml(s.title) + '</div>';
      html += '<div class="script-card-meta">';
      html += '<span>' + date + '</span>';
      html += '<span style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:' + shareDot + ';display:inline-block"></span>' + shareLabel + '</span>';
      html += '</div>';
      html += '<button class="script-card-delete" onclick="event.stopPropagation(); _deleteScript(\'' + s.id + '\')" title="Delete script">' + SKETCHY_ICONS.trash + '</button>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

async function _createNewScript() {
  var script = await sbCreateScript('Untitled Script');
  if (script) {
    window.location.hash = 'script/' + script.id;
  }
}

async function _deleteScript(scriptId) {
  if (!confirm('Delete this script and all its scenes? This cannot be undone.')) return;
  await sbDeleteScript(scriptId);
  renderScripts();
}

function _escHtml(str) {
  if (!str) return '';
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* ---- SCRIPT EDITOR VIEW ---- */
async function renderScriptEditor(scriptId) {
  _sharedScriptToken = null;
  _currentScriptId = scriptId;
  var container = document.getElementById('view-script-editor');
  container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:300px;border-radius:12px"></div></div>';

  /* Fetch script + scenes */
  var scriptRes = await _sb.from('scripts').select('*').eq('id', scriptId).single();
  if (scriptRes.error || !scriptRes.data) {
    container.innerHTML = '<div style="padding:48px;text-align:center"><p>Script not found.</p><a href="#scripts" style="color:var(--accent)">Back to Scripts</a></div>';
    return;
  }
  var script = scriptRes.data;
  _currentScriptRow = script;
  _currentScenes = await sbFetchScenes(scriptId);

  _renderEditorUI(container, script, _currentScenes, false);
}

function _renderEditorUI(container, script, scenes, readOnly) {
  var html = '<div class="script-editor">';

  /* Top bar. In a shared session the owner controls (Back into the app,
     the Share modal) are hidden — visitors only get the editing surface. */
  var isSharedSession = !!_sharedScriptToken;
  html += '<div class="script-editor-topbar">';
  if (!readOnly && !isSharedSession) {
    html += '<a href="#scripts" class="script-back-btn">' + SKETCHY_ICONS.chevronLeft + ' Back</a>';
  }
  html += '<input type="text" class="script-title-input" id="scriptTitleInput" value="' + _escHtml(script.title) + '" ' + (readOnly ? 'disabled' : '') + ' placeholder="Script title..." />';
  if (!readOnly) {
    html += '<div class="script-topbar-actions">';
    if (!isSharedSession) {
      html += '<button class="bd-share-btn" id="scShareBtn">' + SKETCHY_ICONS.share + '<span id="scShareBtnLabel">' + (!script.share_mode || script.share_mode === 'none' ? 'Share' : 'Shared') + '</span></button>';
    } else {
      html += '<span class="script-readonly-badge">Shared — can edit</span>';
    }
    html += '<span class="script-save-indicator" id="scriptSaveIndicator">Saved</span>';
    html += '</div>';
  } else {
    html += '<span class="script-readonly-badge">View Only</span>';
  }
  if (!readOnly && !isSharedSession) {
    /* Same share popover as Boards (shared CSS classes + link-row builder) */
    html += '<div class="bd-share-popover" id="scSharePopover" style="display:none;right:16px">' +
      '<button class="bd-share-opt" data-share="none">Private</button>' +
      '<button class="bd-share-opt" data-share="view">Anyone with the link can view</button>' +
      '<button class="bd-share-opt" data-share="edit">Anyone with the link can edit</button>' +
      '<div id="scShareLinks"></div>' +
      '</div>';
  }
  html += '</div>';

  /* Scenes table */
  html += '<div class="script-scenes-wrapper">';
  html += '<div class="script-scenes-table">';
  /* Header row */
  html += '<div class="script-scene-header">';
  html += '<div class="script-col-num">#</div>';
  html += '<div class="script-col-script">SCRIPT</div>';
  html += '<div class="script-col-scene">SCENE</div>';
  html += '<div class="script-col-thumb">THUMBNAIL</div>';
  if (!readOnly) html += '<div class="script-col-actions"></div>';
  html += '</div>';

  /* Scene rows */
  if (scenes.length === 0 && !readOnly) {
    html += '<div style="padding:48px 24px;text-align:center;color:var(--text-secondary)">No scenes yet. Click "Add Scene" below.</div>';
  }
  scenes.forEach(function(scene, idx) {
    html += _renderSceneRow(scene, idx, readOnly);
  });

  html += '</div>'; /* end table */

  /* Add scene button */
  if (!readOnly) {
    html += '<button class="script-add-scene-btn" onclick="_addScene()">+ Add Scene</button>';
  }
  html += '</div>'; /* end wrapper */
  html += '</div>'; /* end editor */

  container.innerHTML = html;

  /* Bind events */
  if (!readOnly) {
    var titleInput = document.getElementById('scriptTitleInput');
    if (titleInput) {
      titleInput.addEventListener('input', function() {
        _scheduleAutoSave();
      });
    }
    _bindSceneEvents();
    _bindDragDrop();
    var scShareBtn = document.getElementById('scShareBtn');
    if (scShareBtn) {
      scShareBtn.addEventListener('click', function() {
        var pop = document.getElementById('scSharePopover');
        _scSyncSharePopover();
        pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
      });
      document.getElementById('scSharePopover').addEventListener('click', function(e) {
        var opt = e.target.closest('.bd-share-opt');
        if (opt) _scSetShareMode(opt.dataset.share);
      });
    }
  }
}

function _scShareLink() {
  return window.location.origin + window.location.pathname + '#shared/' + _currentScriptRow.share_token;
}

function _scSyncSharePopover() {
  var pop = document.getElementById('scSharePopover');
  if (!pop || !_currentScriptRow) return;
  var mode = (_currentScriptRow.share_mode === 'view' || _currentScriptRow.share_mode === 'edit') ? _currentScriptRow.share_mode : 'none';
  pop.querySelectorAll('.bd-share-opt').forEach(function(b) { b.classList.toggle('active', b.dataset.share === mode); });
  var links = document.getElementById('scShareLinks');
  if (links) links.innerHTML = mode === 'none' ? '' : _shareLinkRowsHtml(mode, _scShareLink(), _scShareLink() + '/edit');
  var label = document.getElementById('scShareBtnLabel');
  if (label) label.textContent = mode === 'none' ? 'Share' : 'Shared';
}

async function _scSetShareMode(mode) {
  if (mode !== 'none' && !_currentScriptRow.share_token) {
    _showSaveError('Sharing needs migration 018 — run it in Supabase first');
    return;
  }
  await sbUpdateScript(_currentScriptId, { share_mode: mode });
  _currentScriptRow.share_mode = mode;
  _scriptsCache.forEach(function(s) { if (s.id === _currentScriptId) s.share_mode = mode; });
  _scSyncSharePopover();
}

function _renderSceneRow(scene, idx, readOnly) {
  var html = '<div class="script-scene-row" data-scene-id="' + scene.id + '" data-idx="' + idx + '" ' + (readOnly ? '' : 'draggable="true"') + '>';
  html += '<div class="script-col-num">';
  if (!readOnly) html += '<span class="script-drag-handle" title="Drag to reorder">&#x2630;</span>';
  html += '<span class="script-scene-num">' + (idx + 1) + '</span>';
  html += '</div>';

  /* Script text */
  html += '<div class="script-col-script">';
  if (readOnly) {
    html += '<div class="script-cell-readonly">' + (_escHtml(scene.script_text) || '<span style="color:var(--text-secondary);font-style:italic">No script text</span>') + '</div>';
  } else {
    html += '<textarea class="script-cell-textarea" data-field="script_text" data-scene-id="' + scene.id + '" placeholder="Write your script here..." rows="4">' + _escHtml(scene.script_text) + '</textarea>';
  }
  html += '</div>';

  /* Scene description */
  html += '<div class="script-col-scene">';
  if (readOnly) {
    html += '<div class="script-cell-readonly">' + (_escHtml(scene.scene_description) || '<span style="color:var(--text-secondary);font-style:italic">No description</span>') + '</div>';
  } else {
    html += '<textarea class="script-cell-textarea" data-field="scene_description" data-scene-id="' + scene.id + '" placeholder="Describe the scene..." rows="4">' + _escHtml(scene.scene_description) + '</textarea>';
  }
  html += '</div>';

  /* Thumbnail */
  html += '<div class="script-col-thumb">';
  if (scene.thumbnail_data) {
    html += '<div class="script-thumb-preview">';
    html += '<img src="' + scene.thumbnail_data + '" alt="Scene thumbnail" />';
    if (!readOnly) {
      html += '<button class="script-thumb-remove" onclick="_removeThumb(\'' + scene.id + '\')" title="Remove thumbnail">&times;</button>';
    }
    html += '</div>';
  } else if (!readOnly) {
    html += '<label class="script-thumb-upload" for="thumbInput_' + scene.id + '">';
    html += '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    html += '<span>Upload image</span>';
    html += '<input type="file" id="thumbInput_' + scene.id + '" accept="image/*" style="display:none" onchange="_handleThumbUpload(this, \'' + scene.id + '\')" />';
    html += '</label>';
  } else {
    html += '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:16px">No thumbnail</div>';
  }
  html += '</div>';

  /* Actions */
  if (!readOnly) {
    html += '<div class="script-col-actions">';
    html += '<button class="script-row-action" onclick="_deleteSceneRow(\'' + scene.id + '\')" title="Delete scene">' + SKETCHY_ICONS.trash + '</button>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/* ---- SCENE EVENTS ---- */
function _bindSceneEvents() {
  document.querySelectorAll('.script-cell-textarea').forEach(function(ta) {
    ta.addEventListener('input', function() {
      _scheduleAutoSave();
    });
    /* Auto-resize */
    ta.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });
    /* Initial resize */
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  });
}

function _scheduleAutoSave() {
  var indicator = document.getElementById('scriptSaveIndicator');
  if (indicator) { indicator.textContent = 'Saving...'; indicator.style.color = 'var(--amber)'; }
  clearTimeout(_scriptAutoSaveTimer);
  _scriptAutoSaveTimer = setTimeout(function() { _saveAllSceneData(); }, 800);
}

async function _saveAllSceneData() {
  if (!_currentScriptId) return;
  /* Save title */
  var titleInput = document.getElementById('scriptTitleInput');
  if (titleInput) {
    await sbUpdateScript(_currentScriptId, { title: titleInput.value || 'Untitled Script' });
  }
  /* Save each scene's text fields */
  var textareas = document.querySelectorAll('.script-cell-textarea');
  var updates = {};
  textareas.forEach(function(ta) {
    var sceneId = ta.getAttribute('data-scene-id');
    var field = ta.getAttribute('data-field');
    if (!updates[sceneId]) updates[sceneId] = {};
    updates[sceneId][field] = ta.value;
  });
  var promises = Object.keys(updates).map(function(sceneId) {
    return _saveSceneFields(sceneId, updates[sceneId]);
  });
  try {
    await Promise.all(promises);
    var indicator = document.getElementById('scriptSaveIndicator');
    if (indicator) { indicator.textContent = 'Saved'; indicator.style.color = 'var(--teal)'; }
  } catch (e) {
    console.error('save err:', e);
    var indicator2 = document.getElementById('scriptSaveIndicator');
    if (indicator2) { indicator2.textContent = 'Error saving'; indicator2.style.color = 'var(--accent)'; }
  }
}

/* ---- ADD / DELETE SCENES ---- */
async function _addScene() {
  var newOrder = _currentScenes.length;
  var res;
  if (_sharedScriptToken) {
    var rpcRes = await _sb.rpc('add_shared_scene', { p_token: _sharedScriptToken, p_sort_order: newOrder });
    res = { data: rpcRes.data && rpcRes.data[0], error: rpcRes.error };
  } else {
    res = await _sb.from('script_scenes').insert({ script_id: _currentScriptId, sort_order: newOrder, script_text: '', scene_description: '', thumbnail_data: '' }).select().single();
  }
  if (res.data) {
    _currentScenes.push(res.data);
    _scriptRerender();
  } else if (res.error) {
    console.error('add scene err:', res.error);
    _showSaveError('Could not add scene');
  }
}

async function _deleteSceneRow(sceneId) {
  await sbDeleteScene(sceneId);
  _currentScenes = _currentScenes.filter(function(s) { return s.id !== sceneId; });
  /* Reorder remaining */
  await sbReorderScenes(_currentScenes);
  _scriptRerender();
}

/* ---- THUMBNAIL UPLOAD ---- */
function _handleThumbUpload(input, sceneId) {
  var file = input.files && input.files[0];
  if (!file) return;
  /* Limit to 2MB */
  if (file.size > 2 * 1024 * 1024) {
    _showSaveError('Image too large. Max 2MB.');
    return;
  }
  var reader = new FileReader();
  reader.onload = async function(e) {
    var dataUrl = e.target.result;
    /* Resize to max 600px wide for storage efficiency */
    var img = new Image();
    img.onload = async function() {
      var maxW = 600;
      var w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      var compressed = canvas.toDataURL('image/jpeg', 0.8);
      await _saveSceneFields(sceneId, { thumbnail_data: compressed });
      /* Update local cache */
      _currentScenes.forEach(function(s) { if (s.id === sceneId) s.thumbnail_data = compressed; });
      _scriptRerender();
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

async function _removeThumb(sceneId) {
  await _saveSceneFields(sceneId, { thumbnail_data: '' });
  _currentScenes.forEach(function(s) { if (s.id === sceneId) s.thumbnail_data = ''; });
  _scriptRerender();
}

/* ---- DRAG & DROP REORDER ---- */
function _bindDragDrop() {
  var rows = document.querySelectorAll('.script-scene-row[draggable="true"]');
  rows.forEach(function(row) {
    row.addEventListener('dragstart', function(e) {
      _dragSrcIdx = parseInt(row.getAttribute('data-idx'));
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('script-row-dragging');
    });
    row.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('script-row-dragover');
    });
    row.addEventListener('dragleave', function() {
      row.classList.remove('script-row-dragover');
    });
    row.addEventListener('drop', async function(e) {
      e.preventDefault();
      row.classList.remove('script-row-dragover');
      var targetIdx = parseInt(row.getAttribute('data-idx'));
      if (_dragSrcIdx === null || _dragSrcIdx === targetIdx) return;
      /* Reorder array */
      var moved = _currentScenes.splice(_dragSrcIdx, 1)[0];
      _currentScenes.splice(targetIdx, 0, moved);
      await sbReorderScenes(_currentScenes);
      _scriptRerender();
    });
    row.addEventListener('dragend', function() {
      row.classList.remove('script-row-dragging');
      _dragSrcIdx = null;
    });
  });
}

/* ---- SHARE MODAL ---- */
/* (Old share modal removed — replaced by the board-style popover above) */

/* ---- SHARED SCRIPT VIEWER ---- */
async function renderSharedScript(token, mode) {
  var container = document.getElementById('view-shared-script');
  container.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:300px;border-radius:12px"></div></div>';

  var script = await sbFetchScriptByToken(token);
  if (!script) {
    // The RPC returns nothing for bad tokens AND for private scripts
    container.innerHTML = '<div style="padding:48px;text-align:center"><h2>Script Not Found</h2><p style="color:var(--text-secondary)">This link is invalid, the script was deleted, or sharing was turned off.</p></div>';
    return;
  }
  var isEdit = mode === 'edit' && script.share_mode === 'edit';
  /* All reads/writes below route through the token-gated RPCs */
  _sharedScriptToken = String(token).split('?')[0].split('&')[0].trim();
  _sharedScriptMode = isEdit ? 'edit' : 'view';
  _currentScriptId = script.id;
  var scenes = await sbFetchScenes(script.id);
  _currentScenes = scenes;

  _renderEditorUI(container, script, scenes, !isEdit);

  /* Mark container for edit-mode grid (5 cols) vs read-only (4 cols) */
  if (isEdit) container.classList.add('shared-edit-mode');
  else container.classList.remove('shared-edit-mode');

  /* Add a branded header for shared view */
  var topbar = container.querySelector('.script-editor-topbar');
  if (topbar) {
    var badge = document.createElement('div');
    badge.className = 'script-shared-badge';
    badge.innerHTML = '<svg width="16" height="16" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h17l7 7v17H4z"/><path d="M10 12h6"/><path d="M10 17h12"/><path d="M10 22h12"/></svg> Shared via Arkives';
    topbar.insertBefore(badge, topbar.firstChild);
  }
}

/* (SKETCHY_ICONS.plus, .trash, .share, .chevronLeft are defined in SKETCHY_ICONS object above) */

/* ---- INIT ---- */
(async function init() {
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
        _authUser = session.user;
        showApp();
        // Load ALL data from Supabase
        await Promise.race([
          sbFetchAllData(),
          new Promise(function(r) { setTimeout(r, 8000); })
        ]);
        updateSidebarUser();
        navigate(getHash());
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

  // Dismiss loader
  var overlay = document.getElementById('loaderOverlay');
  if (overlay) {
    setTimeout(function() {
      overlay.classList.add('hiding');
      setTimeout(function() { overlay.remove(); }, 450);
    }, 300);
  }
})();
