// Arkives — Rate Cards: brand-facing cards (rates + the media-kit metrics)
// and freelance role presets that combine into one freelance PDF. Replaces
// the Media Kit view. Presets live in rate_card_presets (migration 031);
// the store owns every write, this view keeps the editor draft (state._rc).
//
// A preset's `name` is internal ("Brand: AI tools") and never prints. The
// PDF is the red paper document (the invoice family), printed through the
// browser like quotes and invoices.
import { state } from '../state.js';
import { ratecards } from '../stores/ratecards.js';
import { _args, act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { isPrivate, pv } from '../lib/privacy.js';
import { showToast } from '../lib/toast.js';
import { _localISODate } from './tasks.js';

/* ---- CONSTANTS ---- */
const RC_MIGRATION_MSG = 'Run migrations/031_rate_cards.sql in Supabase first';
const RC_UNITS = {
  none: { label: 'No unit', print: '' },
  post: { label: 'Per post', print: 'per post' },
  each: { label: 'Each', print: 'each' },
  day: { label: 'Per day', print: 'per day' },
  hour: { label: 'Per hour', print: 'per hour' },
  second: { label: 'Per second', print: 'per second' },
  '30d': { label: 'Per 30 days', print: 'per 30 days' },
  pct: { label: '% of base', print: 'of base fee' },
  pct30d: { label: '% of base / 30 days', print: 'of base fee, per 30 days' },
};
const RC_DISPLAY = { fixed: 'Fixed', from: 'From $X', request: 'On request' };
const RC_ROLES = {
  editor: 'Editor',
  director: 'Director',
  director_editor: 'Director + editor',
  motion: 'Motion design',
  custom: 'Custom role',
};
const RC_KIND_LABEL = { brand: 'Brand card', role: 'Freelance role', terms: 'Freelance terms', about: 'About (shared)' };

const _clone = (o) => JSON.parse(JSON.stringify(o || {}));
const I = (name, detail, unit, display, price) => ({ name, detail: detail || '', price: price == null ? null : price, unit: unit || 'none', display: display || 'fixed' });
const T = (label, hint, text) => ({ label, hint: hint || '', text: text || '' });

function _addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return _localISODate(d);
}

/* ---- TEMPLATES ----
   Every new preset starts from one of these. Prices start blank on
   purpose: the numbers are Jordan's to set. The brand card copies the
   deliverables already saved in Settings -> Rate Card. */
function _brandTemplate() {
  const rc = state.RATE_CARD || {};
  const fromSettings = (list, unit) => (list || []).filter((r) => r && r.name)
    .map((r) => I(r.name, '', unit, 'fixed', Number(r.rate) > 0 ? Number(r.rate) : null));
  let deliverables = [
    ...fromSettings(rc.organic, 'post'), ...fromSettings(rc.tiktok, 'post'),
    ...fromSettings(rc.youtube, 'post'), ...fromSettings(rc.ugc, 'each'),
  ];
  if (!deliverables.length) deliverables = [
    I('Instagram Reel', 'Concept, production and posting on my feed', 'post'),
    I('Instagram carousel', '', 'post'),
    I('Instagram Stories', 'Three frames with link sticker', 'post'),
    I('TikTok video', '', 'post'),
    I('YouTube integration', '60-90 seconds inside a video', 'post'),
    I('UGC video, 30s', 'For your channels, not posted on mine', 'each'),
    I('UGC video, 60s', 'For your channels, not posted on mine', 'each'),
  ];
  const addOns = (rc.addOns || []).filter((r) => r && r.name).length
    ? fromSettings(rc.addOns, 'none')
    : [
      I('Organic usage', 'You repost the content on your own channels', 'pct30d'),
      I('Paid usage', 'You run the content as ads', 'pct30d'),
      I('Whitelisting / Spark Ads / Partnership Ads', 'Ads run from my handle', 'pct30d'),
      I('Exclusivity', 'No competitor work in your category', 'pct30d'),
      I('Cross-posting', 'The same video on another platform', 'each'),
      I('Raw footage', 'Unedited source files', 'each'),
      I('Link in bio', '', '30d'),
      I('Rush delivery', 'Delivery inside 5 business days', 'pct'),
    ];
  const packages = fromSettings(rc.bundles, 'none');
  return {
    headline: 'Rates',
    intro: '',
    validUntil: _addDays(90),
    tagline: '',
    show: { platforms: true, engagement: true, demographics: true, fit: false, about: true },
    engagementRate: '',
    sections: [
      { title: 'Deliverables', items: deliverables },
      { title: 'Usage & add-ons', items: addOns },
      { title: 'Packages', items: packages.length ? packages : [I('Reel + TikTok', 'One concept, posted on both', 'none', 'from')] },
    ],
    terms: [
      T('Rates cover', '', 'Creation and posting on my channels. Usage rights, paid ads and exclusivity are priced as add-ons.'),
      T('Revisions', 'e.g. One round of revisions included per deliverable.'),
      T('Payment', 'e.g. 50% on signing, 50% on delivery. Net 30 from invoice date.'),
      T('Turnaround', 'e.g. First draft within 7 business days of the brief.'),
    ],
  };
}

const ROLE_TEMPLATES = {
  editor: () => ({ title: 'Editing', summary: 'Post-production on supplied or shot footage.', items: [
    I('Day rate', '10-hour day', 'day'),
    I('Half day', '5 hours', 'none'),
    I('Hourly', '1-hour minimum', 'hour'),
    I('Extra revision round', 'Beyond the included rounds', 'each'),
    I('Edit suite & software', 'My own system, when working remotely', 'day'),
  ] }),
  director: () => ({ title: 'Directing', summary: 'Creative direction and directing on set.', items: [
    I('Shoot day', '10-hour day', 'day'),
    I('Prep day', 'Pre-production, recce, shot list', 'day'),
    I('Travel day', '', 'day'),
    I('Creative fee', 'Per project, set by scope', 'none', 'from'),
    I('Treatment', 'Written treatment for a pitch', 'each'),
  ] }),
  director_editor: () => ({ title: 'Direct + edit', summary: 'One person from treatment to final cut.', items: [
    I('Package', 'Treatment, shoot day, edit and two revision rounds', 'none', 'from'),
    I('Shoot day', '10-hour day', 'day'),
    I('Edit day', '', 'day'),
  ] }),
  motion: () => ({ title: 'Motion design', summary: 'Hand-drawn animation and motion graphics.', items: [
    I('Motion design day', '', 'day'),
    I('Animated title or logo sting', '', 'each', 'from'),
    I('Hand-drawn animation', 'Frame by frame', 'second', 'from'),
    I('Extra revision round', '', 'each'),
  ] }),
  custom: () => ({ title: '', summary: '', items: [I('', '', 'day')] }),
};

// The About section is one shared preset (kind 'about') that every card
// prints, so it is edited once
function _aboutTemplate() {
  const c = state.CREATOR || {};
  return {
    rows: [
      T('Reel', 'Link to your reel or portfolio'),
      T('Based in', 'City, time zone. Available to travel?'),
      T('Software', 'e.g. Premiere Pro, After Effects, DaVinci Resolve'),
      T('Specialties', 'e.g. Social-first cuts, hand-drawn motion, hero films'),
      T('Selected clients', 'e.g. Anthropic, LG, Adobe'),
      T('Availability', 'e.g. Booking 2-3 weeks out'),
      T('Contact', '', c.mkContactEmail || c.email || ''),
    ],
  };
}

function _termsTemplate() {
  return {
    headline: 'Rates',
    tagline: '',
    showAbout: true,
    intro: '',
    validUntil: _addDays(90),
    terms: [
      T('Working day', 'e.g. 10 hours including a 1-hour break. Half day is 5 hours.'),
      T('Overtime', 'e.g. 1.5x after 10 hours, 2x after 12, billed in half-hour blocks.'),
      T('Prep & travel', 'e.g. Prep days at the shoot day rate. Travel days at 50%, plus per diem and mileage.'),
      T('Kit & equipment', 'e.g. Camera package billed separately, or included.'),
      T('Revisions', 'e.g. Two rounds included. Further rounds at the hourly rate, 1-hour minimum.'),
      T('Deposit', 'e.g. 50% non-refundable deposit books the dates.'),
      T('Payment', 'e.g. Balance Net 30 from final delivery. Interim invoices on jobs over 2 weeks.'),
      T('Cancellation', 'e.g. 50% of booked days if cancelled within 7 days, 100% within 48 hours.'),
      T('Weather days', 'e.g. Billed at 50% of the day rate.'),
      T('Rush', 'e.g. +50% for delivery inside 48 hours or weekend work.'),
      T('Usage', 'e.g. Work for hire. I may show the finished work in my reel after release.'),
      T('Credit', 'e.g. Director / Editor credit where credits run.'),
      T('Union status', 'e.g. Non-union.'),
    ],
  };
}

/* ---- PRICE FORMATTING ---- */
function _money(n) {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}
function _hasPrice(it) { return it.price !== null && it.price !== '' && it.price !== undefined && !isNaN(Number(it.price)); }
// Lines that print: a name and either a price or "on request"
function _prints(it) { return !!String(it.name || '').trim() && (it.display === 'request' || _hasPrice(it)); }
// { main, sub } as it prints, or null for a line that does not print
function rcPrice(it) {
  if (it.display === 'request') return { main: 'On request', sub: '' };
  if (!_hasPrice(it)) return null;
  const unit = RC_UNITS[it.unit] || RC_UNITS.none;
  const pct = it.unit === 'pct' || it.unit === 'pct30d';
  const amount = pct ? '+' + Number(it.price) + '%' : _money(it.price);
  return { main: (it.display === 'from' ? 'From ' : '') + amount, sub: unit.print };
}
function _unpricedCount(content) {
  const lists = content.sections ? content.sections.map((s) => s.items || []) : [content.items || []];
  return lists.flat().filter((it) => String(it.name || '').trim() && !_prints(it)).length;
}

/* ---- THE DOCUMENT MODEL ----
   Everything the PDF shows, resolved from a preset (brand) or a set of
   role presets plus a terms preset (freelance). Version names never get
   in here. */
function _identity() {
  const c = state.CREATOR || {};
  const ig = ((c.platforms && c.platforms.instagram && c.platforms.instagram.handle) || '').replace(/^@/, '');
  return { name: c.brand || c.name || '', person: c.name || '', handle: ig ? '@' + ig : '', email: c.mkContactEmail || c.email || '', niche: c.niche || '' };
}
const PLATFORM_DEFS = [
  ['instagram', 'Instagram', 'followers'], ['tiktok', 'TikTok', 'followers'], ['youtube', 'YouTube', 'subscribers'],
  ['twitter', 'X', 'followers'], ['linkedin', 'LinkedIn', 'followers'], ['threads', 'Threads', 'followers'],
];
function _brandMetrics(content) {
  const show = content.show || {};
  const c = state.CREATOR || {};
  const p = c.platforms || {};
  const out = { platforms: [], engagement: '', demographics: null, fit: null };
  if (show.platforms) {
    out.platforms = PLATFORM_DEFS.filter(([k]) => p[k] && p[k].followersNum > 0)
      .map(([k, label, word]) => ({ label, value: p[k].followers || String(p[k].followersNum), word }));
  }
  if (show.engagement) out.engagement = String(content.engagementRate || (p.instagram && p.instagram.engagement) || '').trim();
  const a = state.AUDIENCE_DATA || {};
  const g = a.gender || {};
  if (show.demographics && (a.ageRange || (a.topCountries || []).length || g.male || g.female)) {
    out.demographics = { ageRange: a.ageRange || '', topAge: a.topAge || '', male: Number(g.male) || 0, female: Number(g.female) || 0, countries: (a.topCountries || []).slice(0, 4) };
  }
  if (show.fit && ((c.mkAlignYes || []).length || (c.mkAlignNo || []).length)) out.fit = { yes: c.mkAlignYes || [], no: c.mkAlignNo || [] };
  return out;
}
const _filled = (list) => (list || []).filter((t) => String(t.label || '').trim() && String(t.text || '').trim());
function _aboutPreset() { return ratecards.ofKind('about')[0] || null; }
// The open About draft wins, so its preview (and every other preview) shows edits before Save
function _aboutRows() {
  if (state._rc && state._rc.kind === 'about') return _filled(state._rc.content.rows);
  const a = _aboutPreset();
  return a ? _filled(a.content.rows) : [];
}
// The line under the name: this card's own, else the profile niche
function _tagline(own) { return String(own || '').trim() || _identity().niche; }
function rcBrandModel(content) {
  return {
    kind: 'brand',
    headline: content.headline || 'Rates',
    tagline: _tagline(content.tagline),
    intro: content.intro || '',
    validUntil: content.validUntil || '',
    id: _identity(),
    metrics: _brandMetrics(content),
    blocks: (content.sections || []).map((s) => ({ title: s.title || '', summary: '', items: (s.items || []).filter(_prints) })).filter((b) => b.items.length),
    profile: (content.show || {}).about === false ? [] : _aboutRows(),
    terms: (content.terms || []).filter((t) => String(t.label || '').trim() && String(t.text || '').trim()),
  };
}
function rcFreelanceModel(roles, terms) {
  const tc = (terms && terms.content) || {};
  const rows = (list) => (list || []).filter((t) => String(t.label || '').trim() && String(t.text || '').trim());
  return {
    kind: 'freelance',
    headline: tc.headline || 'Rates',
    tagline: _tagline(tc.tagline),
    intro: tc.intro || '',
    validUntil: tc.validUntil || '',
    id: _identity(),
    metrics: null,
    blocks: roles.map((r) => ({ title: r.content.title || RC_ROLES[r.role] || '', summary: r.content.summary || '', items: (r.content.items || []).filter(_prints) })).filter((b) => b.items.length),
    // Shared About; a terms preset from before About was shared keeps its own rows
    profile: tc.showAbout === false ? [] : (_aboutPreset() ? _aboutRows() : rows(tc.profile)),
    terms: rows(tc.terms),
  };
}

/* ---- THE DOCUMENT (red paper) ----
   Shared by the editor preview and the PDF. `masked` is the preview in
   privacy mode; the PDF always gets the real document. */
function _fmtValid(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function renderRateDoc(m, masked) {
  const mk = masked ? pv : (h) => h;
  const id = m.id;
  const idLine = [id.handle, m.tagline === undefined ? id.niche : m.tagline].filter(Boolean).map(_esc).join('  |  ');
  const valid = _fmtValid(m.validUntil);

  let metrics = '';
  if (m.metrics) {
    const x = m.metrics;
    const tiles = x.platforms.map((p) => `<div class="rcr-stat"><strong>${_esc(p.value)}</strong><span>${_esc(p.label)} ${_esc(p.word)}</span></div>`);
    if (x.engagement) tiles.push(`<div class="rcr-stat"><strong>${_esc(x.engagement)}</strong><span>engagement rate</span></div>`);
    const stats = tiles.length ? `<div class="rcr-stats">${tiles.join('')}</div>` : '';
    let demo = '';
    if (x.demographics) {
      const d = x.demographics;
      const parts = [];
      if (d.ageRange) parts.push(`<div class="rcr-demo"><span class="rcr-label">Age</span><span>${_esc(d.ageRange)}${d.topAge ? ` (core ${_esc(d.topAge)})` : ''}</span></div>`);
      if (d.male || d.female) parts.push(`<div class="rcr-demo"><span class="rcr-label">Gender</span><span>${d.male}% men, ${d.female}% women</span></div>`);
      if (d.countries.length) parts.push(`<div class="rcr-demo"><span class="rcr-label">Top locations</span><span>${d.countries.map((c) => _esc(c.name) + ' ' + Number(c.pct || 0) + '%').join(', ')}</span></div>`);
      demo = `<div class="rcr-demos">${parts.join('')}</div>`;
    }
    let fit = '';
    if (x.fit) {
      fit = `<div class="rcr-demos">
        ${x.fit.yes.length ? `<div class="rcr-demo"><span class="rcr-label">Good fit</span><span>${x.fit.yes.map(_esc).join(', ')}</span></div>` : ''}
        ${x.fit.no.length ? `<div class="rcr-demo"><span class="rcr-label">Not a fit</span><span>${x.fit.no.map(_esc).join(', ')}</span></div>` : ''}
      </div>`;
    }
    metrics = stats + demo + fit;
  }

  const blocks = m.blocks.map((b) => `
    <section class="rcr-block">
      <div class="rcr-bar"><img class="rcr-bar-icons" src="invoice-red-icons.svg" alt=""><span>${_esc(b.title)}</span></div>
      ${b.summary ? `<p class="rcr-summary">${_esc(b.summary)}</p>` : ''}
      ${b.items.map((it) => {
        const p = rcPrice(it);
        return `<div class="rcr-row">
          <div class="rcr-row-name">${_esc(it.name)}${it.detail ? `<small>${_esc(it.detail)}</small>` : ''}</div>
          <div class="rcr-row-price">${mk(_esc(p.main))}${p.sub ? `<small>${_esc(p.sub)}</small>` : ''}</div>
        </div>`;
      }).join('')}
    </section>`).join('');

  const table = (title, rows) => rows.length ? `
    <section class="rcr-block">
      <div class="rcr-bar"><img class="rcr-bar-icons" src="invoice-red-icons.svg" alt=""><span>${_esc(title)}</span></div>
      ${rows.map((t) => `<div class="rcr-term"><span class="rcr-label">${_esc(t.label)}</span><span>${/^(contact)$/i.test(t.label) ? mk(_esc(t.text)) : _esc(t.text).replace(/\n/g, '<br>')}</span></div>`).join('')}
    </section>` : '';

  const empty = !m.blocks.length ? '<p class="rcr-empty">Add a price to a line and it shows here. Lines without a price stay off the PDF.</p>' : '';

  return `
  <div class="rcr">
    <header class="rcr-head">
      <div class="rcr-title">[ ${_esc(String(m.headline || 'Rates').toUpperCase())} ]</div>
      <div class="rcr-id">
        <div class="rcr-name">${_esc(id.name)}</div>
        ${idLine ? `<div>${idLine}</div>` : ''}
        ${id.email && m.kind === 'brand' ? `<div>${mk(_esc(id.email))}</div>` : ''}
        ${valid ? `<div>Rates valid through ${_esc(valid)}</div>` : ''}
      </div>
    </header>
    ${m.intro ? `<p class="rcr-intro">${_esc(m.intro)}</p>` : ''}
    ${metrics}
    ${blocks}${empty}
    ${table('About', m.profile)}
    ${table('Terms', m.terms)}
    <footer class="rcr-footer"><img class="rcr-mark" src="invoice-red-mark.svg" alt=""></footer>
  </div>`;
}

/* ---- PDF (browser print -> Save as PDF) ---- */
function rcPrint(model, fileTitle) {
  let host = document.getElementById('rcPrintHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'rcPrintHost';
    document.body.appendChild(host);
  }
  host.innerHTML = renderRateDoc(model, false);
  document.body.classList.add('printing-ratecard');
  const prevTitle = document.title;
  if (fileTitle) document.title = fileTitle; // the default "Save as PDF" file name
  const done = () => {
    document.body.classList.remove('printing-ratecard');
    document.title = prevTitle;
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  // The bar icons and the mark must be decoded before the print snapshot
  const imgs = [...host.querySelectorAll('img')].map((im) => (im.decode ? im.decode().catch(() => {}) : null));
  Promise.all(imgs).then(() => window.print());
}
function _fileTitle(kind) {
  const n = _identity().person || _identity().name || 'Rates';
  return n + (kind === 'brand' ? ' - Rates' : ' - Freelance Rates');
}
function _defaultTerms() { return ratecards.ofKind('terms')[0] || null; }
// The model a preset previews and prints
function _modelFor(rc) {
  if (rc.kind === 'brand') return rcBrandModel(rc.content);
  if (rc.kind === 'role') return rcFreelanceModel([rc], _defaultTerms());
  if (rc.kind === 'about') return rcFreelanceModel(ratecards.ofKind('role'), _defaultTerms());
  return rcFreelanceModel(ratecards.ofKind('role'), rc);
}

/* ============================================================
   LIST VIEW
   ============================================================ */
// sub: '' = list, '<id>' = that preset's editor
function renderRateCards(sub) {
  if (typeof sub === 'string') _rcApplyRoute(sub);
  if (state._rcOpenId && state._rc) { renderRateCardEditor(); return; }
  const container = document.getElementById('view-ratecards');
  if (!container) return;

  if (state._rateCardsMigrationMissing) {
    container.innerHTML = `
      <div class="view-header"><div><h1 class="view-title">Rate Cards</h1></div></div>
      <div class="card"><div class="empty-state" style="padding:32px">${RC_MIGRATION_MSG}.</div></div>`;
    return;
  }

  const brand = ratecards.ofKind('brand');
  const about = _aboutPreset();
  const roles = ratecards.ofKind('role');
  const terms = ratecards.ofKind('terms');
  const row = (rc, sub2) => `
    <div class="rc-row">
      <button class="rc-row-open" data-action="rcOpen" data-args="${_args(rc._sbId)}">
        <strong>${_esc(rc.name)}</strong>
        <span>${_esc(sub2)}</span>
      </button>
      <div class="gap-row">
        ${rc.kind !== 'terms' ? `<button class="btn btn-sm" data-action="rcRowPDF" data-args="${_args(rc._sbId)}">PDF</button>` : ''}
        <button class="btn btn-sm" data-action="rcDuplicate" data-args="${_args(rc._sbId)}">Duplicate</button>
        <button class="btn btn-sm rc-del${state._rcConfirmDelete === rc._sbId ? ' rc-del-armed' : ''}" data-action="rcRowDelete" data-args="${_args(rc._sbId)}">${state._rcConfirmDelete === rc._sbId ? 'Confirm delete' : 'Delete'}</button>
      </div>
    </div>`;
  const lines = (rc) => {
    const n = (rc.kind === 'brand' ? (rc.content.sections || []).flatMap((s) => s.items || []) : (rc.content.items || [])).filter(_prints).length;
    return n + (n === 1 ? ' priced line' : ' priced lines');
  };

  const pick = state._rcExport;
  const exportPanel = pick ? `
    <div class="rc-export">
      <div class="inv-section-label">Combine into one PDF</div>
      ${roles.length ? roles.map((r) => `
        <label class="rc-check"><input type="checkbox" ${pick.roles[r._sbId] ? 'checked' : ''} data-change="rcExportRole" data-change-args="${_args(r._sbId, '$checked')}"> ${_esc(r.name)} <span class="rc-muted">${_esc(RC_ROLES[r.role] || '')}</span></label>`).join('') : '<p class="inv-help">Add a role preset first.</p>'}
      <div class="form-group" style="margin-top:12px">
        <label>Terms</label>
        <select data-change="rcExportTerms" data-change-args="${_args('$value')}">
          <option value="">No terms page</option>
          ${terms.map((t) => `<option value="${_esc(t._sbId)}" ${pick.termsId === t._sbId ? 'selected' : ''}>${_esc(t.name)}</option>`).join('')}
        </select>
      </div>
      <div class="gap-row">
        <button class="btn" data-action="rcExportAll">Select all roles</button>
        <button class="btn btn-primary" data-action="rcExportGo">Download PDF</button>
        <button class="btn" data-action="rcExportClose">Cancel</button>
      </div>
    </div>` : '';

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Rate Cards</h1>
        <p class="view-subtitle">Rates for brands, and day rates for agencies and creative directors. Preset names stay private and never print.</p>
      </div>
    </div>

    <div class="card rc-about">
      <div>
        <h3>About</h3>
        <p class="inv-help">Shared by every card: reel, location, software, clients, availability, contact. Edit it once; each card can hide it.</p>
        ${about ? `<p class="rc-about-sum">${_esc(_filled(about.content.rows).map((t) => t.label).join(' · ') || 'Nothing filled in yet')}</p>` : ''}
      </div>
      ${about
        ? `<button class="btn btn-primary btn-sm" data-action="rcOpen" data-args="${_args(about._sbId)}">Edit About</button>`
        : `<button class="btn btn-primary btn-sm" data-action="rcNew" data-args="${_args('about')}">Set up About</button>`}
    </div>

    <div class="rc-groups">
      <div class="card rc-group">
        <div class="card-header"><h3>Brand cards</h3><button class="btn btn-primary btn-sm" data-action="rcNew" data-args="${_args('brand')}">+ Brand card</button></div>
        <p class="inv-help rc-group-help">Rates plus your metrics: followers, engagement rate, audience.</p>
        ${brand.length ? brand.map((rc) => row(rc, lines(rc))).join('') : '<div class="rc-empty">No brand cards yet. A new one starts from your Settings rates.</div>'}
      </div>

      <div class="card rc-group">
        <div class="card-header"><h3>Freelance</h3><button class="btn btn-sm" data-action="rcExportOpen" ${roles.length ? '' : 'disabled'}>Export combined PDF</button></div>
        <p class="inv-help rc-group-help">Save each role as a preset, then combine any of them with a terms page into one PDF.</p>
        ${exportPanel}
        <div class="inv-section-label">Roles</div>
        ${roles.length ? roles.map((rc) => row(rc, (RC_ROLES[rc.role] || 'Role') + ' · ' + lines(rc))).join('') : '<div class="rc-empty">No roles yet.</div>'}
        <div class="gap-row rc-adds">
          ${Object.keys(RC_ROLES).map((k) => `<button class="btn btn-sm" data-action="rcNew" data-args="${_args('role', k)}">+ ${_esc(RC_ROLES[k])}</button>`).join('')}
        </div>
        <div class="inv-section-label">Terms</div>
        ${terms.length ? terms.map((rc) => row(rc, 'Working day, overtime, deposit, cancellation')).join('') : '<div class="rc-empty">No terms yet.</div>'}
        <div class="gap-row rc-adds"><button class="btn btn-sm" data-action="rcNew" data-args="${_args('terms')}">+ Terms</button></div>
      </div>
    </div>`;
}

/* ---- ROUTING ---- */
function _rcApplyRoute(sub) {
  if (sub && sub === state._rcOpenId && state._rc) return;
  _rcFlush();
  const rc = sub ? ratecards.find(sub) : null;
  state._rcOpenId = rc ? rc._sbId : null;
  state._rc = rc ? { name: rc.name, kind: rc.kind, role: rc.role, content: _clone(rc.content) } : null;
  state._rcDirty = false;
  state._rcConfirmDelete = null;
}
// Unsaved edits save quietly when the editor closes
function _rcFlush() {
  if (state._rcOpenId && state._rc && state._rcDirty) {
    const id = state._rcOpenId;
    const draft = state._rc;
    state._rcDirty = false;
    ratecards.save(id, { name: draft.name.trim() || RC_KIND_LABEL[draft.kind], content: draft.content }, true);
  }
}
function unmountRateCards() { _rcFlush(); state._rcOpenId = null; state._rc = null; state._rcExport = null; }

/* ---- LIST ACTIONS ---- */
async function rcNew(kind, role) {
  if (state._rateCardsMigrationMissing) { showToast(RC_MIGRATION_MSG); return; }
  let content, name;
  if (kind === 'brand') {
    content = _brandTemplate();
    name = 'Brand card ' + (ratecards.ofKind('brand').length + 1);
  } else if (kind === 'role') {
    content = (ROLE_TEMPLATES[role] || ROLE_TEMPLATES.custom)();
    name = RC_ROLES[role] || 'Role';
    if (ratecards.ofKind('role').some((r) => r.name === name)) name += ' ' + (ratecards.ofKind('role').filter((r) => r.role === role).length + 1);
  } else if (kind === 'about') {
    if (_aboutPreset()) { location.hash = 'ratecards/' + _aboutPreset()._sbId; return; }
    content = _aboutTemplate();
    name = 'About';
  } else {
    content = _termsTemplate();
    name = 'Freelance terms' + (ratecards.ofKind('terms').length ? ' ' + (ratecards.ofKind('terms').length + 1) : '');
  }
  const rc = await ratecards.add({ kind, name, role: kind === 'role' ? role : null, content });
  if (rc) location.hash = 'ratecards/' + rc._sbId;
}
function rcOpen(id) { location.hash = 'ratecards/' + id; }
async function rcDuplicate(id) {
  const src = id ? ratecards.find(id) : null;
  const base = src || (state._rc && { kind: state._rc.kind, role: state._rc.role, name: state._rc.name, content: state._rc.content });
  if (!base) return;
  const rc = await ratecards.add({ kind: base.kind, role: base.role, name: (base.name || 'Preset') + ' copy', content: _clone(base.content) });
  if (rc) { showToast('Duplicated'); if (!src) location.hash = 'ratecards/' + rc._sbId; }
}
function rcRowPDF(id) {
  const rc = ratecards.find(id);
  if (rc) rcPrint(_modelFor(rc), _fileTitle(rc.kind === 'brand' ? 'brand' : 'freelance'));
}
function rcExportOpen() {
  const roles = {};
  ratecards.ofKind('role').forEach((r) => { roles[r._sbId] = true; });
  const t = _defaultTerms();
  state._rcExport = { roles, termsId: t ? t._sbId : '' };
  renderRateCards();
}
function rcExportClose() { state._rcExport = null; renderRateCards(); }
function rcExportRole(id, on) { if (state._rcExport) state._rcExport.roles[id] = !!on; }
function rcExportTerms(id) { if (state._rcExport) state._rcExport.termsId = id; }
function rcExportAll() { if (!state._rcExport) return; ratecards.ofKind('role').forEach((r) => { state._rcExport.roles[r._sbId] = true; }); renderRateCards(); }
function rcExportGo() {
  const pick = state._rcExport;
  if (!pick) return;
  const roles = ratecards.ofKind('role').filter((r) => pick.roles[r._sbId]);
  if (!roles.length) { showToast('Pick at least one role'); return; }
  const terms = pick.termsId ? ratecards.find(pick.termsId) : null;
  rcPrint(rcFreelanceModel(roles, terms), _fileTitle('freelance'));
}

/* ============================================================
   EDITOR
   ============================================================ */
const _in = (path, value, placeholder, cls, type) =>
  `<input type="${type || 'text'}" class="${cls || ''}" value="${_esc(value == null ? '' : value)}" placeholder="${_esc(placeholder || '')}" data-input="rcField" data-input-args="${_args(path, '$value')}">`;
const _ta = (path, value, placeholder, rows) =>
  `<textarea rows="${rows || 2}" placeholder="${_esc(placeholder || '')}" data-input="rcField" data-input-args="${_args(path, '$value')}">${_esc(value || '')}</textarea>`;

function _itemsEditor(items, base) {
  return `<div class="rc-items">${items.map((it, i) => {
    const p = base + '.' + i;
    return `
    <div class="rc-item">
      <div class="rc-item-main">
        ${_in(p + '.name', it.name, 'Line (e.g. Day rate)', 'rc-item-name')}
        ${_in(p + '.detail', it.detail, 'Detail (optional)', 'rc-item-detail')}
      </div>
      <div class="rc-item-price">
        ${_in(p + '.price', it.price, it.display === 'request' ? 'n/a' : (it.unit === 'pct' || it.unit === 'pct30d' ? '%' : '$'), 'pv-field', 'number')}
        <select data-change="rcSelect" data-change-args="${_args(p + '.unit', '$value')}">${Object.keys(RC_UNITS).map((k) => `<option value="${k}" ${it.unit === k ? 'selected' : ''}>${RC_UNITS[k].label}</option>`).join('')}</select>
        <select data-change="rcSelect" data-change-args="${_args(p + '.display', '$value')}">${Object.keys(RC_DISPLAY).map((k) => `<option value="${k}" ${it.display === k ? 'selected' : ''}>${RC_DISPLAY[k]}</option>`).join('')}</select>
        <button class="btn btn-sm rc-x" title="Remove line" data-action="rcRemove" data-args="${_args(base, i)}">×</button>
      </div>
    </div>`;
  }).join('')}
  </div>
  <button class="btn btn-sm" data-action="rcAddItem" data-args="${_args(base)}">+ Line</button>`;
}
function _rowsEditor(rows, base, title) {
  return `<div class="inv-section-label">${title}</div>
  <div class="rc-terms">${rows.map((t, i) => `
    <div class="rc-term-row">
      ${_in(base + '.' + i + '.label', t.label, 'Label', 'rc-term-label')}
      ${_ta(base + '.' + i + '.text', t.text, t.hint || 'Leave blank to keep it off the PDF', 2)}
      <button class="btn btn-sm rc-x" title="Remove" data-action="rcRemove" data-args="${_args(base, i)}">×</button>
    </div>`).join('')}
  </div>
  <button class="btn btn-sm" data-action="rcAddRow" data-args="${_args(base)}">+ Row</button>`;
}

function renderRateCardEditor() {
  const container = document.getElementById('view-ratecards');
  const d = state._rc;
  if (!container || !d) return;
  const c = d.content;
  let form = '';

  if (d.kind === 'brand') {
    const show = c.show || {};
    const chk = (k, label) => `<label class="rc-check"><input type="checkbox" ${show[k] ? 'checked' : ''} data-change="rcCheck" data-change-args="${_args('content.show.' + k, '$checked')}"> ${label}</label>`;
    const igEng = (state.CREATOR.platforms.instagram || {}).engagement || '';
    form = `
      <div class="inv-section-label">On the page</div>
      <div class="form-row">
        <div class="form-group"><label>Title</label>${_in('content.headline', c.headline, 'Rates')}</div>
        <div class="form-group"><label>Valid through</label><input type="date" value="${_esc(c.validUntil || '')}" data-change="rcSelect" data-change-args="${_args('content.validUntil', '$value')}"></div>
      </div>
      <div class="form-group"><label>Line under your name</label>${_in('content.tagline', c.tagline, (state.CREATOR.niche || 'e.g. Visual creator · Editing education') + (state.CREATOR.niche ? ' (from your profile)' : ''))}</div>
      <div class="form-group"><label>Intro line (optional)</label>${_ta('content.intro', c.intro, 'One line on what you make and who it works for', 2)}</div>

      <div class="inv-section-label">Metrics</div>
      <div class="rc-checks">
        ${chk('platforms', 'Followers per platform')}
        ${chk('engagement', 'Engagement rate')}
        ${chk('demographics', 'Audience demographics')}
        ${chk('fit', 'Brand fit (from Settings)')}
        <label class="rc-check"><input type="checkbox" ${show.about !== false ? 'checked' : ''} data-change="rcCheck" data-change-args="${_args('content.show.about', '$checked')}"> About section (shared)</label>
      </div>
      <div class="form-group"><label>Engagement rate</label>${_in('content.engagementRate', c.engagementRate, igEng ? 'Blank uses Instagram: ' + igEng : 'e.g. 23.7%')}</div>
      <p class="inv-help">Followers come from Settings → Platforms, demographics from your audience data.</p>

      ${(c.sections || []).map((s, si) => `
        <div class="rc-section">
          <div class="rc-section-head">
            ${_in('content.sections.' + si + '.title', s.title, 'Section title', 'rc-section-title')}
            <button class="btn btn-sm rc-x" title="Remove section" data-action="rcRemove" data-args="${_args('content.sections', si)}">×</button>
          </div>
          ${_itemsEditor(s.items || [], 'content.sections.' + si + '.items')}
        </div>`).join('')}
      <button class="btn" data-action="rcAddSection">+ Section</button>

      ${_rowsEditor(c.terms || [], 'content.terms', 'Terms')}`;
  } else if (d.kind === 'role') {
    form = `
      <div class="inv-section-label">Role</div>
      <div class="form-group"><label>Heading on the PDF</label>${_in('content.title', c.title, 'e.g. Editing')}</div>
      <div class="form-group"><label>One line under it (optional)</label>${_in('content.summary', c.summary, 'e.g. Post-production on supplied or shot footage.')}</div>
      <div class="inv-section-label">Rates</div>
      ${_itemsEditor(c.items || [], 'content.items')}
      <p class="inv-help">The preview pairs this role with your first terms preset. Combine roles from the list with Export combined PDF.</p>`;
  } else if (d.kind === 'terms') {
    form = `
      <div class="inv-section-label">On the page</div>
      <div class="form-row">
        <div class="form-group"><label>Title</label>${_in('content.headline', c.headline, 'Rates')}</div>
        <div class="form-group"><label>Valid through</label><input type="date" value="${_esc(c.validUntil || '')}" data-change="rcSelect" data-change-args="${_args('content.validUntil', '$value')}"></div>
      </div>
      <div class="form-group"><label>Line under your name</label>${_in('content.tagline', c.tagline, (state.CREATOR.niche || 'e.g. Director · Editor · Motion design') + (state.CREATOR.niche ? ' (from your profile)' : ''))}</div>
      <div class="form-group"><label>Intro line (optional)</label>${_ta('content.intro', c.intro, 'e.g. Director and editor for social-first brand films.', 2)}</div>
      <label class="rc-check"><input type="checkbox" ${c.showAbout !== false ? 'checked' : ''} data-change="rcCheck" data-change-args="${_args('content.showAbout', '$checked')}"> Show the About section (shared, edit it from the Rate Cards list)</label>
      ${(c.profile || []).length && !_aboutPreset() ? _rowsEditor(c.profile, 'content.profile', 'About you (this preset only)') : ''}
      ${_rowsEditor(c.terms || [], 'content.terms', 'Terms')}
      <p class="inv-help">The preview shows every role preset with these terms.</p>`;
  } else if (d.kind === 'about') {
    form = `
      <p class="inv-help">One About section for every rate card, brand and freelance. Rows left blank stay off the PDF; each card can hide the whole section.</p>
      ${_rowsEditor(c.rows || [], 'content.rows', 'About')}`;
  }

  const unpriced = _unpricedCount(c);
  container.innerHTML = `
    <div class="view-header">
      <div>
        <button class="btn btn-sm" data-action="rcBack" style="margin-bottom:8px">← Rate Cards</button>
        <h1 class="view-title">${_esc(d.name || RC_KIND_LABEL[d.kind])} <span class="rc-kind">${_esc(d.kind === 'role' ? (RC_ROLES[d.role] || 'Role') : RC_KIND_LABEL[d.kind])}</span></h1>
      </div>
      <div class="gap-row">
        ${d.kind === 'brand' || d.kind === 'role' ? '<button class="btn" data-action="rcDownload">Download PDF</button>' : ''}
        ${d.kind !== 'about' ? '<button class="btn" data-action="rcDuplicate">Duplicate</button>' : ''}
        <button class="btn btn-primary" data-action="rcSave">Save</button>
      </div>
    </div>

    <div class="inv-editor">
      <div class="inv-form-panel">
        ${d.kind === 'about' ? '' : `<div class="form-group">
          <label>Preset name (private, never printed)</label>
          ${_in('name', d.name, 'e.g. Brand: AI tools')}
        </div>`}
        <div id="rcUnpriced" class="rc-warn" ${unpriced ? '' : 'hidden'}>${_unpricedText(unpriced)}</div>
        ${form}
        <button class="btn inv-delete-btn" data-action="rcDelete">${state._rcConfirmDelete === state._rcOpenId ? 'Click again to delete' : 'Delete preset'}</button>
      </div>
      <div class="inv-preview-pane">
        <div id="rcDocPreview">${_previewHtml()}</div>
      </div>
    </div>`;
}

function _unpricedText(n) { return n + (n === 1 ? ' line has' : ' lines have') + ' no price yet and will stay off the PDF.'; }
function _previewHtml() {
  const d = state._rc;
  const rc = { _sbId: state._rcOpenId, kind: d.kind, role: d.role, name: d.name, content: d.content };
  let model;
  if (d.kind === 'brand') model = rcBrandModel(d.content);
  else if (d.kind === 'role') model = rcFreelanceModel([rc], _defaultTerms());
  else if (d.kind === 'about') model = (ratecards.ofKind('brand')[0] && !ratecards.ofKind('role').length) ? rcBrandModel(ratecards.ofKind('brand')[0].content) : rcFreelanceModel(ratecards.ofKind('role'), _defaultTerms());
  else model = rcFreelanceModel(ratecards.ofKind('role'), rc);
  return renderRateDoc(model, isPrivate());
}
function _refreshPreview() {
  const el = document.getElementById('rcDocPreview');
  if (el) el.innerHTML = _previewHtml();
  const w = document.getElementById('rcUnpriced');
  if (w) { const n = _unpricedCount(state._rc.content); w.hidden = !n; w.textContent = n ? _unpricedText(n) : ''; }
}

/* ---- EDITOR ACTIONS ---- */
// path is dotted from the draft root: "content.sections.0.items.2.price"
function _walk(path) {
  const keys = path.split('.');
  let o = state._rc;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o == null) return null;
    o = o[keys[i]];
  }
  return o == null ? null : { obj: o, key: keys[keys.length - 1] };
}
function _set(path, value) {
  if (!state._rc) return false;
  const w = _walk(path);
  if (!w) return false;
  if (w.key === 'price') {
    const n = parseFloat(value);
    value = value === '' || isNaN(n) ? null : Math.max(0, n);
  }
  w.obj[w.key] = value;
  state._rcDirty = true;
  return true;
}
function rcField(path, value) { if (_set(path, value)) _refreshPreview(); }
// Selects and checkboxes can change what the form shows (price placeholder)
function rcSelect(path, value) { if (_set(path, value)) renderRateCardEditor(); }
function rcCheck(path, on) { if (_set(path, !!on)) _refreshPreview(); }
function _list(path) { const w = _walk(path + '.x'); return w && Array.isArray(w.obj) ? w.obj : null; }
function rcAddItem(path) { const l = _list(path); if (!l) return; l.push(I('', '', 'none')); state._rcDirty = true; renderRateCardEditor(); }
function rcAddRow(path) { const l = _list(path); if (!l) return; l.push(T('', '')); state._rcDirty = true; renderRateCardEditor(); }
function rcAddSection() { const c = state._rc && state._rc.content; if (!c) return; (c.sections = c.sections || []).push({ title: '', items: [I('', '', 'none')] }); state._rcDirty = true; renderRateCardEditor(); }
function rcRemove(path, idx) { const l = _list(path); if (!l) return; l.splice(idx, 1); state._rcDirty = true; renderRateCardEditor(); }
async function rcSave() {
  const id = state._rcOpenId;
  const d = state._rc;
  if (!id || !d) return;
  if (!d.name.trim()) d.name = RC_KIND_LABEL[d.kind];
  const ok = await ratecards.save(id, { name: d.name.trim(), content: d.content });
  if (ok && state._rc === d) state._rcDirty = false;
}
function rcBack() { location.hash = 'ratecards'; }
function rcDownload() {
  const d = state._rc;
  if (!d) return;
  rcPrint(d.kind === 'brand' ? rcBrandModel(d.content) : rcFreelanceModel([{ role: d.role, content: d.content }], _defaultTerms()), _fileTitle(d.kind === 'brand' ? 'brand' : 'freelance'));
}
// Delete asks twice: the first click arms the button, the second deletes
async function rcDelete() {
  const id = state._rcOpenId;
  if (state._rcConfirmDelete !== id) { state._rcConfirmDelete = id; renderRateCardEditor(); return; }
  state._rcDirty = false;
  state._rcConfirmDelete = null;
  const ok = await ratecards.remove(id);
  if (ok) { state._rcOpenId = null; state._rc = null; location.hash = 'ratecards'; renderRateCards(); }
}
async function rcRowDelete(id) {
  if (state._rcConfirmDelete !== id) { state._rcConfirmDelete = id; renderRateCards(); return; }
  state._rcConfirmDelete = null;
  if (state._rcExport) delete state._rcExport.roles[id];
  if (state._rcExport && state._rcExport.termsId === id) state._rcExport.termsId = '';
  if (await ratecards.remove(id)) showToast('Preset deleted');
}

act({ rcAddItem, rcAddRow, rcAddSection, rcBack, rcCheck, rcDelete, rcDownload, rcDuplicate, rcExportAll, rcExportClose, rcExportGo, rcExportOpen, rcExportRole, rcExportTerms, rcField, rcNew, rcOpen, rcRemove, rcRowDelete, rcRowPDF, rcSave, rcSelect });

export { RC_UNITS, _aboutTemplate, _brandTemplate, _termsTemplate, ROLE_TEMPLATES, _prints, rcBrandModel, rcFreelanceModel, rcPrice, renderRateCardEditor, renderRateCards, renderRateDoc, unmountRateCards };
