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
  minimumRate: 15000, pricingRule: "6% of follower count baseline"
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

let FOLLOW_UPS = [];

/* ---- LATEST EMAIL UPDATES (populated by morning scan) ---- */
let LATEST_UPDATES = [];

/* ---- ACTION ITEMS ---- */
let ACTION_ITEMS = [];

/* ---- CONTENT DEADLINES (populated by morning scan) ---- */
let CONTENT_DEADLINES = [];

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
  DEALS = []; FOLLOW_UPS = []; ACTION_ITEMS = [];
  LATEST_UPDATES = []; CONTENT_DEADLINES = [];
  WEEKLY_TASKS = []; PARKING_LOT = []; INBOX_ITEMS = [];
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
let LABOR = [];
let BRAND_RULES = [];
let CONTRACT_RULES = [];

let WEEKLY_PLAN_META = { weekLabel: '', planId: null, lastSync: new Date().toISOString() };
let WEEKLY_TASKS = [];
let PARKING_LOT = [];
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

/* ---- SUPABASE CRUD FUNCTIONS ---- */
async function sbFetchTasks() {
  if (!_sb) {
    console.warn('Supabase client is null — running in offline mode. Changes will NOT persist.');
    return;
  }
  try {
    // Get most recent weekly plan
    var planRes = await _sb.from('weekly_plans').select('*').order('week_start', { ascending: false }).limit(1);
    if (planRes.error) {
      console.error('Supabase weekly_plans fetch error:', planRes.error);
      _showSaveError('DB load failed: ' + (planRes.error.message || planRes.error.code || JSON.stringify(planRes.error)));
      return;
    }
    if (planRes.data && planRes.data.length > 0) {
      var plan = planRes.data[0];
      WEEKLY_PLAN_META.weekLabel = plan.week_label;
      WEEKLY_PLAN_META.planId = plan.id;
      WEEKLY_PLAN_META.lastSync = new Date().toISOString();

      // Fetch weekly tasks for this plan
      var taskRes = await _sb.from('weekly_tasks').select('*').eq('plan_id', plan.id).order('sort_order');
      if (taskRes.error) {
        console.error('Supabase weekly_tasks fetch error:', taskRes.error);
      } else if (taskRes.data) {
        WEEKLY_TASKS = taskRes.data.map(function(t) {
          return { id: t.id, name: t.name, day: t.day, priority: t.priority || null, timeEstimate: t.time_estimate, done: t.done, sortOrder: t.sort_order };
        });
      }
    }

    // Fetch parking lot
    var plRes = await _sb.from('parking_lot').select('*').order('sort_order');
    if (plRes.error) {
      console.error('Supabase parking_lot fetch error:', plRes.error);
    } else if (plRes.data) {
      PARKING_LOT = plRes.data.map(function(t) {
        return { id: t.id, task: t.task, priority: t.priority || null, done: t.done, project: t.project, sortOrder: t.sort_order };
      });
    }

    _sbReady = true;
    console.log('Supabase connected: ' + WEEKLY_TASKS.length + ' tasks, ' + PARKING_LOT.length + ' parking lot items loaded.');
  } catch (err) {
    console.error('Supabase fetch error:', err);
    _showSaveError('Database connection failed. Running offline.');
  }
}

async function sbToggleWeeklyTask(taskId) {
  var task = WEEKLY_TASKS.find(function(t) { return t.id === taskId; });
  if (!task) return;
  task.done = !task.done;
  renderCalendar();
  if (_sb) {
    try {
      var res = await _sb.from('weekly_tasks').update({ done: task.done }).eq('id', taskId);
      if (res.error) console.error('Supabase toggle weekly error:', res.error);
    } catch (err) {
      console.error('Supabase toggle weekly exception:', err);
    }
  }
}

async function sbToggleParkingTask(taskId) {
  var task = PARKING_LOT.find(function(t) { return t.id === taskId; });
  if (!task) return;
  task.done = !task.done;
  renderCalendar();
  if (_sb) {
    try {
      var res = await _sb.from('parking_lot').update({ done: task.done }).eq('id', taskId);
      if (res.error) console.error('Supabase toggle parking error:', res.error);
    } catch (err) {
      console.error('Supabase toggle parking exception:', err);
    }
  }
}

async function sbAddWeeklyTask(name, day, priority, timeEstimate) {
  if (!name || !day) return;
  var maxSort = WEEKLY_TASKS.filter(function(t) { return t.day === day; }).reduce(function(m, t) { return Math.max(m, t.sortOrder || 0); }, -1);
  var newTask = { id: crypto.randomUUID(), name: name, day: day, priority: priority || null, timeEstimate: timeEstimate || null, done: false, sortOrder: maxSort + 1 };
  WEEKLY_TASKS.push(newTask);
  renderCalendar();
  if (_sb && WEEKLY_PLAN_META.planId) {
    var ins = { name: name, day: day, done: false, sort_order: maxSort + 1, plan_id: WEEKLY_PLAN_META.planId };
    if (priority) ins.priority = priority;
    if (timeEstimate) ins.time_estimate = timeEstimate;
    try {
      var res = await _sb.from('weekly_tasks').insert(ins).select();
      if (res.error) {
        console.error('Supabase weekly_tasks insert error:', res.error);
        _showSaveError('Save failed: ' + (res.error.message || res.error.code || JSON.stringify(res.error)));
        WEEKLY_TASKS = WEEKLY_TASKS.filter(function(t) { return t.id !== newTask.id; });
        renderCalendar();
        return;
      }
      if (res.data && res.data[0]) {
        var old = WEEKLY_TASKS.find(function(t) { return t.id === newTask.id; });
        if (old) old.id = res.data[0].id;
        _showSaveSuccess();
      }
    } catch (err) {
      console.error('Supabase weekly_tasks insert exception:', err);
      _showSaveError('Network error saving task.');
      WEEKLY_TASKS = WEEKLY_TASKS.filter(function(t) { return t.id !== newTask.id; });
      renderCalendar();
    }
  } else if (!_sb) {
    console.warn('Supabase client not available. Task saved locally only.');
    _showSaveError('Offline mode — task will not persist after refresh.');
  }
}

async function sbAddParkingTask(taskText, priority) {
  if (!taskText) return;
  var maxSort = PARKING_LOT.reduce(function(m, t) { return Math.max(m, t.sortOrder || 0); }, -1);
  var newItem = { id: crypto.randomUUID(), task: taskText, priority: priority || null, done: false, sortOrder: maxSort + 1 };
  PARKING_LOT.push(newItem);
  renderCalendar();
  if (_sb) {
    var ins = { task: taskText, done: false, sort_order: maxSort + 1 };
    if (priority) ins.priority = priority;
    try {
      var res = await _sb.from('parking_lot').insert(ins).select();
      if (res.error) {
        console.error('Supabase parking_lot insert error:', res.error);
        _showSaveError('Save failed: ' + (res.error.message || res.error.code || JSON.stringify(res.error)));
        PARKING_LOT = PARKING_LOT.filter(function(t) { return t.id !== newItem.id; });
        renderCalendar();
        return;
      }
      if (res.data && res.data[0]) {
        var old = PARKING_LOT.find(function(t) { return t.id === newItem.id; });
        if (old) old.id = res.data[0].id;
        _showSaveSuccess();
      }
    } catch (err) {
      console.error('Supabase parking_lot insert exception:', err);
      _showSaveError('Network error saving parking lot item.');
      PARKING_LOT = PARKING_LOT.filter(function(t) { return t.id !== newItem.id; });
      renderCalendar();
    }
  } else {
    console.warn('Supabase client not available. Parking lot item saved locally only.');
    _showSaveError('Offline mode — item will not persist after refresh.');
  }
}

async function sbDeleteWeeklyTask(taskId) {
  WEEKLY_TASKS = WEEKLY_TASKS.filter(function(t) { return t.id !== taskId; });
  renderCalendar();
  if (_sb) {
    try {
      var res = await _sb.from('weekly_tasks').delete().eq('id', taskId);
      if (res.error) console.error('Supabase delete weekly error:', res.error);
    } catch (err) {
      console.error('Supabase delete weekly exception:', err);
    }
  }
}

async function sbDeleteParkingTask(taskId) {
  PARKING_LOT = PARKING_LOT.filter(function(t) { return t.id !== taskId; });
  renderCalendar();
  if (_sb) {
    try {
      var res = await _sb.from('parking_lot').delete().eq('id', taskId);
      if (res.error) console.error('Supabase delete parking error:', res.error);
    } catch (err) {
      console.error('Supabase delete parking exception:', err);
    }
  }
}

async function sbEditWeeklyTask(taskId, updates) {
  var task = WEEKLY_TASKS.find(function(t) { return t.id === taskId; });
  if (!task) return;
  if (updates.name !== undefined) task.name = updates.name;
  if (updates.day !== undefined) task.day = updates.day;
  if (updates.priority !== undefined) task.priority = updates.priority || null;
  if (updates.timeEstimate !== undefined) task.timeEstimate = updates.timeEstimate;
  renderCalendar();
  if (_sb) {
    var dbUpdates = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.day !== undefined) dbUpdates.day = updates.day;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority || null;
    if (updates.timeEstimate !== undefined) dbUpdates.time_estimate = updates.timeEstimate;
    try {
      var res = await _sb.from('weekly_tasks').update(dbUpdates).eq('id', taskId);
      if (res.error) console.error('Supabase edit weekly error:', res.error);
    } catch (err) {
      console.error('Supabase edit weekly exception:', err);
    }
  }
}

async function sbEditParkingTask(taskId, updates) {
  var task = PARKING_LOT.find(function(t) { return t.id === taskId; });
  if (!task) return;
  if (updates.task !== undefined) task.task = updates.task;
  if (updates.priority !== undefined) task.priority = updates.priority || null;
  renderCalendar();
  if (_sb) {
    var dbUpdates = {};
    if (updates.task !== undefined) dbUpdates.task = updates.task;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority || null;
    try {
      var res = await _sb.from('parking_lot').update(dbUpdates).eq('id', taskId);
      if (res.error) console.error('Supabase edit parking error:', res.error);
    } catch (err) {
      console.error('Supabase edit parking exception:', err);
    }
  }
}

async function sbCreateWeeklyPlan(weekLabel, weekStart) {
  if (!_sb) return null;
  var res = await _sb.from('weekly_plans').insert({ week_label: weekLabel, week_start: weekStart }).select();
  if (res.data && res.data[0]) {
    WEEKLY_PLAN_META.weekLabel = weekLabel;
    WEEKLY_PLAN_META.planId = res.data[0].id;
    WEEKLY_TASKS = [];
    renderCalendar();
    return res.data[0].id;
  }
  return null;
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

    // Fetch profile — first try by auth_user_id, then fallback to first profile
    var profileRes;
    if (_authUser && _authUser.id) {
      profileRes = await _sb.from('profiles').select('*').eq('auth_user_id', _authUser.id).limit(1).maybeSingle();
      // If no profile linked to this auth user, try linking the first unlinked profile
      if (!profileRes.data) {
        var unlinked = await _sb.from('profiles').select('*').is('auth_user_id', null).limit(1).maybeSingle();
        if (unlinked.data) {
          // Link this profile to the auth user
          await _sb.from('profiles').update({ auth_user_id: _authUser.id }).eq('id', unlinked.data.id);
          profileRes = { data: unlinked.data };
          console.log('Linked profile', unlinked.data.id, 'to auth user', _authUser.id);
        } else {
          // No profile at all — create one
          var newProfile = await _sb.from('profiles').insert({
            name: _authUser.email.split('@')[0],
            email: _authUser.email,
            auth_user_id: _authUser.id
          }).select().single();
          profileRes = { data: newProfile.data };
          console.log('Created new profile for auth user', _authUser.id);
        }
      }
    } else {
      profileRes = await _sb.from('profiles').select('*').limit(1).maybeSingle();
    }
    if (profileRes.data) {
      CREATOR.name = profileRes.data.name || '';
      CREATOR.brand = profileRes.data.brand || '';
      CREATOR.entity = profileRes.data.entity || '';
      CREATOR.email = profileRes.data.email || '';
      CREATOR.niche = profileRes.data.niche || '';
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
      RATE_CARD.minimumRate = rcsRes.data.minimum_rate || 15000;
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

    // Fetch follow-ups
    const fuRes = await _sb.from('follow_ups').select('*').eq('user_id', CREATOR._sbId).order('date');
    if (fuRes.data) {
      FOLLOW_UPS = fuRes.data.map(f => ({
        _sbId: f.id, brand: f.brand || '', contact: f.contact || '',
        date: f.date || '', note: f.note || '', completed: f.completed || false
      }));
    }

    // Fetch action items
    const aiRes = await _sb.from('action_items').select('*').eq('user_id', CREATOR._sbId).order('sort_order');
    if (aiRes.data) {
      ACTION_ITEMS = aiRes.data.map(a => ({
        _sbId: a.id, priority: a.priority || 'medium', brand: a.brand || '',
        action: a.action || '', deadline: a.deadline || '', contact: a.contact || '',
        completed: a.completed || false
      }));
    }

    // Fetch latest updates
    const luRes = await _sb.from('latest_updates').select('*').eq('user_id', CREATOR._sbId).order('created_at', { ascending: false }).limit(20);
    if (luRes.data) {
      LATEST_UPDATES = luRes.data.map(u => ({
        _sbId: u.id, dot: u.dot || 'blue', text: u.text || '',
        time: u.time || '', priority: u.priority || 'info'
      }));
    }

    // Fetch content deadlines
    const cdRes = await _sb.from('content_deadlines').select('*').eq('user_id', CREATOR._sbId).order('sort_order');
    if (cdRes.data) {
      CONTENT_DEADLINES = cdRes.data.map(c => ({
        _sbId: c.id, date: c.date || '', text: c.text || '',
        brand: c.brand || '', completed: c.completed || false
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
      // Interests are not in the DB yet - keep hardcoded defaults
      if (!AUDIENCE_DATA.interests || AUDIENCE_DATA.interests.length === 0) {
        AUDIENCE_DATA.interests = ["Photography", "Video Editing", "Creative Business", "AI Tools", "Tech & Gadgets", "Design", "Entrepreneurship"];
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

    // Fetch subscriptions
    const subRes = await _sb.from('subscriptions').select('*').eq('user_id', CREATOR._sbId).order('sort_order');
    if (subRes.data) {
      const personalMonthly = subRes.data.filter(s => s.type === 'personal' && s.frequency === 'monthly');
      const personalYearly = subRes.data.filter(s => s.type === 'personal' && s.frequency === 'yearly');
      const bizMonthly = subRes.data.filter(s => s.type === 'business' && s.frequency === 'monthly');
      const bizYearly = subRes.data.filter(s => s.type === 'business' && s.frequency === 'yearly');

      const pmTotal = personalMonthly.reduce((s, i) => s + Number(i.cost || 0), 0);
      const pyTotal = personalYearly.reduce((s, i) => s + Number(i.cost || 0), 0);
      const bmTotal = bizMonthly.reduce((s, i) => s + Number(i.cost || 0), 0);
      const byTotal = bizYearly.reduce((s, i) => s + Number(i.cost || 0), 0);

      PERSONAL_SUBS = {
        monthly: personalMonthly.map(s => ({ item: s.name, cost: Number(s.cost), _sbId: s.id })),
        monthlyTotal: Math.round(pmTotal * 100) / 100,
        yearly: personalYearly.map(s => ({ item: s.name, cost: Number(s.cost), renewal: s.renewal_info || '', _sbId: s.id })),
        yearlyTotal: Math.round(pyTotal * 100) / 100,
        annualTotal: Math.round((pmTotal * 12 + pyTotal) * 100) / 100
      };

      BUSINESS_SUBS = {
        monthly: bizMonthly.map(s => ({ item: s.name, cost: Number(s.cost), renewal: s.renewal_info || '', _sbId: s.id })),
        monthlyTotal: Math.round(bmTotal * 100) / 100,
        yearly: bizYearly.map(s => ({ item: s.name, cost: Number(s.cost), renewal: s.renewal_info || '', _sbId: s.id })),
        yearlyTotal: Math.round(byTotal * 100) / 100,
        annualTotal: Math.round((bmTotal * 12 + byTotal) * 100) / 100
      };
    }

    // Fetch net income
    const niRes = await _sb.from('net_income').select('*').eq('user_id', CREATOR._sbId).order('year').order('created_at');
    if (niRes.data && niRes.data.length > 0) {
      const months = niRes.data.map(m => ({
        month: m.month, personalRev: Number(m.personal_rev || 0), businessRev: Number(m.business_rev || 0),
        totalRev: Number(m.total_rev || 0), personalExp: Number(m.personal_exp || 0),
        businessExp: Number(m.business_exp || 0), totalExp: Number(m.total_exp || 0),
        personalPL: Number(m.personal_pl || 0), businessPL: Number(m.business_pl || 0),
        totalPL: Number(m.total_pl || 0), _sbId: m.id
      }));
      const avgRev = months.reduce((s, m) => s + m.totalRev, 0) / months.length;
      const avgExp = months.reduce((s, m) => s + m.totalExp, 0) / months.length;
      NET_INCOME = {
        months: months,
        summary: {
          avgRevenue: Math.round(avgRev * 100) / 100,
          avgExpense: Math.round(avgExp * 100) / 100,
          avgPL: Math.round((avgRev - avgExp) * 100) / 100
        }
      };
    }

    // Fetch labor
    const labRes = await _sb.from('labor').select('*').eq('user_id', CREATOR._sbId);
    if (labRes.data) {
      LABOR = labRes.data.map(l => ({
        _sbId: l.id, name: l.name, role: l.role, salary: Number(l.salary || 0), active: l.active
      }));
    }

    // Fetch brand rules
    const brRes = await _sb.from('brand_rules').select('*').eq('user_id', CREATOR._sbId).order('sort_order');
    if (brRes.data) {
      BRAND_RULES = brRes.data.map(r => ({ _sbId: r.id, rule: r.rule, category: r.category }));
    }

    // Fetch contract rules
    const ctRes = await _sb.from('contract_rules').select('*').eq('user_id', CREATOR._sbId).order('sort_order');
    if (ctRes.data) {
      CONTRACT_RULES = ctRes.data.map(r => ({ _sbId: r.id, rule: r.rule }));
    }

    // Also fetch tasks (existing function)
    await sbFetchTasks();

    // Update sidebar with loaded profile data
    updateSidebarUser();

    console.log('All data loaded from Supabase:', {
      profile: CREATOR.name,
      deals: DEALS.length,
      followUps: FOLLOW_UPS.length,
      actionItems: ACTION_ITEMS.length,
      updates: LATEST_UPDATES.length,
      deadlines: CONTENT_DEADLINES.length,
      inbox: INBOX_ITEMS.length,
      templates: Object.keys(OUTREACH_TEMPLATES).length
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

/* ---- SUPABASE CRUD: FOLLOW-UPS ---- */
async function sbAddFollowUp(data) {
  if (!_sb || !CREATOR._sbId) return null;
  const { data: row, error } = await _sb.from('follow_ups').insert({
    user_id: CREATOR._sbId, brand: data.brand, contact: data.contact || '',
    date: data.date || todayISO(), note: data.note || ''
  }).select().single();
  if (error) { _showSaveError('Failed to add follow-up'); return null; }
  _showSaveSuccess();
  return row;
}

async function sbCompleteFollowUp(sbId) {
  if (!_sb) return;
  await _sb.from('follow_ups').update({ completed: true }).eq('id', sbId);
  _showSaveSuccess();
}

async function sbDeleteFollowUp(sbId) {
  if (!_sb) return;
  await _sb.from('follow_ups').delete().eq('id', sbId);
  _showSaveSuccess();
}

/* ---- SUPABASE CRUD: ACTION ITEMS ---- */
async function sbAddActionItem(data) {
  if (!_sb || !CREATOR._sbId) return null;
  const { data: row, error } = await _sb.from('action_items').insert({
    user_id: CREATOR._sbId, priority: data.priority || 'medium', brand: data.brand || '',
    action: data.action || '', deadline: data.deadline || '', contact: data.contact || '',
    sort_order: ACTION_ITEMS.length
  }).select().single();
  if (error) { _showSaveError('Failed to add action item'); return null; }
  _showSaveSuccess();
  return row;
}

async function sbCompleteActionItem(sbId) {
  if (!_sb) return;
  await _sb.from('action_items').update({ completed: true }).eq('id', sbId);
  _showSaveSuccess();
}

async function sbDeleteActionItem(sbId) {
  if (!_sb) return;
  await _sb.from('action_items').delete().eq('id', sbId);
  _showSaveSuccess();
}

/* ---- SUPABASE CRUD: CONTENT DEADLINES ---- */
async function sbAddContentDeadline(data) {
  if (!_sb || !CREATOR._sbId) return null;
  const { data: row, error } = await _sb.from('content_deadlines').insert({
    user_id: CREATOR._sbId, date: data.date || '', text: data.text || '',
    brand: data.brand || '', sort_order: CONTENT_DEADLINES.length
  }).select().single();
  if (error) { _showSaveError('Failed to add deadline'); return null; }
  _showSaveSuccess();
  return row;
}

async function sbDeleteContentDeadline(sbId) {
  if (!_sb) return;
  await _sb.from('content_deadlines').delete().eq('id', sbId);
  _showSaveSuccess();
}

/* ---- SUPABASE CRUD: INBOX ---- */
async function sbUpdateInboxStatus(sbId, status) {
  if (!_sb) return;
  await _sb.from('inbox_items').update({ status: status }).eq('id', sbId);
  _showSaveSuccess();
}

/* ---- SUPABASE CRUD: SUBSCRIPTIONS ---- */
async function sbAddSubscription(data) {
  if (!_sb || !CREATOR._sbId) return null;
  const { data: row, error } = await _sb.from('subscriptions').insert({
    user_id: CREATOR._sbId, name: data.name, cost: data.cost,
    frequency: data.frequency || 'monthly', type: data.type || 'business',
    renewal_info: data.renewal || null, sort_order: 99
  }).select().single();
  if (error) { _showSaveError('Failed to add subscription'); return null; }
  _showSaveSuccess();
  return row;
}

async function sbDeleteSubscription(sbId) {
  if (!_sb) return;
  await _sb.from('subscriptions').delete().eq('id', sbId);
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

/* ---- SUPABASE CRUD: INVOICES ---- */
async function sbAddInvoice(data) {
  if (!_sb || !CREATOR._sbId) return null;
  const { data: row, error } = await _sb.from('invoices').insert({
    user_id: CREATOR._sbId, invoice_number: data.invoiceNumber || '',
    brand: data.brand || '', amount: data.amount || 0, date: data.date || todayISO(),
    due_date: data.dueDate || null, status: data.status || 'draft',
    description: data.description || '', payment_terms: data.paymentTerms || 'net30'
  }).select().single();
  if (error) { _showSaveError('Failed to add invoice'); return null; }
  _showSaveSuccess();
  return row;
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
  /* Handle sub-routes: script/UUID, shared/TOKEN */
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
    var shareToken = view.split('/')[1];
    var shareMode = (view.split('/')[2]) || 'view';
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

window.addEventListener("hashchange", () => navigate(getHash()));

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
    case "pipeline": renderPipeline(); break;
    case "research": renderResearch(); break;
    case "revenue": renderRevenue(); break;
    case "mediakit": renderMediaKit(); break;
    case "analytics": renderAnalytics(); break;
    case "inbox": renderInbox(); break;
    case "calendar": renderCalendar(); break;
    case "settings": renderSettings(); break;
    case "voice": renderVoice(); break;
    case "scripts": renderScripts(); break;
    case "contentstudio": renderContentStudio(); break;
    case "contracts": renderContracts(); break;
    case "expenses": renderExpenses(); break;
    case "invoices": renderInvoices(); break;
  }
}

/* ---- DASHBOARD ---- */
function toggleWidget(id) {
  const body = document.getElementById(id);
  const card = body.closest('.card');
  const chevron = card.querySelector('.widget-chevron');
  if (body.style.display === 'none') {
    body.style.display = '';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  } else {
    body.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(-90deg)';
  }
}

function renderDashboard() {
  const container = document.getElementById("view-dashboard");
  const activeDeals = DEALS.filter(d => !["Declined", "Completed", "Cold"].includes(mapStatus(d.status)));
  const totalPipeline = DEALS.reduce((sum, d) => sum + parseValue(d.value), 0);
  const signedRevenue = DEALS.filter(d => ["SIGNED", "ACTIVE - In Production", "ACTIVE — In Production"].includes(d.status)).reduce((s, d) => s + parseValue(d.value), 0);
  const avgDeal = activeDeals.length > 0 ? Math.round(totalPipeline / activeDeals.length) : 0;
  const signedCount = DEALS.filter(d => mapStatus(d.status) === "Active" || mapStatus(d.status) === "Completed").length;

  const urgentActions = ACTION_ITEMS.filter(a => a.priority === "urgent").length;
  const deadlineCount = CONTENT_DEADLINES.length;

  // Build mini calendar for current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const deadlineDates = new Set();
  CONTENT_DEADLINES.forEach(dl => {
    if (dl.date !== "ongoing") {
      const d = new Date(dl.date + "T12:00:00");
      if (d.getMonth() === month && d.getFullYear() === year) deadlineDates.add(d.getDate());
    }
  });
  // Build set of dates that have weekly tasks
  const taskDates = new Set();
  var _weekParts = WEEKLY_PLAN_META.weekLabel.split(" - ");
  var _wStartParts = _weekParts[0].split("/");
  var _wStartMonth = parseInt(_wStartParts[0]);
  var _wStartDay = parseInt(_wStartParts[1]);
  var _dayMap = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
  WEEKLY_TASKS.forEach(function(t) {
    var offset = _dayMap[t.day] !== undefined ? _dayMap[t.day] : -1;
    if (offset >= 0) {
      var tDate = new Date(2026, _wStartMonth - 1, _wStartDay + offset);
      if (tDate.getMonth() === month && tDate.getFullYear() === year) taskDates.add(tDate.getDate());
    }
  });
  let calDays = '';
  for (let i = 0; i < firstDay; i++) calDays += '<div class="mini-cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const classes = ['mini-cal-day'];
    if (d === today) classes.push('today');
    if (deadlineDates.has(d)) classes.push('has-deadline');
    if (taskDates.has(d)) classes.push('has-task');
    calDays += `<div class="${classes.join(' ')}">${d}</div>`;
  }

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Dashboard</h1>
      </div>
      <div class="briefing-badge">
        <span class="briefing-time">Last scan: ${todayStr()}</span>
      </div>
    </div>

    <!-- KPI ROW: Signed Revenue + Avg Deal -->
    <div class="kpi-grid kpi-grid-2">
      <div class="kpi-card kpi-featured card-clickable" onclick="navigate('revenue')">
        <span class="kpi-label">Signed Revenue</span>
        <span class="kpi-value">${formatCurrency(signedRevenue)}</span>
        <span class="kpi-delta up">${signedCount} deals closed</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Avg Deal Value</span>
        <span class="kpi-value">${formatCurrency(avgDeal)}</span>
        <span class="kpi-delta neutral">${activeDeals.length} active deals</span>
      </div>
    </div>

    <!-- PLATFORM ANALYTICS CHART -->
    <div class="card card-clickable" onclick="navigate('analytics')">
      <div class="card-header"><span class="card-title">Platform Analytics</span></div>
      <div class="platform-chart-wrap">
        <canvas id="dashPlatformChart"></canvas>
      </div>
    </div>

    <!-- CALENDAR SNIPPET + CONTENT DEADLINES side by side -->
    <div class="chart-row">
      <div class="card card-clickable" onclick="navigate('calendar')">
        <div class="card-header"><span class="card-title">${monthName}</span></div>
        <div class="mini-cal">
          <div class="mini-cal-grid">
            <div class="mini-cal-dow">Su</div><div class="mini-cal-dow">Mo</div><div class="mini-cal-dow">Tu</div><div class="mini-cal-dow">We</div><div class="mini-cal-dow">Th</div><div class="mini-cal-dow">Fr</div><div class="mini-cal-dow">Sa</div>
            ${calDays}
          </div>
        </div>
      </div>
      <div class="card card-clickable" onclick="navigate('calendar')">
        <div class="card-header card-header-toggle" onclick="event.stopPropagation(); toggleWidget('widget-deadlines')">
          <span class="card-title">Content Deadlines</span>
          <div class="card-header-right">
            <span class="badge-count">${deadlineCount} items</span>
            ${SKETCHY_ICONS.chevron}
          </div>
        </div>
        <div class="deadlines-list" id="widget-deadlines">
          ${CONTENT_DEADLINES.map(dl => {
            const now2 = new Date();
            const isOngoing = dl.date === "ongoing";
            let dateLabel = isOngoing ? "Ongoing" : "";
            let isToday = false;
            let isTomorrow = false;
            let isPast = false;
            if (!isOngoing) {
              const dDate = new Date(dl.date + "T12:00:00");
              isToday = dDate.toDateString() === now2.toDateString();
              const tomorrow = new Date(now2); tomorrow.setDate(tomorrow.getDate() + 1);
              isTomorrow = dDate.toDateString() === tomorrow.toDateString();
              isPast = dDate < now2 && !isToday;
              const mo = dDate.toLocaleString("en-US", { month: "short" });
              const day = dDate.getDate();
              dateLabel = `${mo} ${day}`;
              if (isToday) dateLabel += " (Today)";
              else if (isTomorrow) dateLabel += " (Tomorrow)";
            }
            const cls = isToday ? "deadline-item deadline-today" : isPast ? "deadline-item deadline-past" : "deadline-item";
            return `<div class="${cls}">
              <div class="deadline-date">${dateLabel}</div>
              <div class="deadline-text">${dl.text}</div>
              <div class="deadline-brand">${dl.brand}</div>
            </div>`;
          }).join("")}
        </div>
      </div>
    </div>

    <!-- ACTION ITEMS + LATEST UPDATES side by side -->
    <div class="chart-row">
      <div class="card">
        <div class="card-header card-header-toggle" onclick="toggleWidget('widget-actions')">
          <span class="card-title">Action Items</span>
          <div class="card-header-right">
            <span style="cursor:pointer;display:flex;align-items:center;gap:6px" onclick="event.stopPropagation(); navigate('inbox')">${SKETCHY_ICONS.link}</span>
            <span class="badge-count urgent-count">${urgentActions} urgent</span>
            ${SKETCHY_ICONS.chevron}
          </div>
        </div>
        <div class="action-items-list" id="widget-actions">
          ${ACTION_ITEMS.map(item => `
            <div class="action-item priority-${item.priority}">
              <div class="action-priority-indicator"></div>
              <div class="action-content">
                <div class="action-brand">${item.brand}</div>
                <div class="action-text">${item.action}</div>
                ${item.contact ? `<div class="action-contact">${item.contact}</div>` : ""}
              </div>
              <div class="action-deadline">${item.deadline}</div>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="card">
        <div class="card-header card-header-toggle" onclick="toggleWidget('widget-updates')">
          <span class="card-title">Latest Updates</span>
          <div class="card-header-right">
            <span class="badge active">${LATEST_UPDATES.length} updates</span>
            ${SKETCHY_ICONS.chevron}
          </div>
        </div>
        <div class="updates-list" id="widget-updates">
          ${LATEST_UPDATES.map(a => `
            <div class="activity-item update-priority-${a.priority}">
              <div class="activity-dot ${a.dot}"></div>
              <div>
                <div class="activity-text">${a.text}</div>
                <div class="activity-time">${a.time}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;

  // Build Platform Analytics chart from analytics_cache.json
  buildDashPlatformChart();
}

async function buildDashPlatformChart() {
  try {
    const resp = await fetch('analytics_cache.json');
    const data = await resp.json();
    const snapshots = data.snapshots || [];

    // Group snapshots by platform (handle both per-platform and unified formats)
    const platformData = {};
    snapshots.forEach(s => {
      if (s.platform) {
        // Per-platform snapshot: { platform: 'instagram', date, followers, ... }
        const plat = s.platform;
        if (!platformData[plat]) platformData[plat] = [];
        const followers = s.followers || s.subscribers || s.connections || 0;
        platformData[plat].push({ date: s.date, followers });
      } else if (s.platforms) {
        // Unified snapshot: { date, platforms: { instagram: {...}, tiktok: {...}, ... } }
        Object.entries(s.platforms).forEach(([plat, pData]) => {
          if (!platformData[plat]) platformData[plat] = [];
          const followers = pData.followers || pData.subscribers || pData.connections || 0;
          platformData[plat].push({ date: s.date, followers });
        });
      }
    });

    // Deduplicate (keep latest entry per date) and sort each platform by date
    Object.keys(platformData).forEach(plat => {
      const byDate = {};
      platformData[plat].forEach(p => { byDate[p.date] = p; });
      platformData[plat] = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    });

    // Collect all unique dates
    const allDates = [...new Set(snapshots.map(s => s.date))].sort();
    const labels = allDates.map(d => {
      const dt = new Date(d + "T12:00:00");
      return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#A8A29E' : '#4A4540';
    const gridColor = isDark ? 'rgba(232,228,221,0.08)' : 'rgba(26,23,20,0.06)';

    const platformColors = {
      instagram: '#C73539',
      tiktok: '#2A6B5A',
      youtube: '#2A5B8F',
      twitter: isDark ? '#E8E4DD' : '#1A1714',
      linkedin: '#6B4A8F'
    };
    const platformLabels = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', twitter: 'X / Twitter', linkedin: 'LinkedIn' };

    const datasets = Object.entries(platformData).map(([plat, arr]) => {
      const dataMap = {};
      arr.forEach(a => { dataMap[a.date] = a.followers; });
      const values = allDates.map(d => dataMap[d] || null);
      return {
        label: platformLabels[plat] || plat,
        data: values,
        borderColor: platformColors[plat] || '#888',
        backgroundColor: 'transparent',
        borderWidth: plat === 'instagram' ? 3 : 2,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.3,
        spanGaps: true
      };
    });

    const canvas = document.getElementById('dashPlatformChart');
    if (!canvas) return;
    if (chartsRendered['dashPlatformChart']) chartsRendered['dashPlatformChart'].destroy();

    chartsRendered['dashPlatformChart'] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            type: 'logarithmic',
            grid: { color: gridColor, drawBorder: false },
            ticks: {
              color: textColor,
              font: { family: "'General Sans', sans-serif", size: 11 },
              callback: function(val) {
                if (val >= 1000) return (val / 1000).toFixed(0) + 'K';
                return val;
              }
            }
          },
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: "'General Sans', sans-serif", size: 10 }, maxRotation: 0 }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { family: "'General Sans', sans-serif", size: 11 }, boxWidth: 12, padding: 16 }
          },
          tooltip: {
            backgroundColor: isDark ? '#252420' : '#fff',
            titleColor: isDark ? '#E8E4DD' : '#1A1714',
            bodyColor: isDark ? '#A8A29E' : '#4A4540',
            borderColor: isDark ? 'rgba(232,228,221,0.2)' : '#1A1714',
            borderWidth: 1,
            callbacks: {
              label: function(ctx) {
                const v = ctx.parsed.y;
                return ctx.dataset.label + ': ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v);
              }
            }
          }
        }
      }
    });
  } catch (e) {
    // If analytics_cache.json is unavailable, show placeholder
    const wrap = document.querySelector('.platform-chart-wrap');
    if (wrap) wrap.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px">Analytics data unavailable</p>';
  }
}

/* ---- PIPELINE (with merged Outreach) ---- */
let pipelineTab = "kanban";

function renderPipeline() {
  const container = document.getElementById("view-pipeline");

  const inbound = DEALS.filter(d => {
    const s = d.status;
    return ["Questions Sent", "Rates Sent", "Counter Sent", "Follow-Up Sent", "Revised Contract Drafted", "SIGNED", "ACTIVE - In Production", "ACTIVE \u2014 In Production", "Meeting Scheduled", "Pointed to Shawn"].includes(s);
  });
  const outbound = DEALS.filter(d => {
    return d.status === "Cold" || d.brand === "Manychat";
  });

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Pipeline</h1>
        <p class="view-subtitle">${DEALS.length} total deals across all stages</p>
      </div>
      <div class="gap-row">
        <button class="btn btn-primary" onclick="openAddDealModal()">+ Add Deal</button>
      </div>
    </div>
    <div class="pipeline-tabs">
      <button class="pipeline-tab ${pipelineTab === "kanban" ? "active" : ""}" data-ptab="kanban">Kanban</button>
      <button class="pipeline-tab ${pipelineTab === "inbound" ? "active" : ""}" data-ptab="inbound">Inbound (${inbound.length})</button>
      <button class="pipeline-tab ${pipelineTab === "outbound" ? "active" : ""}" data-ptab="outbound">Outbound (${outbound.length})</button>
    </div>
    <div id="pipeline-kanban" style="display:${pipelineTab === "kanban" ? "block" : "none"}">
      ${renderKanbanContent()}
    </div>
    <div id="pipeline-inbound" style="display:${pipelineTab === "inbound" ? "block" : "none"}">
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Brand</th><th>Contact</th><th>Status</th><th>Value</th><th>Last Contact</th><th>Notes</th></tr></thead>
            <tbody>
              ${inbound.map(d => `<tr onclick="openDealModal('${d.brand}')" style="cursor:pointer">
                <td style="font-weight:600;color:var(--text-primary)">${d.brand}</td>
                <td>${d.contact || "\u2014"}</td>
                <td><span class="badge ${mapStatus(d.status).toLowerCase().replace(/\s+/g, "")}">${d.status}</span></td>
                <td style="font-variant-numeric:tabular-nums">${formatCurrency(parseValue(d.value))}</td>
                <td>${d.lastContact || "\u2014"}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${d.notes ? d.notes.substring(0, 60) + "..." : "\u2014"}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div id="pipeline-outbound" style="display:${pipelineTab === "outbound" ? "block" : "none"}">
      <div class="card">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Brand</th><th>Contact</th><th>Method</th><th>Status</th><th>Last Contact</th><th>Notes</th></tr></thead>
            <tbody>
              ${outbound.map(d => `<tr onclick="openDealModal('${d.brand}')" style="cursor:pointer">
                <td style="font-weight:600;color:var(--text-primary)">${d.brand}</td>
                <td>${d.contact || "\u2014"}</td>
                <td>${d.email ? "Email" : "DM"}</td>
                <td><span class="badge ${mapStatus(d.status).toLowerCase().replace(/\s+/g, "")}">${d.status}</span></td>
                <td>${d.lastContact || "\u2014"}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${d.notes ? d.notes.substring(0, 60) + "..." : "\u2014"}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll(".pipeline-tab").forEach(tab => {
    tab.addEventListener("click", function() {
      pipelineTab = this.dataset.ptab;
      container.querySelectorAll(".pipeline-tab").forEach(t => t.classList.remove("active"));
      this.classList.add("active");
      ["kanban", "inbound", "outbound"].forEach(t => {
        const el = document.getElementById("pipeline-" + t);
        if (el) el.style.display = t === pipelineTab ? "block" : "none";
      });
    });
  });

  if (pipelineTab === "kanban") {
    document.getElementById("pipelineFilter").addEventListener("change", filterPipeline);
    document.getElementById("pipelineSort").addEventListener("change", filterPipeline);
  }
}

function renderKanbanContent() {
  const columns = PIPELINE_STATUSES.map(status => {
    const deals = DEALS.filter(d => mapStatus(d.status) === status);
    return { status, deals };
  });
  return `
    <div class="gap-row" style="margin-bottom:16px">
      <select id="pipelineFilter">
        <option value="all">All Statuses</option>
        ${PIPELINE_STATUSES.map(s => `<option value="${s}">${s}</option>`).join("")}
      </select>
      <select id="pipelineSort">
        <option value="value">Sort by Value</option>
        <option value="date">Sort by Last Contact</option>
        <option value="name">Sort by Name</option>
      </select>
    </div>
    <div class="kanban" id="kanbanBoard">
      ${columns.map(col => `
        <div class="kanban-col" data-status="${col.status}">
          <div class="kanban-col-header">
            <span>${col.status}</span>
            <span class="kanban-col-count">${col.deals.length}</span>
          </div>
          <div class="kanban-cards">
            ${col.deals.map(deal => renderKanbanCard(deal)).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderKanbanCard(deal) {
  const days = daysSince(deal.lastContact);
  const statusClass = mapStatus(deal.status).toLowerCase().replace(/\s+/g, "");
  const borderColors = {
    "lead": "#6b6560", "qualifying": "#9b7fd4", "ratessent": "#5b8fd9",
    "negotiating": "#d4a853", "contract": "#d4a853", "active": "#4f98a3",
    "completed": "#5db87a", "declined": "#c45d5d"
  };
  const color = borderColors[statusClass] || "#6b6560";

  return `<div class="kanban-card" style="border-left-color:${color}" onclick="openDealModal('${deal.brand}')">
    <div class="brand-name">${deal.brand}</div>
    <div class="deal-value">${formatCurrency(parseValue(deal.value))}</div>
    <div class="deal-meta">
      <span>${deal.contact || "No contact"}</span>
      <span class="days-ago ${daysClass(days)}">${days === 0 ? "Today" : days + "d ago"}</span>
    </div>
  </div>`;
}

function filterPipeline() {
  const filter = document.getElementById("pipelineFilter").value;
  const sort = document.getElementById("pipelineSort").value;
  const cols = document.querySelectorAll(".kanban-col");

  cols.forEach(col => {
    const status = col.dataset.status;
    if (filter === "all" || filter === status) {
      col.style.display = "";
    } else {
      col.style.display = "none";
    }
  });
}

/* ---- DEAL MODAL ---- */
function openDealModal(brandName) {
  const deal = DEALS.find(d => d.brand === brandName);
  if (!deal) return;

  const modal = document.getElementById("dealModal");
  const content = document.getElementById("dealModalContent");

  content.innerHTML = `
    <button class="modal-close" onclick="closeDealModal()">&times;</button>
    <h2 class="modal-title">${deal.brand}</h2>
    <span class="badge ${mapStatus(deal.status).toLowerCase().replace(/\s+/g, "")}">${deal.status}</span>

    <div class="modal-section mt-4">
      <div class="modal-section-title">Deal Information</div>
      <div class="detail-grid">
        <div class="detail-item"><label>Contact</label><span>${deal.contact || "—"}</span></div>
        <div class="detail-item"><label>Email</label><span>${deal.email || "—"}</span></div>
        <div class="detail-item"><label>Agency</label><span>${deal.agency || "Direct"}</span></div>
        <div class="detail-item"><label>Value</label><span style="color:var(--accent);font-weight:700">${formatCurrency(parseValue(deal.value))}</span></div>
        <div class="detail-item"><label>Campaign</label><span>${deal.campaign || "—"}</span></div>
        <div class="detail-item"><label>Last Contact</label><span>${deal.lastContact || "—"}</span></div>
      </div>
    </div>

    ${deal.scope ? `<div class="modal-section">
      <div class="modal-section-title">Scope & Deliverables</div>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">${deal.scope}</p>
      <p style="font-size:13px;color:var(--text-secondary)">${deal.deliverables || ""}</p>
      ${deal.term ? `<p style="font-size:12px;color:var(--text-muted);margin-top:4px">Term: ${deal.term}</p>` : ""}
    </div>` : ""}

    ${deal.negotiationHistory && deal.negotiationHistory.length > 0 ? `
    <div class="modal-section">
      <div class="modal-section-title">Negotiation History</div>
      ${deal.negotiationHistory.map(h => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div>
            <div class="timeline-text">${h.text}</div>
            <div class="timeline-date">${h.date}</div>
          </div>
        </div>
      `).join("")}
    </div>` : ""}

    <div class="modal-section">
      <div class="modal-section-title">Revenue Tracking</div>
      <div class="detail-grid">
        <div class="detail-item"><label>Contract Status</label><span>${deal.contractStatus || "N/A"}</span></div>
        <div class="detail-item"><label>Invoiced</label><span>${formatCurrency(deal.invoiced || 0)}</span></div>
        <div class="detail-item"><label>Paid</label><span style="color:var(--green)">${formatCurrency(deal.paid || 0)}</span></div>
        <div class="detail-item"><label>Outstanding</label><span style="color:${(deal.outstanding || 0) > 0 ? "var(--accent)" : "var(--text-muted)"}">${formatCurrency(deal.outstanding || 0)}</span></div>
      </div>
    </div>

    ${deal.notes ? `<div class="modal-section">
      <div class="modal-section-title">Notes</div>
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.6">${deal.notes}</p>
    </div>` : ""}
  `;

  modal.classList.add("open");
}

function closeDealModal() {
  document.getElementById("dealModal").classList.remove("open");
}

document.getElementById("dealModal").addEventListener("click", function(e) {
  if (e.target === this) closeDealModal();
});

/* ---- ADD DEAL MODAL ---- */
function openAddDealModal() {
  const modal = document.getElementById("addDealModal");
  const content = document.getElementById("addDealForm");

  content.innerHTML = `
    <button class="modal-close" onclick="closeAddDealModal()">&times;</button>
    <h2 class="modal-title">Add New Deal</h2>
    <form id="newDealForm" onsubmit="handleAddDeal(event)">
      <div class="form-row">
        <div class="form-group"><label>Brand Name</label><input type="text" name="brand" required></div>
        <div class="form-group"><label>Contact Name</label><input type="text" name="contact"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Email</label><input type="email" name="email"></div>
        <div class="form-group"><label>Agency</label><input type="text" name="agency"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <select name="status">
            ${PIPELINE_STATUSES.map(s => `<option value="${s}">${s}</option>`).join("")}
          </select>
        </div>
        <div class="form-group"><label>Estimated Value</label><input type="number" name="value" placeholder="15000"></div>
      </div>
      <div class="form-group"><label>Campaign Name</label><input type="text" name="campaign"></div>
      <div class="form-group"><label>Notes</label><textarea name="notes"></textarea></div>
      <div class="gap-row mt-4">
        <button type="submit" class="btn btn-primary">Add Deal</button>
        <button type="button" class="btn btn-secondary" onclick="closeAddDealModal()">Cancel</button>
      </div>
    </form>
  `;

  modal.classList.add("open");
}

function closeAddDealModal() {
  document.getElementById("addDealModal").classList.remove("open");
}

document.getElementById("addDealModal").addEventListener("click", function(e) {
  if (e.target === this) closeAddDealModal();
});

async function handleAddDeal(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const newDeal = {
    brand: fd.get("brand"),
    status: fd.get("status"),
    value: parseInt(fd.get("value")) || 0,
    contact: fd.get("contact"),
    email: fd.get("email"),
    agency: fd.get("agency"),
    campaign: fd.get("campaign"),
    lastContact: todayISO(),
    notes: fd.get("notes"),
    negotiationHistory: [{ date: todayISO(), text: "Deal created" }],
    contractStatus: "N/A",
    invoiced: 0,
    paid: 0,
    outstanding: 0
  };
  const row = await sbAddDeal(newDeal);
  if (row) {
    newDeal._sbId = row.id;
    await sbAddDealHistory(row.id, todayISO(), "Deal created");
  }
  DEALS.push(newDeal);
  closeAddDealModal();
  renderPipeline();
}

/* ---- RESEARCH CENTER ---- */
function renderResearch() {
  const container = document.getElementById("view-research");
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Research Center</h1>
        <p class="view-subtitle">Research brands before outreach or pricing</p>
      </div>
    </div>

    <div class="research-mode-tabs">
      <button class="mode-tab active" data-mode="outreach">Research for Outreach</button>
      <button class="mode-tab" data-mode="pricing">Research for Pricing</button>
    </div>

    <div class="research-input-group">
      <input type="text" id="researchInput" placeholder="Enter company name (e.g., Notion, Canva, Adobe...)">
      <button class="btn btn-primary" onclick="runResearch()">Research</button>
    </div>

    <div id="researchResults">
      <div class="research-cards">
        <div class="research-card">
          <h4>How to Use</h4>
          <p>Enter a company name above to generate a research card. Use <strong>Outreach</strong> mode when approaching brands, or <strong>Pricing</strong> mode when brands reach out to you.</p>
        </div>
        <div class="research-card">
          <h4>Pricing Intelligence</h4>
          <ul>
            <li>Well-funded startups (Series B+): Price at or above standard rates</li>
            <li>Seed/Series A: Standard rates, flexible on scope</li>
            <li>Bootstrap/small brands: Offer UGC alternatives at lower price point</li>
            <li>Enterprise (Adobe, Canva level): Premium pricing + long-term pitch</li>
          </ul>
        </div>
        <div class="research-card">
          <h4>Your Standard Rates</h4>
          <ul>
            <li>Instagram Reel: $15,000</li>
            <li>Instagram Static: $10,000</li>
            <li>Stories (3-pack): $5,000</li>
            <li>UGC Video (30s): $3,500</li>
            <li>Minimum rate: $15,000 organic</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll(".mode-tab").forEach(tab => {
    tab.addEventListener("click", function() {
      container.querySelectorAll(".mode-tab").forEach(t => t.classList.remove("active"));
      this.classList.add("active");
    });
  });
}

async function runResearch() {
  const input = document.getElementById("researchInput").value.trim();
  if (!input) return;

  const mode = document.querySelector(".mode-tab.active").dataset.mode;
  const resultsDiv = document.getElementById("researchResults");

  // Show loading state
  resultsDiv.innerHTML = `
    <div class="research-loading">
      <div class="research-loading-spinner"></div>
      <p>Researching <strong>${input}</strong>...</p>
      <p class="text-sm text-muted">Analyzing company data, funding, campaigns, and contacts</p>
    </div>
  `;

  try {
    const res = await fetch(API_BASE + "/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: input, mode: mode })
    });
    const result = await res.json();

    if (!result.success) {
      resultsDiv.innerHTML = `<div class="research-card"><h4>Error</h4><p>${result.error || "Research failed. Please try again."}</p></div>`;
      return;
    }

    const d = result.data;
    const co = d.company_overview || {};
    const fv = d.funding_valuation || {};
    const cc = d.creator_campaigns || {};
    const sp = d.social_presence || {};
    const kc = d.key_contacts || [];
    const pr = d.pricing_recommendation || {};

    const opportunityColor = (pr.opportunity_score || 0) >= 7 ? "var(--success)" : (pr.opportunity_score || 0) >= 4 ? "var(--accent)" : "var(--error)";

    resultsDiv.innerHTML = `
      <div class="research-result-header">
        <div>
          <h2 class="research-company-name">${co.name || input}</h2>
          <p class="text-muted">${co.industry || ""} ${co.headquarters ? " \u2022 " + co.headquarters : ""} ${co.founded ? " \u2022 Founded " + co.founded : ""}</p>
        </div>
        <div class="research-score" style="border-color:${opportunityColor}">
          <span class="score-num" style="color:${opportunityColor}">${pr.opportunity_score || "?"}</span>
          <span class="score-label">/ 10</span>
        </div>
      </div>

      <div class="research-cards">
        <div class="research-card">
          <h4>Company Overview</h4>
          <p>${co.description || "No description available."}</p>
          ${co.website ? '<p class="mt-4"><a href="' + co.website + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">' + co.website + '</a></p>' : ""}
          ${co.employee_count ? '<p class="text-sm text-muted mt-2">Employees: ' + co.employee_count + '</p>' : ""}
          ${co.key_products && co.key_products.length ? '<div class="research-tags mt-4">' + co.key_products.map(function(p){ return '<span class="research-tag">' + p + '</span>'; }).join("") + '</div>' : ""}
        </div>

        <div class="research-card">
          <h4>Funding & Valuation</h4>
          <div class="research-data-grid">
            <div class="research-data-item"><span class="data-label">Stage</span><span class="data-value">${fv.funding_stage || "Unknown"}</span></div>
            <div class="research-data-item"><span class="data-label">Total Raised</span><span class="data-value">${fv.total_raised || "Unknown"}</span></div>
            <div class="research-data-item"><span class="data-label">Valuation</span><span class="data-value">${fv.valuation || "Unknown"}</span></div>
            <div class="research-data-item"><span class="data-label">Revenue Est.</span><span class="data-value">${fv.revenue_estimate || "Unknown"}</span></div>
          </div>
          ${fv.latest_round ? '<p class="mt-4 text-sm">Latest: ' + fv.latest_round + '</p>' : ""}
          ${fv.investors && fv.investors.length ? '<p class="text-sm text-muted mt-2">Investors: ' + fv.investors.join(", ") + '</p>' : ""}
          ${fv.public_ticker ? '<p class="text-sm mt-2" style="color:var(--accent)">Public: ' + fv.public_ticker + '</p>' : ""}
        </div>

        <div class="research-card">
          <h4>Creator Campaigns</h4>
          ${cc.recent_partnerships && cc.recent_partnerships.length ? '<ul>' + cc.recent_partnerships.map(function(p){ return '<li>' + p + '</li>'; }).join("") + '</ul>' : '<p class="text-muted">No known creator partnerships found.</p>'}
          ${cc.campaign_style ? '<p class="mt-4 text-sm"><strong>Style:</strong> ' + cc.campaign_style + '</p>' : ""}
          ${cc.estimated_creator_budget ? '<p class="text-sm" style="color:var(--accent)">Est. creator budget: ' + cc.estimated_creator_budget + '</p>' : ""}
          ${cc.marketing_channels && cc.marketing_channels.length ? '<div class="research-tags mt-4">' + cc.marketing_channels.map(function(c){ return '<span class="research-tag">' + c + '</span>'; }).join("") + '</div>' : ""}
        </div>

        <div class="research-card">
          <h4>Social Presence</h4>
          <div class="research-social-list">
            ${renderSocialItem("Instagram", sp.instagram)}
            ${renderSocialItem("TikTok", sp.tiktok)}
            ${renderSocialItem("Twitter/X", sp.twitter)}
            ${renderSocialItem("LinkedIn", sp.linkedin)}
            ${renderSocialItem("YouTube", sp.youtube)}
          </div>
        </div>

        <div class="research-card">
          <h4>Key Contacts</h4>
          ${kc.length ? '<div class="research-contacts">' + kc.map(function(c){
            return '<div class="contact-item"><div class="contact-name">' + (c.name || "Unknown") + '</div><div class="contact-title">' + (c.title || "") + '</div>' + (c.platform ? '<div class="contact-platform">' + c.platform + '</div>' : "") + (c.notes ? '<div class="contact-notes">' + c.notes + '</div>' : "") + '</div>';
          }).join("") + '</div>' : '<p class="text-muted">Search LinkedIn for marketing/partnerships roles at ' + input + '</p>'}
        </div>

        <div class="research-card research-card-accent">
          <h4>Pricing Recommendation</h4>
          <div class="pricing-rec-tier">
            <span class="tier-badge" style="background:${pr.tier === "Premium" ? "var(--accent)" : pr.tier === "Standard" ? "var(--success)" : pr.tier === "Decline" ? "var(--error)" : "var(--text-muted)"}">${pr.tier || "Standard"}</span>
            <span class="rec-rate">${pr.recommended_rate || "$15,000"}</span>
          </div>
          <p class="mt-4">${pr.reasoning || ""}</p>
          ${pr.deal_structure ? '<p class="mt-4 text-sm"><strong>Suggested structure:</strong> ' + pr.deal_structure + '</p>' : ""}
          ${pr.negotiation_tips && pr.negotiation_tips.length ? '<div class="mt-4"><strong class="text-sm">Negotiation Tips:</strong><ul class="mt-2">' + pr.negotiation_tips.map(function(t){ return '<li>' + t + '</li>'; }).join("") + '</ul></div>' : ""}
          ${pr.red_flags && pr.red_flags.length ? '<div class="mt-4"><strong class="text-sm" style="color:var(--error)">Red Flags:</strong><ul class="mt-2">' + pr.red_flags.map(function(f){ return '<li style="color:var(--error)">' + f + '</li>'; }).join("") + '</ul></div>' : ""}
        </div>
      </div>
    `;
  } catch (err) {
    resultsDiv.innerHTML = `<div class="research-card"><h4>Connection Error</h4><p>Could not reach the research service. Please try again.</p><p class="text-sm text-muted">${err.message}</p></div>`;
  }
}

function renderSocialItem(platform, data) {
  if (!data) return "";
  const handle = data.handle || "";
  const count = data.followers || data.subscribers || "";
  const notes = data.notes || "";
  return '<div class="social-item"><span class="social-platform">' + platform + '</span><span class="social-handle">' + handle + '</span><span class="social-count">' + count + '</span>' + (notes ? '<span class="social-notes">' + notes + '</span>' : "") + '</div>';
}

/* ---- PRICING CALCULATOR ---- */
function renderPricing() {
  const container = document.getElementById("view-pricing");
  const allItems = [...RATE_CARD.organic, ...RATE_CARD.ugc, ...RATE_CARD.tiktok, ...RATE_CARD.youtube];

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Pricing Calculator</h1>
        <p class="view-subtitle">Build custom quotes based on your rate card</p>
      </div>
    </div>

    <div class="pricing-layout">
      <div>
        <div class="card">
          <div class="pricing-section">
            <div class="pricing-section-title">Organic Placement</div>
            ${RATE_CARD.organic.map(item => pricingRow(item)).join("")}
          </div>
          <div class="pricing-section">
            <div class="pricing-section-title">UGC Content</div>
            ${RATE_CARD.ugc.map(item => pricingRow(item)).join("")}
          </div>
          <div class="pricing-section">
            <div class="pricing-section-title">TikTok</div>
            ${RATE_CARD.tiktok.map(item => pricingRow(item)).join("")}
          </div>
          <div class="pricing-section">
            <div class="pricing-section-title">YouTube</div>
            ${RATE_CARD.youtube.map(item => pricingRow(item)).join("")}
          </div>
          <div class="pricing-section">
            <div class="pricing-section-title">Add-Ons (% of base)</div>
            ${RATE_CARD.addOns.map(item => `
              <div class="pricing-row">
                <label><input type="checkbox" data-addon="${item.id}" data-pct="${item.pct}" onchange="calcPricing()"> ${item.name}</label>
                <span class="rate">+${item.pct}%</span>
              </div>
            `).join("")}
          </div>
          <div class="pricing-section">
            <div class="pricing-section-title">Bundle Discount</div>
            <div class="pricing-row">
              <label><input type="checkbox" id="bundleDiscount" onchange="calcPricing()"> Apply 10% bundle discount</label>
              <span class="rate">-10%</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="pricing-summary" id="pricingSummary">
          <div class="summary-title">Quote Summary</div>
          <div id="summaryLines"><p class="text-muted text-sm">Select deliverables to build a quote</p></div>
          <div class="summary-line total" id="summaryTotal" style="display:none">
            <span>Total</span><span id="totalAmount">$0</span>
          </div>
          <div class="summary-comparison" id="summaryComparison" style="display:none">
            <div class="comparison-row"><span>Industry standard (4%)</span><span id="comp4">$0</span></div>
            <div class="comparison-row"><span>Your baseline (6%)</span><span id="comp6">$0</span></div>
            <div class="comparison-row highlight"><span>Your quote</span><span id="compQuote">$0</span></div>
          </div>
          <button class="btn btn-primary mt-4" style="width:100%" onclick="exportQuote()">Export Quote as Text</button>
        </div>
      </div>
    </div>
  `;
}

function pricingRow(item) {
  return `<div class="pricing-row">
    <label><input type="checkbox" data-item="${item.id}" data-rate="${item.rate}" onchange="calcPricing()"> ${item.name}</label>
    <input type="number" class="qty-input" data-qty-for="${item.id}" value="1" min="1" max="20" onchange="calcPricing()">
    <span class="rate">${item.range || formatCurrency(item.rate)}</span>
  </div>`;
}

function calcPricing() {
  let lines = [];
  let baseTotal = 0;

  document.querySelectorAll('[data-item]').forEach(cb => {
    if (cb.checked) {
      const id = cb.dataset.item;
      const rate = parseInt(cb.dataset.rate);
      const qtyInput = document.querySelector(`[data-qty-for="${id}"]`);
      const qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
      const lineTotal = rate * qty;
      baseTotal += lineTotal;
      const name = cb.parentElement.textContent.trim();
      lines.push({ name, qty, rate, total: lineTotal });
    }
  });

  // Add-ons
  let addOnTotal = 0;
  document.querySelectorAll('[data-addon]').forEach(cb => {
    if (cb.checked) {
      const pct = parseInt(cb.dataset.pct);
      const addOnAmount = Math.round(baseTotal * pct / 100);
      addOnTotal += addOnAmount;
      const name = cb.parentElement.textContent.trim();
      lines.push({ name: name + " (+" + pct + "%)", qty: 1, rate: addOnAmount, total: addOnAmount });
    }
  });

  let total = baseTotal + addOnTotal;

  // Bundle discount
  const bundleEl = document.getElementById("bundleDiscount");
  if (bundleEl && bundleEl.checked && total > 0) {
    const discount = Math.round(total * 0.1);
    lines.push({ name: "Bundle Discount (-10%)", qty: 1, rate: -discount, total: -discount });
    total -= discount;
  }

  const linesDiv = document.getElementById("summaryLines");
  const totalDiv = document.getElementById("summaryTotal");
  const compDiv = document.getElementById("summaryComparison");

  if (lines.length === 0) {
    linesDiv.innerHTML = '<p class="text-muted text-sm">Select deliverables to build a quote</p>';
    totalDiv.style.display = "none";
    compDiv.style.display = "none";
    return;
  }

  linesDiv.innerHTML = lines.map(l => `
    <div class="summary-line">
      <span>${l.name}${l.qty > 1 ? " × " + l.qty : ""}</span>
      <span>${formatCurrency(l.total)}</span>
    </div>
  `).join("");

  totalDiv.style.display = "flex";
  document.getElementById("totalAmount").textContent = formatCurrency(total);

  compDiv.style.display = "block";
  const followersNum = CREATOR.platforms.instagram.followersNum;
  document.getElementById("comp4").textContent = formatCurrency(Math.round(followersNum * 0.04));
  document.getElementById("comp6").textContent = formatCurrency(Math.round(followersNum * 0.06));
  document.getElementById("compQuote").textContent = formatCurrency(total);
}

function exportQuote() {
  const lines = [];
  lines.push("=== QUOTE — Jordan's Archives ===\n");
  document.querySelectorAll("#summaryLines .summary-line").forEach(line => {
    const spans = line.querySelectorAll("span");
    if (spans.length === 2) {
      lines.push(spans[0].textContent + ": " + spans[1].textContent);
    }
  });
  const total = document.getElementById("totalAmount").textContent;
  lines.push("\nTOTAL: " + total);
  lines.push("\n---\nPayment: 50% on approval, 50% on delivery. NET 14.");
  lines.push("Contact: jordanss.archives@gmail.com");

  const text = lines.join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quote-jordans-archives.txt";
  a.click();
  URL.revokeObjectURL(url);
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
          <div class="mk-avatar">JW</div>
          <div>
            <div class="mk-brand-name">
              Jordan's Archives
              <svg class="mk-verified" width="18" height="18" viewBox="0 0 24 24" fill="var(--teal)"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
            </div>
            <div class="mk-handle">@jordans.archivess</div>
            <div class="mk-niche">Visual Creator \u00b7 Editing Education \u00b7 Creative Business</div>
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
        <div class="mk-platforms">
          <a href="https://instagram.com/jordans.archivess" target="_blank" rel="noopener" class="mk-platform-card mk-platform-link">
            <div class="platform-icon ig">${SKETCHY_ICONS.instagram}</div>
            <div class="mk-platform-details">
              <div class="mk-platform-stat">${CREATOR.platforms.instagram.followers}</div>
              <div class="mk-platform-label">Followers</div>
              <div class="mk-platform-er">${CREATOR.platforms.instagram.engagement} Engagement</div>
            </div>
          </a>
          <a href="https://tiktok.com/@jordans.archives" target="_blank" rel="noopener" class="mk-platform-card mk-platform-link">
            <div class="platform-icon tt">${SKETCHY_ICONS.tiktok}</div>
            <div class="mk-platform-details">
              <div class="mk-platform-stat">${CREATOR.platforms.tiktok.followers}</div>
              <div class="mk-platform-label">Followers</div>
              <div class="mk-platform-er">${CREATOR.platforms.tiktok.likes} Total Likes</div>
            </div>
          </a>
          <a href="https://youtube.com/@JordansArchives" target="_blank" rel="noopener" class="mk-platform-card mk-platform-link">
            <div class="platform-icon yt">${SKETCHY_ICONS.youtube}</div>
            <div class="mk-platform-details">
              <div class="mk-platform-stat">${CREATOR.platforms.youtube.followers}</div>
              <div class="mk-platform-label">Subscribers</div>
              <div class="mk-platform-er">${CREATOR.platforms.youtube.videos} Videos</div>
            </div>
          </a>
          <a href="https://x.com/jordanarchivess" target="_blank" rel="noopener" class="mk-platform-card mk-platform-link">
            <div class="platform-icon tw">${SKETCHY_ICONS.twitter}</div>
            <div class="mk-platform-details">
              <div class="mk-platform-stat">${CREATOR.platforms.twitter.followers}</div>
              <div class="mk-platform-label">Followers</div>
              <div class="mk-platform-er">New Account</div>
            </div>
          </a>
          <a href="https://linkedin.com/in/jordanwatkinss" target="_blank" rel="noopener" class="mk-platform-card mk-platform-link">
            <div class="platform-icon li">${SKETCHY_ICONS.linkedin}</div>
            <div class="mk-platform-details">
              <div class="mk-platform-stat">${CREATOR.platforms.linkedin.followers}</div>
              <div class="mk-platform-label">Followers</div>
              <div class="mk-platform-er">${CREATOR.platforms.linkedin.connections} Connections</div>
            </div>
          </a>
        </div>
      </div>

      <div class="mk-row">
        <div class="mk-section">
          <h3 class="mk-section-title">Audience Demographics</h3>
          <div class="mk-demo-grid">
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
          </div>
        </div>

        <div class="mk-section">
          <h3 class="mk-section-title">Brand Alignment</h3>
          <div class="mk-tags">
            ${AUDIENCE_DATA.interests.map(i => `<span class="mk-tag">${i}</span>`).join("")}
          </div>
          <div class="mk-alignment-list">
            <div class="mk-alignment-item mk-align-yes"><span class="mk-align-icon">\u2713</span><span>AI tools that enhance creativity</span></div>
            <div class="mk-alignment-item mk-align-yes"><span class="mk-align-icon">\u2713</span><span>Visual storytelling and editing tools</span></div>
            <div class="mk-alignment-item mk-align-yes"><span class="mk-align-icon">\u2713</span><span>Creative business and entrepreneurship</span></div>
            <div class="mk-alignment-item mk-align-yes"><span class="mk-align-icon">\u2713</span><span>Tech, gadgets, and productivity tools</span></div>
            <div class="mk-alignment-item mk-align-no"><span class="mk-align-icon">\u2717</span><span>Products requiring rev-share only</span></div>
            <div class="mk-alignment-item mk-align-no"><span class="mk-align-icon">\u2717</span><span>AI tools that replace creativity (organic)</span></div>
          </div>
        </div>
      </div>

      <div class="mk-section">
        <h3 class="mk-section-title">Campaign Performance</h3>
        <div class="mk-campaigns">
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
        </div>
      </div>

      <div class="mk-section">
        <h3 class="mk-section-title">Rates</h3>
        <div class="mk-rates">
          <div class="mk-rate-card"><div class="mk-rate-name">Instagram Reel</div><div class="mk-rate-price">$15,000</div></div>
          <div class="mk-rate-card"><div class="mk-rate-name">IG Static / Carousel</div><div class="mk-rate-price">$10,000</div></div>
          <div class="mk-rate-card"><div class="mk-rate-name">IG Stories (3-pack)</div><div class="mk-rate-price">$5,000</div></div>
          <div class="mk-rate-card"><div class="mk-rate-name">UGC Video (30s)</div><div class="mk-rate-price">$3,500</div></div>
          <div class="mk-rate-card"><div class="mk-rate-name">UGC Video (60s)</div><div class="mk-rate-price">$5,000</div></div>
          <div class="mk-rate-card"><div class="mk-rate-name">Custom Bundle</div><div class="mk-rate-price">Let's talk</div></div>
        </div>
        <p style="color:var(--text-muted);font-size:12px;margin-top:12px">All pricing is flat-rate. NET 30 terms. Licensing, exclusivity, and paid ad usage rights available as add-ons.</p>
      </div>

      <div class="mk-footer">
        <p>Contact: <a href="mailto:jordanss.archives@gmail.com" style="color:var(--accent)">jordanss.archives@gmail.com</a></p>

      </div>
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
    const url = `${API_BASE}/api/analytics${refresh ? "?refresh=true" : ""}`;
    const resp = await fetch(url);
    const json = await resp.json();
    if (json.success) {
      analyticsData = json.data;
      analyticsLastFetch = json.data.last_fetch;
      // If we loaded from cache but there's no data, auto-refresh
      if (!refresh && (!analyticsData.last_fetch || Object.keys(analyticsData.platforms).length === 0)) {
        analyticsLoading = false;
        return fetchAnalyticsData(true);
      }
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
        <p style="color:var(--text-secondary)">Fetching live data from Social Blade...</p>
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

  // Compute follower growth from history for the selected period
  const igHistory = analyticsData ? filterHistoryByPeriod(analyticsData.history.instagram || [], analyticsTimePeriod) : [];
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
      ${analyticsData ? renderAnalyticsPlatform(analyticsPlatform) : '<div class="card" style="padding:60px;text-align:center"><p style="color:var(--text-muted)">Click "Refresh Data" to fetch live analytics</p></div>'}
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

  const p = analyticsData.platforms[platform];
  const history = filterHistoryByPeriod(analyticsData.history[platform] || [], analyticsTimePeriod);
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
          <div class="analytics-stat-delta">@${p.handle || 'jordanarchivess'}</div>
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
          <div class="analytics-stat-delta">/in/${p.handle || 'jordanwatkinss'}/</div>
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
  let history = filterHistoryByPeriod(analyticsData.history[platform] || [], analyticsTimePeriod);
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
  const history = filterHistoryByPeriod(analyticsData.history.instagram || [], analyticsTimePeriod);
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

/* ---- BRAND MATCH ---- */
function renderBrandMatch() {
  const container = document.getElementById("view-brandmatch");

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Brand Match</h1>
        <p class="view-subtitle">AI-powered scoring for inbound brand deal inquiries</p>
      </div>
    </div>

    <div class="bm-layout">
      <div class="card bm-input-card">
        <h3 style="margin-bottom:16px;color:var(--text-primary)">Score a Brand Deal</h3>
        <div class="form-group"><label>Brand Name</label><input type="text" id="bmBrand" placeholder="e.g., Notion, Squarespace..."></div>
        <div class="form-group"><label>Contact Person</label><input type="text" id="bmContact" placeholder="e.g., Sarah from Marketing"></div>
        <div class="form-group"><label>Proposed Scope</label><input type="text" id="bmScope" placeholder="e.g., 1 Instagram Reel + Stories"></div>
        <div class="form-group"><label>Budget Mentioned</label><input type="text" id="bmBudget" placeholder="e.g., $10,000 or 'Not mentioned'"></div>
        <div class="form-group"><label>Email / Message Content</label><textarea id="bmEmail" rows="4" placeholder="Paste the brand's inquiry email here..."></textarea></div>
        <button class="btn btn-primary" style="width:100%" onclick="runBrandMatch()">Score This Deal</button>

        <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border)">
          <h4 style="color:var(--text-secondary);font-size:13px;margin-bottom:8px">Quick Score from Pipeline</h4>
          <div class="bm-quick-list">
            ${DEALS.filter(d => !["Declined", "Completed", "Cold"].includes(mapStatus(d.status)) && mapStatus(d.status) !== "Active")
              .slice(0, 5)
              .map(d => `<button class="bm-quick-btn" onclick="quickBrandMatch('${d.brand.replace(/'/g, "\\'")}')"><span>${d.brand}</span><span class="text-muted" style="font-size:11px">${d.status}</span></button>`).join("")}
          </div>
        </div>
      </div>

      <div id="bmResults">
        <div class="card">
          <div style="padding:40px;text-align:center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <p style="color:var(--text-secondary);margin-top:16px;font-size:15px">Enter a brand to get an AI-powered match score</p>
            <p style="color:var(--text-muted);font-size:12px;margin-top:8px">Scores are based on niche alignment, budget potential, brand reputation, campaign fit, and growth value</p>
          </div>
        </div>
      </div>
    </div>
  `;
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

async function runBrandMatch() {
  const brand = document.getElementById("bmBrand").value.trim();
  if (!brand) return;

  const resultsDiv = document.getElementById("bmResults");
  resultsDiv.innerHTML = `
    <div class="card">
      <div class="research-loading">
        <div class="research-loading-spinner"></div>
        <p>Scoring <strong>${brand}</strong>...</p>
        <p class="text-sm text-muted">Analyzing niche fit, budget potential, and brand reputation</p>
      </div>
    </div>
  `;

  try {
    const res = await fetch(API_BASE + "/api/brand-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand,
        contact: document.getElementById("bmContact").value,
        scope: document.getElementById("bmScope").value,
        budget: document.getElementById("bmBudget").value,
        email_body: document.getElementById("bmEmail").value
      })
    });
    const result = await res.json();

    if (!result.success) {
      resultsDiv.innerHTML = `<div class="card"><div style="padding:24px"><h4>Error</h4><p>${result.error}</p></div></div>`;
      return;
    }

    const d = result.data;
    const scoreColor = d.overall_score >= 7 ? "var(--green)" : d.overall_score >= 4 ? "var(--accent)" : "var(--error)";
    const classColors = { "High-Value": "var(--green)", "Standard": "var(--teal)", "Low-Priority": "var(--accent)", "Decline": "var(--error)" };
    const classColor = classColors[d.classification] || "var(--text-muted)";

    resultsDiv.innerHTML = `
      <div class="bm-result-header card">
        <div class="bm-score-ring" style="border-color:${scoreColor}">
          <span class="bm-score-num" style="color:${scoreColor}">${d.overall_score}</span>
          <span class="bm-score-of">/10</span>
        </div>
        <div>
          <h2 style="color:var(--text-primary);margin:0">${brand}</h2>
          <span class="bm-classification" style="color:${classColor}">${d.classification}</span>
        </div>
      </div>

      <div class="bm-scores-grid">
        ${Object.entries(d.scores || {}).map(([key, val]) => {
          const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          const barColor = val.score >= 7 ? "var(--green)" : val.score >= 4 ? "var(--accent)" : "var(--error)";
          return `
            <div class="card bm-score-card">
              <div class="bm-score-header">
                <span class="bm-score-label">${label}</span>
                <span class="bm-score-val" style="color:${barColor}">${val.score}/10</span>
              </div>
              <div class="bm-score-bar"><div class="bm-score-fill" style="width:${val.score * 10}%;background:${barColor}"></div></div>
              <p class="bm-score-reason">${val.reason}</p>
            </div>
          `;
        }).join("")}
      </div>

      <div class="card" style="padding:20px">
        <h4 style="color:var(--text-primary);margin-bottom:8px">Recommendation</h4>
        <p style="color:var(--text-secondary);line-height:1.6">${d.recommendation}</p>
        ${d.suggested_rate ? `<p style="margin-top:12px"><strong style="color:var(--accent)">Suggested Rate: ${d.suggested_rate}</strong></p>` : ""}
        ${d.suggested_response ? `<p style="margin-top:4px;color:var(--text-muted);font-size:12px">Suggested response: ${d.suggested_response.replace(/_/g, " ")}</p>` : ""}
      </div>

      ${d.flags && d.flags.length ? `<div class="card" style="padding:20px">
        <h4 style="color:var(--error);margin-bottom:8px">Flags</h4>
        <ul style="color:var(--text-secondary);font-size:13px">${d.flags.map(f => "<li>" + f + "</li>").join("")}</ul>
      </div>` : ""}

      ${d.comparable_deals && d.comparable_deals.length ? `<div class="card" style="padding:20px">
        <h4 style="color:var(--text-primary);margin-bottom:8px">Comparable Deals</h4>
        <ul style="color:var(--text-secondary);font-size:13px">${d.comparable_deals.map(c => "<li>" + c + "</li>").join("")}</ul>
      </div>` : ""}
    `;
  } catch (err) {
    resultsDiv.innerHTML = `<div class="card"><div style="padding:24px"><h4>Connection Error</h4><p>${err.message}</p></div></div>`;
  }
}

/* ---- PROPOSAL BUILDER ---- */
let proposalTab = "builder";

function renderProposals() {
  const container = document.getElementById("view-proposals");

  const activeDealOptions = DEALS.filter(d => !["Declined", "Completed", "Cold"].includes(mapStatus(d.status)))
    .map(d => `<option value="${d.brand}">${d.brand} — ${d.status}</option>`).join("");

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Proposals</h1>
        <p class="view-subtitle">Generate polished partnership proposals</p>
      </div>
    </div>

    <div class="proposal-layout">
      <div class="card proposal-form-card">
        <h3 style="margin-bottom:16px;color:var(--text-primary)">Build a Proposal</h3>
        <div class="form-group">
          <label>Load from Pipeline</label>
          <select id="propDealSelect" onchange="loadDealForProposal()">
            <option value="">— Select a deal —</option>
            ${activeDealOptions}
          </select>
        </div>
        <div class="form-group"><label>Brand Name</label><input type="text" id="propBrand" placeholder="Brand name"></div>
        <div class="form-group"><label>Contact Person</label><input type="text" id="propContact" placeholder="Contact name"></div>
        <div class="form-group"><label>Scope of Work</label><textarea id="propScope" rows="2" placeholder="e.g., 1 Instagram Reel + 3 Stories"></textarea></div>
        <div class="form-group"><label>Deliverables</label><textarea id="propDeliverables" rows="2" placeholder="e.g., 1 Reel (40s+), 3 IG Stories, 2 revision rounds"></textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Quoted Value ($)</label><input type="number" id="propValue" placeholder="15000"></div>
          <div class="form-group"><label>Term</label><input type="text" id="propTerm" placeholder="e.g., 30 days"></div>
        </div>
        <div class="form-group">
          <label>Template</label>
          <select id="propTemplate">
            <option value="standard">Standard Partnership</option>
            <option value="ugc">UGC Only</option>
            <option value="premium">Premium / Multi-Month</option>
            <option value="decline">Polite Decline</option>
          </select>
        </div>
        <div class="form-group"><label>Additional Notes</label><textarea id="propNotes" rows="2" placeholder="Any special terms or context..."></textarea></div>
        <button class="btn btn-primary" style="width:100%" onclick="generateProposal()">Generate Proposal</button>
      </div>

      <div id="proposalOutput">
        <div class="card">
          <div style="padding:40px;text-align:center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p style="color:var(--text-secondary);margin-top:16px">Fill in deal details and generate a polished proposal</p>
            <p style="color:var(--text-muted);font-size:12px;margin-top:8px">Proposals include scope, deliverables, pricing, terms, and are ready to send</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function loadDealForProposal() {
  const brand = document.getElementById("propDealSelect").value;
  const deal = DEALS.find(d => d.brand === brand);
  if (!deal) return;
  document.getElementById("propBrand").value = deal.brand;
  document.getElementById("propContact").value = deal.contact || "";
  document.getElementById("propScope").value = deal.scope || "";
  document.getElementById("propDeliverables").value = deal.deliverables || "";
  document.getElementById("propValue").value = parseValue(deal.value) || "";
  document.getElementById("propTerm").value = deal.term || "";
  document.getElementById("propNotes").value = deal.notes || "";
}

async function generateProposal() {
  const brand = document.getElementById("propBrand").value.trim();
  if (!brand) return;

  const outputDiv = document.getElementById("proposalOutput");
  outputDiv.innerHTML = `
    <div class="card">
      <div class="research-loading">
        <div class="research-loading-spinner"></div>
        <p>Generating proposal for <strong>${brand}</strong>...</p>
      </div>
    </div>
  `;

  try {
    const res = await fetch(API_BASE + "/api/generate-proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand,
        contact: document.getElementById("propContact").value,
        scope: document.getElementById("propScope").value,
        deliverables: document.getElementById("propDeliverables").value,
        value: parseInt(document.getElementById("propValue").value) || 0,
        term: document.getElementById("propTerm").value,
        notes: document.getElementById("propNotes").value,
        template: document.getElementById("propTemplate").value
      })
    });
    const result = await res.json();

    if (!result.success) {
      outputDiv.innerHTML = `<div class="card" style="padding:24px"><h4>Error</h4><p>${result.error}</p></div>`;
      return;
    }

    const p = result.data;
    outputDiv.innerHTML = `
      <div class="card proposal-preview">
        <div class="proposal-header">
          <h3>${p.subject_line || "Partnership Proposal"}</h3>
          <div class="proposal-actions">
            <button class="btn btn-secondary btn-sm" onclick="copyProposal()">Copy to Clipboard</button>
            <button class="btn btn-primary btn-sm" onclick="downloadProposal()">Download .txt</button>
          </div>
        </div>
        <div class="proposal-body" id="proposalText">
          <pre class="proposal-text">${p.full_text || [p.greeting, p.intro, p.scope_section, p.pricing_section, p.terms_section, p.closing, p.signature].filter(Boolean).join("\n\n")}</pre>
        </div>
      </div>

      ${p.deliverables && p.deliverables.length ? `
      <div class="card" style="padding:20px">
        <h4 style="color:var(--text-primary);margin-bottom:8px">Deliverables Summary</h4>
        <ul style="color:var(--text-secondary);font-size:13px">${p.deliverables.map(d => "<li>" + d + "</li>").join("")}</ul>
      </div>` : ""}
    `;
  } catch (err) {
    outputDiv.innerHTML = `<div class="card" style="padding:24px"><h4>Connection Error</h4><p>${err.message}</p></div>`;
  }
}

function copyProposal() {
  const text = document.querySelector(".proposal-text").textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(".proposal-actions .btn-secondary");
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = "Copy to Clipboard"; }, 2000);
  });
}

function downloadProposal() {
  const text = document.querySelector(".proposal-text").textContent;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "proposal-jordans-archives.txt";
  a.click();
  URL.revokeObjectURL(url);
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
let calendarMonth = 2; // March 2026 (0-indexed)
let calendarYear = 2026;

function renderCalendar() {
  const container = document.getElementById("view-calendar");
  const year = calendarYear;
  const month = calendarMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const monthName = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  let cells = [];
  // Previous month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDays - i;
    cells.push({ day: d, otherMonth: true, date: null });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const events = CALENDAR_EVENTS.filter(e => e.date === dateStr);
    cells.push({ day: d, otherMonth: false, date: dateStr, events, isToday: dateStr === todayStr });
  }
  // Next month padding
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, otherMonth: true, date: null });
  }

  // Build weekly schedule board
  var dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var weekLabel = WEEKLY_PLAN_META.weekLabel || '';
  var weekStartMonth = 3, weekStartDay = 9, weekStartYear = 2026;
  if (weekLabel) {
    var weekParts = weekLabel.split(" - ");
    var weekStartParts = weekParts[0].split("/");
    weekStartMonth = parseInt(weekStartParts[0]) || 3;
    weekStartDay = parseInt(weekStartParts[1]) || 9;
  }
  var todayDayName = today.toLocaleDateString("en-US", { weekday: "long" });

  var weekColumnsHtml = dayOrder.map(function(dayName, idx) {
    var dayDate = new Date(weekStartYear, weekStartMonth - 1, weekStartDay + idx);
    var dayDateStr = (dayDate.getMonth() + 1) + '/' + dayDate.getDate();
    var isToday = dayName === todayDayName;
    var dayTasks = WEEKLY_TASKS.filter(function(t) { return t.day === dayName; });
    var tasksHtml = dayTasks.map(function(t) {
      var checkedClass = t.done ? 'done' : '';
      var checkIcon = t.done
        ? '<svg class="task-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12.5l3 3 5-6"/></svg>'
        : '<svg class="task-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>';
      var timeBadge = t.timeEstimate ? '<span class="time-badge">' + t.timeEstimate + 'h</span>' : '';
      var priorityDot = t.priority ? '<span class="priority-dot priority-' + t.priority.toLowerCase() + '"></span>' : '';
      var actionsHtml = '<span class="task-actions">' +
        '<button class="task-action-btn" onclick="openEditWeeklyTask(event,\'' + t.id + '\')" title="Edit">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        '</button>' +
        '<button class="task-action-btn task-action-delete" onclick="deleteWeeklyTask(event,\'' + t.id + '\')" title="Delete">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>' +
        '</button>' +
      '</span>';
      return '<div class="task-card ' + checkedClass + '" onclick="toggleWeeklyTask(\'' + t.id + '\')">' +
        '<span class="task-checkbox">' + checkIcon + '</span>' +
        '<span class="task-card-name">' + t.name + '</span>' +
        priorityDot + timeBadge + actionsHtml +
        '</div>';
    }).join('');
    var addBtnHtml = '<button class="add-task-btn" onclick="showAddTaskForm(\'' + dayName + '\')">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>' +
      '</button>';
    var addFormHtml = '<div class="add-task-inline" id="addTaskInline-' + dayName + '" style="display:none">' +
      '<input type="text" placeholder="New task..." onkeydown="handleAddTaskKey(event,\'' + dayName + '\')">' +
      '<div class="add-task-inline-actions">' +
        '<button onclick="submitAddTask(\'' + dayName + '\')" class="add-task-confirm">Add</button>' +
        '<button onclick="hideAddTaskForm(\'' + dayName + '\')" class="add-task-cancel">Cancel</button>' +
      '</div>' +
    '</div>';
    return '<div class="day-column ' + (isToday ? 'is-today' : '') + '">' +
      '<div class="day-column-header">' +
        '<span class="day-column-name">' + dayName.substring(0, 3) + '</span>' +
        '<span class="day-column-date">' + dayDateStr + '</span>' +
      '</div>' +
      '<div class="day-column-body">' + (tasksHtml || '<div class="day-column-empty">No tasks</div>') + addFormHtml + '</div>' +
      addBtnHtml +
      '</div>';
  }).join('');

  // Build parking lot
  var sortedParking = PARKING_LOT.slice().sort(function(a, b) {
    var order = { 'High': 0, 'Medium': 1 };
    var aO = a.priority ? (order[a.priority] !== undefined ? order[a.priority] : 2) : 2;
    var bO = b.priority ? (order[b.priority] !== undefined ? order[b.priority] : 2) : 2;
    return aO - bO;
  });
  var parkingCount = PARKING_LOT.filter(function(t) { return !t.done; }).length;
  var parkingItemsHtml = sortedParking.map(function(t) {
    var checkedClass = t.done ? 'done' : '';
    var checkIcon = t.done
      ? '<svg class="task-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12.5l3 3 5-6"/></svg>'
      : '<svg class="task-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>';
    var priorityBadge = '';
    if (t.priority === 'High') priorityBadge = '<span class="priority-badge priority-high">High</span>';
    else if (t.priority === 'Medium') priorityBadge = '<span class="priority-badge priority-medium">Medium</span>';
    var actionsHtml = '<span class="task-actions">' +
      '<button class="task-action-btn" onclick="openEditParkingTask(event,\'' + t.id + '\')" title="Edit">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
      '</button>' +
      '<button class="task-action-btn task-action-delete" onclick="deleteParkingTask(event,\'' + t.id + '\')" title="Delete">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>' +
      '</button>' +
    '</span>';
    return '<div class="parking-lot-item ' + checkedClass + '" onclick="toggleParkingLotTask(\'' + t.id + '\')">' +
      '<span class="task-checkbox">' + checkIcon + '</span>' +
      '<span class="parking-lot-text">' + t.task + '</span>' +
      priorityBadge + actionsHtml +
      '</div>';
  }).join('');

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Calendar</h1>
        <p class="view-subtitle">Content deadlines and weekly schedule</p>
      </div>
    </div>

    <!-- Section A: Content Calendar -->
    <div class="card">
      <div class="calendar-header">
        <div class="calendar-nav">
          <button onclick="changeMonth(-1)">&larr;</button>
          <span class="calendar-month">${monthName}</span>
          <button onclick="changeMonth(1)">&rarr;</button>
        </div>
        <div class="gap-row">
          <span class="badge ig" style="background:linear-gradient(90deg,rgba(240,148,51,0.25),rgba(188,24,136,0.25));color:#e6683c">Instagram</span>
          <span class="badge" style="background:rgba(255,0,0,0.15);color:#ff4444">YouTube</span>
          <span class="badge" style="background:rgba(255,255,255,0.08);color:var(--text-secondary)">Other</span>
        </div>
      </div>
      <div class="calendar-grid">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => `<div class="calendar-day-header">${d}</div>`).join("")}
        ${cells.map(c => `
          <div class="calendar-day ${c.otherMonth ? "other-month" : ""} ${c.isToday ? "today" : ""}">
            <div class="calendar-day-num">${c.day}</div>
            ${(c.events || []).map(e => {
              let cls = "ig";
              if (e.platform === "yt") cls = "yt";
              else if (e.platform === "tt") cls = "tt";
              else if (e.platform === "ugc") cls = "tt";
              return `<div class="calendar-event ${cls}" title="${e.brand}: ${e.type}">${e.brand} — ${e.type}</div>`;
            }).join("")}
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Section B: Weekly Schedule -->
    <div class="card weekly-schedule-card">
      <div class="weekly-schedule-header">
        <div class="weekly-schedule-title-row">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 4.2h17.6c.6 0 1.1.5 1.1 1.1v14.5c0 .6-.5 1.1-1.1 1.1H3.2c-.6 0-1.1-.5-1.1-1.1V5.3c0-.6.5-1.1 1.1-1.1z"/><path d="M16.1 2.1v4.1"/><path d="M8 2.1v4.1"/><path d="M2.1 10.1h19.8"/></svg>
          <h2 class="weekly-schedule-title">Week of ${WEEKLY_PLAN_META.weekLabel || 'Loading...'}</h2>
        </div>
        <div class="weekly-schedule-actions">
          <span class="sync-status" title="Data stored in Supabase">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12.5l3 3 5-6"/></svg>
            Live
          </span>
        </div>
      </div>
      <div class="weekly-board">
        ${weekColumnsHtml}
      </div>
    </div>

    <!-- Section C: Parking Lot -->
    <div class="card parking-lot-section">
      <div class="card-header card-header-toggle" onclick="toggleWidget('widget-parking-lot')">
        <span class="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>
          Parking Lot
        </span>
        <div class="card-header-right">
          <button class="add-parking-btn" onclick="event.stopPropagation(); showAddParkingForm()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </button>
          <span class="badge-count">${parkingCount} items</span>
          ${SKETCHY_ICONS.chevron}
        </div>
      </div>
      <div class="parking-lot-body" id="widget-parking-lot">
        <div class="add-parking-inline" id="addParkingInline" style="display:none">
          <input type="text" placeholder="New parking lot item..." onkeydown="handleAddParkingKey(event)">
          <select><option value="">Priority</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select>
          <div class="add-task-inline-actions">
            <button onclick="submitAddParking()" class="add-task-confirm">Add</button>
            <button onclick="hideAddParkingForm()" class="add-task-cancel">Cancel</button>
          </div>
        </div>
        ${parkingItemsHtml}
      </div>
    </div>

    <!-- Task Edit Modal -->
    <div class="task-edit-modal" id="taskEditModal" style="display:none" onclick="if(event.target===this)closeTaskEditModal()">
      <div class="task-edit-modal-inner">
        <h3>Edit Task</h3>
        <div class="task-edit-field">
          <label>Name</label>
          <input type="text" id="editTaskName">
        </div>
        <div class="task-edit-field" id="editTaskDayRow">
          <label>Day</label>
          <select id="editTaskDay">
            <option value="Monday">Monday</option><option value="Tuesday">Tuesday</option><option value="Wednesday">Wednesday</option><option value="Thursday">Thursday</option><option value="Friday">Friday</option><option value="Saturday">Saturday</option><option value="Sunday">Sunday</option>
          </select>
        </div>
        <div class="task-edit-field">
          <label>Priority</label>
          <select id="editTaskPriority">
            <option value="">None</option><option value="Urgent">Urgent</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
          </select>
        </div>
        <div class="task-edit-field" id="editTaskTimeRow">
          <label>Time (hours)</label>
          <input type="number" id="editTaskTime" step="0.5" min="0">
        </div>
        <div class="task-edit-actions">
          <button onclick="saveTaskEdit()" class="btn-primary">Save</button>
          <button onclick="closeTaskEditModal()" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function changeMonth(delta) {
  calendarMonth += delta;
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
  if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
  renderCalendar();
}

/* ---- TASK HANDLERS (Supabase-backed) ---- */
function toggleWeeklyTask(taskId) {
  sbToggleWeeklyTask(taskId);
}

function toggleParkingLotTask(taskId) {
  sbToggleParkingTask(taskId);
}

function deleteWeeklyTask(e, taskId) {
  e.stopPropagation();
  sbDeleteWeeklyTask(taskId);
}

function deleteParkingTask(e, taskId) {
  e.stopPropagation();
  sbDeleteParkingTask(taskId);
}

function openEditWeeklyTask(e, taskId) {
  e.stopPropagation();
  var task = WEEKLY_TASKS.find(function(t) { return t.id === taskId; });
  if (!task) return;
  var modal = document.getElementById('taskEditModal');
  if (!modal) return;
  modal.style.display = 'flex';
  modal.dataset.editType = 'weekly';
  modal.dataset.editId = taskId;
  document.getElementById('editTaskName').value = task.name;
  document.getElementById('editTaskDay').value = task.day;
  document.getElementById('editTaskPriority').value = task.priority || '';
  document.getElementById('editTaskTime').value = task.timeEstimate || '';
}

function openEditParkingTask(e, taskId) {
  e.stopPropagation();
  var task = PARKING_LOT.find(function(t) { return t.id === taskId; });
  if (!task) return;
  var modal = document.getElementById('taskEditModal');
  if (!modal) return;
  modal.style.display = 'flex';
  modal.dataset.editType = 'parking';
  modal.dataset.editId = taskId;
  document.getElementById('editTaskName').value = task.task;
  document.getElementById('editTaskDay').value = '';
  document.getElementById('editTaskPriority').value = task.priority || '';
  document.getElementById('editTaskTime').value = '';
  // Hide day/time fields for parking lot
  document.getElementById('editTaskDayRow').style.display = 'none';
  document.getElementById('editTaskTimeRow').style.display = 'none';
}

function closeTaskEditModal() {
  var modal = document.getElementById('taskEditModal');
  if (modal) {
    modal.style.display = 'none';
    // Reset hidden fields
    document.getElementById('editTaskDayRow').style.display = '';
    document.getElementById('editTaskTimeRow').style.display = '';
  }
}

function saveTaskEdit() {
  var modal = document.getElementById('taskEditModal');
  var editType = modal.dataset.editType;
  var editId = modal.dataset.editId;
  var name = document.getElementById('editTaskName').value.trim();
  var day = document.getElementById('editTaskDay').value;
  var priority = document.getElementById('editTaskPriority').value || null;
  var time = parseFloat(document.getElementById('editTaskTime').value) || null;
  if (!name) return;
  if (editType === 'weekly') {
    sbEditWeeklyTask(editId, { name: name, day: day, priority: priority, timeEstimate: time });
  } else {
    sbEditParkingTask(editId, { task: name, priority: priority });
  }
  closeTaskEditModal();
}

function showAddTaskForm(day) {
  var form = document.getElementById('addTaskInline-' + day);
  if (form) {
    form.style.display = 'block';
    var input = form.querySelector('input');
    if (input) input.focus();
  }
}

function hideAddTaskForm(day) {
  var form = document.getElementById('addTaskInline-' + day);
  if (form) {
    form.style.display = 'none';
    var input = form.querySelector('input');
    if (input) input.value = '';
  }
}

function submitAddTask(day) {
  var form = document.getElementById('addTaskInline-' + day);
  var input = form.querySelector('input');
  var name = input.value.trim();
  if (name) {
    sbAddWeeklyTask(name, day, null, null);
    input.value = '';
    form.style.display = 'none';
  }
}

function handleAddTaskKey(e, day) {
  if (e.key === 'Enter') submitAddTask(day);
  if (e.key === 'Escape') hideAddTaskForm(day);
}

function showAddParkingForm() {
  var form = document.getElementById('addParkingInline');
  if (form) {
    form.style.display = 'flex';
    var input = form.querySelector('input');
    if (input) input.focus();
  }
}

function hideAddParkingForm() {
  var form = document.getElementById('addParkingInline');
  if (form) {
    form.style.display = 'none';
    var input = form.querySelector('input');
    if (input) input.value = '';
    var sel = form.querySelector('select');
    if (sel) sel.value = '';
  }
}

function submitAddParking() {
  var form = document.getElementById('addParkingInline');
  var input = form.querySelector('input');
  var sel = form.querySelector('select');
  var task = input.value.trim();
  var priority = sel.value || null;
  if (task) {
    sbAddParkingTask(task, priority);
    input.value = '';
    sel.value = '';
    form.style.display = 'none';
  }
}

function handleAddParkingKey(e) {
  if (e.key === 'Enter') submitAddParking();
  if (e.key === 'Escape') hideAddParkingForm();
}

/* ---- SETTINGS ---- */
function renderSettings() {
  const container = document.getElementById("view-settings");

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Settings</h1>
        <p class="view-subtitle">Manage your rate card, platform stats, and references</p>
      </div>
    </div>

    <div class="settings-grid">
      <div class="settings-section">
        <h3>Rate Card — Organic</h3>
        ${RATE_CARD.organic.map(r => `<div class="setting-row"><span class="setting-label">${r.name}</span><span class="setting-value">${formatCurrency(r.rate)}</span></div>`).join("")}
        <h3 class="mt-4">Rate Card — UGC</h3>
        ${RATE_CARD.ugc.map(r => `<div class="setting-row"><span class="setting-label">${r.name}</span><span class="setting-value">${formatCurrency(r.rate)}</span></div>`).join("")}
        <h3 class="mt-4">TikTok</h3>
        ${RATE_CARD.tiktok.map(r => `<div class="setting-row"><span class="setting-label">${r.name}</span><span class="setting-value">${r.range || formatCurrency(r.rate)}</span></div>`).join("")}
        <h3 class="mt-4">YouTube</h3>
        ${RATE_CARD.youtube.map(r => `<div class="setting-row"><span class="setting-label">${r.name}</span><span class="setting-value">${r.range || formatCurrency(r.rate)}</span></div>`).join("")}
        <h3 class="mt-4">Bundles</h3>
        ${RATE_CARD.bundles.map(r => `<div class="setting-row"><span class="setting-label">${r.name}</span><span class="setting-value">${formatCurrency(r.rate)}</span></div>`).join("")}
      </div>

      <div>
        <div class="settings-section">
          <h3>Platform Stats</h3>
          <div class="setting-row"><span class="setting-label">Instagram</span><span class="setting-value">${CREATOR.platforms.instagram.followers} · ${CREATOR.platforms.instagram.engagement} ER</span></div>
          <div class="setting-row"><span class="setting-label">TikTok</span><span class="setting-value">${CREATOR.platforms.tiktok.followers} · ${CREATOR.platforms.tiktok.likes} likes</span></div>
          <div class="setting-row"><span class="setting-label">YouTube</span><span class="setting-value">${CREATOR.platforms.youtube.followers} subs · ${CREATOR.platforms.youtube.videos} videos</span></div>
          <div class="setting-row"><span class="setting-label">X (Twitter)</span><span class="setting-value">${CREATOR.platforms.twitter.followers} followers</span></div>
          <div class="setting-row"><span class="setting-label">LinkedIn</span><span class="setting-value">${CREATOR.platforms.linkedin.followers} followers</span></div>
          <div class="setting-row"><span class="setting-label">Pricing Rule</span><span class="setting-value">${RATE_CARD.pricingRule}</span></div>
          <div class="setting-row"><span class="setting-label">Minimum Rate</span><span class="setting-value">${formatCurrency(RATE_CARD.minimumRate)}</span></div>
        </div>

        <div class="settings-section mt-4">
          <h3>Brand Alignment Criteria</h3>
          ${BRAND_RULES.length > 0 ? BRAND_RULES.map(r => '<div class="checklist-item">' + r.rule + '</div>').join('') : '<div class="checklist-item">No rules configured</div>'}
        </div>

        <div class="settings-section mt-4">
          <h3>Contract Must-Haves</h3>
          ${CONTRACT_RULES.length > 0 ? CONTRACT_RULES.map(r => '<div class="checklist-item">' + r.rule + '</div>').join('') : '<div class="checklist-item">No rules configured</div>'}
        </div>

        <div class="settings-section mt-4">
          <h3>FTC Disclosure Requirements</h3>
          <div class="checklist-item">Disclose: Any payment, free product, affiliate relationship</div>
          <div class="checklist-item">Acceptable: "ad", "sponsored", "paid partnership", "#ad"</div>
          <div class="checklist-item">NOT acceptable: "sp", "collab", "spon", "Thanks to [Brand]"</div>
          <div class="checklist-item">Video: State verbally in first 30s AND show on screen</div>
          <div class="checklist-item">Must be visible without clicking "more"</div>
          <div class="checklist-item">Penalty: Up to $53,088 per violation</div>
        </div>

        <div class="settings-section mt-4 sync-config-card">
          <h3><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px"><path d="M4 12c0-4.4 3.6-8 8-8 2.8 0 5.2 1.4 6.6 3.5M20 12c0 4.4-3.6 8-8 8-2.8 0-5.2-1.4-6.6-3.5"/><polyline points="20 4 20 8 16 8"/><polyline points="4 20 4 16 8 16"/></svg>Finance Sync</h3>
          <p style="color:var(--muted);font-size:0.85rem;margin-bottom:12px;">Connect your Google Apps Script web app to sync expenses and revenue entries with Google Sheets. Deploy the companion Apps Script and paste the URL below.</p>
          <div class="expense-field">
            <label>Apps Script Web App URL</label>
            <input type="text" id="appsScriptUrlInput" value="${APPS_SCRIPT_URL}" placeholder="https://script.google.com/macros/s/…/exec" style="width:100%;padding:10px 12px;border:2px solid var(--border);background:var(--surface);color:var(--text);font-size:0.9rem;">
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button onclick="(function(){
              const url = document.getElementById('appsScriptUrlInput').value.trim();
              APPS_SCRIPT_URL = url;
              safeSet('arkives_apps_script_url', url);
              showExpenseToast('Apps Script URL saved!', 'success');
            })()" style="padding:8px 16px;background:var(--accent);color:#fff;border:2px solid var(--border);font-weight:700;cursor:pointer;">Save</button>
            <button onclick="(function(){
              const url = document.getElementById('appsScriptUrlInput').value.trim();
              if(!url){showExpenseToast('Enter a URL first','error');return;}
              showExpenseToast('Testing connection…','info');
              fetch(url+'?action=ping').then(r=>r.json()).then(d=>{
                showExpenseToast('Connected! '+JSON.stringify(d),'success');
              }).catch(e=>{
                showExpenseToast('Connection failed: '+e.message,'error');
              });
            })()" style="padding:8px 16px;background:var(--surface);color:var(--text);border:2px solid var(--border);font-weight:700;cursor:pointer;">Test Connection</button>
          </div>
          <p style="color:var(--muted);font-size:0.75rem;margin-top:8px;">Entries are always saved locally. When a URL is configured, they also sync to your Google Sheet.</p>
        </div>
      </div>
    </div>
  `;
}

/* ---- EXPENSES (Real Data from Google Sheets) ---- */
let PERSONAL_SUBS = { monthly: [], monthlyTotal: 0, yearly: [], yearlyTotal: 0, annualTotal: 0 };

let BUSINESS_SUBS = { monthly: [], monthlyTotal: 0, yearly: [], yearlyTotal: 0, annualTotal: 0 };

let NET_INCOME = {
  months: [], summary: { avgRevenue: 0, avgExpense: 0, avgPL: 0 }
};

const PERSONAL_CATEGORIES = ["LEASURE", "LIVING", "GAS", "GROCERIES", "THERAPY", "OTHER"];
const BUSINESS_CATEGORIES = ["HARDWARE", "SOFTWARE", "AD", "GENERAL", "TRAVEL", "EMPLOYEE"];

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

/* ---- EXPENSE TRACKING CONFIG ---- */
let APPS_SCRIPT_URL = safeGet('arkives_apps_script_url') || '';
let EXPENSE_CACHE = JSON.parse(safeGet('arkives_expense_cache') || '{"entries":[],"lastFetch":null}');
let EXPENSE_FILTER = 'all'; // all, personal, business

// Pre-populate cache from seed data on first load
if (!EXPENSE_CACHE.entries.length && !EXPENSE_CACHE.lastFetch) {
  fetch('expense_cache_seed.json').then(r => r.json()).then(seed => {
    if (seed.entries && seed.entries.length) {
      EXPENSE_CACHE = seed;
      safeSet('arkives_expense_cache', JSON.stringify(EXPENSE_CACHE));
      if (getHash() === 'expenses') renderExpenses();
    }
  }).catch(() => {});
}

const ENTRY_CATEGORIES = {
  personal_expense: ["LEASURE EXPENSES", "LIVING EXPENSES", "GAS EXPENSES", "GROCERIES EXPENSES", "THERAPY EXPENSE", "OTHER EXPENSES"],
  personal_revenue: ["OTHER REVENUE", "WORK REVENUE"],
  business_expense: ["HARDWARE EXPENSE", "SOFTWARE EXPENSE", "AD EXPENSE", "GENERAL EXPENSE", "TRAVEL EXPENSE", "EMPLOYEE EXPENSE"],
  business_revenue: ["WORK REVENUE", "PROGRAM REVENUE"]
};

/* ---- EXPENSE HELPER FUNCTIONS ---- */

function showExpenseToast(message, type = 'info') {
  const existing = document.querySelector('.expense-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'expense-toast ' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
}

function showAddEntryModal() {
  let entryType = 'personal';
  let entryDir = 'expense';

  function getCats() {
    return ENTRY_CATEGORIES[entryType + '_' + entryDir] || [];
  }

  function renderCatOptions() {
    return getCats().map(c => `<option value="${c}">${c}</option>`).join('');
  }

  const overlay = document.createElement('div');
  overlay.className = 'expense-modal-overlay';
  overlay.id = 'addEntryOverlay';
  overlay.onclick = function(e) { if (e.target === overlay) closeAddEntryModal(); };

  function buildModal() {
    overlay.innerHTML = `
      <div class="expense-modal">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          Add Entry
        </h2>
        <div class="expense-field">
          <label>Type</label>
          <div class="pill-toggle" id="entryTypeToggle">
            <button class="${entryType === 'personal' ? 'active' : ''}" data-val="personal">Personal</button>
            <button class="${entryType === 'business' ? 'active' : ''}" data-val="business">Business</button>
          </div>
        </div>
        <div class="expense-field">
          <label>Direction</label>
          <div class="pill-toggle" id="entryDirToggle">
            <button class="${entryDir === 'expense' ? 'active' : ''}" data-val="expense">Expense</button>
            <button class="${entryDir === 'revenue' ? 'active' : ''}" data-val="revenue">Revenue</button>
          </div>
        </div>
        <div class="expense-field">
          <label>Category</label>
          <select id="entryCategory">${renderCatOptions()}</select>
        </div>
        <div class="expense-field">
          <label>Amount</label>
          <div class="amount-wrap">
            <input type="number" id="entryAmount" placeholder="0.00" min="0" step="0.01">
          </div>
        </div>
        <div class="expense-field">
          <label>Notes</label>
          <input type="text" id="entryNotes" placeholder="What was this for?">
        </div>
        <div class="expense-field">
          <label>Date</label>
          <input type="date" id="entryDate" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="expense-modal-actions">
          <button class="btn btn-primary" onclick="submitExpenseEntry()">Add Entry</button>
          <button class="btn" onclick="closeAddEntryModal()">Cancel</button>
        </div>
      </div>
    `;

    // Wire up pill toggles
    overlay.querySelectorAll('#entryTypeToggle button').forEach(btn => {
      btn.addEventListener('click', function() {
        entryType = this.dataset.val;
        buildModal();
      });
    });
    overlay.querySelectorAll('#entryDirToggle button').forEach(btn => {
      btn.addEventListener('click', function() {
        entryDir = this.dataset.val;
        buildModal();
      });
    });
  }

  buildModal();
  document.body.appendChild(overlay);
}

function closeAddEntryModal() {
  const overlay = document.getElementById('addEntryOverlay');
  if (overlay) overlay.remove();
}

async function submitExpenseEntry() {
  const category = document.getElementById('entryCategory').value;
  const amount = parseFloat(document.getElementById('entryAmount').value) || 0;
  const notes = document.getElementById('entryNotes').value || '';
  const date = document.getElementById('entryDate').value;

  if (amount <= 0) {
    showExpenseToast('Please enter a valid amount', 'error');
    return;
  }

  // Determine type/direction from category
  const typeToggle = document.querySelector('#entryTypeToggle button.active');
  const dirToggle = document.querySelector('#entryDirToggle button.active');
  const type = typeToggle ? typeToggle.dataset.val : 'personal';
  const direction = dirToggle ? dirToggle.dataset.val : 'expense';

  const entry = { type, direction, category, amount, notes, date, dateISO: date, id: Date.now() };

  // Save to local cache
  EXPENSE_CACHE.entries.unshift(entry);
  safeSet('arkives_expense_cache', JSON.stringify(EXPENSE_CACHE));

  // POST to Apps Script if URL is set
  if (APPS_SCRIPT_URL) {
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', type, category, amount, notes, date })
      });
      showExpenseToast('Entry saved & synced', 'success');
    } catch (err) {
      showExpenseToast('Saved locally — sync failed: ' + err.message, 'error');
    }
  } else {
    showExpenseToast('Saved locally — connect Google Sheets in Settings to sync', 'info');
  }

  closeAddEntryModal();
  renderExpenses();
}

async function refreshExpenseData() {
  if (!APPS_SCRIPT_URL) {
    showExpenseToast('Set up Google Sheets sync in Settings first');
    return;
  }
  showExpenseToast('Syncing from Google Sheets...', 'info');
  try {
    const res = await fetch(APPS_SCRIPT_URL + '?action=journal&type=all&months=6');
    const data = await res.json();
    if (data.success) {
      EXPENSE_CACHE = { entries: data.entries, lastFetch: new Date().toISOString() };
      safeSet('arkives_expense_cache', JSON.stringify(EXPENSE_CACHE));
      showExpenseToast('Synced ' + data.count + ' entries', 'success');
      renderExpenses();
    }
  } catch (err) {
    showExpenseToast('Sync failed: ' + err.message, 'error');
  }
}

function filterTransactions(filter) {
  EXPENSE_FILTER = filter;
  renderExpenses();
}

function renderExpenses() {
  const container = document.getElementById("view-expenses");
  const combinedMonthlySubs = PERSONAL_SUBS.monthlyTotal + BUSINESS_SUBS.monthlyTotal;
  const ytdPL = NET_INCOME.ytd.totalPL;
  const latestMonth = NET_INCOME.months[NET_INCOME.months.length - 1];

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Expenses</h1>
      </div>
      <div class="gap-row" style="display:flex;align-items:center;gap:8px">
        <span class="sheets-connected-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ${APPS_SCRIPT_URL ? 'Google Sheets Connected' : 'Local Only'}</span>
        <button class="btn" onclick="refreshExpenseData()" style="padding:6px 10px;display:flex;align-items:center;gap:4px;font-size:0.8rem">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
        <button class="btn btn-primary" onclick="showAddEntryModal()">+ Add Entry</button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Monthly Subscriptions</span>
        <span class="kpi-value">${formatCurrency(combinedMonthlySubs, true)}</span>
        <span class="kpi-delta">Personal + Business</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">YTD Net Income</span>
        <span class="kpi-value ${ytdPL >= 0 ? 'up' : 'down'}">${ytdPL >= 0 ? '+' : ''}${formatCurrency(ytdPL, true)}</span>
        <span class="kpi-delta">Jan – Mar 2026</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Business MRR Target</span>
        <span class="kpi-value">${formatCurrency(BUSINESS_SUBS.mrrMinimum, true)}</span>
        <span class="kpi-delta">Minimum to break even</span>
      </div>
    </div>

    <!-- Net Income by Month -->
    <div class="collapsible-section" style="margin-bottom:16px">
      <button class="collapsible-header" onclick="toggleCollapsible(this)">
        <span class="collapsible-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="3"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="8" y1="3" x2="8" y2="21"/></svg>
          Net Income Summary
        </span>
        <svg class="collapsible-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="collapsible-body" style="display:block">
        <div class="card" style="margin:0">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th style="text-align:right">Revenue</th>
                  <th style="text-align:right">Expenses</th>
                  <th style="text-align:right">Net P&L</th>
                </tr>
              </thead>
              <tbody>
                ${NET_INCOME.months.map(m => `
                  <tr>
                    <td style="font-weight:600">${m.month}</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums">${formatCurrency(m.totalRev, true)}</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--red)">${formatCurrency(m.totalExp, true)}</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:${m.totalPL >= 0 ? 'var(--green)' : 'var(--red)'}">${m.totalPL >= 0 ? '+' : ''}${formatCurrency(m.totalPL, true)}</td>
                  </tr>
                `).join('')}
                <tr style="border-top:2px solid var(--border)">
                  <td style="font-weight:700">YTD Total</td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700">${formatCurrency(NET_INCOME.months.reduce((s,m) => s + m.totalRev, 0), true)}</td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:var(--red)">${formatCurrency(NET_INCOME.ytd.totalExp, true)}</td>
                  <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:${NET_INCOME.ytd.totalPL >= 0 ? 'var(--green)' : 'var(--red)'}">${NET_INCOME.ytd.totalPL >= 0 ? '+' : ''}${formatCurrency(NET_INCOME.ytd.totalPL, true)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Monthly P&L Chart -->
    <div class="card" style="margin-bottom:16px">
      <h3 style="font-family:var(--font-display);margin-bottom:12px;font-size:1rem">Monthly P&L</h3>
      <div style="height:220px">
        <canvas id="expensePLChart"></canvas>
      </div>
    </div>

    <!-- Recent Transactions -->
    <div class="collapsible-section" style="margin-bottom:16px">
      <button class="collapsible-header" onclick="toggleCollapsible(this)">
        <span class="collapsible-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 10h8"/><path d="M8 14h4"/></svg>
          Recent Transactions (last 30 entries)
        </span>
        <svg class="collapsible-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="collapsible-body" style="display:block">
        <div class="card" style="margin:0">
          <div class="txn-filters">
            <button class="txn-filter-btn ${EXPENSE_FILTER === 'all' ? 'active' : ''}" onclick="filterTransactions('all')">All</button>
            <button class="txn-filter-btn ${EXPENSE_FILTER === 'personal' ? 'active' : ''}" onclick="filterTransactions('personal')">Personal</button>
            <button class="txn-filter-btn ${EXPENSE_FILTER === 'business' ? 'active' : ''}" onclick="filterTransactions('business')">Business</button>
            <button class="txn-filter-btn ${EXPENSE_FILTER === 'month' ? 'active' : ''}" onclick="filterTransactions('month')">This Month</button>
          </div>
          ${(() => {
            let filtered = EXPENSE_CACHE.entries || [];
            if (EXPENSE_FILTER === 'personal') filtered = filtered.filter(e => e.type === 'personal');
            else if (EXPENSE_FILTER === 'business') filtered = filtered.filter(e => e.type === 'business');
            else if (EXPENSE_FILTER === 'month') {
              const now = new Date();
              const curMonth = now.getMonth();
              const curYear = now.getFullYear();
              filtered = filtered.filter(e => {
                if (!e.date) return false;
                const d = new Date(e.dateISO || e.date);
                return d.getMonth() === curMonth && d.getFullYear() === curYear;
              });
            }
            filtered = filtered.slice(0, 30);
            if (!filtered.length) return '<p style="text-align:center;color:var(--text-muted);padding:24px 0">No entries yet. Tap + Add Entry to start tracking.</p>';
            return filtered.map(e => {
              const isRevenue = e.direction === 'revenue' || e.isRevenue === true || (e.category && e.category.includes('REVENUE'));
              const typeClass = e.type === 'business' ? 'business' : 'personal';
              const catClass = isRevenue ? 'revenue' : typeClass;
              const amtClass = isRevenue ? 'revenue' : 'expense';
              const sign = isRevenue ? '+' : '-';
              let dateStr = '—';
              try {
                const dp = e.dateISO ? new Date(e.dateISO + 'T12:00:00') : new Date(e.date);
                if (!isNaN(dp)) dateStr = dp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              } catch(_) {}
              return '<div class="txn-row">' +
                '<span class="txn-date">' + dateStr + '</span>' +
                '<div class="txn-details"><span class="txn-category ' + catClass + '">' + (e.category || 'Uncategorized') + '</span>' +
                (e.notes ? '<span class="txn-notes">' + e.notes + '</span>' : '') +
                '</div>' +
                '<span class="txn-amount ' + amtClass + '">' + sign + formatCurrency(e.amount, true) + '</span>' +
                '</div>';
            }).join('');
          })()}
        </div>
      </div>
    </div>

    <!-- Personal Subscriptions -->
    <div class="collapsible-section" style="margin-bottom:16px">
      <button class="collapsible-header" onclick="toggleCollapsible(this)">
        <span class="collapsible-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          Personal Subscriptions — ${formatCurrency(PERSONAL_SUBS.monthlyTotal)}/mo
        </span>
        <svg class="collapsible-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="collapsible-body">
        <div class="card" style="margin:0">
          <div class="expense-sub-grid">
            ${PERSONAL_SUBS.monthly.map(s => `
              <div class="expense-sub-row">
                <span class="expense-sub-name">${s.item}</span>
                <span class="expense-sub-cost">${formatCurrency(s.cost)}</span>
              </div>
            `).join('')}
            <div class="expense-sub-row expense-sub-total">
              <span class="expense-sub-name">Monthly Total</span>
              <span class="expense-sub-cost">${formatCurrency(PERSONAL_SUBS.monthlyTotal)}</span>
            </div>
          </div>
          ${PERSONAL_SUBS.yearly.length ? `
            <div style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--border)">
              <h4 style="font-family:var(--font-display);font-size:0.85rem;margin-bottom:8px;color:var(--text-muted)">Annual Subscriptions (${formatCurrency(PERSONAL_SUBS.yearlyTotal)}/yr)</h4>
              <div class="expense-sub-grid">
                ${PERSONAL_SUBS.yearly.map(s => `
                  <div class="expense-sub-row">
                    <span class="expense-sub-name">${s.item} <span style="color:var(--text-muted);font-size:0.75rem">(${s.renewal})</span></span>
                    <span class="expense-sub-cost">${formatCurrency(s.cost)}/yr</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          <div class="expense-budget-bar" style="margin-top:16px">
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">
              <span style="color:var(--text-muted)">Monthly Budget: ${formatCurrency(4000)}</span>
              <span style="color:var(--text-muted)">Remaining: ${formatCurrency(PERSONAL_SUBS.remainingBudget)}</span>
            </div>
            <div style="height:6px;background:var(--surface-secondary);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${Math.min(100, Math.round((PERSONAL_SUBS.monthlyTotal / 4000) * 100))}%;background:${PERSONAL_SUBS.monthlyTotal > 4000 ? 'var(--red)' : 'var(--accent)'};border-radius:3px"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Business Subscriptions -->
    <div class="collapsible-section" style="margin-bottom:16px">
      <button class="collapsible-header" onclick="toggleCollapsible(this)">
        <span class="collapsible-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/></svg>
          Business Subscriptions — ${formatCurrency(BUSINESS_SUBS.monthlyTotal)}/mo
        </span>
        <svg class="collapsible-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="collapsible-body">
        <div class="card" style="margin:0">
          <div class="expense-sub-grid">
            ${BUSINESS_SUBS.monthly.map(s => `
              <div class="expense-sub-row">
                <span class="expense-sub-name">${s.item}${s.renewal ? ` <span style="color:var(--text-muted);font-size:0.75rem">(${s.renewal})</span>` : ''}</span>
                <span class="expense-sub-cost">${formatCurrency(s.cost)}</span>
              </div>
            `).join('')}
            <div class="expense-sub-row expense-sub-total">
              <span class="expense-sub-name">Software & Services</span>
              <span class="expense-sub-cost">${formatCurrency(BUSINESS_SUBS.monthlyTotal)}</span>
            </div>
          </div>

          <div style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--border)">
            <h4 style="font-family:var(--font-display);font-size:0.85rem;margin-bottom:8px;color:var(--text-muted)">Labor & Payroll</h4>
            <div class="expense-sub-grid">
              ${BUSINESS_SUBS.labor.map(l => `
                <div class="expense-sub-row">
                  <span class="expense-sub-name">${l.name}</span>
                  <span class="expense-sub-cost">${l.salary ? formatCurrency(l.salary) + '/mo' : l.role}</span>
                </div>
              `).join('')}
              <div class="expense-sub-row">
                <span class="expense-sub-name">Unexpected Budget Buffer</span>
                <span class="expense-sub-cost">${formatCurrency(BUSINESS_SUBS.unexpectedBudget)}</span>
              </div>
              <div class="expense-sub-row expense-sub-total">
                <span class="expense-sub-name">Total Monthly Business Cost</span>
                <span class="expense-sub-cost">${formatCurrency(BUSINESS_SUBS.totalMonthlyCost)}</span>
              </div>
            </div>
          </div>

          ${BUSINESS_SUBS.yearly.length ? `
            <div style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--border)">
              <h4 style="font-family:var(--font-display);font-size:0.85rem;margin-bottom:8px;color:var(--text-muted)">Annual Subscriptions (${formatCurrency(BUSINESS_SUBS.yearlyTotal)}/yr)</h4>
              <div class="expense-sub-grid">
                ${BUSINESS_SUBS.yearly.map(s => `
                  <div class="expense-sub-row">
                    <span class="expense-sub-name">${s.item} <span style="color:var(--text-muted);font-size:0.75rem">(${s.renewal})</span></span>
                    <span class="expense-sub-cost">${formatCurrency(s.cost)}/yr</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="expense-budget-bar" style="margin-top:16px">
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:4px">
              <span style="color:var(--text-muted)">MRR Revenue Target: ${formatCurrency(BUSINESS_SUBS.mrrMinimum)}</span>
              <span style="color:var(--text-muted)">Total Cost: ${formatCurrency(BUSINESS_SUBS.totalMonthlyCost)}</span>
            </div>
            <div style="height:6px;background:var(--surface-secondary);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${Math.min(100, Math.round((BUSINESS_SUBS.totalMonthlyCost / BUSINESS_SUBS.mrrMinimum) * 100))}%;background:${BUSINESS_SUBS.totalMonthlyCost > BUSINESS_SUBS.mrrMinimum ? 'var(--red)' : 'var(--accent)'};border-radius:3px"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Expense Categories -->
    <div class="collapsible-section" style="margin-bottom:16px">
      <button class="collapsible-header" onclick="toggleCollapsible(this)">
        <span class="collapsible-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c-1.657 0-3-4.03-3-9s1.343-9 3-9m0 18c1.657 0 3-4.03 3-9s-1.343-9-3-9m-9 9a9 9 0 0 1 9-9"/></svg>
          Expense Categories
        </span>
        <svg class="collapsible-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="collapsible-body">
        <div class="card" style="margin:0">
          <div class="expense-cat-dual">
            <div>
              <h4 style="font-family:var(--font-display);font-size:0.85rem;margin-bottom:8px">Personal</h4>
              <div class="expense-cat-tags">
                ${PERSONAL_CATEGORIES.map(c => `<span class="expense-cat-tag personal">${c}</span>`).join('')}
              </div>
            </div>
            <div>
              <h4 style="font-family:var(--font-display);font-size:0.85rem;margin-bottom:8px">Business</h4>
              <div class="expense-cat-tags">
                ${BUSINESS_CATEGORIES.map(c => `<span class="expense-cat-tag business">${c}</span>`).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render P&L chart
  const canvas = document.getElementById('expensePLChart');
  if (canvas) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#A8A29E' : '#6B6560';
    const gridColor = isDark ? 'rgba(232,228,221,0.08)' : 'rgba(26,23,20,0.06)';

    if (chartsRendered['expensePLChart']) chartsRendered['expensePLChart'].destroy();
    chartsRendered['expensePLChart'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: NET_INCOME.months.map(m => m.month.substring(0, 3)),
        datasets: [
          {
            label: 'Revenue',
            data: NET_INCOME.months.map(m => m.totalRev),
            backgroundColor: isDark ? 'rgba(79,152,163,0.7)' : 'rgba(1,105,111,0.7)',
            borderColor: isDark ? '#4F98A3' : '#01696F',
            borderWidth: 2,
            borderRadius: 2
          },
          {
            label: 'Expenses',
            data: NET_INCOME.months.map(m => m.totalExp),
            backgroundColor: isDark ? 'rgba(217,74,78,0.7)' : 'rgba(199,53,57,0.7)',
            borderColor: isDark ? '#D94A4E' : '#C73539',
            borderWidth: 2,
            borderRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: textColor,
              font: { family: "'General Sans', sans-serif", size: 11 },
              boxWidth: 12,
              boxHeight: 12,
              padding: 12,
              usePointStyle: true,
              pointStyle: 'rectRounded'
            }
          }
        },
        scales: {
          y: {
            grid: { color: gridColor, drawBorder: false },
            ticks: {
              color: textColor,
              font: { family: "'General Sans', sans-serif", size: 11 },
              callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v)
            }
          },
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: "'General Sans', sans-serif", size: 11 } }
          }
        }
      }
    });
  }
}

/* ---- INVOICES ---- */
let INVOICE_DATA = [];
try {
  INVOICE_DATA = DEALS.filter(d => d.invoiced && parseValue(d.invoiced) > 0).map((d, i) => ({
    id: `INV-${String(2025001 + i)}`,
    brand: d.brand,
    amount: parseValue(d.invoiced),
    date: d.lastContact || "2026-03-01",
    status: (d.status || "") === "SIGNED" ? "paid" : (String(d.status || "").includes("ACTIVE") ? "sent" : "draft"),
    description: d.deliverables ? String(d.deliverables) : "Creator partnership"
  }));
} catch(e) { console.warn("INVOICE_DATA init:", e); }

function renderInvoices() {
  const container = document.getElementById("view-invoices");
  const totalInvoiced = INVOICE_DATA.reduce((s, inv) => s + inv.amount, 0);
  const paidTotal = INVOICE_DATA.filter(inv => inv.status === "paid").reduce((s, inv) => s + inv.amount, 0);
  const pendingTotal = INVOICE_DATA.filter(inv => inv.status === "sent").reduce((s, inv) => s + inv.amount, 0);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Invoices</h1>
      </div>
      <div class="gap-row">
        <button class="btn btn-primary" onclick="toggleInvoiceForm()">+ Create Invoice</button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total Invoiced</span>
        <span class="kpi-value">${formatCurrency(totalInvoiced)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Paid</span>
        <span class="kpi-value">${formatCurrency(paidTotal)}</span>
        <span class="kpi-delta up">${INVOICE_DATA.filter(i => i.status === "paid").length} invoices</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Pending</span>
        <span class="kpi-value">${formatCurrency(pendingTotal)}</span>
        <span class="kpi-delta">${INVOICE_DATA.filter(i => i.status === "sent").length} invoices</span>
      </div>
    </div>

    <div id="invoiceFormWrap" style="display:none;margin-bottom:20px">
      <div class="card">
        <h3 style="font-family:var(--font-display);margin-bottom:16px">New Invoice</h3>
        <div class="invoice-form">
          <div>
            <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px">Brand</label>
            <select id="invoiceBrand" style="width:100%;padding:8px;border:2px solid var(--border);background:var(--surface);color:var(--text-primary);font-family:var(--font-body)">
              ${DEALS.map(d => `<option value="${d.brand}">${d.brand}</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px">Amount</label>
            <input id="invoiceAmount" type="number" placeholder="15000" style="width:100%;padding:8px;border:2px solid var(--border);background:var(--surface);color:var(--text-primary);font-family:var(--font-body);box-sizing:border-box">
          </div>
          <div>
            <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px">Description</label>
            <input id="invoiceDesc" type="text" placeholder="Instagram Reel + Stories" style="width:100%;padding:8px;border:2px solid var(--border);background:var(--surface);color:var(--text-primary);font-family:var(--font-body);box-sizing:border-box">
          </div>
          <div>
            <label style="display:block;font-size:0.8rem;font-weight:600;margin-bottom:4px">Payment Terms</label>
            <select id="invoiceTerms" style="width:100%;padding:8px;border:2px solid var(--border);background:var(--surface);color:var(--text-primary);font-family:var(--font-body)">
              <option value="net15">Net 15</option>
              <option value="net30" selected>Net 30</option>
              <option value="net45">Net 45</option>
              <option value="net60">Net 60</option>
            </select>
          </div>
        </div>
        <div class="invoice-actions" style="margin-top:16px">
          <button class="btn btn-primary" onclick="createInvoice()">Save as Draft</button>
          <button class="btn" onclick="toggleInvoiceForm()">Cancel</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Brand</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${INVOICE_DATA.length ? INVOICE_DATA.map(inv => `
              <tr>
                <td style="font-weight:600;font-variant-numeric:tabular-nums">${inv.id}</td>
                <td>${inv.brand}</td>
                <td style="font-variant-numeric:tabular-nums">${formatCurrency(inv.amount)}</td>
                <td>${inv.date}</td>
                <td><span class="invoice-status ${inv.status}">${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span></td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${inv.description}</td>
              </tr>
            `).join("") : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px">No invoices yet. Click "+ Create Invoice" to get started.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card quickbooks-card" style="margin-top:20px">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <h3 style="margin:0 0 4px;font-family:var(--font-display);font-size:1.1rem">QuickBooks Integration</h3>
          <p style="margin:0;color:var(--text-muted);font-size:0.85rem">Sync invoices with QuickBooks for automated accounting, payment tracking, and tax preparation.</p>
        </div>
        <button class="btn btn-primary" disabled style="opacity:0.6">Connect QuickBooks (Coming Soon)</button>
      </div>
    </div>
  `;
}

function toggleInvoiceForm() {
  const wrap = document.getElementById('invoiceFormWrap');
  if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

async function createInvoice() {
  const brand = document.getElementById('invoiceBrand').value;
  const amount = parseFloat(document.getElementById('invoiceAmount').value) || 0;
  const desc = document.getElementById('invoiceDesc').value || 'Creator partnership';
  const terms = document.getElementById('invoiceTerms').value;
  if (amount > 0) {
    const invNum = `INV-${String(2025001 + INVOICE_DATA.length)}`;
    const invDate = new Date().toISOString().split('T')[0];
    const row = await sbAddInvoice({
      invoiceNumber: invNum, brand: brand, amount: amount,
      date: invDate, status: 'draft', description: desc, paymentTerms: terms
    });
    INVOICE_DATA.push({
      id: invNum, brand, amount, date: invDate,
      status: 'draft', description: desc,
      _sbId: row ? row.id : null
    });
    renderInvoices();
  }
}

/* ---- MEDIA KIT PDF EXPORT ---- */
function exportMediaKitPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF library is still loading. Please try again in a moment.');
    return;
  }
  try {
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
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
    doc.text("Jordan's Archives  |  Media Kit  |  " + new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), W / 2, H - 22, { align: 'center' });
    doc.text(pageNum + ' / ' + totalPages, W - M, H - 22, { align: 'right' });
    setFill(RED);
    doc.rect(0, H - 5, W, 5, 'F');
  }

  var PLATFORM_URLS = {
    instagram: 'https://instagram.com/jordans.archivess',
    tiktok: 'https://tiktok.com/@jordans.archives',
    youtube: 'https://youtube.com/@JordansArchives',
    twitter: 'https://x.com/jordanarchivess',
    linkedin: 'https://linkedin.com/in/jordanwatkinss'
  };

  // ==================== PAGE 1 ====================
  drawPageBg();
  var Y = 38;

  // Logo "A" mark
  setDraw(RED);
  doc.setLineWidth(2.5);
  doc.line(M, Y + 2, M + 10, Y - 12);
  doc.line(M + 10, Y - 12, M + 20, Y + 2);
  doc.line(M + 4, Y - 3, M + 16, Y - 3);

  // Brand name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  setColor(TEXT_DARK);
  doc.text("Jordan's Archives", M + 28, Y);

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
  doc.text('@jordans.archivess', M, Y);
  setColor(MUTED);
  doc.text('Visual Creator  |  Editing Education  |  Creative Business', M + 80, Y);
  setColor(TEAL);
  doc.text('jordanss.archives@gmail.com', W - M, Y, { align: 'right' });

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

    // Clickable link on the card
    doc.link(cx, cy, cardW - 2, cardH, { url: PLATFORM_URLS[p.key] });

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

  var alignYes = ['AI tools that enhance creativity', 'Visual storytelling and editing tools', 'Creative business and entrepreneurship', 'Tech, gadgets, and productivity tools'];
  var alignNo = ['Products requiring rev-share only', 'AI tools that replace creativity (organic)'];

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
  doc.text('jordanss.archives@gmail.com', M, Y);

  pageFooter('2', '2');

  doc.setProperties({
    title: "Jordan's Archives - Media Kit",
    author: 'Jordan Watkins',
    subject: 'Creator Media Kit',
    creator: 'Arkives CRM'
  });

  doc.save('Jordans_Archives_Media_Kit.pdf');
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
var _currentScenes = [];
var _scriptAutoSaveTimer = null;
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
    await _sb.from('scripts').update(updates).eq('id', scriptId);
  } catch (e) { console.error('script update exception:', e); }
}

async function sbFetchScenes(scriptId) {
  if (!_sb) return [];
  try {
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
    await _sb.from('script_scenes').delete().eq('id', sceneId);
  } catch (e) { console.error('scene delete exception:', e); }
}

async function sbReorderScenes(scenes) {
  if (!_sb || !scenes.length) return;
  try {
    var updates = scenes.map(function(s, i) { return { id: s.id, script_id: s.script_id, sort_order: i }; });
    await _sb.from('script_scenes').upsert(updates);
  } catch (e) { console.error('reorder exception:', e); }
}

async function sbFetchScriptByToken(token) {
  if (!_sb) return null;
  try {
    var res = await _sb.from('scripts').select('*').eq('share_token', token).single();
    if (res.error) return null;
    return res.data;
  } catch (e) { return null; }
}

/* ---- SCRIPTS LIST VIEW ---- */
async function renderScripts() {
  var container = document.getElementById('view-scripts');
  container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:200px;border-radius:12px"></div></div>';
  var scripts = await sbFetchScripts();
  var html = '<div class="scripts-page">';
  html += '<div class="scripts-header">';
  html += '<div><h2 class="view-title" style="margin:0">Scripts</h2><p style="color:var(--text-secondary);margin:4px 0 0;font-size:13px">Storyboards and video scripts</p></div>';
  html += '<button class="btn-primary" onclick="_createNewScript()" style="display:flex;align-items:center;gap:6px">' + SKETCHY_ICONS.plus + ' New Script</button>';
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
  _currentScenes = await sbFetchScenes(scriptId);

  _renderEditorUI(container, script, _currentScenes, false);
}

function _renderEditorUI(container, script, scenes, readOnly) {
  var html = '<div class="script-editor">';

  /* Top bar */
  html += '<div class="script-editor-topbar">';
  if (!readOnly) {
    html += '<a href="#scripts" class="script-back-btn">' + SKETCHY_ICONS.chevronLeft + ' Back</a>';
  }
  html += '<input type="text" class="script-title-input" id="scriptTitleInput" value="' + _escHtml(script.title) + '" ' + (readOnly ? 'disabled' : '') + ' placeholder="Script title..." />';
  if (!readOnly) {
    html += '<div class="script-topbar-actions">';
    html += '<button class="btn-ghost" onclick="_openShareModal()" title="Share">' + SKETCHY_ICONS.share + ' Share</button>';
    html += '<span class="script-save-indicator" id="scriptSaveIndicator">Saved</span>';
    html += '</div>';
  } else {
    html += '<span class="script-readonly-badge">View Only</span>';
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
  }
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
    return _sb.from('script_scenes').update(updates[sceneId]).eq('id', sceneId);
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
  var res = await _sb.from('script_scenes').insert({ script_id: _currentScriptId, sort_order: newOrder, script_text: '', scene_description: '', thumbnail_data: '' }).select().single();
  if (res.data) {
    _currentScenes.push(res.data);
    renderScriptEditor(_currentScriptId);
  }
}

async function _deleteSceneRow(sceneId) {
  await sbDeleteScene(sceneId);
  _currentScenes = _currentScenes.filter(function(s) { return s.id !== sceneId; });
  /* Reorder remaining */
  await sbReorderScenes(_currentScenes);
  renderScriptEditor(_currentScriptId);
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
      await _sb.from('script_scenes').update({ thumbnail_data: compressed }).eq('id', sceneId);
      /* Update local cache */
      _currentScenes.forEach(function(s) { if (s.id === sceneId) s.thumbnail_data = compressed; });
      renderScriptEditor(_currentScriptId);
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

async function _removeThumb(sceneId) {
  await _sb.from('script_scenes').update({ thumbnail_data: '' }).eq('id', sceneId);
  _currentScenes.forEach(function(s) { if (s.id === sceneId) s.thumbnail_data = ''; });
  renderScriptEditor(_currentScriptId);
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
      renderScriptEditor(_currentScriptId);
    });
    row.addEventListener('dragend', function() {
      row.classList.remove('script-row-dragging');
      _dragSrcIdx = null;
    });
  });
}

/* ---- SHARE MODAL ---- */
function _openShareModal() {
  var script = _scriptsCache.find(function(s) { return s.id === _currentScriptId; });
  if (!script) return;
  var currentUrl = window.location.origin + window.location.pathname;
  var viewLink = currentUrl + '#shared/' + script.share_token;
  var editLink = currentUrl + '#shared/' + script.share_token + '/edit';

  var modal = document.createElement('div');
  modal.className = 'script-share-modal-overlay';
  modal.innerHTML = '<div class="script-share-modal">' +
    '<div class="script-share-modal-header"><h3>Share Script</h3><button onclick="this.closest(\'.script-share-modal-overlay\').remove()" class="script-share-close">&times;</button></div>' +
    '<div class="script-share-modal-body">' +
    '<label class="script-share-label">Share Mode</label>' +
    '<div class="script-share-options">' +
    '<button class="script-share-opt ' + (script.share_mode === 'none' ? 'active' : '') + '" data-mode="none" onclick="_setShareMode(\'none\', this)">Private</button>' +
    '<button class="script-share-opt ' + (script.share_mode === 'view' ? 'active' : '') + '" data-mode="view" onclick="_setShareMode(\'view\', this)">View Only</button>' +
    '<button class="script-share-opt ' + (script.share_mode === 'edit' ? 'active' : '') + '" data-mode="edit" onclick="_setShareMode(\'edit\', this)">Can Edit</button>' +
    '</div>' +
    '<div id="shareLinksArea" style="' + (script.share_mode === 'none' ? 'display:none' : '') + '">' +
    '<label class="script-share-label" style="margin-top:16px">View Link</label>' +
    '<div class="script-share-link-row"><input type="text" value="' + viewLink + '" readonly id="shareLinkView" /><button onclick="_copyShareLink(\'shareLinkView\')">Copy</button></div>' +
    '<label class="script-share-label" style="margin-top:12px">Edit Link</label>' +
    '<div class="script-share-link-row"><input type="text" value="' + editLink + '" readonly id="shareLinkEdit" /><button onclick="_copyShareLink(\'shareLinkEdit\')">Copy</button></div>' +
    '</div>' +
    '</div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

async function _setShareMode(mode, btn) {
  await sbUpdateScript(_currentScriptId, { share_mode: mode });
  /* Update local cache */
  _scriptsCache.forEach(function(s) { if (s.id === _currentScriptId) s.share_mode = mode; });
  /* Toggle UI */
  btn.closest('.script-share-options').querySelectorAll('.script-share-opt').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  var linksArea = document.getElementById('shareLinksArea');
  if (linksArea) linksArea.style.display = mode === 'none' ? 'none' : '';
}

function _copyShareLink(inputId) {
  var input = document.getElementById(inputId);
  if (!input) return;
  input.select();
  navigator.clipboard.writeText(input.value).then(function() {
    _showSaveSuccess();
  });
}

/* ---- SHARED SCRIPT VIEWER ---- */
async function renderSharedScript(token, mode) {
  var container = document.getElementById('view-shared-script');
  container.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text-secondary)"><div class="skeleton" style="height:300px;border-radius:12px"></div></div>';

  var script = await sbFetchScriptByToken(token);
  if (!script) {
    container.innerHTML = '<div style="padding:48px;text-align:center"><h2>Script Not Found</h2><p style="color:var(--text-secondary)">This link may have expired or the script has been deleted.</p></div>';
    return;
  }
  if (script.share_mode === 'none') {
    container.innerHTML = '<div style="padding:48px;text-align:center"><h2>Access Denied</h2><p style="color:var(--text-secondary)">This script is currently set to private.</p></div>';
    return;
  }
  var scenes = await sbFetchScenes(script.id);
  var isEdit = mode === 'edit' && script.share_mode === 'edit';
  _currentScriptId = script.id;
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
  } catch (e) {
    console.error('Init error:', e);
    showAuthScreen();
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
