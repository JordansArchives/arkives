// Arkives — shared mutable state.
// Every module-level variable the classic scripts used to share lives here,
// as a property of one object, so modules (and tests, via window.__arkives.state)
// read and write the same thing. Grouping into per-domain stores comes next.
export const state = {};

// ---- from app.js ----
/* ---- DATA ---- */
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
state.RATE_CARD = {
  organic: [], ugc: [], tiktok: [], youtube: [], addOns: [], bundles: [],
  minimumRate: 0, pricingRule: ""
};
state.DEALS = [];
/* ---- LATEST EMAIL UPDATES (populated by morning scan) ---- */
/* ---- ACTION ITEMS ---- */
/* ---- CONTENT DEADLINES (populated by morning scan) ---- */
state.CAMPAIGN_RESULTS = [];
state.OUTREACH_TEMPLATES = {};
state.CALENDAR_EVENTS = [];
state._sb = null;
/* ---- AUTH STATE ---- */
state._authUser = null;
state._booted = false; // hashchange is ignored until init has run once
/* ---- TASK STATE (loaded from Supabase) ---- */
state.CONTRACT_RULES = [];
state.TASKS = [];
state._tasksTableMissing = false;
state._sbReady = false;
// A toast with an action. One at a time; a new one replaces the last.
state._undoToastTimer = null;
/* ---- RENDER VIEWS ---- */
state.chartsRendered = {};
/* ---- REVENUE TRACKER ---- */
state.MONTHLY_REVENUE = [];
/* ---- MEDIA KIT ---- */
state.AUDIENCE_DATA = {
  ageRange: "", topAge: "", gender: { male: 0, female: 0 },
  topCountries: [], interests: []
};
/* ---- SOCIAL ANALYTICS (Live via Social Blade) ---- */
state.analyticsData = null;
state.analyticsPlatform = "instagram";
state.analyticsTimePeriod = "3m";
state.analyticsLoading = false;
state.analyticsLastFetch = null;
/* ---- INBOX ---- */
state.INBOX_ITEMS = [];
/* ---- CONTENT CALENDAR ---- */
state._calendarMonth = new Date().getMonth();
state._calendarYear = new Date().getFullYear();
/* ---- TASKS ---- */
state._tasksCompletedOpen = false;
state._taskComposerOpen = false;
state._editingTaskId = null;
state._taskSaving = false;
state._taskBusyIds = {};
state._taskComposerFocusPending = false;
// Delete = remove now, offer Undo for a few seconds, then commit. No
// confirm() dialog. Pending deletes are committed on navigation/unload.
state._taskPendingDeletes = {};
state.INVOICE_DATA = [];
state.CLIENTS = [];
state._invoicingMigrationMissing = false;
state.OUTREACH_TARGETS = [];
state.OUTREACH_LISTS = [];
state._outreachMigrationMissing = false;
/* ---- MEDIA KIT PDF EXPORT ---- */
// Brand mark for PDF headers, fetched once and cached as a data URL
state._brandLogoDataUrl = null;
state._scriptsCache = [];
state._currentScriptId = null;
state._currentScriptRow = null; // full script row from renderScriptEditor (share popover needs share_token/mode)
state._currentScenes = [];
state._scriptAutoSaveTimer = null;
state._scriptLoadToken = 0; // guards against a slow script painting into another's route
state._sceneDirty = {}; // sceneId -> { field: value } typed but not yet saved
state._titleDirty = null; // pending title, or null
state._scriptSaveChain = Promise.resolve(); // saves run one after another, never overlapping
state._sharedScriptToken = null;
state._sharedScriptMode = 'view';
state._dragSrcIdx = null;

// ---- from invoices.js ----
state._invEditorOpen = false;
state._invEditingId = null; // _sbId of the invoice being edited; null = new
state._inv = null; // working copy while the editor is open
state._invNewClientOpen = false; // inline new-client form inside the editor
state._invClientEditingId = null; // clients card: null = closed, '__new' = adding, else _sbId
state._invFilter = 'all'; // all | draft | sent | overdue | paid
state._invSearch = ''; // matches invoice number / bill-to
state._invPayingId = null; // invoice _sbId with the payment modal open
state._invRowMenuId = null; // invoice _sbId with the row-actions sheet open (phone)

// ---- from outreach.js ----
state._outSelectedList = 'all'; // 'all' | list _sbId
state._outTypeFilter = 'all'; // all | brand | company | platform | opportunity
state._outStatusFilter = 'all'; // all | not_contacted | contacted | in_talks | worked_together | passed
state._outSearch = ''; // matches name / website / pitch / notes
state._outSort = { key: 'name', dir: 1 };
state._outDrawerId = null; // null = closed, '__new' = adding, else target _sbId
state._outDraft = null; // working copy while the drawer is open
state._outDirty = false; // unsaved edits in the drawer
state._outAddingList = false; // inline new-list input open in the rail
state._outListEditingId = null; // list _sbId being renamed inline

// ---- from boards.js ----
state.BOARDS = [];
state._bdBoard = null; // current board row
state._bdItems = []; // current board's items
state._bdView = { x: 0, y: 0, z: 1 };
state._bdTool = 'select'; // select | note | text | pen
state._bdSelectedId = null;
state._bdMaxZ = 1;
state._bdStickyColor = 'yellow';
state._bdPenColor = 'ink';
state._bdPenWidth = 3;
state._bdSignedUrls = {}; // storage path -> signed URL
state._bdPtr = null; // active pointer gesture
state._bdPenPts = null; // in-progress stroke points (board coords)
state._bdPendingSaves = {}; // item id -> {updates, timer}
state._bdViewSaveTimer = null;
state._bdListenersBound = false;
state._bdSuppressClick = false; // eat the click that follows a drag gesture
state._bdLoadToken = 0; // guards against stale async renders
state._bdUndoStack = []; // session-local undo (cleared per board)
state._bdRedoStack = [];
state._bdOrphanPaths = []; // storage files of deleted images — purged on board exit so undo can restore them
state._bdReadOnly = false; // shared (#bshared/token) view
state._bdSharedToken = null; // set in a shared EDIT session — routes all writes through the 019 RPCs
state._bdSharedOwnerId = null; // board owner's profile id (shared edit needs it for upload paths)
state._bdEditingEl = null; // .bd-text-content currently in edit mode (format bar target)
state._bdPointers = new Map(); // active touch pointers (two-finger pan / pinch)
state._bdPinch = null; // in-progress pinch: {dist, mx, my}
state._bdChannel = null;

// ---- from toolkit-views.js ----
state.CONTRACT_DEFAULTS = {
  creatorEntity: 'Asterisk LLC',
  creatorDBA: 'Asterisk LLC',
  creatorTitle: 'Managing Member',
  creatorState: 'Colorado',
  revisionExtraCost: 500,
  paidMediaFloor: 5000,
  crossPostFee: 30,
  nonDisparagement: 6,
  mediationDays: 30,
  contentExclusions: 'raw footage, outtakes, drafts, behind-the-scenes material, working files',
  invoiceMethod: 'email',
  paymentMethod: 'wire transfer or ACH',
  approvalConsequence: 'approval of the Content as delivered',
  forceMajeureDays: 30
};
