// Arkives — Contracts: contract builder and defaults.
import { state } from '../state.js';
import { clients } from '../stores/invoices.js';
import { act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { showToast } from '../lib/toast.js';


/* Load contract defaults from Supabase on init */
async function loadContractDefaults() {
  if (typeof state._sb === 'undefined' || !state._sb || typeof state.CREATOR === 'undefined' || !state.CREATOR._sbId) return;
  try {
    var res = await state._sb.from('user_settings').select('*').eq('user_id', state.CREATOR._sbId).eq('key', 'contract_defaults').maybeSingle();
    if (res.data && res.data.value) {
      try {
        var saved = JSON.parse(res.data.value);
        Object.assign(state.CONTRACT_DEFAULTS, saved);
      } catch(e) { /* ignore parse errors */ }
    }
  } catch(e) { console.warn('loadContractDefaults:', e); }
}

async function saveContractDefaults() {
  if (typeof state._sb === 'undefined' || !state._sb || typeof state.CREATOR === 'undefined' || !state.CREATOR._sbId) return;
  // Read values from the settings form
  var fields = {
    creatorEntity: 'cdEntity', creatorDBA: 'cdDBA', creatorTitle: 'cdTitle',
    creatorState: 'cdState', contentExclusions: 'cdExclusions',
    invoiceMethod: 'cdInvoiceMethod', paymentMethod: 'cdPaymentMethod',
    approvalConsequence: 'cdApprovalConsequence'
  };
  var numFields = {
    revisionExtraCost: 'cdRevCost', paidMediaFloor: 'cdPaidFloor', dayRate: 'cdDayRate',
    crossPostFee: 'cdCrossPost', nonDisparagement: 'cdNonDisp',
    mediationDays: 'cdMedDays', forceMajeureDays: 'cdFMDays'
  };
  for (var k in fields) {
    var el = document.getElementById(fields[k]);
    if (el) state.CONTRACT_DEFAULTS[k] = el.value.trim();
  }
  for (var k2 in numFields) {
    var el2 = document.getElementById(numFields[k2]);
    if (el2) state.CONTRACT_DEFAULTS[k2] = Number(el2.value) || 0;
  }
  try {
    var res = await state._sb.from('user_settings').upsert({
      user_id: state.CREATOR._sbId, key: 'contract_defaults',
      value: JSON.stringify(state.CONTRACT_DEFAULTS)
    }, { onConflict: 'user_id,key' });
    if (res.error) throw res.error;
    showToast('Contract defaults saved');
  } catch(e) {
    console.error('saveContractDefaults:', e);
    showToast('Failed to save defaults');
  }
}

function toggleContractDefaults() {
  var panel = document.getElementById('contractDefaultsPanel');
  var arrow = document.getElementById('contractDefaultsArrow');
  if (!panel) return;
  var isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

function renderContracts() {
  const container = document.getElementById("view-contracts");
  const today = new Date().toISOString().split('T')[0];

  // Load defaults from Supabase (async, will be ready for next generate)
  loadContractDefaults();

  // Build deliverable options from RATE_CARD if available
  const deliverableOptions = (() => {
    const items = [];
    if (typeof state.RATE_CARD !== 'undefined') {
      ['organic', 'ugc', 'tiktok', 'youtube'].forEach(cat => {
        if (state.RATE_CARD[cat]) state.RATE_CARD[cat].forEach(r => {
          if (r.name && !items.find(i => i.name === r.name)) items.push({ name: r.name, rate: r.rate || 0 });
        });
      });
    }
    if (!items.length) {
      return [
        { name: 'Instagram Reels', rate: 15000 }, { name: 'Instagram Static / Carousel', rate: 8000 },
        { name: 'Instagram Stories', rate: 5000 }, { name: 'UGC Video (30s)', rate: 3000 },
        { name: 'UGC Video (60s)', rate: 5000 }, { name: 'YouTube Integration', rate: 20000 },
        { name: 'YouTube Dedicated Video', rate: 35000 }, { name: 'TikTok Video', rate: 12000 }
      ];
    }
    return items;
  })();

  // Build deal options for pre-fill dropdown
  const dealOpts = (typeof state.DEALS !== 'undefined' && state.DEALS.length)
    ? state.DEALS.map((d, i) => `<option value="${i}">${_esc(d.brand || 'Untitled')} — ${_esc(d.campaign || d.scope || 'No campaign')}</option>`).join('')
    : '';
  // Client picker: the same clients the invoices use, plus an inline "new client"
  const clientOpts = [
    `<option value="">— Select a client —</option>`,
    ...(state.CLIENTS || []).map(c => `<option value="${c._sbId}"${state._contractClientId === c._sbId ? ' selected' : ''}>${_esc(c.name)}${c.company ? ' · ' + _esc(c.company) : ''}</option>`),
    `<option value="__new">+ New client…</option>`
  ].join('');

  const platformCheckboxes = ['Instagram', 'TikTok', 'YouTube', 'X (Twitter)', 'LinkedIn'].map(p =>
    `<label class="contract-checkbox"><input type="checkbox" value="${p}" class="cPlatformCheck"${p === 'Instagram' ? ' checked' : ''}> ${p}</label>`
  ).join('');

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Contract Builder</h1>
        <p class="view-subtitle">Generate professional partnership agreements from your template</p>
      </div>
    </div>

    <div class="contract-builder">
      <div class="contract-form">

        <!-- Contract Settings (collapsible, inside form column only) -->
        <div class="contract-defaults-toggle" data-action="toggleContractDefaults">
          <svg id="contractDefaultsArrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.2s;vertical-align:-1px;margin-right:6px;"><polyline points="6 9 12 15 18 9"/></svg>
          Contract Settings
        </div>
        <div id="contractDefaultsPanel" class="contract-defaults-panel" style="display:none;">
          <div class="form-row">
            <div class="form-group">
              <label>Creator Entity Name</label>
              <input type="text" id="cdEntity" value="${state.CONTRACT_DEFAULTS.creatorEntity}" placeholder="Asterisk LLC">
            </div>
            <div class="form-group">
              <label>Doing Business As (DBA)</label>
              <input type="text" id="cdDBA" value="${state.CONTRACT_DEFAULTS.creatorDBA}" placeholder="Asterisk LLC">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Signing Title</label>
              <input type="text" id="cdTitle" value="${state.CONTRACT_DEFAULTS.creatorTitle}" placeholder="Managing Member">
            </div>
            <div class="form-group">
              <label>Home State</label>
              <input type="text" id="cdState" value="${state.CONTRACT_DEFAULTS.creatorState}" placeholder="Colorado">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Extra Revision Cost ($)</label>
              <input type="number" id="cdRevCost" value="${state.CONTRACT_DEFAULTS.revisionExtraCost}">
            </div>
            <div class="form-group">
              <label>Paid Media Floor ($/mo)</label>
              <input type="number" id="cdPaidFloor" value="${state.CONTRACT_DEFAULTS.paidMediaFloor}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Day Rate ($) — production services</label>
              <input type="number" id="cdDayRate" value="${state.CONTRACT_DEFAULTS.dayRate}">
            </div>
            <div class="form-group"></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Cross-Post Fee (%)</label>
              <input type="number" id="cdCrossPost" value="${state.CONTRACT_DEFAULTS.crossPostFee}">
            </div>
            <div class="form-group">
              <label>Non-Disparagement (months)</label>
              <input type="number" id="cdNonDisp" value="${state.CONTRACT_DEFAULTS.nonDisparagement}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Mediation Period (days)</label>
              <input type="number" id="cdMedDays" value="${state.CONTRACT_DEFAULTS.mediationDays}">
            </div>
            <div class="form-group">
              <label>Force Majeure Termination (days)</label>
              <input type="number" id="cdFMDays" value="${state.CONTRACT_DEFAULTS.forceMajeureDays}">
            </div>
          </div>
          <div class="form-group">
            <label>Content Definition Exclusions</label>
            <input type="text" id="cdExclusions" value="${state.CONTRACT_DEFAULTS.contentExclusions}" placeholder="raw footage, outtakes, drafts...">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Invoice Method</label>
              <input type="text" id="cdInvoiceMethod" value="${state.CONTRACT_DEFAULTS.invoiceMethod}" placeholder="email">
            </div>
            <div class="form-group">
              <label>Payment Method</label>
              <input type="text" id="cdPaymentMethod" value="${state.CONTRACT_DEFAULTS.paymentMethod}" placeholder="wire transfer or ACH">
            </div>
          </div>
          <div class="form-group">
            <label>Approval Consequence (if client misses deadline)</label>
            <input type="text" id="cdApprovalConsequence" value="${state.CONTRACT_DEFAULTS.approvalConsequence}" placeholder="approval of the Content as delivered">
          </div>
          <button class="btn btn-secondary" data-action="saveContractDefaults" style="margin-top:8px;">Save Defaults</button>
        </div>

        <h3 class="contract-form-heading">Client</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Client</label>
            <select id="cClientSel" data-change="contractPickClient" data-change-args="[&quot;$value&quot;]">${clientOpts}</select>
          </div>
          ${dealOpts ? `
          <div class="form-group">
            <label>Or load a deal</label>
            <select id="cLoadDeal" data-change="prefillContractFromDeal">
              <option value="">— Select a deal to pre-fill —</option>
              ${dealOpts}
            </select>
          </div>` : '<div class="form-group"></div>'}
        </div>
        <div id="cNewClient" class="inv-client-form" style="display:none">
          <div class="form-row">
            <div class="form-group"><label>Contact Name</label><input type="text" id="cNcName" placeholder="Jane Smith"></div>
            <div class="form-group"><label>Company</label><input type="text" id="cNcCompany" placeholder="Acme Media LLC"></div>
          </div>
          <div class="form-group"><label>Email</label><input type="email" id="cNcEmail" placeholder="jane@acme.com"></div>
          <div class="form-group"><label>Billing Address</label><textarea id="cNcAddress" rows="3" placeholder="Street&#10;City, ST ZIP"></textarea></div>
          <div class="gap-row">
            <button class="btn btn-primary btn-sm" data-action="contractSaveNewClient">Save Client</button>
            <button class="btn btn-sm" data-action="contractCancelNewClient">Cancel</button>
          </div>
        </div>
        <hr class="contract-divider">

        <h3 class="contract-form-heading">Parties</h3>
        <div class="form-row">
          <div class="form-group">
            <label>Brand Legal Name</label>
            <input type="text" id="cBrandName" placeholder="e.g., Acme Inc.">
          </div>
          <div class="form-group">
            <label>Brand Short Name</label>
            <input type="text" id="cBrandShort" placeholder="e.g., Acme">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Contact Name</label>
            <input type="text" id="cContact" placeholder="e.g., Sarah Johnson">
          </div>
          <div class="form-group">
            <label>Contact Title</label>
            <input type="text" id="cContactTitle" placeholder="e.g., VP of Marketing">
          </div>
        </div>
        <div class="form-group">
          <label>Contact Email</label>
          <input type="email" id="cContactEmail" placeholder="e.g., sarah@acme.com">
        </div>
        <div class="form-group">
          <label>Brand Address (Street)</label>
          <input type="text" id="cBrandStreet" placeholder="e.g., 123 Market St, Suite 400">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>City</label>
            <input type="text" id="cBrandCity" placeholder="e.g., San Francisco">
          </div>
          <div class="form-group">
            <label>State</label>
            <input type="text" id="cBrandState" placeholder="e.g., CA">
          </div>
        </div>
        <div class="form-group" style="max-width:200px;">
          <label>Zip Code</label>
          <input type="text" id="cBrandZip" placeholder="e.g., 94105">
        </div>
        <div class="form-group">
          <label>Agreement Date</label>
          <input type="date" id="cDate" value="${today}">
        </div>

        <hr class="contract-divider">
        <h3 class="contract-form-heading">Deal</h3>
        <div class="form-group">
          <label>Agreement Type</label>
          <select id="cAgreementType" data-change="toggleAgreementType">
            <option value="partnership">Partnership — sponsored content on my channels</option>
            <option value="services">Production services — editing / day-rate work on the client's footage</option>
          </select>
        </div>
        <div class="form-group">
          <label>Campaign / Project Name</label>
          <input type="text" id="cCampaign" placeholder="e.g., AI Sustainability for Creatives">
        </div>
        <div class="form-group">
          <label>Description / Context</label>
          <textarea id="cContext" rows="3" placeholder="Describe the campaign goals, context, and any special terms…"></textarea>
        </div>

        <div id="dealServices" style="display:none">
          <div class="form-row">
            <div class="form-group">
              <label>What you're producing</label>
              <input type="text" id="cSvcWork" placeholder="e.g., hero video assets, each with a separate hook">
            </div>
            <div class="form-group" style="max-width:160px;">
              <label>Number of Assets</label>
              <input type="number" id="cSvcCount" value="3" min="1">
            </div>
          </div>
          <div class="form-group">
            <label>Deliverable Spec</label>
            <input type="text" id="cSvcSpec" placeholder="e.g., 9:16 and 1:1, up to 60s each, ProRes 422 + H.264, captions burned in">
          </div>
          <div class="form-group">
            <label>Client Provides</label>
            <input type="text" id="cSvcMaterials" value="all raw footage, brand assets, logos, fonts, licensed music, and the creative brief" placeholder="footage, brand assets, music…">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Day Rate ($)</label>
              <input type="number" id="cSvcDayRate" value="${state.CONTRACT_DEFAULTS.dayRate}" min="0">
            </div>
            <div class="form-group">
              <label>Estimated Days (low – high)</label>
              <div class="contract-range">
                <input type="number" id="cSvcDaysLow" value="6" min="1" step="0.5">
                <span>to</span>
                <input type="number" id="cSvcDaysHigh" value="7" min="1" step="0.5">
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Not-to-Exceed ($) <span class="contract-hint">optional</span></label>
              <input type="number" id="cSvcNte" placeholder="blank = billed on actual days" min="0">
            </div>
            <div class="form-group">
              <label>Deposit (%)</label>
              <input type="number" id="cSvcDeposit" value="50" min="0" max="100">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Balance Due</label>
              <select id="cSvcBalance">
                <option value="delivery">On delivery of final assets</option>
                <option value="NET15">NET 15 from delivery</option>
                <option value="NET30">NET 30 from delivery</option>
              </select>
            </div>
            <div class="form-group">
              <label>Target Delivery Date <span class="contract-hint">optional</span></label>
              <input type="date" id="cSvcDelivery">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Extra Revision Rate ($)</label>
              <input type="number" id="cSvcRevRate" value="750" min="0">
            </div>
            <div class="form-group">
              <label>Billed Per</label>
              <select id="cSvcRevUnit">
                <option value="day">Day of editing</option>
                <option value="round">Round</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Kill Fee (% of remaining estimate)</label>
              <input type="number" id="cSvcKill" value="25" min="0" max="100">
            </div>
            <div class="form-group">
              <label class="contract-checkbox" style="margin-top:26px"><input type="checkbox" id="cSvcPortfolio" checked> Portfolio rights (I can show the work)</label>
            </div>
          </div>
        </div>

        <div id="dealPartnership">
        <div class="form-row">
          <div class="form-group">
            <label>Deliverable Type</label>
            <select id="cDeliverable" data-change="contractDeliverableChanged">
              ${deliverableOptions.map(d => `<option value="${d.name}" data-rate="${d.rate}">${d.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Number of Deliverables</label>
            <input type="number" id="cNumDeliverables" value="1" min="1">
          </div>
        </div>
        <div class="form-group">
          <label>Platform(s)</label>
          <div class="contract-platform-checks">${platformCheckboxes}</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Compensation Model</label>
            <select id="cCompModel" data-change="togglePerfFields">
              <option value="flat">Flat Rate</option>
              <option value="performance">Performance-Based</option>
            </select>
          </div>
          <div class="form-group">
            <label>Base Amount ($)</label>
            <input type="number" id="cAmount" placeholder="15000" value="15000">
          </div>
        </div>
        <div class="form-group">
          <label>Payment Terms</label>
          <select id="cPayTerms">
            <option value="50/50">50% on brief approval, 50% on delivery</option>
            <option value="NET30">NET 30 from delivery</option>
            <option value="100UP">100% upfront before production begins</option>
            <option value="custom">Custom (specify in notes)</option>
          </select>
        </div>
        <div id="perfFields" style="display:none">
          <div class="form-row">
            <div class="form-group">
              <label>Performance Metric</label>
              <input type="text" id="cPerfMetric" placeholder="e.g., Instagram Reel Plays" value="Instagram Reel Plays">
            </div>
            <div class="form-group">
              <label>Bonus Rate ($/1K above threshold)</label>
              <input type="number" id="cPerfRate" placeholder="30" value="30">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Threshold</label>
              <input type="number" id="cPerfThreshold" placeholder="500000" value="500000">
            </div>
            <div class="form-group">
              <label>Cap per deliverable ($)</label>
              <input type="number" id="cPerfCap" placeholder="35000" value="35000">
            </div>
          </div>
        </div>
        </div>

        <hr class="contract-divider">
        <h3 class="contract-form-heading">Rights & Terms</h3>
        <div id="rightsPartnership">
        <div class="form-row">
          <div class="form-group">
            <label>Content License Duration</label>
            <select id="cLicense">
              <option value="30">30 days organic</option>
              <option value="90">90 days organic (+25%)</option>
              <option value="180">6 months organic (+50%)</option>
              <option value="perpetual">Perpetual (3x base)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Paid Ad Rights</label>
            <select id="cPaidAd">
              <option value="none">None — separate agreement required</option>
              <option value="included">Included in fee</option>
              <option value="separate">Separate agreement ($5K/mo floor)</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Exclusivity</label>
            <select id="cExcl">
              <option value="none">None</option>
              <option value="30">30 days (+20%)</option>
              <option value="60">60 days (+35%)</option>
              <option value="90">90 days (+50%)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Term / Duration</label>
            <input type="text" id="cTerm" placeholder="e.g., 3 months from first content publish">
          </div>
        </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Governing Law State</label>
            <input type="text" id="cGovLaw" value="Colorado">
          </div>
          <div class="form-group">
            <label>Revision Rounds</label>
            <input type="number" id="cRevisions" value="2" min="1">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Approval Timeline (hours)</label>
            <input type="number" id="cApprovalHrs" value="48" min="24" step="24">
          </div>
          <div class="form-group" data-partnership-only>
            <label>Kill Fee — Standard (%)</label>
            <input type="number" id="cKillStd" value="50" min="0" max="100">
          </div>
        </div>
        <div class="form-group" style="max-width:200px;" data-partnership-only>
          <label>Kill Fee — Breach (%)</label>
          <input type="number" id="cKillBreach" value="100" min="0" max="100">
        </div>

        <div class="contract-actions">
          <button class="btn btn-primary" data-action="generateContract">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Generate Contract
          </button>
        </div>
      </div>

      <div class="contract-preview">
        <div class="contract-preview-header">
          <h4>Contract Preview</h4>
          <div class="contract-preview-actions">
            <button class="btn btn-sm btn-secondary" data-action="copyContractPreview">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><rect x="9" y="9" width="13" height="13" rx="1"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
            <button class="btn btn-sm btn-primary" data-action="downloadContractPDF">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              PDF
            </button>
          </div>
        </div>
        <div id="contractPreviewContent" class="preview-content">
          <p class="text-muted" style="text-align:center;padding:40px 20px;">Fill in the form and click "Generate Contract" to preview your agreement</p>
        </div>
      </div>
    </div>


  `;
}

/* ---- CONTRACT: Client picker (the invoices' client list) ---- */
// "Street / City, ST ZIP" (lines or commas) -> the four address fields.
// Anything that does not parse lands in Street untouched.
function _splitAddress(text) {
  const lines = String(text || '').split(/\n|,\s*(?=[^\n]*$)/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) return { street: '', city: '', state: '', zip: '' };
  const last = lines[lines.length - 1];
  const m = last.match(/^(.+?)[,\s]+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/) || last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!m) return { street: lines.join(', '), city: '', state: '', zip: '' };
  const head = lines.slice(0, -1);
  if (m.length === 4) return { street: head.join(', '), city: m[1], state: m[2].toUpperCase(), zip: m[3] };
  // "ST ZIP" alone: the line before it is the city
  return { street: head.slice(0, -1).join(', '), city: head[head.length - 1] || '', state: m[1].toUpperCase(), zip: m[2] };
}

function _contractFillFromClient(c) {
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  const org = c.company || c.name;
  setVal('cBrandName', org);
  setVal('cBrandShort', org);
  setVal('cContact', c.name);
  setVal('cContactEmail', c.email);
  const a = _splitAddress(c.billingAddress);
  setVal('cBrandStreet', a.street); setVal('cBrandCity', a.city); setVal('cBrandState', a.state); setVal('cBrandZip', a.zip);
}

function contractPickClient(val) {
  const form = document.getElementById('cNewClient');
  if (val === '__new') { if (form) form.style.display = ''; return; }
  if (form) form.style.display = 'none';
  state._contractClientId = val || null;
  if (!val) return;
  const c = clients.find(val);
  if (c) _contractFillFromClient(c);
}

function contractCancelNewClient() {
  const form = document.getElementById('cNewClient');
  if (form) form.style.display = 'none';
  const sel = document.getElementById('cClientSel');
  if (sel) sel.value = state._contractClientId || '';
}

// Saving a client notifies the store, which repaints this view; the form
// is snapshotted around the save so nothing typed is lost.
async function contractSaveNewClient() {
  const name = (document.getElementById('cNcName')?.value || '').trim();
  if (!name) { showToast('Client needs a name'); return; }
  const data = {
    name,
    company: (document.getElementById('cNcCompany')?.value || '').trim(),
    email: (document.getElementById('cNcEmail')?.value || '').trim(),
    invoicePrefix: '',
    billingAddress: (document.getElementById('cNcAddress')?.value || '').trim()
  };
  const snap = _contractFormSnapshot();
  const client = await clients.add(data);
  if (!client) { showToast('Could not save client'); return; }
  state._contractClientId = client._sbId;
  if (!document.getElementById('cClientSel') || !document.getElementById('cClientSel').querySelector('option[value="' + client._sbId + '"]')) renderContracts();
  _contractFormRestore(snap);
  const sel = document.getElementById('cClientSel');
  if (sel) sel.value = client._sbId;
  _contractFillFromClient(client);
  showToast('Client saved: ' + name);
}

function _contractFormSnapshot() {
  const out = {};
  document.querySelectorAll('#view-contracts .contract-form input, #view-contracts .contract-form select, #view-contracts .contract-form textarea').forEach(el => {
    if (!el.id || /^cNc/.test(el.id)) return;
    out[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  out.__platforms = Array.from(document.querySelectorAll('.cPlatformCheck')).map(cb => cb.checked);
  return out;
}
function _contractFormRestore(snap) {
  Object.keys(snap).forEach(id => {
    if (id === '__platforms') return;
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!snap[id]; else el.value = snap[id];
  });
  document.querySelectorAll('.cPlatformCheck').forEach((cb, i) => { if (snap.__platforms && i < snap.__platforms.length) cb.checked = snap.__platforms[i]; });
  toggleAgreementType();
  togglePerfFields();
}

/* ---- CONTRACT: Pre-fill from Deal ---- */
function prefillContractFromDeal() {
  const sel = document.getElementById('cLoadDeal');
  const idx = parseInt(sel.value, 10);
  if (isNaN(idx) || !state.DEALS[idx]) return;
  const d = state.DEALS[idx];
  const setVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  setVal('cBrandName', d.brand);
  setVal('cBrandShort', d.brand);
  setVal('cContact', d.contact);
  setVal('cContactEmail', d.email);
  setVal('cCampaign', d.campaign || d.scope);
  setVal('cContext', d.notes);
  setVal('cTerm', d.term);
  if (d.value) setVal('cAmount', d.value);
  if (d.deliverables) {
    const delSel = document.getElementById('cDeliverable');
    for (let i = 0; i < delSel.options.length; i++) {
      if (d.deliverables.toLowerCase().includes(delSel.options[i].value.toLowerCase())) {
        delSel.selectedIndex = i; break;
      }
    }
  }
  showToast('Deal loaded: ' + d.brand);
}

/* ---- CONTRACT: Update amount hint when deliverable changes ---- */
function contractDeliverableChanged() {
  const sel = document.getElementById('cDeliverable');
  const opt = sel.options[sel.selectedIndex];
  const rate = opt.getAttribute('data-rate');
  if (rate && Number(rate) > 0) {
    document.getElementById('cAmount').placeholder = Number(rate).toLocaleString();
  }
}

/* ---- CONTRACT: Agreement type swaps the deal + rights fields ---- */
function toggleAgreementType() {
  var services = (document.getElementById('cAgreementType')?.value || 'partnership') === 'services';
  var show = function(id, on) { var el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('dealServices', services);
  show('dealPartnership', !services);
  show('rightsPartnership', !services);
  document.querySelectorAll('[data-partnership-only]').forEach(function(el) { el.style.display = services ? 'none' : ''; });
  var subtitle = document.querySelector('#view-contracts .view-subtitle');
  if (subtitle) subtitle.textContent = services ? 'Generate a production services agreement for day-rate editing work' : 'Generate professional partnership agreements from your template';
}

/* ---- CONTRACT: Toggle performance fields ---- */
function togglePerfFields() {
  document.getElementById("perfFields").style.display =
    document.getElementById("cCompModel").value === "performance" ? "block" : "none";
}

/* ---- CONTRACT: Gather all form data ---- */
function gatherContractData() {
  const v = (id, fallback) => (document.getElementById(id)?.value || '').trim() || fallback || '';
  // Read latest values from the defaults panel (if open) before gathering
  var cdEl = document.getElementById('cdEntity');
  if (cdEl) {
    state.CONTRACT_DEFAULTS.creatorEntity = cdEl.value.trim() || state.CONTRACT_DEFAULTS.creatorEntity;
    state.CONTRACT_DEFAULTS.creatorDBA = (document.getElementById('cdDBA')?.value || '').trim() || state.CONTRACT_DEFAULTS.creatorDBA;
    state.CONTRACT_DEFAULTS.creatorTitle = (document.getElementById('cdTitle')?.value || '').trim() || state.CONTRACT_DEFAULTS.creatorTitle;
    state.CONTRACT_DEFAULTS.creatorState = (document.getElementById('cdState')?.value || '').trim() || state.CONTRACT_DEFAULTS.creatorState;
    state.CONTRACT_DEFAULTS.revisionExtraCost = Number(document.getElementById('cdRevCost')?.value) || state.CONTRACT_DEFAULTS.revisionExtraCost;
    state.CONTRACT_DEFAULTS.paidMediaFloor = Number(document.getElementById('cdPaidFloor')?.value) || state.CONTRACT_DEFAULTS.paidMediaFloor;
    state.CONTRACT_DEFAULTS.crossPostFee = Number(document.getElementById('cdCrossPost')?.value) || state.CONTRACT_DEFAULTS.crossPostFee;
    state.CONTRACT_DEFAULTS.nonDisparagement = Number(document.getElementById('cdNonDisp')?.value) || state.CONTRACT_DEFAULTS.nonDisparagement;
    state.CONTRACT_DEFAULTS.mediationDays = Number(document.getElementById('cdMedDays')?.value) || state.CONTRACT_DEFAULTS.mediationDays;
    state.CONTRACT_DEFAULTS.contentExclusions = (document.getElementById('cdExclusions')?.value || '').trim() || state.CONTRACT_DEFAULTS.contentExclusions;
    state.CONTRACT_DEFAULTS.invoiceMethod = (document.getElementById('cdInvoiceMethod')?.value || '').trim() || state.CONTRACT_DEFAULTS.invoiceMethod;
    state.CONTRACT_DEFAULTS.paymentMethod = (document.getElementById('cdPaymentMethod')?.value || '').trim() || state.CONTRACT_DEFAULTS.paymentMethod;
    state.CONTRACT_DEFAULTS.approvalConsequence = (document.getElementById('cdApprovalConsequence')?.value || '').trim() || state.CONTRACT_DEFAULTS.approvalConsequence;
    state.CONTRACT_DEFAULTS.forceMajeureDays = Number(document.getElementById('cdFMDays')?.value) || state.CONTRACT_DEFAULTS.forceMajeureDays;
    state.CONTRACT_DEFAULTS.dayRate = Number(document.getElementById('cdDayRate')?.value) || state.CONTRACT_DEFAULTS.dayRate;
  }

  const creatorName = (typeof state.CREATOR !== 'undefined' && state.CREATOR.name) ? state.CREATOR.name : 'Creator';
  const creatorEntity = state.CONTRACT_DEFAULTS.creatorEntity;
  const creatorEmail = (typeof state.CREATOR !== 'undefined' && state.CREATOR.email) ? state.CREATOR.email : '';

  const platforms = Array.from(document.querySelectorAll('.cPlatformCheck:checked')).map(cb => cb.value);

  const payTermsMap = {
    '50/50': '50% upon brief approval and 50% upon final delivery of all Content',
    'NET30': 'NET 30 days from delivery of final Content',
    '100UP': '100% upfront before production begins',
    'custom': 'As mutually agreed upon in writing'
  };

  const licenseMap = {
    '30': { text: 'thirty (30) days', label: '30 days' },
    '90': { text: 'ninety (90) days', label: '90 days' },
    '180': { text: 'six (6) months', label: '6 months' },
    'perpetual': { text: 'perpetuity', label: 'Perpetual' }
  };

  const exclMap = {
    'none': null,
    '30': { text: 'thirty (30) days', label: '30 days' },
    '60': { text: 'sixty (60) days', label: '60 days' },
    '90': { text: 'ninety (90) days', label: '90 days' }
  };

  const licenseVal = v('cLicense', '30');
  const exclVal = v('cExcl', 'none');

  // Production services (day-rate) fields
  const balanceMap = {
    'delivery': 'due upon delivery of the final Deliverables',
    'NET15': 'due NET 15 days from delivery of the final Deliverables',
    'NET30': 'due NET 30 days from delivery of the final Deliverables'
  };
  const daysLow = Math.max(0, Number(v('cSvcDaysLow', '6')) || 6);
  const daysHigh = Math.max(daysLow, Number(v('cSvcDaysHigh', String(daysLow))) || daysLow);
  const svc = {
    work: v('cSvcWork', 'video assets'),
    count: Math.max(1, parseInt(v('cSvcCount', '1'), 10) || 1),
    spec: v('cSvcSpec', ''),
    materials: v('cSvcMaterials', 'all raw footage, brand assets, and the creative brief'),
    dayRate: Number(v('cSvcDayRate', String(state.CONTRACT_DEFAULTS.dayRate))) || state.CONTRACT_DEFAULTS.dayRate,
    daysLow, daysHigh,
    nte: Number(v('cSvcNte', '0')) || 0,
    deposit: Math.min(100, Math.max(0, Number(v('cSvcDeposit', '50')))),
    balanceKey: v('cSvcBalance', 'delivery'),
    balance: balanceMap[v('cSvcBalance', 'delivery')] || balanceMap.delivery,
    delivery: v('cSvcDelivery', ''),
    revRate: Number(v('cSvcRevRate', '750')) || 0,
    revUnit: v('cSvcRevUnit', 'day') === 'round' ? 'round' : 'day',
    kill: Math.min(100, Math.max(0, Number(v('cSvcKill', '25')))),
    portfolio: document.getElementById('cSvcPortfolio') ? !!document.getElementById('cSvcPortfolio').checked : true
  };

  return {
    agreementType: v('cAgreementType', 'partnership') === 'services' ? 'services' : 'partnership',
    svc,
    brand: v('cBrandName', '[BRAND LEGAL NAME]'),
    brandShort: v('cBrandShort', '[BRAND]'),
    contact: v('cContact', '[CONTACT NAME]'),
    contactTitle: v('cContactTitle', '[TITLE]'),
    contactEmail: v('cContactEmail', ''),
    brandStreet: v('cBrandStreet', '[ADDRESS]'),
    brandCity: v('cBrandCity', '[CITY]'),
    brandState: v('cBrandState', '[STATE]'),
    brandZip: v('cBrandZip', '[ZIP]'),
    date: v('cDate', '[DATE]'),
    campaign: v('cCampaign', '[CAMPAIGN NAME]'),
    context: v('cContext', ''),
    deliverable: v('cDeliverable', 'Instagram Reels'),
    numDeliverables: parseInt(v('cNumDeliverables', '1'), 10) || 1,
    platforms: platforms.length ? platforms : ['Instagram'],
    compModel: v('cCompModel', 'flat'),
    amount: Number(v('cAmount', '15000')) || 15000,
    payTermsKey: v('cPayTerms', '50/50'),
    payTerms: payTermsMap[v('cPayTerms', '50/50')] || payTermsMap['50/50'],
    perfMetric: v('cPerfMetric', 'Instagram Reel Plays'),
    perfRate: Number(v('cPerfRate', '30')) || 30,
    perfThreshold: Number(v('cPerfThreshold', '500000')) || 500000,
    perfCap: Number(v('cPerfCap', '35000')) || 35000,
    license: licenseMap[licenseVal] || licenseMap['30'],
    licenseKey: licenseVal,
    paidAd: v('cPaidAd', 'none'),
    excl: exclMap[exclVal],
    exclKey: exclVal,
    term: v('cTerm', '[TERM]'),
    govLaw: v('cGovLaw', 'Colorado'),
    revisions: parseInt(v('cRevisions', '2'), 10) || 2,
    approvalHrs: parseInt(v('cApprovalHrs', '48'), 10) || 48,
    killStd: parseInt(v('cKillStd', '50'), 10),
    killBreach: parseInt(v('cKillBreach', '100'), 10),
    creatorName,
    creatorEntity,
    creatorEmail
  };
}

/* ---- CONTRACT: Build all sections as array ----
   Two templates share the back half (confidentiality through
   signatures): the Partnership Agreement (sponsored content on the
   creator's channels) and the Production Services Agreement (day-rate
   editing on the client's own footage). */
function buildContractSections(d) {
  if (d.agreementType === 'services') return buildServicesSections(d);
  const fmt = n => '$' + Number(n).toLocaleString();
  const totalComp = d.amount * d.numDeliverables;
  const platformList = d.platforms.join(', ');
  const brandAddr = [d.brandStreet, d.brandCity, d.brandState, d.brandZip].filter(Boolean).join(', ');
  const dateFormatted = d.date !== '[DATE]' ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '[DATE]';

  const sections = [];

  // PREAMBLE
  sections.push({
    num: null, title: 'CONTENT CREATOR PARTNERSHIP AGREEMENT', body:
    `This Content Creator Partnership Agreement ("Agreement") is entered into as of <strong>${dateFormatted}</strong> ("Effective Date"), by and between:\n\n` +
    `<strong>${d.creatorEntity}</strong> ("Creator"), a ${state.CONTRACT_DEFAULTS.creatorState} limited liability company operated by ${d.creatorName}, doing business as ${state.CONTRACT_DEFAULTS.creatorDBA}` +
    (d.creatorEmail ? `, email: ${d.creatorEmail}` : '') + `;\n\n` +
    `and\n\n` +
    `<strong>${d.brand}</strong> ("Client"), represented by ${d.contact}, ${d.contactTitle}` +
    (d.contactEmail ? `, email: ${d.contactEmail}` : '') +
    (brandAddr && brandAddr !== '[ADDRESS], [CITY], [STATE], [ZIP]' ? `, address: ${brandAddr}` : '') + `.\n\n` +
    `Whereas, Creator is a content production company with an established audience and expertise in visual storytelling, video production, and creative education;\n\n` +
    `Whereas, ${d.brandShort} desires to engage Creator for the creation of original content promoting ${d.brandShort}'s products and services;` +
    (d.context ? `\n\nWhereas, ${d.context};` : '') +
    `\n\nNow, therefore, in consideration of the mutual promises and obligations set forth herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:`
  });

  // 1. SCOPE OF WORK
  sections.push({ num: 1, title: 'SCOPE OF WORK', body:
    `Creator shall produce and deliver the following content as further described in Exhibit A:\n\n` +
    `<strong>Deliverable:</strong> ${d.deliverable}\n` +
    `<strong>Quantity:</strong> ${d.numDeliverables} deliverable${d.numDeliverables > 1 ? 's' : ''}\n` +
    `<strong>Platform(s):</strong> ${platformList}\n` +
    `<strong>Campaign:</strong> "${d.campaign}"\n\n` +
    `"Content" means the final, published ${d.deliverable} delivered by Creator under this Agreement, including the visual, audio, and textual elements as posted on Creator's channel(s). Content does not include ${state.CONTRACT_DEFAULTS.contentExclusions}, or any other material not included in the final published deliverable.\n\n` +
    `"Paid Media" means boosted posts, sponsored ads, dark posts, paid social campaigns, display advertising, and any distribution requiring media spend, regardless of the platform.`
  });

  // 2. TERM
  sections.push({ num: 2, title: 'TERM', body:
    `This Agreement shall commence on the Effective Date and continue for <strong>${d.term}</strong> ("Term"), unless terminated earlier in accordance with the provisions herein.\n\n` +
    `The Term begins on the date the first Content is published and continues for the specified duration. Either party may terminate this Agreement at the end of the Term by providing written notice at least fifteen (15) days prior to expiration.`
  });

  // 3. COMPENSATION
  let compBody = '';
  if (d.compModel === 'flat') {
    compBody = `Client shall pay Creator a flat rate of <strong>${fmt(d.amount)} USD</strong> per deliverable, for a total of <strong>${fmt(totalComp)} USD</strong> for all ${d.numDeliverables} deliverable${d.numDeliverables > 1 ? 's' : ''}, provided that all agreed deliverables are completed in full and on time.`;
  } else {
    compBody = `<strong>Base Rate:</strong> ${fmt(d.amount)} USD per deliverable (${fmt(totalComp)} total for ${d.numDeliverables} deliverable${d.numDeliverables > 1 ? 's' : ''}).\n\n` +
    `<strong>Performance Bonus:</strong> ${fmt(d.perfRate)} per 1,000 ${d.perfMetric} above ${d.perfThreshold.toLocaleString()}, measured fourteen (14) days after publication.\n\n` +
    `<strong>Performance Cap:</strong> ${fmt(d.perfCap)} per deliverable.`;
  }
  compBody += `\n\n<strong>Payment Terms:</strong> ${d.payTerms}.\n\n` +
    `Creator shall submit invoices via ${state.CONTRACT_DEFAULTS.invoiceMethod}. Payment shall be made by ${state.CONTRACT_DEFAULTS.paymentMethod}. Client shall be responsible for any applicable processing fees.\n\n` +
    `Creator is an independent contractor and is not entitled to any employee benefits, including but not limited to health insurance, retirement plans, or paid time off.`;
  sections.push({ num: 3, title: 'COMPENSATION', body: compBody });

  // 4. CONTENT LICENSING & USAGE RIGHTS
  let licBody = `Client receives a non-exclusive license to reshare and repost the Content organically for a period of <strong>${d.license.text}</strong> following initial publication, limited to the platform(s) specified herein.`;
  if (d.paidAd === 'none' || d.paidAd === 'separate') {
    licBody += `\n\nPaid media rights (boosted posts, dark posts, paid social, display advertising) require a <strong>separate written agreement</strong> with a minimum floor of <strong>$${state.CONTRACT_DEFAULTS.paidMediaFloor.toLocaleString()} per month</strong>. No paid media usage is authorized under this Agreement.`;
  } else {
    licBody += `\n\nPaid media rights are included in the compensation above for the duration of the license period.`;
  }
  licBody += `\n\nCross-posting fees: Any reuse of Content on platforms not originally specified shall incur an additional fee of ${state.CONTRACT_DEFAULTS.crossPostFee}% of the base rate per additional platform.`;
  sections.push({ num: 4, title: 'CONTENT LICENSING & USAGE RIGHTS', body: licBody });

  // 5. INTELLECTUAL PROPERTY
  sections.push({ num: 5, title: 'INTELLECTUAL PROPERTY', body:
    `Creator retains full intellectual property rights and copyright to all Content created under this Agreement. This is not a work-for-hire arrangement, and no assignment of copyright is made.\n\n` +
    `"Content" as defined herein explicitly excludes ${state.CONTRACT_DEFAULTS.contentExclusions}, and any material not included in the final published deliverable. Creator retains all rights to such excluded materials.\n\n` +
    `Client receives only the specific license rights granted in Section 4 above. Any use beyond those rights requires prior written consent from Creator.`
  });

  // 6. EXCLUSIVITY
  if (d.excl) {
    sections.push({ num: 6, title: 'EXCLUSIVITY', body:
      `During the Term and for a period of <strong>${d.excl.text}</strong> following publication of the final Content, Creator agrees not to publish organic content promoting a direct competitor of Client on the same platform(s) specified in this Agreement.\n\n` +
      `"Direct competitor" is limited to companies offering substantially similar products or services in the same market category. This exclusivity does not restrict Creator from general content creation, other brand partnerships in unrelated categories, or personal content.`
    });
  } else {
    sections.push({ num: 6, title: 'EXCLUSIVITY', body:
      `No exclusivity period applies to this Agreement. Creator is free to engage with other brands, including competitors of Client, at any time during and after the Term.`
    });
  }

  // 7. REVISIONS & APPROVAL
  sections.push({ num: 7, title: 'REVISIONS & APPROVAL', body:
    `Creator shall provide up to <strong>${d.revisions} (${numberToWord(d.revisions)})</strong> round${d.revisions > 1 ? 's' : ''} of revisions per deliverable at no additional cost. Additional revisions beyond this scope shall be billed at <strong>$${state.CONTRACT_DEFAULTS.revisionExtraCost.toLocaleString()} per round</strong>.\n\n` +
    `Client shall provide feedback or approval within <strong>${d.approvalHrs} hours</strong> of receiving Content for review. Failure to respond within this period shall constitute ${state.CONTRACT_DEFAULTS.approvalConsequence}.\n\n` +
    `Revision requests must be specific, actionable, and consistent with the original brief. Requests that materially change the scope of the deliverable may be treated as new work and quoted separately.`
  });

  // 8. CANCELLATION & KILL FEE
  sections.push({ num: 8, title: 'CANCELLATION & KILL FEE', body:
    `If Client cancels this Agreement after Creator has begun production:\n\n` +
    `<strong>Standard cancellation:</strong> ${d.killStd}% of the total Agreement value (${fmt(totalComp * d.killStd / 100)}) is due within fifteen (15) days of cancellation notice.\n\n` +
    `<strong>Cancellation due to Client's breach:</strong> ${d.killBreach}% of the total Agreement value (${fmt(totalComp * d.killBreach / 100)}) is due immediately.\n\n` +
    `In either case, Creator retains all rights to any completed or in-progress work, and Client's license to use such work is revoked.`
  });

  // 9. FTC DISCLOSURE
  sections.push({ num: 9, title: 'FTC DISCLOSURE', body:
    `All Content shall include appropriate FTC-compliant disclosures as required by the Federal Trade Commission Endorsement Guides, including but not limited to clear and conspicuous use of "#ad", "sponsored", "paid partnership", or equivalent designations.\n\n` +
    `For video Content, disclosures must be stated verbally within the first thirty (30) seconds and displayed on-screen. Disclosures must be visible without requiring the viewer to click "more" or expand any truncated text.\n\n` +
    `Client shall not request, encourage, or require Creator to omit, obscure, or minimize any FTC-required disclosure.`
  });

  sections.push.apply(sections, buildSharedSections(d, 10, 'the Content'));
  sections.push({ num: null, title: 'SIGNATURES', body: 'SIGNATURES_BLOCK', isSigBlock: true, sigData: d });
  return sections;
}

// Boilerplate shared by both templates, numbered from `start`.
// `subject` names the work product in the indemnity warranty.
function buildSharedSections(d, start, subject) {
  const sections = [];
  let n = start;

  // CONFIDENTIALITY
  sections.push({ num: n++, title: 'CONFIDENTIALITY', body:
    `Each party agrees to keep confidential all non-public information shared by the other party in connection with this Agreement, including but not limited to campaign strategy, pricing, creative briefs, performance data, and business terms.\n\n` +
    `This obligation does not apply to information that: (a) is or becomes publicly available through no fault of the receiving party; (b) was known to the receiving party prior to disclosure; (c) is independently developed by the receiving party; or (d) is required to be disclosed by law or legal process.`
  });

  // LIMITATION OF LIABILITY
  sections.push({ num: n++, title: 'LIMITATION OF LIABILITY', body:
    `Neither party shall be liable to the other for any indirect, incidental, special, consequential, or punitive damages arising out of or related to this Agreement, regardless of the cause of action or theory of liability.\n\n` +
    `Each party's total aggregate liability under this Agreement shall not exceed the total compensation payable hereunder.`
  });

  // INDEMNIFICATION
  sections.push({ num: n++, title: 'INDEMNIFICATION', body:
    `Each party shall indemnify, defend, and hold harmless the other party from and against any third-party claims, damages, losses, and expenses (including reasonable attorneys' fees) arising from: (a) the indemnifying party's breach of this Agreement; (b) the indemnifying party's negligence or willful misconduct; or (c) any violation of applicable law by the indemnifying party.\n\n` +
    (d.agreementType === 'services'
      ? `Creator represents that Creator's original contributions to ${subject} (editing, motion graphics, and other creative work) do not infringe upon any third-party intellectual property rights. Client represents and warrants that it owns or has secured all rights, licenses, releases, and permissions necessary for every element of the Client Materials, including footage, music, talent likenesses, trademarks, and any third-party content, and that ${subject} may lawfully be used as contemplated herein.`
      : `Creator represents that all Content is original work and does not infringe upon any third-party intellectual property rights. Client represents that any materials or products provided to Creator for the campaign are lawfully distributed and comply with all applicable regulations.`)
  });

  // INDEPENDENT CONTRACTOR
  sections.push({ num: n++, title: 'INDEPENDENT CONTRACTOR', body:
    `Creator is an independent contractor and not an employee, agent, or partner of Client. Creator shall use their own equipment, set their own schedule, and maintain full creative discretion in producing ${subject}, subject to the brief and revision process.\n\n` +
    `Creator is solely responsible for all applicable federal, state, and local taxes, including self-employment tax. Client shall not withhold any taxes from payments to Creator. If payments exceed applicable IRS thresholds, Client shall issue a Form 1099.`
  });

  // NON-DISPARAGEMENT
  sections.push({ num: n++, title: 'NON-DISPARAGEMENT', body:
    `During the Term and for a period of ${state.CONTRACT_DEFAULTS.nonDisparagement} (${numberToWord(state.CONTRACT_DEFAULTS.nonDisparagement)}) months following termination or expiration of this Agreement, neither party shall make any public statements or communications that disparage, defame, or cast in a negative light the other party, its products, services, officers, directors, or employees.\n\n` +
    `This obligation sunsets automatically ${state.CONTRACT_DEFAULTS.nonDisparagement} (${numberToWord(state.CONTRACT_DEFAULTS.nonDisparagement)}) months after the termination or expiration of this Agreement.`
  });

  // DISPUTE RESOLUTION
  sections.push({ num: n++, title: 'DISPUTE RESOLUTION', body:
    `Any dispute arising out of or relating to this Agreement shall first be submitted to good-faith mediation in ${d.govLaw}. If mediation fails to resolve the dispute within ${state.CONTRACT_DEFAULTS.mediationDays} (${numberToWord(state.CONTRACT_DEFAULTS.mediationDays)}) days, either party may pursue binding arbitration in ${d.govLaw} under the rules of the American Arbitration Association.\n\n` +
    `Each party shall bear its own costs of mediation and arbitration. The prevailing party in any arbitration shall be entitled to recover reasonable attorneys' fees from the non-prevailing party.`
  });

  // FORCE MAJEURE
  sections.push({ num: n++, title: 'FORCE MAJEURE', body:
    `Neither party shall be liable for any failure or delay in performance under this Agreement due to causes beyond its reasonable control, including but not limited to natural disasters, pandemics, government actions, internet outages, platform policy changes, acts of war or terrorism, or other force majeure events.\n\n` +
    `The affected party shall provide prompt written notice and make reasonable efforts to mitigate the impact. If a force majeure event continues for more than ${state.CONTRACT_DEFAULTS.forceMajeureDays} (${numberToWord(state.CONTRACT_DEFAULTS.forceMajeureDays)}) days, either party may terminate this Agreement without penalty.`
  });

  // GOVERNING LAW
  sections.push({ num: n++, title: 'GOVERNING LAW', body:
    `This Agreement shall be governed by and construed in accordance with the laws of the State of ${d.govLaw}, without regard to its conflict of laws provisions.`
  });

  // GENERAL PROVISIONS
  sections.push({ num: n++, title: 'GENERAL PROVISIONS', body:
    `<strong>Entire Agreement:</strong> This Agreement, together with any exhibits attached hereto, constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements relating to the subject matter herein.\n\n` +
    `<strong>Assignment:</strong> Neither party may assign or transfer this Agreement without the prior written consent of the other party, except that Creator may assign this Agreement to a successor entity.\n\n` +
    `<strong>Amendments:</strong> This Agreement may be amended only by a written instrument signed by both parties.\n\n` +
    `<strong>Severability:</strong> If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.\n\n` +
    `<strong>Notices:</strong> All notices under this Agreement shall be in writing and sent to the email addresses listed above, or such other address as a party may designate in writing.\n\n` +
    `<strong>Counterparts:</strong> This Agreement may be executed in counterparts, each of which shall be deemed an original, and all of which together shall constitute one and the same instrument. Electronic signatures shall be deemed valid and binding.`
  });

  return sections;
}

/* ---- PRODUCTION SERVICES AGREEMENT ----
   Day-rate editing / post-production on footage the client supplies.
   The client ends up owning the finished assets; the creator keeps
   project files and (optionally) portfolio rights. No FTC, licensing
   windows, exclusivity or performance bonus: none of that applies. */
function buildServicesSections(d) {
  const fmt = n => '$' + Number(n).toLocaleString();
  const s = d.svc;
  const brandAddr = [d.brandStreet, d.brandCity, d.brandState, d.brandZip].filter(Boolean).join(', ');
  const dateFormatted = d.date !== '[DATE]' ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '[DATE]';
  const deliveryFormatted = s.delivery ? new Date(s.delivery + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const feeLow = s.dayRate * s.daysLow, feeHigh = s.dayRate * s.daysHigh;
  const sameDays = s.daysLow === s.daysHigh;
  const daysText = sameDays ? `${s.daysLow} working day${s.daysLow === 1 ? '' : 's'}` : `${s.daysLow} to ${s.daysHigh} working days`;
  const feeText = sameDays ? fmt(feeLow) : `${fmt(feeLow)} to ${fmt(feeHigh)}`;
  const depositAmt = Math.round(feeLow * s.deposit / 100);
  const assets = `${s.count} ${s.work}`;
  const sections = [];

  // PREAMBLE
  sections.push({
    num: null, title: 'PRODUCTION SERVICES AGREEMENT', body:
    `This Production Services Agreement ("Agreement") is entered into as of <strong>${dateFormatted}</strong> ("Effective Date"), by and between:\n\n` +
    `<strong>${d.creatorEntity}</strong> ("Creator"), a ${state.CONTRACT_DEFAULTS.creatorState} limited liability company operated by ${d.creatorName}, doing business as ${state.CONTRACT_DEFAULTS.creatorDBA}` +
    (d.creatorEmail ? `, email: ${d.creatorEmail}` : '') + `;\n\n` +
    `and\n\n` +
    `<strong>${d.brand}</strong> ("Client"), represented by ${d.contact}, ${d.contactTitle}` +
    (d.contactEmail ? `, email: ${d.contactEmail}` : '') +
    (brandAddr && brandAddr !== '[ADDRESS], [CITY], [STATE], [ZIP]' ? `, address: ${brandAddr}` : '') + `.\n\n` +
    `Whereas, Creator provides video editing, motion design, and post-production services;\n\n` +
    `Whereas, ${d.brandShort} desires to engage Creator to produce finished video assets from materials supplied by ${d.brandShort}, for ${d.brandShort}'s own use;` +
    (d.context ? `\n\nWhereas, ${d.context};` : '') +
    `\n\nNow, therefore, in consideration of the mutual promises and obligations set forth herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:`
  });

  // 1. SCOPE OF SERVICES
  sections.push({ num: 1, title: 'SCOPE OF SERVICES', body:
    `Creator shall edit and deliver the following (the "Deliverables") under the project <strong>"${d.campaign}"</strong>:\n\n` +
    `<strong>Deliverables:</strong> ${assets}\n` +
    (s.spec ? `<strong>Specifications:</strong> ${s.spec}\n` : '') +
    `<strong>Source:</strong> edited from the Client Materials described in Section 2; no original footage capture is included\n` +
    `<strong>Estimated effort:</strong> ${daysText}\n\n` +
    `The Deliverables are produced for ${d.brandShort}'s own channels and media. Creator is not engaged to publish, post, or distribute the Deliverables, to manage any media spend, or to appear in or endorse the Deliverables, and no such obligation shall be implied.\n\n` +
    `Work outside this scope, including additional assets, additional cuts or aspect ratios not listed above, re-edits caused by new or replacement footage, or changes to the creative direction after approval of a cut, is a change in scope. Creator will quote changes in scope in writing (a "Change Order") at the Day Rate before proceeding, and no change-in-scope work is due until the Change Order is accepted.`
  });

  // 2. CLIENT MATERIALS
  sections.push({ num: 2, title: 'CLIENT MATERIALS', body:
    `Client shall supply ${s.materials} (the "Client Materials") in a usable, organized form before work begins. The Estimated Effort and any delivery date assume complete Client Materials on the Effective Date; each day of delay in supplying complete Client Materials extends the schedule by at least one day.\n\n` +
    `Client represents and warrants that it owns or has secured all rights, licenses, consents, and releases needed for every element of the Client Materials, including footage, music, voice, talent likeness, trademarks, and third-party content, and that Creator's use of the Client Materials to produce the Deliverables will not infringe any third-party right. Creator is not responsible for clearing, licensing, or verifying the Client Materials.\n\n` +
    `Creator will keep the Client Materials confidential and use them only to perform this Agreement. Client is responsible for retaining its own copies; Creator may delete working files and Client Materials sixty (60) days after final delivery.`
  });

  // 3. SCHEDULE
  sections.push({ num: 3, title: 'SCHEDULE', body:
    `Work begins once Creator has received the Deposit (Section 4) and complete Client Materials.` +
    (deliveryFormatted ? ` Creator will target delivery of the final Deliverables by <strong>${deliveryFormatted}</strong>, subject to timely feedback and complete Client Materials.` : ` Creator will deliver a first cut of each Deliverable in the order agreed with Client, and the final Deliverables on completion of the included revision rounds.`) +
    `\n\nDates are targets, not guarantees. Delays caused by late Client Materials, late feedback, or changes in scope move the schedule accordingly and are not a breach by Creator.`
  });

  // 4. COMPENSATION
  let comp = `<strong>Day Rate:</strong> ${fmt(s.dayRate)} USD per working day of Creator's time. A working day is up to eight (8) hours; partial days are billed in half-day increments.\n\n` +
    `<strong>Estimate:</strong> Creator estimates <strong>${daysText}</strong> to complete the Deliverables as scoped, for an estimated fee of <strong>${feeText} USD</strong>. The estimate is a good-faith projection, not a fixed price; Client is billed for the days actually worked.`;
  if (s.nte > 0) {
    comp += `\n\n<strong>Not-to-Exceed:</strong> Without Client's prior written approval, total fees under this Agreement (excluding paid revision rounds under Section 5 and accepted Change Orders) shall not exceed <strong>${fmt(s.nte)} USD</strong>. If Creator expects to reach this cap before the Deliverables are complete, Creator will notify Client in writing with the days remaining and will pause at the cap until Client approves additional days.`;
  } else {
    comp += `\n\nIf Creator expects to exceed the high end of the estimate, Creator will notify Client in writing before doing so, with the reason and the additional days expected.`;
  }
  comp += `\n\n<strong>Deposit:</strong> ${s.deposit}% of the estimated fee (${fmt(depositAmt)} USD${sameDays ? '' : ', calculated on the low end of the estimate'}) is due on signing and before work begins. The Deposit is credited against the final invoice and is non-refundable except as provided in Section 8.\n\n` +
    `<strong>Balance:</strong> Creator will invoice the balance (days worked at the Day Rate, plus any paid revision rounds and accepted Change Orders, less the Deposit) ${s.balance}. Creator will include a summary of days worked with each invoice.\n\n` +
    `Creator shall submit invoices via ${state.CONTRACT_DEFAULTS.invoiceMethod}. Payment shall be made by ${state.CONTRACT_DEFAULTS.paymentMethod}. Client shall be responsible for any applicable processing fees. Invoices unpaid thirty (30) days after the due date accrue interest at 1.5% per month or the maximum rate permitted by law, whichever is lower.`;
  sections.push({ num: 4, title: 'COMPENSATION', body: comp });

  // 5. REVISIONS & APPROVAL
  const revUnitText = s.revUnit === 'round' ? 'per additional round' : 'per working day of editing time, billed in half-day increments';
  sections.push({ num: 5, title: 'REVISIONS & APPROVAL', body:
    `The estimate includes up to <strong>${d.revisions} (${numberToWord(d.revisions)})</strong> round${d.revisions > 1 ? 's' : ''} of revisions per Deliverable. A "round" is one consolidated set of written notes on a cut, delivered together.\n\n` +
    `Additional revision rounds requested by Client beyond those included are billed at <strong>${fmt(s.revRate)} USD ${revUnitText}</strong>, in addition to the fees above${s.nte > 0 ? ' and outside the Not-to-Exceed cap' : ''}. There is no limit on the number of additional rounds Client may request on these terms.\n\n` +
    `Client shall provide consolidated feedback or approval within <strong>${d.approvalHrs} hours</strong> of receiving a cut for review. Failure to respond within this period shall constitute approval of that cut as delivered.\n\n` +
    `Revision requests must be specific, actionable, and consistent with the brief and the approved cut. Requests that materially change the creative direction, swap in new footage, or add deliverables are changes in scope under Section 1, not revisions.`
  });

  // 6. DELIVERY & ACCEPTANCE
  sections.push({ num: 6, title: 'DELIVERY & ACCEPTANCE', body:
    `Creator will deliver the final Deliverables by digital file transfer${s.spec ? ` in the specifications stated in Section 1` : ''}. A Deliverable is accepted when Client approves it in writing or when the approval period in Section 5 lapses without a response.\n\n` +
    `Final, full-resolution files are released upon receipt of all amounts then due. Until then, Creator may deliver review copies with a watermark or at reduced resolution.`
  });

  // 7. OWNERSHIP & USAGE
  let own = `Upon Creator's receipt of all fees due under this Agreement, Creator assigns to Client all right, title, and interest in the final, approved Deliverables, and Client may use, reproduce, modify, distribute, and display the Deliverables in any media, including paid media, in any territory, without limit of time, and without further payment to Creator. Until full payment, Client's use of the Deliverables is a limited, revocable license for internal review only.\n\n` +
    `Creator retains ownership of its project files, templates, presets, animations, typefaces, tools, techniques, and any pre-existing or generally reusable material used in producing the Deliverables ("Creator Tools"). Client receives no rights in the Creator Tools beyond their inclusion in the final Deliverables. Project files are not a Deliverable; Creator may provide them on request at the Day Rate for the time involved.`;
  if (s.portfolio) {
    own += `\n\nCreator may display the final Deliverables, and excerpts of them, in Creator's portfolio, showreel, website, and social channels as examples of Creator's work, and may identify Client as a client, once the Deliverables have been publicly released by Client or six (6) months after delivery, whichever comes first. Creator will honor any written request from Client to hold a specific Deliverable back from such display.`;
  } else {
    own += `\n\nCreator shall not display the Deliverables publicly or identify Client as a client without Client's prior written consent.`;
  }
  sections.push({ num: 7, title: 'OWNERSHIP & USAGE', body: own });

  // 8. CANCELLATION
  const remainingHigh = Math.max(0, feeHigh);
  sections.push({ num: 8, title: 'CANCELLATION', body:
    `Client may cancel this Agreement at any time by written notice. On cancellation, Client shall pay, within fifteen (15) days of the notice:\n\n` +
    `(a) the Day Rate for all days worked through the date of notice, plus any paid revision rounds and accepted Change Orders completed; and\n` +
    `(b) a cancellation fee of <strong>${s.kill}%</strong> of the remaining estimate, meaning ${s.kill}% of the difference between the high end of the estimated fee (${fmt(remainingHigh)} USD) and the fees under (a).\n\n` +
    `The Deposit is applied to these amounts; any excess Deposit is refunded. Once the amounts above are paid, Creator will deliver the work completed to date in its then-current state, and Client's rights under Section 7 attach to that work.\n\n` +
    `Creator may terminate this Agreement by written notice if Client fails to pay any amount within fifteen (15) days after it is due, or fails to supply complete Client Materials or feedback for more than thirty (30) days after a written request. In that case the amounts in (a) and (b) above are likewise due.`
  });

  sections.push.apply(sections, buildSharedSections(d, 9, 'the Deliverables'));
  sections.push({ num: null, title: 'SIGNATURES', body: 'SIGNATURES_BLOCK', isSigBlock: true, sigData: d });
  return sections;
}

function numberToWord(n) {
  const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
  return words[n] || String(n);
}

/* ---- CONTRACT: Generate styled HTML preview ---- */
function generateContract() {
  const d = gatherContractData();
  const sections = buildContractSections(d);
  const previewEl = document.getElementById('contractPreviewContent');

  let html = '<div class="contract-document">';

  sections.forEach(sec => {
    if (sec.isSigBlock) {
      const s = sec.sigData;
      html += `
        <div class="contract-sig-block">
          <p style="margin-bottom:24px;font-weight:700;">IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.</p>
          <div class="contract-sig-row">
            <div class="contract-sig-party">
              <p class="contract-sig-entity">${s.creatorEntity}</p>
              <div class="contract-sig-line"></div>
              <p class="contract-sig-label">By: ${s.creatorName}, ${state.CONTRACT_DEFAULTS.creatorTitle}</p>
              <div class="contract-sig-line"></div>
              <p class="contract-sig-label">Date</p>
            </div>
            <div class="contract-sig-party">
              <p class="contract-sig-entity">${s.brand}</p>
              <div class="contract-sig-line"></div>
              <p class="contract-sig-label">By: ${s.contact}, ${s.contactTitle}</p>
              <div class="contract-sig-line"></div>
              <p class="contract-sig-label">Date</p>
            </div>
          </div>
        </div>`;
      return;
    }

    if (sec.num === null) {
      // Preamble / title section
      html += `<h2 class="contract-doc-title">${sec.title}</h2>`;
      html += `<div class="contract-section-body">${formatContractBody(sec.body)}</div>`;
    } else {
      html += `<div class="contract-section">`;
      html += `<h3 class="contract-section-heading"><span class="contract-section-num">${sec.num}.</span> ${sec.title}</h3>`;
      html += `<div class="contract-section-body">${formatContractBody(sec.body)}</div>`;
      html += `</div>`;
    }
  });

  html += '</div>';
  previewEl.innerHTML = html;
  showToast('Contract generated');
}

function formatContractBody(text) {
  return text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>').replace(/^/, '<p>').replace(/$/, '</p>');
}

// "<strong>" markup -> [{ text, bold }] runs for the PDF layout
function _pdfRuns(line) {
  var runs = [];
  var re = /<strong>([\s\S]*?)<\/strong>/g;
  var last = 0, m;
  while ((m = re.exec(line))) {
    if (m.index > last) runs.push({ text: line.slice(last, m.index), bold: false });
    if (m[1]) runs.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) runs.push({ text: line.slice(last), bold: false });
  return runs.map(function(r) { return { text: r.text.replace(/<[^>]+>/g, ''), bold: r.bold }; }).filter(function(r) { return r.text.length; });
}

/* ---- CONTRACT: Copy to clipboard ---- */
function copyContractPreview() {
  const el = document.getElementById("contractPreviewContent");
  const text = el.innerText;
  if (!text || text.includes("Fill in the form")) {
    showToast("Generate a contract first");
    return;
  }
  navigator.clipboard.writeText(text).then(() => showToast("Contract copied to clipboard"));
}

/* ---- CONTRACT: Download PDF ---- */
function downloadContractPDF() {
  const previewEl = document.getElementById('contractPreviewContent');
  if (!previewEl.querySelector('.contract-document')) {
    showToast('Generate a contract first');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('PDF library still loading — try again in a moment');
    return;
  }

  const d = gatherContractData();
  const sections = buildContractSections(d);
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  var W = doc.internal.pageSize.getWidth();
  var H = doc.internal.pageSize.getHeight();
  var M = 72; // 1 inch margins
  var CW = W - M * 2;

  var TEXT_C = [30, 28, 25];
  var MUTED_C = [110, 108, 105];
  var ACCENT = [199, 53, 57];
  var RULE_C = [200, 198, 193];

  function setColor(c) { doc.setTextColor(c[0], c[1], c[2]); }
  function setDraw(c) { doc.setDrawColor(c[0], c[1], c[2]); }

  // The body style in force. A page break redraws the footer (its own
  // font + colour) and must put this back, or the text that follows the
  // break inherits the footer's 8pt grey.
  var cur = { style: 'normal', size: 10, color: TEXT_C };
  function applyCur() { doc.setFont('helvetica', cur.style); doc.setFontSize(cur.size); setColor(cur.color); }
  function setBody(style, size, color) { cur = { style: style, size: size, color: color }; applyCur(); }

  function checkPage(y, needed) {
    if (y + needed > H - M) {
      doc.addPage();
      drawFooter();
      applyCur();
      return M + 10;
    }
    return y;
  }

  var pageNum = 0;
  function drawFooter() {
    pageNum++;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setColor(MUTED_C);
    doc.text(d.creatorEntity + ' — ' + d.brand + (d.agreementType === 'services' ? ' Production Services Agreement' : ' Partnership Agreement'), M, H - 30);
    doc.text('Page ' + pageNum, W - M, H - 30, { align: 'right' });
    setDraw(RULE_C);
    doc.setLineWidth(0.5);
    doc.line(M, H - 42, W - M, H - 42);
  }

  // Paragraph text with inline <strong> runs, laid out word by word so
  // bold stays in the sentence (the preview's look). Single newlines
  // break the line; blank lines separate paragraphs.
  function writeBoldWrapped(text, x, y, maxW, lineH) {
    text = text.replace(/<\/?p>/g, '\n').replace(/<br>/g, '\n');
    var paragraphs = text.split(/\n\n+/);
    var spaceW = function(bold) { doc.setFont('helvetica', bold ? 'bold' : cur.style); return doc.getTextWidth(' '); };
    paragraphs.forEach(function(para) {
      if (!para.trim()) { y += lineH * 0.5; return; }
      para.split('\n').forEach(function(line) {
        var runs = _pdfRuns(line);
        var cx = x;
        var lineEmpty = true;
        y = checkPage(y, lineH);
        runs.forEach(function(run) {
          doc.setFont('helvetica', run.bold ? 'bold' : cur.style);
          var tokens = run.text.split(/(\s+)/).filter(function(t) { return t.length; });
          tokens.forEach(function(tok) {
            if (/^\s+$/.test(tok)) {
              if (!lineEmpty) cx += spaceW(run.bold);
              return;
            }
            doc.setFont('helvetica', run.bold ? 'bold' : cur.style);
            var w = doc.getTextWidth(tok);
            if (!lineEmpty && cx + w > x + maxW) {
              y += lineH; y = checkPage(y, lineH); cx = x; lineEmpty = true;
              doc.setFont('helvetica', run.bold ? 'bold' : cur.style);
            }
            // A single token wider than the line is split by character
            if (w > maxW) {
              var pieces = doc.splitTextToSize(tok, maxW);
              pieces.forEach(function(piece, i) {
                if (i) { y += lineH; y = checkPage(y, lineH); cx = x; doc.setFont('helvetica', run.bold ? 'bold' : cur.style); }
                doc.text(piece, cx, y);
                cx += doc.getTextWidth(piece);
              });
              lineEmpty = false;
              return;
            }
            doc.text(tok, cx, y);
            cx += w;
            lineEmpty = false;
          });
        });
        y += lineH;
      });
      y += lineH * 0.4;
    });
    applyCur();
    return y;
  }

  // --- PAGE 1: Title ---
  drawFooter();
  var y = M;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setColor(TEXT_C);
  var titleLines = doc.splitTextToSize(sections[0].title, CW);
  titleLines.forEach(function(line) {
    doc.text(line, W / 2, y, { align: 'center' });
    y += 24;
  });

  y += 8;
  setDraw(ACCENT);
  doc.setLineWidth(2);
  doc.line(M + CW * 0.3, y, M + CW * 0.7, y);
  y += 24;

  // Preamble body
  setBody('normal', 10, TEXT_C);
  var preamble = sections[0];
  y = writeBoldWrapped(preamble.body, M, y, CW, 14);
  y += 10;

  // Numbered sections
  for (var s = 1; s < sections.length; s++) {
    var sec = sections[s];
    if (sec.isSigBlock) {
      // Signature block
      y = checkPage(y, 260);
      y += 10;
      setBody('bold', 10, TEXT_C);
      doc.splitTextToSize('IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.', CW).forEach(function(line) { doc.text(line, M, y); y += 14; });
      y += 16;

      // Creator sig
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(d.creatorEntity, M, y);
      y += 30;
      setDraw(TEXT_C);
      doc.setLineWidth(0.5);
      doc.line(M, y, M + CW * 0.4, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setColor(MUTED_C);
      doc.text('By: ' + d.creatorName + ', ' + state.CONTRACT_DEFAULTS.creatorTitle, M, y);
      y += 20;
      doc.line(M, y, M + CW * 0.25, y);
      y += 14;
      doc.text('Date', M, y);
      y += 30;

      // Client sig
      setColor(TEXT_C);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(d.brand, M, y);
      y += 30;
      setDraw(TEXT_C);
      doc.line(M, y, M + CW * 0.4, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setColor(MUTED_C);
      doc.text('By: ' + d.contact + ', ' + d.contactTitle, M, y);
      y += 20;
      doc.line(M, y, M + CW * 0.25, y);
      y += 14;
      doc.text('Date', M, y);
      continue;
    }

    if (sec.num === null) continue; // Skip preamble (already rendered)

    y = checkPage(y, 50);

    // Section heading: the number in the accent, like the preview
    setDraw(RULE_C);
    doc.setLineWidth(0.5);
    doc.line(M, y, M + CW, y);
    y += 16;

    setBody('bold', 11, ACCENT);
    doc.text(sec.num + '.', M, y);
    setBody('bold', 11, TEXT_C);
    doc.text(sec.title, M + doc.getTextWidth(sec.num + '.') + 6, y);
    y += 18;

    // Section body
    setBody('normal', 10, TEXT_C);
    y = writeBoldWrapped(sec.body, M, y, CW, 13.5);
    y += 8;
  }

  var filename = (d.brandShort !== '[BRAND]' ? d.brandShort.replace(/[^a-zA-Z0-9]/g, '_') : 'Brand') + (d.agreementType === 'services' ? '_Services_' : '_Contract_') + d.date + '.pdf';
  doc.save(filename);
  showToast('PDF downloaded');
}

act({ contractCancelNewClient, contractPickClient, contractSaveNewClient, toggleAgreementType, contractDeliverableChanged, copyContractPreview, downloadContractPDF, generateContract, prefillContractFromDeal, saveContractDefaults, toggleContractDefaults, togglePerfFields });

export { _pdfRuns, _splitAddress, contractCancelNewClient, contractPickClient, contractSaveNewClient, buildServicesSections, buildSharedSections, toggleAgreementType, buildContractSections, contractDeliverableChanged, copyContractPreview, downloadContractPDF, formatContractBody, gatherContractData, generateContract, loadContractDefaults, numberToWord, prefillContractFromDeal, renderContracts, saveContractDefaults, toggleContractDefaults, togglePerfFields };
