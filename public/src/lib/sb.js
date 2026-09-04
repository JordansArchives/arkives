// Arkives — Supabase: the client and every read/write. All I/O goes through the `db` object so tests (and future callers) can swap a method.
import { state } from '../state.js';
import { _showSaveError, _showSaveSuccess } from './toast.js';
import { updateSidebarUser } from '../views/auth.js';


/* ---- SUPABASE CLIENT ---- */
const SUPABASE_URL = 'https://wqblmehsqcmsdstyweus.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jYnmjabjsjkfnBvo1Eii0g_c3aKkCf2';

/* ---- LOADERS (one per domain; stores/index.js wires them) ----
   Every query is scoped by the profile id, so sbFetchProfile() runs first
   (the store layer enforces that). Each loader returns false when it could
   not load, so the store stays unloaded and the next navigate retries.
   Errors on optional tables map to empty data, as the old boot loader did. */
function _own(table) { return state._sb.from(table).select('*').eq('user_id', state.CREATOR._sbId); }
// 42P01 = Postgres undefined_table, PGRST205 = PostgREST table not in schema cache
function _missingTable(err) { return !!err && (err.code === '42P01' || err.code === 'PGRST205'); }
function _loadFailed(what, err) {
  console.error(what + ' fetch error:', err);
  _showSaveError('Failed to load ' + what + ': ' + (err && err.message || 'Unknown error'));
  return false;
}

async function sbFetchProfile() {
  if (!state._sb) { console.warn('Supabase not available — app will show empty data'); return false; }
  try {
    // Profile first: everything else is scoped by its id. Strictly by
    // auth_user_id, create a fresh one if missing. Never claim an existing
    // unlinked profile: that once let a new signup inherit another tenant.
    var profileRes = { data: null };
    if (state._authUser && state._authUser.id) {
      profileRes = await state._sb.from('profiles').select('*').eq('auth_user_id', state._authUser.id).limit(1).maybeSingle();
      if (!profileRes.data) {
        var newProfile = await state._sb.from('profiles').insert({
          name: state._authUser.email.split('@')[0],
          email: state._authUser.email,
          auth_user_id: state._authUser.id
        }).select().single();
        if (newProfile.error) {
          console.error('Profile creation failed:', newProfile.error);
          _showSaveError('Could not set up your account. Please refresh and try again.');
          return false;
        }
        profileRes = { data: newProfile.data };
      }
    }
    if (!profileRes.data) return false;

    const p = profileRes.data;
    state.CREATOR.name = p.name || '';
    state.CREATOR.brand = p.brand || '';
    state.CREATOR.entity = p.entity || '';
    state.CREATOR.email = p.email || '';
    state.CREATOR.niche = p.niche || '';
    // Media-kit copy (migration 013) — undefined pre-migration, defaults cover it
    state.CREATOR.mkAlignYes = Array.isArray(p.mk_align_yes) ? p.mk_align_yes : [];
    state.CREATOR.mkAlignNo = Array.isArray(p.mk_align_no) ? p.mk_align_no : [];
    state.CREATOR.mkInterests = Array.isArray(p.mk_interests) ? p.mk_interests : [];
    state.CREATOR.mkContactEmail = p.mk_contact_email || '';
    // Invoicing fields (migration 011) — undefined pre-migration, defaults cover it
    state.CREATOR.businessAddress = p.business_address || '';
    state.CREATOR.bankName = p.bank_name || '';
    state.CREATOR.bankAccountHolder = p.bank_account_holder || '';
    state.CREATOR.bankAccountNumber = p.bank_account_number || '';
    state.CREATOR.bankRoutingNumber = p.bank_routing_number || '';
    state.CREATOR.bankAccountType = p.bank_account_type || '';
    state.CREATOR.invoiceNumbering = p.invoice_numbering || 'per_client';
    state.CREATOR.invoicePrefix = p.invoice_prefix || 'INV';
    // Document template (migration 015) — undefined pre-migration, defaults to classic
    state.CREATOR.invoiceTemplate = p.invoice_template || 'classic';
    state.CREATOR._sbId = p.id;
    const [platRes, rcsRes, rcRes] = await Promise.all([
      _own('platforms'),
      _own('rate_card_settings').limit(1).maybeSingle(),
      _own('rate_cards').order('sort_order')
    ]);
    // Platforms
    if (platRes.data) {
      platRes.data.forEach(pl => {
        const key = pl.platform;
        if (state.CREATOR.platforms[key]) {
          state.CREATOR.platforms[key].handle = pl.handle || '';
          state.CREATOR.platforms[key].followers = pl.followers_display || String(pl.followers);
          state.CREATOR.platforms[key].followersNum = pl.followers || 0;
          state.CREATOR.platforms[key].engagement = pl.engagement_rate ? pl.engagement_rate + '%' : '0%';
          state.CREATOR.platforms[key].tier = pl.tier || '';
          state.CREATOR.platforms[key].posts = pl.posts || 0;
          state.CREATOR.platforms[key].likes = pl.likes || '0';
          state.CREATOR.platforms[key].videos = pl.videos || 0;
          state.CREATOR.platforms[key].connections = pl.connections || 0;
          state.CREATOR.platforms[key].verified = pl.verified || false;
          state.CREATOR.platforms[key].status = pl.status || '';
          state.CREATOR.platforms[key].profileUrl = pl.profile_url || '';
          state.CREATOR.platforms[key]._sbId = pl.id;
        }
      });
    }

    // Rate card settings + rows
    if (rcsRes.data) {
      state.RATE_CARD.minimumRate = rcsRes.data.minimum_rate || 0;
      state.RATE_CARD.pricingRule = rcsRes.data.pricing_rule || '';
    }
    if (rcRes.data) {
      state.RATE_CARD.organic = []; state.RATE_CARD.ugc = []; state.RATE_CARD.tiktok = [];
      state.RATE_CARD.youtube = []; state.RATE_CARD.addOns = []; state.RATE_CARD.bundles = [];
      rcRes.data.forEach(r => {
        const item = { id: r.item_id, name: r.name, rate: r.rate || 0, platform: r.platform || '', pct: r.pct || null, range: r.rate_range || null, _sbId: r.id };
        if (state.RATE_CARD[r.category]) state.RATE_CARD[r.category].push(item);
      });
    }

    updateSidebarUser();
    return true;
  } catch (err) { return _loadFailed('your profile', err); }
}

async function sbFetchDeals() {
  try {
    const dealsRes = await _own('deals').order('sort_order');
    // Deals (history is not loaded: no view reads it)
    if (dealsRes.error) { console.error('deals fetch error:', dealsRes.error); state.DEALS = []; return true; }
    state.DEALS = dealsRes.data.map(d => ({
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
      negotiationHistory: []
    }));
    return true;
  } catch (err) { return _loadFailed('deals', err); }
}

async function sbFetchCampaignResults() {
  try {
    const crRes = await _own('campaign_results');
    if (crRes.error) { console.error('campaign_results fetch error:', crRes.error); state.CAMPAIGN_RESULTS = []; return true; }
    state.CAMPAIGN_RESULTS = crRes.data.map(c => ({
      _sbId: c.id, brand: c.brand || '', views: c.views || 0,
      ctr: c.ctr || null, conversion: c.conversion || null, revenue: c.revenue || 0
    }));
    return true;
  } catch (err) { return _loadFailed('campaign results', err); }
}

async function sbFetchCalendarEvents() {
  try {
    const ceRes = await _own('calendar_events').order('date');
    if (ceRes.error) { console.error('calendar_events fetch error:', ceRes.error); state.CALENDAR_EVENTS = []; return true; }
    state.CALENDAR_EVENTS = ceRes.data.map(e => ({
      _sbId: e.id, date: e.date || '', brand: e.brand || '',
      type: e.type || '', platform: e.platform || '', status: e.status || 'draft'
    }));
    return true;
  } catch (err) { return _loadFailed('calendar', err); }
}

async function sbFetchMonthlyRevenue() {
  try {
    const mrRes = await _own('monthly_revenue').order('year').order('created_at');
    if (mrRes.error) { console.error('monthly_revenue fetch error:', mrRes.error); state.MONTHLY_REVENUE = []; return true; }
    state.MONTHLY_REVENUE = mrRes.data.map(r => ({
      _sbId: r.id, month: r.month + ' ' + r.year, earned: r.amount || 0
    }));
    return true;
  } catch (err) { return _loadFailed('revenue', err); }
}

async function sbFetchAudienceData() {
  try {
    const adRes = await _own('audience_data');
    if (adRes.error) { console.error('audience_data fetch error:', adRes.error); return true; }
    adRes.data.forEach(row => {
      if (row.category === 'age') {
        const ageData = row.data || {};
        const entries = Object.entries(ageData).sort((a, b) => b[1] - a[1]);
        state.AUDIENCE_DATA.topAge = entries.length > 0 ? entries[0][0] + ' (' + entries[0][1] + '%)' : '';
        state.AUDIENCE_DATA.ageRange = entries.length >= 2 ? entries[0][0].split('-')[0] + '-' + entries[1][0].split('-')[1] : '';
      }
      if (row.category === 'gender') {
        const g = row.data || {};
        state.AUDIENCE_DATA.gender = { male: g.Male || 0, female: g.Female || 0 };
      }
      if (row.category === 'topCountries') {
        const c = row.data || {};
        state.AUDIENCE_DATA.topCountries = Object.entries(c).map(([name, pct]) => ({ name, pct })).sort((a, b) => b.pct - a.pct);
      }
      if (row.category === 'topCities') {
        state.AUDIENCE_DATA.topCities = row.data || {};
      }
    });
    // Interests live on the profile (mk_interests, migration 013)
    if (!state.AUDIENCE_DATA.interests || state.AUDIENCE_DATA.interests.length === 0) {
      state.AUDIENCE_DATA.interests = state.CREATOR.mkInterests || [];
    }
    return true;
  } catch (err) { return _loadFailed('audience data', err); }
}

async function sbFetchInboxItems() {
  try {
    const ibRes = await state._sb.from('inbox_items').select('id, brand, from_name, from_email, subject, date, time, preview, status, suggested_action').eq('user_id', state.CREATOR._sbId).order('created_at', { ascending: false });
    if (ibRes.error) { console.error('inbox_items fetch error:', ibRes.error); state.INBOX_ITEMS = []; return true; }
    state.INBOX_ITEMS = ibRes.data.map((item, idx) => ({
      _sbId: item.id, id: idx + 1, brand: item.brand || '', contact: item.from_name || '',
      email: item.from_email || '', subject: item.subject || '', time: (item.date || '') + (item.time ? ', ' + item.time : ''),
      snippet: item.preview || '', status: item.status === 'new' ? 'needs_reply' : (item.status || 'read'),
      priority: 'medium', suggestedAction: item.suggested_action || 'reply',
      context: item.preview || ''
    }));
    return true;
  } catch (err) { return _loadFailed('inbox', err); }
}

// Tasks — table added in migration 010; tolerate a missing table so the
// Tasks view can show setup instructions instead of erroring
async function sbFetchTasks() {
  try {
    const tkRes = await _own('tasks').order('created_at', { ascending: false });
    if (tkRes.error) {
      state._tasksTableMissing = _missingTable(tkRes.error);
      if (!state._tasksTableMissing) console.error('tasks fetch error:', tkRes.error);
      state.TASKS = [];
    } else {
      state._tasksTableMissing = false;
      state.TASKS = (tkRes.data || []).map(t => ({
        _sbId: t.id, title: t.title || '', details: t.details || '',
        dueDate: t.due_date || '', starred: !!t.starred, completed: !!t.completed,
        completedAt: t.completed_at || '', createdAt: t.created_at || ''
      }));
    }

    return true;
  } catch (err) { return _loadFailed('tasks', err); }
}

// Clients — table added in migration 011
async function sbFetchClients() {
  try {
    const clRes = await _own('clients').order('name');
    if (clRes.error) {
      state._invoicingMigrationMissing = _missingTable(clRes.error);
      if (!state._invoicingMigrationMissing) console.error('clients fetch error:', clRes.error);
      state.CLIENTS = [];
    } else {
      state._invoicingMigrationMissing = false;
      state.CLIENTS = (clRes.data || []).map(c => ({
        _sbId: c.id, name: c.name || '', company: c.company || '', email: c.email || '',
        billingAddress: c.billing_address || '', invoicePrefix: c.invoice_prefix || ''
      }));
    }

    return true;
  } catch (err) { return _loadFailed('clients', err); }
}

// Outreach lists + targets — tables added in migration 012
async function sbFetchOutreach() {
  try {
    const orlRes = await _own('outreach_lists').order('sort_order');
    if (orlRes.error) {
      state._outreachMigrationMissing = _missingTable(orlRes.error);
      if (!state._outreachMigrationMissing) console.error('outreach_lists fetch error:', orlRes.error);
      state.OUTREACH_LISTS = [];
    } else {
      state._outreachMigrationMissing = false;
      state.OUTREACH_LISTS = (orlRes.data || []).map(l => ({
        _sbId: l.id, name: l.name || '', sortOrder: l.sort_order || 0
      }));
    }
    if (!state._outreachMigrationMissing) {
      const ortRes = await _own('outreach_targets').order('name');
      if (ortRes.error) {
        state._outreachMigrationMissing = _missingTable(ortRes.error);
        if (!state._outreachMigrationMissing) console.error('outreach_targets fetch error:', ortRes.error);
        state.OUTREACH_TARGETS = [];
      } else {
        state.OUTREACH_TARGETS = (ortRes.data || []).map(_mapOutreachRow);
      }
    } else {
      state.OUTREACH_TARGETS = [];
    }

    return true;
  } catch (err) { return _loadFailed('outreach', err); }
}

// Invoices (table exists since 001; 011 columns default in the mapper)
async function sbFetchInvoices() {
  try {
    const invRes = await _own('invoices').order('date', { ascending: false });
    if (invRes.error) { console.error('invoices fetch error:', invRes.error); state.INVOICE_DATA = []; return true; }
    state.INVOICE_DATA = (invRes.data || []).map(_mapInvoiceRow);
    return true;
  } catch (err) { return _loadFailed('invoices', err); }
}

/* ---- SUPABASE CRUD: TASKS ---- */
async function sbAddTask(data) {
  if (!state._sb || !state.CREATOR._sbId) return null;
  // user_id is stamped by the DB default (current_profile_id) per the
  // multi-tenancy rules — inserts must not pass it manually
  const { data: row, error } = await state._sb.from('tasks').insert({
    title: data.title, details: data.details || '', due_date: data.dueDate || null
  }).select().single();
  if (error) { _showSaveError('Failed to add task'); console.error(error); return null; }
  _showSaveSuccess();
  return row;
}

async function sbUpdateTask(sbId, updates) {
  if (!state._sb || !sbId) return false;
  const { error } = await state._sb.from('tasks').update(updates).eq('id', sbId);
  if (error) { _showSaveError('Failed to update task'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbDeleteTasks(sbIds) {
  if (!state._sb || !sbIds.length) return false;
  const { error } = await state._sb.from('tasks').delete().in('id', sbIds);
  if (error) { _showSaveError('Failed to delete'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

/* ---- SUPABASE CRUD: INVOICES ---- */
// user_id is stamped by the DB default (current_profile_id) per the
// multi-tenancy rules — inserts must not pass it manually
async function sbAddInvoice(payload) {
  if (!state._sb || !state.CREATOR._sbId) return null;
  const { data: row, error } = await state._sb.from('invoices').insert(payload).select().single();
  if (error) { _showSaveError('Failed to add invoice'); console.error(error); return null; }
  _showSaveSuccess();
  return row;
}

async function sbUpdateInvoice(sbId, updates) {
  if (!state._sb || !sbId) return false;
  const { error } = await state._sb.from('invoices').update(updates).eq('id', sbId);
  if (error) { _showSaveError('Failed to update invoice'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbDeleteInvoice(sbId) {
  if (!state._sb || !sbId) return false;
  const { error } = await state._sb.from('invoices').delete().eq('id', sbId);
  if (error) { _showSaveError('Failed to delete invoice'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

/* ---- SUPABASE CRUD: CLIENTS ---- */
async function sbAddClient(data) {
  if (!state._sb || !state.CREATOR._sbId) return null;
  const { data: row, error } = await state._sb.from('clients').insert({
    name: data.name, company: data.company || '', email: data.email || '',
    billing_address: data.billingAddress || '', invoice_prefix: data.invoicePrefix || ''
  }).select().single();
  if (error) { _showSaveError('Failed to add client'); console.error(error); return null; }
  _showSaveSuccess();
  return row;
}

async function sbUpdateClient(sbId, updates) {
  if (!state._sb || !sbId) return false;
  const { error } = await state._sb.from('clients').update(updates).eq('id', sbId);
  if (error) { _showSaveError('Failed to update client'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbDeleteClient(sbId) {
  if (!state._sb || !sbId) return false;
  const { error } = await state._sb.from('clients').delete().eq('id', sbId);
  if (error) { _showSaveError('Failed to delete client'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

/* ---- SUPABASE CRUD: OUTREACH ---- */
// user_id is stamped by the DB default (current_profile_id) per the
// multi-tenancy rules — inserts must not pass it manually
async function sbAddOutreachTarget(payload) {
  if (!state._sb || !state.CREATOR._sbId) return null;
  const { data: row, error } = await state._sb.from('outreach_targets').insert(payload).select().single();
  if (error) { _showSaveError('Failed to add target'); console.error(error); return null; }
  _showSaveSuccess();
  return row;
}

async function sbUpdateOutreachTarget(sbId, updates) {
  if (!state._sb || !sbId) return false;
  const { error } = await state._sb.from('outreach_targets').update(updates).eq('id', sbId);
  if (error) { _showSaveError('Failed to update target'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbDeleteOutreachTarget(sbId) {
  if (!state._sb || !sbId) return false;
  const { error } = await state._sb.from('outreach_targets').delete().eq('id', sbId);
  if (error) { _showSaveError('Failed to delete target'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbAddOutreachList(name, sortOrder) {
  if (!state._sb || !state.CREATOR._sbId) return null;
  const { data: row, error } = await state._sb.from('outreach_lists').insert({
    name: name, sort_order: sortOrder || 0
  }).select().single();
  if (error) { _showSaveError('Failed to add list'); console.error(error); return null; }
  _showSaveSuccess();
  return row;
}

async function sbUpdateOutreachList(sbId, updates) {
  if (!state._sb || !sbId) return false;
  const { error } = await state._sb.from('outreach_lists').update(updates).eq('id', sbId);
  if (error) { _showSaveError('Failed to update list'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbDeleteOutreachList(sbId) {
  if (!state._sb || !sbId) return false;
  const { error } = await state._sb.from('outreach_lists').delete().eq('id', sbId);
  if (error) { _showSaveError('Failed to delete list'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

/* ---- SUPABASE CRUD: PROFILE ---- */
async function sbUpdateProfile(updates) {
  if (!state._sb || !state.CREATOR._sbId) return false;
  const { error } = await state._sb.from('profiles').update(updates).eq('id', state.CREATOR._sbId);
  if (error) { _showSaveError('Failed to update profile'); return false; }
  _showSaveSuccess();
  return true;
}

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

/* Scene field saves route through here so shared-edit sessions work.
   fields may hold script_text / scene_description / thumbnail_data. */
async function sbSaveSceneFields(sceneId, fields, sharedToken) {
  if (!state._sb) return;
  if (sharedToken === undefined) sharedToken = state._sharedScriptToken;
  try {
    if (sharedToken) {
      var res = await state._sb.rpc('patch_shared_scene', {
        p_token: sharedToken, p_scene_id: sceneId,
        p_script_text: ('script_text' in fields) ? fields.script_text : null,
        p_scene_description: ('scene_description' in fields) ? fields.scene_description : null,
        p_thumbnail_data: ('thumbnail_data' in fields) ? fields.thumbnail_data : null
      });
      if (res.error) throw res.error;
    } else {
      var res2 = await state._sb.from('script_scenes').update(fields).eq('id', sceneId);
      if (res2.error) throw res2.error;
    }
  } catch (e) { console.error('scene save error:', e); throw e; }
}

/* ---- SUPABASE CRUD FOR SCRIPTS ---- */
async function sbFetchScripts() {
  if (!state._sb) return [];
  try {
    var res = await state._sb.from('scripts').select('*').order('updated_at', { ascending: false });
    if (res.error) { console.error('scripts fetch err:', res.error); return []; }
    state._scriptsCache = res.data || [];
    return state._scriptsCache;
  } catch (e) { console.error('scripts fetch exception:', e); return []; }
}

async function sbCreateScript(title) {
  if (!state._sb) return null;
  try {
    var res = await state._sb.from('scripts').insert({ title: title || 'Untitled Script' }).select().single();
    if (res.error) { console.error('script create err:', res.error); _showSaveError('Failed to create script'); return null; }
    /* Add one empty scene by default */
    var sc = await state._sb.from('script_scenes').insert({ script_id: res.data.id, sort_order: 0, script_text: '', scene_description: '', thumbnail_data: '' });
    if (sc.error) console.error('first scene err:', sc.error);
    return res.data;
  } catch (e) { console.error('script create exception:', e); return null; }
}

async function sbDeleteScript(scriptId) {
  if (!state._sb) return false;
  try {
    var res = await state._sb.from('scripts').delete().eq('id', scriptId);
    if (res.error) { console.error('script delete err:', res.error); _showSaveError('Failed to delete script'); return false; }
    return true;
  } catch (e) { console.error('script delete exception:', e); _showSaveError('Failed to delete script'); return false; }
}

async function sbUpdateScript(scriptId, updates, sharedToken) {
  if (!state._sb) return false;
  if (sharedToken === undefined) sharedToken = state._sharedScriptToken;
  try {
    var res;
    if (sharedToken) {
      // Shared editors may only rename; share_mode etc. stay owner-only
      if (!('title' in updates)) return true;
      res = await state._sb.rpc('update_shared_script_title', { p_token: sharedToken, p_title: updates.title });
    } else {
      res = await state._sb.from('scripts').update(updates).eq('id', scriptId);
    }
    if (res.error) { console.error('script update err:', res.error); return false; }
    return true;
  } catch (e) { console.error('script update exception:', e); return false; }
}

async function sbFetchScenes(scriptId) {
  if (!state._sb) return [];
  try {
    if (state._sharedScriptToken) {
      var shRes = await state._sb.rpc('get_shared_script_scenes', { p_token: state._sharedScriptToken });
      if (shRes.error) { console.error('shared scenes fetch err:', shRes.error); return []; }
      return shRes.data || [];
    }
    var res = await state._sb.from('script_scenes').select('*').eq('script_id', scriptId).order('sort_order', { ascending: true });
    if (res.error) { console.error('scenes fetch err:', res.error); return []; }
    return res.data || [];
  } catch (e) { console.error('scenes fetch exception:', e); return []; }
}

async function sbDeleteScene(sceneId) {
  if (!state._sb) return false;
  try {
    var res = state._sharedScriptToken
      ? await state._sb.rpc('delete_shared_scene', { p_token: state._sharedScriptToken, p_scene_id: sceneId })
      : await state._sb.from('script_scenes').delete().eq('id', sceneId);
    if (res.error) { console.error('scene delete err:', res.error); _showSaveError('Failed to delete scene'); return false; }
    return true;
  } catch (e) { console.error('scene delete exception:', e); _showSaveError('Failed to delete scene'); return false; }
}

async function sbReorderScenes(scenes) {
  if (!state._sb || !scenes.length) return;
  try {
    var res;
    if (state._sharedScriptToken) {
      res = await state._sb.rpc('reorder_shared_scenes', {
        p_token: state._sharedScriptToken,
        p_scene_ids: scenes.map(function(s) { return s.id; })
      });
    } else {
      var updates = scenes.map(function(s, i) { return { id: s.id, script_id: s.script_id, sort_order: i }; });
      res = await state._sb.from('script_scenes').upsert(updates);
    }
    if (res.error) { console.error('reorder err:', res.error); _showSaveError('Failed to reorder scenes'); }
  } catch (e) { console.error('reorder exception:', e); _showSaveError('Failed to reorder scenes'); }
}

async function sbFetchScriptByToken(token) {
  if (!state._sb || !token) return null;
  // Strip any query string that may have leaked in from URL parsing
  var cleanToken = String(token).split('?')[0].split('&')[0].trim();
  if (!cleanToken) return null;
  try {
    // Token-gated RPC (018): works for logged-out visitors, where the
    // old direct table read came back empty under user-scoped RLS
    var res = await state._sb.rpc('get_shared_script', { p_token: cleanToken });
    if (res.error) { console.error('sbFetchScriptByToken error:', res.error); return null; }
    return (res.data && res.data[0]) || null;
  } catch (e) { console.error('sbFetchScriptByToken exception:', e); return null; }
}

/* ---- SUPABASE CRUD ---- */

async function sbFetchBoards() {
  if (!state._sb) return [];
  const res = await state._sb.from('boards').select('*').order('updated_at', { ascending: false });
  if (res.error) { _showSaveError('Failed to load boards'); console.error(res.error); return []; }
  return res.data || [];
}

async function sbCreateBoard(title) {
  if (!state._sb) return null;
  const res = await state._sb.from('boards').insert({ title: title || 'Untitled Board' }).select().single();
  if (res.error) { _showSaveError('Failed to create board'); console.error(res.error); return null; }
  return res.data;
}

async function sbUpdateBoard(boardId, updates, silent) {
  if (!state._sb || state._bdSharedToken) return false; // board row (title/viewport/share) is owner-only
  const { error } = await state._sb.from('boards').update(updates).eq('id', boardId);
  if (error) { _showSaveError('Failed to save board'); console.error(error); return false; }
  if (!silent) _showSaveSuccess();
  return true;
}

async function sbDeleteBoard(boardId) {
  if (!state._sb) return false;
  // Best-effort storage cleanup first (items cascade with the row)
  try {
    const folder = state.CREATOR._sbId + '/' + boardId;
    const listing = await state._sb.storage.from('board-media').list(folder, { limit: 1000 });
    if (listing.data && listing.data.length) {
      await state._sb.storage.from('board-media').remove(listing.data.map(f => folder + '/' + f.name));
    }
  } catch (e) { console.warn('Board media cleanup failed', e); }
  const { error } = await state._sb.from('boards').delete().eq('id', boardId);
  if (error) { _showSaveError('Failed to delete board'); console.error(error); return false; }
  _showSaveSuccess();
  return true;
}

async function sbFetchBoardItems(boardId) {
  if (!state._sb) return [];
  const res = await state._sb.from('board_items').select('*').eq('board_id', boardId);
  if (res.error) { _showSaveError('Failed to load board'); console.error(res.error); return []; }
  return res.data || [];
}

async function sbAddBoardItem(item) {
  if (!state._sb) return null;
  if (state._bdSharedToken) {
    const res = await state._sb.rpc('add_shared_board_item', {
      p_token: state._bdSharedToken, p_kind: item.kind,
      p_x: item.x, p_y: item.y, p_w: item.w, p_h: item.h,
      p_z: item.z, p_content: item.content, p_id: item.id || null
    });
    if (res.error) { _showSaveError('Failed to add to board'); console.error(res.error); return null; }
    return (res.data && res.data[0]) || null;
  }
  // user_id is stamped by the DB default (current_profile_id) per the
  // multi-tenancy rules — never pass it manually.
  const res = await state._sb.from('board_items').insert(item).select().single();
  if (res.error) { _showSaveError('Failed to add to board'); console.error(res.error); return null; }
  return res.data;
}

async function sbUpdateBoardItem(itemId, updates) {
  if (!state._sb) return false;
  if (state._bdSharedToken) {
    const res = await state._sb.rpc('update_shared_board_item', {
      p_token: state._bdSharedToken, p_item_id: itemId,
      p_x: ('x' in updates) ? updates.x : null, p_y: ('y' in updates) ? updates.y : null,
      p_w: ('w' in updates) ? updates.w : null, p_h: ('h' in updates) ? updates.h : null,
      p_z: ('z' in updates) ? updates.z : null,
      p_content: ('content' in updates) ? updates.content : null
    });
    if (res.error) { _showSaveError('Failed to save changes'); console.error(res.error); return false; }
    return true;
  }
  const { error } = await state._sb.from('board_items').update(updates).eq('id', itemId);
  if (error) { _showSaveError('Failed to save changes'); console.error(error); return false; }
  return true;
}

async function sbDeleteBoardItem(itemId) {
  if (!state._sb) return false;
  if (state._bdSharedToken) {
    const res = await state._sb.rpc('delete_shared_board_item', { p_token: state._bdSharedToken, p_item_id: itemId });
    if (res.error) { _showSaveError('Failed to delete'); console.error(res.error); return false; }
    return true;
  }
  const { error } = await state._sb.from('board_items').delete().eq('id', itemId);
  if (error) { _showSaveError('Failed to delete'); console.error(error); return false; }
  return true;
}

/* ---- THE I/O OBJECT ---- All Supabase reads and writes are called as db.sbX(...). */
export const db = {
  sbAddBoardItem,
  sbAddClient,
  sbAddInvoice,
  sbAddOutreachList,
  sbAddOutreachTarget,
  sbAddTask,
  sbCreateBoard,
  sbCreateScript,
  sbDeleteBoard,
  sbDeleteBoardItem,
  sbDeleteClient,
  sbDeleteInvoice,
  sbDeleteOutreachList,
  sbDeleteOutreachTarget,
  sbDeleteScene,
  sbDeleteScript,
  sbDeleteTasks,
  sbFetchAudienceData,
  sbFetchCalendarEvents,
  sbFetchCampaignResults,
  sbFetchClients,
  sbFetchDeals,
  sbFetchInboxItems,
  sbFetchInvoices,
  sbFetchMonthlyRevenue,
  sbFetchOutreach,
  sbFetchProfile,
  sbFetchTasks,
  sbFetchBoardItems,
  sbFetchBoards,
  sbFetchScenes,
  sbFetchScriptByToken,
  sbFetchScripts,
  sbReorderScenes,
  sbSaveSceneFields,
  sbUpdateBoard,
  sbUpdateBoardItem,
  sbUpdateClient,
  sbUpdateInvoice,
  sbUpdateOutreachList,
  sbUpdateOutreachTarget,
  sbUpdateProfile,
  sbUpdateScript,
  sbUpdateTask,
};

/* ---- SIDE EFFECTS ---- Registered from main.js in a fixed order, not at import time. */
export function __init() {
  try {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
      state._sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    } else {
      console.error('Supabase library not loaded. typeof supabase:', typeof supabase);
    }
  } catch (initErr) {
    console.error('Supabase client init error:', initErr);
    state._sb = null;
  }
}

export { SUPABASE_ANON_KEY, SUPABASE_URL, _mapInvoiceRow, _mapOutreachRow, sbAddBoardItem, sbAddClient, sbAddInvoice, sbAddOutreachList, sbAddOutreachTarget, sbAddTask, sbCreateBoard, sbCreateScript, sbDeleteBoard, sbDeleteBoardItem, sbDeleteClient, sbDeleteInvoice, sbDeleteOutreachList, sbDeleteOutreachTarget, sbDeleteScene, sbDeleteScript, sbDeleteTasks, sbFetchBoardItems, sbFetchBoards, sbFetchScenes, sbFetchScriptByToken, sbFetchScripts, sbReorderScenes, sbSaveSceneFields, sbUpdateBoard, sbUpdateBoardItem, sbUpdateClient, sbUpdateInvoice, sbUpdateOutreachList, sbUpdateOutreachTarget, sbUpdateProfile, sbUpdateScript, sbUpdateTask };
