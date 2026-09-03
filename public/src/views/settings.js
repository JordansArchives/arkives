// Arkives — Settings view (profile, platforms, rate card, contract defaults, audience, account).
import { state } from '../state.js';
import { _args, act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { _showSaveError, _showSaveSuccess } from '../lib/toast.js';
import { updateSidebarUser } from './auth.js';
import { renderInvoicingSettings } from './invoices.js';


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
      <button class="settings-tab active" data-tab="profile" data-action="switchSettingsTab" data-args="[&quot;profile&quot;]">Profile</button>
      <button class="settings-tab" data-tab="platforms" data-action="switchSettingsTab" data-args="[&quot;platforms&quot;]">Platforms</button>
      <button class="settings-tab" data-tab="ratecard" data-action="switchSettingsTab" data-args="[&quot;ratecard&quot;]">Rate Card</button>
      <button class="settings-tab" data-tab="contract" data-action="switchSettingsTab" data-args="[&quot;contract&quot;]">Contract Defaults</button>
      <button class="settings-tab" data-tab="invoicing" data-action="switchSettingsTab" data-args="[&quot;invoicing&quot;]">Invoicing</button>
      <button class="settings-tab" data-tab="audience" data-action="switchSettingsTab" data-args="[&quot;audience&quot;]">Audience</button>
      <button class="settings-tab" data-tab="danger" data-action="switchSettingsTab" data-args="[&quot;danger&quot;]">Account</button>
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
  const c = state.CREATOR || {};
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
        <button class="btn btn-primary" data-action="saveProfile">Save Profile</button>
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
  if (!state._sb || !state.CREATOR?._sbId) { _showSaveError('Not connected'); return; }
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
  const { error } = await state._sb.from('profiles').update(updates).eq('id', state.CREATOR._sbId);
  if (error) { _showSaveError('Failed: ' + error.message); return; }
  Object.assign(state.CREATOR, {
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
  const platformsObj = (state.CREATOR && state.CREATOR.platforms) || {};
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
        <button class="btn btn-primary" data-action="savePlatforms">Save Platforms</button>
      </div>
    </div>
  `;
}

async function savePlatforms() {
  if (!state._sb || !state.CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  const keys = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'];
  let errors = 0;
  for (const key of keys) {
    const handle = document.getElementById(`setPlat_${key}_handle`)?.value.trim() || '';
    const followers = parseInt(document.getElementById(`setPlat_${key}_followers`)?.value) || 0;
    const p = state.CREATOR.platforms[key];
    if (!p) continue;

    const updates = { handle, followers, followers_display: _formatFollowers(followers) };
    if (p._sbId) {
      const { error } = await state._sb.from('platforms').update(updates).eq('id', p._sbId);
      if (error) { errors++; continue; }
    } else {
      const { data, error } = await state._sb.from('platforms').insert({
        user_id: state.CREATOR._sbId, platform: key, ...updates
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
  const rc = state.RATE_CARD || {};
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
        <button class="btn-icon btn-danger" data-action="deleteRateRow" data-args="${_args(key, idx)}" title="Delete">×</button>
      </div>
    `).join('');
    return `
      <div class="rate-category">
        <div class="rate-cat-header">
          <h4>${label}</h4>
          <button class="btn btn-secondary btn-sm" data-action="addRateRow" data-args="${_args(key)}">+ Add</button>
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
        <button class="btn btn-primary" data-action="saveRateCard">Save All Rates</button>
      </div>
    </div>
  `;
}

function addRateRow(key) {
  state.RATE_CARD[key] = state.RATE_CARD[key] || [];
  state.RATE_CARD[key].push({ name: '', rate: 0, _new: true });
  renderSettings();
  switchSettingsTab('ratecard');
}

async function deleteRateRow(key, idx) {
  const item = state.RATE_CARD[key]?.[idx];
  if (!item) return;
  if (item._sbId && state._sb) {
    const { error } = await state._sb.from('rate_cards').delete().eq('id', item._sbId);
    if (error) { _showSaveError('Failed to delete rate'); console.error(error); return; }
  }
  state.RATE_CARD[key].splice(idx, 1);
  renderSettings();
  switchSettingsTab('ratecard');
}

async function saveRateCard() {
  if (!state._sb || !state.CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  // Save minimum rate + pricing rule to rate_card_settings
  const minRate = parseInt(document.getElementById('setRateMin').value) || 0;
  const pricingRule = document.getElementById('setRatePricingRule').value.trim();

  const settingsRes = await state._sb.from('rate_card_settings').select('id').eq('user_id', state.CREATOR._sbId).maybeSingle();
  const sRes = settingsRes.data
    ? await state._sb.from('rate_card_settings').update({ minimum_rate: minRate, pricing_rule: pricingRule }).eq('id', settingsRes.data.id)
    : await state._sb.from('rate_card_settings').insert({ user_id: state.CREATOR._sbId, minimum_rate: minRate, pricing_rule: pricingRule });
  if (sRes.error) { _showSaveError('Failed to save rate settings'); console.error(sRes.error); return; }
  state.RATE_CARD.minimumRate = minRate;
  state.RATE_CARD.pricingRule = pricingRule;

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
      const { error } = await state._sb.from('rate_cards').update({ name, rate }).eq('id', sbId);
      if (error) errors++;
      else if (state.RATE_CARD[key]?.[idx]) { state.RATE_CARD[key][idx].name = name; state.RATE_CARD[key][idx].rate = rate; }
    } else {
      const { data, error } = await state._sb.from('rate_cards').insert({
        user_id: state.CREATOR._sbId, category: key, item_id: 'custom_' + Date.now(),
        name, rate, sort_order: idx
      }).select().single();
      if (error) errors++;
      else if (data && state.RATE_CARD[key]?.[idx]) {
        state.RATE_CARD[key][idx]._sbId = data.id;
        state.RATE_CARD[key][idx].name = name;
        state.RATE_CARD[key][idx].rate = rate;
        delete state.RATE_CARD[key][idx]._new;
      }
    }
  }
  if (errors > 0) _showSaveError(`${errors} rate(s) failed`);
  else _showSaveSuccess();
}

/* ---- SETTINGS: Contract Defaults tab ---- */
function renderContractSettingsPanel() {
  // CONTRACT_DEFAULTS is defined in toolkit-views.js
  const cd = (typeof state.CONTRACT_DEFAULTS !== 'undefined') ? state.CONTRACT_DEFAULTS : {
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
        <button class="btn btn-primary" data-action="saveContractDefaults">Save Contract Defaults</button>
      </div>
    </div>
  `;
}

/* ---- SETTINGS: Audience tab ---- */
function renderAudienceSettings() {
  const a = state.AUDIENCE_DATA || {};
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
        <button class="btn btn-primary" data-action="saveAudience">Save Audience</button>
      </div>
    </div>
  `;
}

async function saveAudience() {
  if (!state._sb || !state.CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  const ageRange = document.getElementById('setAudAgeRange').value.trim();
  const topAge = document.getElementById('setAudTopAge').value.trim();
  const male = parseInt(document.getElementById('setAudMale').value) || 0;
  const female = parseInt(document.getElementById('setAudFemale').value) || 0;

  state.AUDIENCE_DATA.ageRange = ageRange;
  state.AUDIENCE_DATA.topAge = topAge;
  state.AUDIENCE_DATA.gender = { male, female };

  // Upsert into audience_data rows keyed by category
  const res = await state._sb.from('audience_data').upsert({
    user_id: state.CREATOR._sbId, category: 'gender', data: { Male: male, Female: female }
  }, { onConflict: 'user_id,category' });
  if (res.error) { _showSaveError('Failed: ' + res.error.message); console.error(res.error); return; }
  _showSaveSuccess();
}

/* ---- SETTINGS: Danger Zone / Account tab ---- */
function renderDangerZone() {
  return `
    <div class="settings-card">
      <h3>Account</h3>
      <p class="settings-help">Signed in as <strong>${_esc(state._authUser?.email || '—')}</strong></p>
      <div class="settings-actions">
        <button class="btn btn-secondary" data-action="exportAllData">Export All Data (JSON)</button>
        <button class="btn btn-danger" data-action="handleLogout">Sign Out</button>
      </div>
    </div>
  `;
}

async function exportAllData() {
  const dump = {
    exportedAt: new Date().toISOString(),
    profile: state.CREATOR,
    rateCard: state.RATE_CARD,
    deals: state.DEALS,
    invoices: state.INVOICE_DATA,
    audience: state.AUDIENCE_DATA,
    campaigns: state.CAMPAIGN_RESULTS,
    inbox: state.INBOX_ITEMS,
    calendarEvents: state.CALENDAR_EVENTS,
    monthlyRevenue: state.MONTHLY_REVENUE,
    outreachTemplates: state.OUTREACH_TEMPLATES,
    contractDefaults: (typeof state.CONTRACT_DEFAULTS !== 'undefined') ? state.CONTRACT_DEFAULTS : {},
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

act({ addRateRow, deleteRateRow, exportAllData, saveAudience, savePlatforms, saveProfile, saveRateCard, switchSettingsTab });

export { _formatFollowers, _mkLines, addRateRow, deleteRateRow, exportAllData, renderAudienceSettings, renderContractSettingsPanel, renderDangerZone, renderPlatformsSettings, renderProfileSettings, renderRateCardSettings, renderSettings, saveAudience, savePlatforms, saveProfile, saveRateCard, switchSettingsTab };
