// Arkives — Timelines: production schedules for brands. List, editor, the
// brand-facing card (#t/TOKEN, public, no login), PDF and calendar export.
// No pricing anywhere: quotes carry the money.
import { state } from '../state.js';
import { db } from '../lib/sb.js';
import { timelines } from '../stores/timelines.js';
import { _args, act } from '../lib/actions.js';
import { _esc, _safeThumb } from '../lib/esc.js';
import { _showSaveError, showToast } from '../lib/toast.js';
import { SKETCHY_ICONS } from '../lib/icons.js';
import { _localISODate } from './tasks.js';


/* ---- CONSTANTS ---- */
const TL_MIGRATION_MSG = 'Run migrations/028_timelines.sql in Supabase first';
const TL_STEPS_MAX = 60, TL_DAYS_MAX = 60;
const TL_PHASES = [
  { key: 'pre', label: 'Pre-production', blurb: 'Planning the project: the idea, the plan and everything the shoot needs.' },
  { key: 'prod', label: 'Production', blurb: 'Filming: capturing everything the edit needs.' },
  { key: 'post', label: 'Post-production', blurb: 'Editing: shaping the footage into the final piece, with your feedback built in.' },
];
const TL_PHASE = TL_PHASES.reduce((m, p) => { m[p.key] = p; return m; }, {});
const TL_OWNER_EDIT = { you: 'You', brand: 'Brand', both: 'Both' };

// The default production plan. Lengths are business days; on: false = skipped.
const TL_TEMPLATE = [
  ['pre', 'Kickoff call & brief', 'Goals, audience, deliverables and must-haves, agreed in one conversation.', 1, 'both', true],
  ['pre', 'Concept & treatment', 'Creative direction, hooks, references and the look and feel.', 3, 'you', false],
  ['pre', 'Concept feedback', 'You review the concept and sign off on the direction.', 2, 'brand', true],
  ['pre', 'Shot list, script & shoot prep', 'Script, shot list, locations, props and scheduling. Product should arrive by the end of this step.', 5, 'you', false],
  ['prod', 'Shoot day', 'Filming everything on the shot list.', 1, 'you', true],
  ['post', 'First cut', 'A bare-bones assembly: structure, pacing and story, before any polish.', 3, 'you', false],
  ['post', 'Brand review: first cut', 'Your notes on structure and messaging.', 2, 'brand', true],
  ['post', 'Full edit', 'Color, sound, graphics and polish, with your notes applied.', 6, 'you', false],
  ['post', 'Final review & approval', 'Your last look and sign-off.', 2, 'brand', true],
  ['post', 'Final delivery', 'Final files in every agreed format, ready to post.', 1, 'you', true],
  ['post', 'Go live', 'The content goes out.', 1, 'both', true],
];

function _tlId() { return 's' + Math.random().toString(36).slice(2, 10); }
function tlDefaultSteps() {
  return TL_TEMPLATE.map(([phase, name, detail, days, owner, cal]) => ({ id: _tlId(), phase, name, detail, days, owner, cal, on: true }));
}

/* ---- DATES: business days, weekends skipped ---- */
function _tlDate(iso) { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? null : d; }
function _tlIsWeekend(d) { return d.getDay() === 0 || d.getDay() === 6; }
// The date itself if it is a weekday, else the Monday after
function _tlBizStart(d) { const x = new Date(d); while (_tlIsWeekend(x)) x.setDate(x.getDate() + 1); return x; }
// n business days after d (d itself a weekday)
function _tlAddBiz(d, n) {
  const x = new Date(d);
  while (n > 0) { x.setDate(x.getDate() + 1); if (!_tlIsWeekend(x)) n--; }
  return x;
}
function _tlDays(v) { return Math.min(TL_DAYS_MAX, Math.max(1, Math.round(Number(v) || 1))); }

// Steps in schedule order: phase order first, then their order in the list
function _tlOrdered(steps) {
  const rank = { pre: 0, prod: 1, post: 2 };
  return (steps || []).map((s, i) => ({ s, i })).filter(x => x.s && x.s.on !== false && rank[x.s.phase] !== undefined)
    .sort((a, b) => rank[a.s.phase] - rank[b.s.phase] || a.i - b.i).map(x => x.s);
}

// Every date, derived: kickoff + each active step's length, one after another.
// Returns { steps: [{...step, start, end, startIdx, endIdx}], phases, start, end, bizDays }
// where *Idx counts business days from the kickoff (for the Gantt columns).
function tlSchedule(t) {
  const kick = _tlDate(t.kickoffDate || '') || _tlDate(_localISODate());
  let cursor = _tlBizStart(kick);
  let idx = 0;
  const steps = _tlOrdered(t.steps).map((s) => {
    const n = _tlDays(s.days);
    const start = cursor, end = _tlAddBiz(cursor, n - 1);
    const out = { ...s, days: n, start: _localISODate(start), end: _localISODate(end), startIdx: idx, endIdx: idx + n - 1 };
    idx += n;
    cursor = _tlAddBiz(end, 1);
    return out;
  });
  const phases = TL_PHASES.map((p) => {
    const ps = steps.filter(s => s.phase === p.key);
    if (!ps.length) return null;
    return { ...p, steps: ps, start: ps[0].start, end: ps[ps.length - 1].end, startIdx: ps[0].startIdx, endIdx: ps[ps.length - 1].endIdx, bizDays: ps.reduce((n, s) => n + s.days, 0) };
  }).filter(Boolean);
  return {
    steps, phases, bizDays: idx,
    start: steps.length ? steps[0].start : _localISODate(_tlBizStart(kick)),
    end: steps.length ? steps[steps.length - 1].end : _localISODate(_tlBizStart(kick)),
  };
}

const _MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const _DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function _tlShort(iso) { const d = _tlDate(iso); return d ? _MON[d.getMonth()] + ' ' + d.getDate() : ''; }
function _tlDay(iso) { const d = _tlDate(iso); return d ? _DOW[d.getDay()] + ', ' + _MON[d.getMonth()] + ' ' + d.getDate() : ''; }
function tlRange(a, b) {
  if (!a) return '';
  if (a === b) return _tlDay(a);
  const da = _tlDate(a), dbb = _tlDate(b);
  if (da && dbb && da.getMonth() === dbb.getMonth() && da.getFullYear() === dbb.getFullYear()) return _MON[da.getMonth()] + ' ' + da.getDate() + '–' + dbb.getDate();
  return _tlShort(a) + ' – ' + _tlShort(b);
}
function _tlPlural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

// Who owns a step, as the brand reads it
function _tlOwnerLabel(t, owner) {
  if (owner === 'brand') return t.clientName || 'Brand';
  if (owner === 'both') return 'Together';
  return t.fromName || 'Creator';
}

// Where the project is today: { kind: 'before'|'during'|'after', step }
function tlStatus(sched, todayIso) {
  if (!sched.steps.length) return { kind: 'before' };
  const today = todayIso || _localISODate();
  if (today < sched.start) return { kind: 'before' };
  if (today > sched.end) return { kind: 'after' };
  const step = sched.steps.find(s => today <= s.end) || sched.steps[sched.steps.length - 1];
  return { kind: 'during', step };
}

/* ---- CALENDAR EXPORT ---- */
function _tlCompact(iso) { return String(iso).replace(/-/g, ''); }
function _tlNextDay(iso) { const d = _tlDate(iso); d.setDate(d.getDate() + 1); return _localISODate(d); }
function _tlEventTitle(t, s) { return s.name + (t.title ? ' · ' + t.title : ''); }
function _tlEventDetails(t, s) {
  return [s.detail, 'Owner: ' + _tlOwnerLabel(t, s.owner), t.fromName ? 'Production timeline from ' + t.fromName : ''].filter(Boolean).join('\n');
}
// One all-day event in Google Calendar (end date is exclusive)
function tlGoogleUrl(t, s) {
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(_tlEventTitle(t, s))
    + '&dates=' + _tlCompact(s.start) + '/' + _tlCompact(_tlNextDay(s.end))
    + '&details=' + encodeURIComponent(_tlEventDetails(t, s));
}
function _icsText(v) { return String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
// Every calendar-checked step as an .ics file: Google, Apple and Outlook all import it
function tlIcs(t, sched) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Arkives//Timeline//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + _icsText(t.title || 'Production timeline')];
  sched.steps.filter(s => s.cal).forEach((s) => {
    lines.push('BEGIN:VEVENT', 'UID:' + _icsText((t.shareToken || 'tl') + '-' + s.id) + '@arkives.xyz', 'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + _tlCompact(s.start), 'DTEND;VALUE=DATE:' + _tlCompact(_tlNextDay(s.end)),
      'SUMMARY:' + _icsText(_tlEventTitle(t, s)), 'DESCRIPTION:' + _icsText(_tlEventDetails(t, s)), 'TRANSP:TRANSPARENT', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
function _tlDownloadIcs(t) {
  const sched = tlSchedule(t);
  if (!sched.steps.some(s => s.cal)) { showToast('No calendar dates on this timeline'); return; }
  const blob = new Blob([tlIcs(t, sched)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (String(t.title || 'timeline').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'timeline') + '.ics';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function tlShareUrl(t) { return location.origin + location.pathname + '#t/' + t.shareToken; }

/* ============================================================
   THE CARD: what the brand sees (editor preview, link, PDF)
   ============================================================ */
// opts: { live: true } adds the today marker and status line (the link)
function renderTimelineCard(t, opts) {
  const o = opts || {};
  const sched = tlSchedule(t);
  const fromLogo = _safeThumb(t.fromLogo), clientLogo = _safeThumb(t.clientLogo);
  const today = _localISODate();
  const status = o.live ? tlStatus(sched, today) : null;

  const logo = (src, name) => src ? `<img class="tl-logo" src="${_esc(src)}" alt="${_esc(name)}">` : (name ? `<span class="tl-logo-name">${_esc(name)}</span>` : '');
  const brands = (fromLogo || t.fromName || clientLogo || t.clientName) ? `
    <div class="tl-brands">
      ${logo(fromLogo, t.fromName)}
      ${(fromLogo || t.fromName) && (clientLogo || t.clientName) ? '<span class="tl-x" aria-hidden="true">×</span>' : ''}
      ${logo(clientLogo, t.clientName)}
    </div>` : '';

  let statusLine = '';
  if (status && sched.steps.length) {
    const txt = status.kind === 'before' ? 'Kicks off ' + _tlDay(sched.start)
      : status.kind === 'after' ? 'Wrapped ' + _tlDay(sched.end)
      : 'Now: ' + TL_PHASE[status.step.phase].label + ' · ' + status.step.name;
    statusLine = `<p class="tl-status tl-status-${status.kind}"><span class="tl-status-dot"></span>${_esc(txt)}</p>`;
  }

  const empty = !sched.steps.length;
  return `
    <article class="tl-card">
      <header class="tl-head">
        ${brands}
        <p class="tl-eyebrow">Production timeline</p>
        <h2 class="tl-title">${_esc(t.title || 'Untitled project')}</h2>
        ${empty ? '' : `<p class="tl-span">${_esc(tlRange(sched.start, sched.end))} · ${_tlPlural(sched.bizDays, 'business day')} · about ${_tlPlural(Math.max(1, Math.round(sched.bizDays / 5)), 'week')}</p>`}
        ${statusLine}
      </header>
      ${empty ? '<p class="tl-empty">No steps yet.</p>' : _tlCalendar(t, sched, o.live ? today : null) + _tlPhaseCards(t, sched, status)}
      ${t.notes ? `<p class="tl-notes">${_esc(t.notes)}</p>` : ''}
      <p class="tl-foot">Dates count business days and skip weekends. They shift if the kickoff moves or feedback runs long.</p>
    </article>`;
}

// A calendar, Monday to Sunday, every week the project touches. Steps are
// sequential, so each week needs one lane: a step is a strip across its days
// in that week (weekends are never work days, so a strip never crosses one).
function _tlCalendar(t, sched, todayIso) {
  const first = _tlDate(sched.start), last = _tlDate(sched.end);
  const mon = new Date(first); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const dayIdx = (iso) => (_tlDate(iso).getDay() + 6) % 7; // Mon 0 .. Sun 6
  let html = `<div class="tl-cal" role="img" aria-label="${_esc('Calendar: ' + tlRange(sched.start, sched.end))}">`;
  html += '<div class="tl-cal-dows">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, k) => `<span${k > 4 ? ' class="tl-cal-we"' : ''}>${d}</span>`).join('') + '</div>';
  let month = -1;
  for (let wk = new Date(mon); wk <= last; wk.setDate(wk.getDate() + 7)) {
    const days = [];
    for (let k = 0; k < 7; k++) { const d = new Date(wk); d.setDate(d.getDate() + k); days.push(d); }
    // A week belongs to the month its work days fall in (its Monday, or the
    // kickoff in the first week); a heading wherever that month changes
    const owner = days[0] < first ? first : days[0];
    if (owner.getMonth() !== month) {
      month = owner.getMonth();
      html += `<div class="tl-cal-month">${_MON_LONG[month]} ${owner.getFullYear()}</div>`;
    }
    const wkStart = _localISODate(days[0]), wkFri = _localISODate(days[4]);
    html += '<div class="tl-cal-week">';
    days.forEach((d, k) => {
      const iso = _localISODate(d);
      const cls = ['tl-cal-day'];
      if (k > 4) cls.push('tl-cal-we');
      if (iso < sched.start || iso > sched.end) cls.push('tl-cal-out');
      if (iso === todayIso) cls.push('tl-cal-today');
      // The 1st names its month, except in a narrow weekend column
      const label = d.getDate() === 1 && k < 5 ? _MON[d.getMonth()] + ' 1' : String(d.getDate());
      html += `<div class="${cls.join(' ')}" style="grid-column:${k + 1}"><span>${label}</span></div>`;
    });
    sched.steps.forEach((s) => {
      const a = s.start > wkStart ? s.start : wkStart, b = s.end < wkFri ? s.end : wkFri;
      if (a > b) return;
      const cont = a > s.start; // carried over from last week
      const from = dayIdx(a), span = dayIdx(b) - from + 1;
      html += `<div class="tl-cal-seg tl-ph-${s.phase}${s.owner === 'brand' ? ' tl-g-brand' : ''}${cont ? ' tl-cal-cont' : ''}" data-step="${_esc(s.id)}" style="grid-column:${from + 1} / span ${span}" title="${_esc(s.name + ': ' + tlRange(s.start, s.end))}"><span>${_esc(s.name)}</span></div>`;
    });
    html += '</div>';
  }
  html += '</div>';
  html += `<div class="tl-legend">${sched.phases.map(p => `<span><i class="tl-dot tl-ph-${p.key}"></i>${_esc(p.label)}</span>`).join('')}<span><i class="tl-dot tl-dot-brand"></i>Your review</span>${todayIso && todayIso >= sched.start && todayIso <= sched.end ? '<span><i class="tl-dot tl-dot-today"></i>Today</span>' : ''}</div>`;
  return html;
}

function _tlPhaseCards(t, sched, status) {
  const nowId = status && status.kind === 'during' ? status.step.id : null;
  return `<div class="tl-phases">${sched.phases.map((p) => `
    <section class="tl-phase tl-ph-${p.key}">
      <div class="tl-phase-head">
        <h3>${_esc(p.label)}</h3>
        <span>${_esc(tlRange(p.start, p.end))} · ${_tlPlural(p.bizDays, 'day')}</span>
      </div>
      <p class="tl-phase-blurb">${_esc(p.blurb)}</p>
      <ol class="tl-steps">${p.steps.map((s) => `
        <li class="tl-step${s.id === nowId ? ' tl-step-now' : ''}">
          <div class="tl-step-main">
            <strong>${_esc(s.name)}</strong>
            ${s.detail ? `<p>${_esc(s.detail)}</p>` : ''}
          </div>
          <div class="tl-step-meta">
            <span class="tl-when">${_esc(tlRange(s.start, s.end))}</span>
            <span class="tl-owner tl-owner-${_esc(s.owner)}">${_esc(_tlOwnerLabel(t, s.owner))}</span>
            ${s.cal ? `<a class="tl-gcal" href="${_esc(tlGoogleUrl(t, s))}" target="_blank" rel="noopener" title="Add to Google Calendar">+ Google Calendar</a>` : ''}
          </div>
        </li>`).join('')}
      </ol>
    </section>`).join('')}</div>`;
}

/* ============================================================
   LIST
   ============================================================ */
function renderTimelines(sub) {
  if (typeof sub === 'string') _tlApplyRoute(sub);
  if (state._tlEditorOpen) { renderTimelineEditor(); return; }
  const container = document.getElementById('view-timelines');
  if (!container) return;
  const T = state.TIMELINES;

  const setupCard = state._timelinesMigrationMissing ? `
    <div class="tasks-setup-card" style="margin-bottom:20px">
      <h3>One-time setup needed</h3>
      <p>Timelines aren't in Supabase yet. Run <code>migrations/028_timelines.sql</code> in the Supabase SQL editor, then refresh this page.</p>
    </div>` : '';
  const linkT = state._tlLinkFor && timelines.find(state._tlLinkFor);
  const linkBanner = linkT && linkT.status === 'shared' ? `
    <div class="card quote-link-banner">
      <div>
        <strong>${_esc(linkT.title || 'Your timeline')} is live.</strong>
        <span>Send this link to ${_esc(linkT.clientName || 'the brand')}. They can follow the schedule, add dates to their calendar and download a PDF.</span>
      </div>
      <div class="bd-share-linkrow">
        <input type="text" readonly value="${_esc(tlShareUrl(linkT))}">
        <button class="btn btn-primary" data-action="tlCopyLink" data-args="${_args(linkT._sbId)}">Copy</button>
        <button class="btn" data-action="tlDismissLink" aria-label="Dismiss">Done</button>
      </div>
    </div>` : '';

  const rows = T.map((t) => {
    const sched = tlSchedule(t);
    const st = tlStatus(sched);
    const now = t.status !== 'shared' ? 'Draft' : st.kind === 'before' ? 'Upcoming' : st.kind === 'after' ? 'Wrapped' : TL_PHASE[st.step.phase].label;
    return `
      <tr>
        <td><button class="quote-link-btn" data-action="tlOpen" data-args="${_args(t._sbId)}"><strong>${_esc(t.title || 'Untitled project')}</strong></button></td>
        <td>${_esc(t.clientName || '—')}</td>
        <td style="white-space:nowrap">${sched.steps.length ? _esc(tlRange(sched.start, sched.end)) : '—'}</td>
        <td><span class="tl-pill${t.status === 'shared' ? ' tl-pill-live' : ''}">${_esc(now)}</span></td>
        <td class="tl-row-actions">
          ${t.status === 'shared' ? `<button class="btn btn-sm" data-action="tlCopyLink" data-args="${_args(t._sbId)}">Copy link</button>` : ''}
          <button class="btn btn-sm" data-action="tlRowPDF" data-args="${_args(t._sbId)}">PDF</button>
          <button class="btn btn-sm" data-action="tlDuplicate" data-args="${_args(t._sbId)}">Duplicate</button>
          <button class="btn btn-sm" data-action="tlDelete" data-args="${_args(t._sbId)}" aria-label="Delete">${SKETCHY_ICONS.trash || 'Delete'}</button>
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Timelines</h1>
        <p class="view-subtitle">Show brands the whole production, start to delivery.</p>
      </div>
      <div class="gap-row">
        <button class="btn btn-primary" data-action="tlNew">+ New Timeline</button>
      </div>
    </div>
    ${setupCard}
    ${linkBanner}
    <div class="card">
      ${T.length ? `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Project</th><th>Brand</th><th>Dates</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : `<p class="tl-empty">No timelines yet. Start one from your default production plan: every step and length can change per project.</p>`}
    </div>`;
}

function unmountTimelines() { /* nothing body-mounted */ }

/* ---- ROUTING: #timelines, #timelines/new, #timelines/<id> ---- */
function _tlApplyRoute(sub) {
  if (!sub) { state._tlEditorOpen = false; state._tlEditingId = null; state._tl = null; return; }
  if (sub === 'new') {
    if (state._tlEditorOpen && state._tlEditingId === null && state._tl) return; // duplicate set it up
    _tlStartNew();
    return;
  }
  if (state._tlEditorOpen && state._tlEditingId === sub && state._tl) return;
  if (!_tlStartEdit(sub)) { state._tlEditorOpen = false; state._tl = null; }
}

function _tlBlank() {
  const last = state.TIMELINES[0];
  const c = state.CREATOR || {};
  return {
    _sbId: null, title: '', clientName: '', clientLogo: '',
    fromName: (last && last.fromName) || c.entity || c.brand || c.name || '',
    fromLogo: (last && last.fromLogo) || '',
    kickoffDate: _localISODate(_tlBizStart(_tlAddBiz(_tlBizStart(new Date()), 5))),
    steps: tlDefaultSteps(), notes: '', status: 'draft', shareToken: '',
  };
}
function _tlStartNew() { state._tl = _tlBlank(); state._tlEditingId = null; state._tlEditorOpen = true; }
function _tlStartEdit(sbId) {
  const src = timelines.find(sbId);
  if (!src) return false;
  state._tl = JSON.parse(JSON.stringify(src));
  state._tlEditingId = sbId; state._tlEditorOpen = true;
  return true;
}

function tlNew() {
  if (state._timelinesMigrationMissing) { _showSaveError(TL_MIGRATION_MSG); return; }
  _tlStartNew();
  if (location.hash !== '#timelines/new') location.hash = 'timelines/new';
  else renderTimelineEditor();
}
function tlOpen(id) {
  if (!_tlStartEdit(id)) return;
  if (location.hash !== '#timelines/' + id) location.hash = 'timelines/' + id;
  else renderTimelineEditor();
}
function tlBack() {
  state._tlEditorOpen = false; state._tlEditingId = null; state._tl = null;
  if (location.hash !== '#timelines') location.hash = 'timelines';
  else renderTimelines();
}
function tlDuplicate(id) {
  const src = timelines.find(id);
  if (!src) return;
  state._tl = { ...JSON.parse(JSON.stringify(src)), _sbId: null, title: (src.title ? src.title + ' (copy)' : ''), status: 'draft', shareToken: '' };
  state._tl.steps.forEach((s) => { s.id = _tlId(); });
  state._tlEditingId = null; state._tlEditorOpen = true;
  if (location.hash !== '#timelines/new') location.hash = 'timelines/new';
  else renderTimelineEditor();
}
async function tlDelete(id) {
  const t = timelines.find(id);
  if (!t) return;
  if (!confirm('Delete "' + (t.title || 'Untitled project') + '"?' + (t.status === 'shared' ? ' Its link stops working.' : ''))) return;
  if (await timelines.remove(id)) { if (state._tlLinkFor === id) state._tlLinkFor = null; renderTimelines(); }
}
function tlRowPDF(id) { const t = timelines.find(id); if (t) tlPrintDoc(t); }
async function tlCopyLink(id) {
  const t = timelines.find(id);
  if (!t || t.status !== 'shared') return;
  try { await navigator.clipboard.writeText(tlShareUrl(t)); showToast('Timeline link copied'); }
  catch (e) { state._tlLinkFor = id; renderTimelines(); }
}
function tlDismissLink() { state._tlLinkFor = null; renderTimelines(); }

/* ============================================================
   EDITOR
   ============================================================ */
function renderTimelineEditor() {
  const container = document.getElementById('view-timelines');
  const t = state._tl;
  if (!container || !t) return;
  const shared = t.status === 'shared';
  const sched = tlSchedule(t);
  const dateOf = {}; sched.steps.forEach((s) => { dateOf[s.id] = s; });

  const logoField = (key, label, hint) => {
    const src = _safeThumb(t[key]);
    return `
      <div class="form-group">
        <label>${label}</label>
        <div class="tl-logo-field">
          ${src ? `<img class="tl-logo-thumb" src="${_esc(src)}" alt="">` : `<span class="tl-logo-thumb tl-logo-none">${hint}</span>`}
          <label class="btn btn-sm" for="tlLogo_${key}">${src ? 'Replace' : 'Upload'}</label>
          <input type="file" id="tlLogo_${key}" accept="image/png,image/jpeg,image/webp" style="display:none" data-change="tlLogoUpload" data-change-args="${_args('$el', key)}">
          ${src ? `<button class="btn btn-sm" data-action="tlLogoClear" data-args="${_args(key)}">Remove</button>` : ''}
        </div>
      </div>`;
  };

  const phaseEditor = (p) => {
    const rows = t.steps.map((s, i) => ({ s, i })).filter(x => x.s.phase === p.key);
    return `
      <div class="tl-ed-phase tl-ph-${p.key}">
        <div class="tl-ed-phase-head"><span class="tl-dot tl-ph-${p.key}"></span><h3>${p.label}</h3><span class="tl-ed-phase-sum">${(() => { const ph = sched.phases.find(x => x.key === p.key); return ph ? _esc(tlRange(ph.start, ph.end)) + ' · ' + _tlPlural(ph.bizDays, 'day') : 'skipped'; })()}</span></div>
        ${rows.map(({ s, i }, k) => {
          const on = s.on !== false;
          const when = dateOf[s.id];
          return `
          <div class="tl-ed-step${on ? '' : ' tl-ed-off'}">
            <label class="tl-switch" title="${on ? 'Included: click to skip this step' : 'Skipped: click to include'}">
              <input type="checkbox" ${on ? 'checked' : ''} data-change="tlStepOn" data-change-args="${_args(i, '$checked')}" aria-label="Include ${_esc(s.name || 'step')}">
              <span></span>
            </label>
            <div class="tl-ed-step-body">
              <div class="tl-ed-step-row">
                <input type="text" class="tl-ed-name" value="${_esc(s.name)}" maxlength="120" placeholder="Step name" data-input="tlStepField" data-input-args="${_args(i, 'name', '$value')}">
                <label class="tl-ed-days"><input type="number" min="1" max="${TL_DAYS_MAX}" value="${_tlDays(s.days)}" data-change="tlStepField" data-change-args="${_args(i, 'days', '$value')}" aria-label="Business days"><span>days</span></label>
                <select data-change="tlStepField" data-change-args="${_args(i, 'owner', '$value')}" aria-label="Owner">
                  ${Object.keys(TL_OWNER_EDIT).map(k => `<option value="${k}" ${s.owner === k ? 'selected' : ''}>${TL_OWNER_EDIT[k]}</option>`).join('')}
                </select>
                <label class="tl-ed-cal" title="Include in the brand's calendar export"><input type="checkbox" ${s.cal ? 'checked' : ''} data-change="tlStepField" data-change-args="${_args(i, 'cal', '$checked')}"> Calendar</label>
              </div>
              <input type="text" class="tl-ed-detail" value="${_esc(s.detail)}" maxlength="400" placeholder="What happens in this step (the brand sees this)" data-input="tlStepField" data-input-args="${_args(i, 'detail', '$value')}">
              <span class="tl-ed-when">${on && when ? _esc(tlRange(when.start, when.end)) : 'Skipped: not shown to the brand'}</span>
            </div>
            <div class="tl-ed-tools">
              <button type="button" class="sc-block-tool" data-action="tlMoveStep" data-args="${_args(i, -1)}" title="Move up"${k === 0 ? ' disabled' : ''}>${SKETCHY_ICONS.arrowUp}</button>
              <button type="button" class="sc-block-tool" data-action="tlMoveStep" data-args="${_args(i, 1)}" title="Move down"${k === rows.length - 1 ? ' disabled' : ''}>${SKETCHY_ICONS.arrowDown}</button>
              <button type="button" class="sc-block-tool" data-action="tlRemoveStep" data-args="${_args(i)}" title="Delete step">&times;</button>
            </div>
          </div>`;
        }).join('')}
        <button class="btn btn-sm tl-ed-add" data-action="tlAddStep" data-args="${_args(p.key)}">+ Add step</button>
      </div>`;
  };

  container.innerHTML = `
    <div class="view-header">
      <div>
        <button class="btn btn-sm" data-action="tlBack">&larr; Timelines</button>
        <h1 class="view-title" style="margin-top:8px">${_esc(t.title || (state._tlEditingId ? 'Untitled project' : 'New timeline'))} <span class="tl-pill${shared ? ' tl-pill-live' : ''}">${shared ? 'Shared' : 'Draft'}</span></h1>
      </div>
      <div class="gap-row">
        <button class="btn" data-action="tlDownloadPDF">PDF</button>
        <button class="btn" data-action="tlEditorIcs">Calendar file</button>
        ${shared ? '<button class="btn" data-action="tlUnshare">Unshare</button>' : ''}
        <button class="btn" data-action="tlSave">Save</button>
        <button class="btn btn-primary" data-action="tlShare">${shared ? 'Save & copy link' : 'Share link'}</button>
      </div>
    </div>

    <div class="tl-editor">
      <div class="tl-editor-form">
        <div class="card">
          <div class="form-group"><label>Project</label><input type="text" value="${_esc(t.title)}" maxlength="200" placeholder="Fall launch: 3 hero videos" data-input="tlField" data-input-args="${_args('title', '$value')}"></div>
          <div class="tl-two">
            <div class="form-group"><label>Brand</label><input type="text" value="${_esc(t.clientName)}" maxlength="200" placeholder="Brand name" data-input="tlField" data-input-args="${_args('clientName', '$value')}"></div>
            <div class="form-group"><label>Kickoff</label><input type="date" value="${_esc(t.kickoffDate)}" data-change="tlKickoff" data-change-args="${_args('$value')}"></div>
          </div>
          <div class="tl-two">
            ${logoField('clientLogo', 'Brand logo', 'Brand')}
            ${logoField('fromLogo', 'Your logo', 'You')}
          </div>
          <div class="form-group"><label>Your name on the card</label><input type="text" value="${_esc(t.fromName)}" maxlength="200" data-input="tlField" data-input-args="${_args('fromName', '$value')}"></div>
          <div class="form-group"><label>Note to the brand (optional)</label><textarea rows="2" maxlength="2000" placeholder="Anything that affects the dates: holidays, product shipping, usage approvals…" data-input="tlField" data-input-args="${_args('notes', '$value')}">${_esc(t.notes)}</textarea></div>
        </div>
        <div class="card">
          <div class="tl-ed-total"><strong>${_tlPlural(sched.bizDays, 'business day')}</strong> · ${sched.steps.length ? _esc(tlRange(sched.start, sched.end)) : 'no active steps'}</div>
          ${TL_PHASES.map(phaseEditor).join('')}
        </div>
      </div>
      <div class="tl-editor-preview">
        <p class="tl-preview-label">What the brand sees</p>
        <div id="tlPreview">${renderTimelineCard(t)}</div>
      </div>
    </div>`;
}

// Typing updates the draft and the preview, never the inputs (focus stays put)
function _tlRefreshPreview() {
  const el = document.getElementById('tlPreview');
  if (el && state._tl) el.innerHTML = renderTimelineCard(state._tl);
}
function tlField(key, val) {
  if (!state._tl) return;
  state._tl[key] = val;
  _tlRefreshPreview();
}
function tlKickoff(val) { if (!state._tl) return; state._tl.kickoffDate = val || ''; renderTimelineEditor(); }
function tlStepField(i, key, val) {
  const s = state._tl && state._tl.steps[i];
  if (!s) return;
  if (key === 'days') s.days = _tlDays(val);
  else if (key === 'cal') s.cal = !!val;
  else if (key === 'owner') s.owner = TL_OWNER_EDIT[val] ? val : 'you';
  else s[key] = val;
  if (key === 'name' || key === 'detail') _tlRefreshPreview();
  else renderTimelineEditor(); // dates moved
}
function tlStepOn(i, checked) {
  const s = state._tl && state._tl.steps[i];
  if (!s) return;
  s.on = !!checked;
  renderTimelineEditor();
}
function tlAddStep(phase) {
  const t = state._tl;
  if (!t || !TL_PHASE[phase]) return;
  if (t.steps.length >= TL_STEPS_MAX) { _showSaveError('Up to ' + TL_STEPS_MAX + ' steps'); return; }
  // Lands at the end of its phase
  let at = -1;
  t.steps.forEach((s, i) => { if (s.phase === phase) at = i; });
  const step = { id: _tlId(), phase, name: '', detail: '', days: 1, owner: 'you', cal: false, on: true };
  if (at === -1) t.steps.push(step); else t.steps.splice(at + 1, 0, step);
  renderTimelineEditor();
}
// Moves within the step's phase only
function tlMoveStep(i, dir) {
  const t = state._tl;
  if (!t || !t.steps[i]) return;
  const phase = t.steps[i].phase;
  let j = i + dir;
  while (j >= 0 && j < t.steps.length && t.steps[j].phase !== phase) j += dir;
  if (j < 0 || j >= t.steps.length) return;
  const tmp = t.steps[i]; t.steps[i] = t.steps[j]; t.steps[j] = tmp;
  renderTimelineEditor();
}
function tlRemoveStep(i) {
  const t = state._tl;
  if (!t || !t.steps[i]) return;
  const s = t.steps[i];
  if (s.name && !confirm('Delete "' + s.name + '"? To leave it out of this project only, switch it off instead.')) return;
  t.steps.splice(i, 1);
  renderTimelineEditor();
}

/* ---- LOGOS ---- Downscaled in the browser to a small data URL */
function _tlReadLogo(file) {
  return new Promise((resolve) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) { _showSaveError('Use a PNG, JPG or WebP logo'); resolve(''); return; }
    if (file.size > 10 * 1024 * 1024) { _showSaveError('Logo is over 10MB'); resolve(''); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 400 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let url = c.toDataURL('image/png'); // keeps transparency
        if (url.length > 280000) url = c.toDataURL('image/webp', 0.9);
        resolve(_safeThumb(url) && url.length <= 300000 ? url : '');
      };
      img.onerror = () => { _showSaveError('Could not read that image'); resolve(''); };
      img.src = reader.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
async function tlLogoUpload(input, key) {
  const file = input && input.files && input.files[0];
  if (!file || !state._tl) return;
  const url = await _tlReadLogo(file);
  if (url && state._tl) { state._tl[key] = url; renderTimelineEditor(); }
}
function tlLogoClear(key) { if (state._tl) { state._tl[key] = ''; renderTimelineEditor(); } }

/* ---- SAVE / SHARE ---- */
function _tlPayload(t) {
  return {
    title: String(t.title || '').trim(), client_name: String(t.clientName || '').trim(),
    client_logo: _safeThumb(t.clientLogo), from_name: String(t.fromName || '').trim(), from_logo: _safeThumb(t.fromLogo),
    kickoff_date: t.kickoffDate || null, notes: String(t.notes || '').trim(),
    steps: (t.steps || []).slice(0, TL_STEPS_MAX).map((s) => ({
      id: String(s.id || _tlId()), phase: TL_PHASE[s.phase] ? s.phase : 'pre', name: String(s.name || '').trim().slice(0, 120),
      detail: String(s.detail || '').trim().slice(0, 400), days: _tlDays(s.days), owner: TL_OWNER_EDIT[s.owner] ? s.owner : 'you',
      cal: !!s.cal, on: s.on !== false,
    })),
  };
}
async function _tlWrite(extra) {
  if (state._timelinesMigrationMissing) { _showSaveError(TL_MIGRATION_MSG); return null; }
  const t = state._tl;
  if (!t) return null;
  const saved = await timelines.save({ ..._tlPayload(t), ...extra }, state._tlEditingId);
  if (saved && !state._tlEditingId) {
    state._tlEditingId = saved._sbId;
    history.replaceState(null, '', '#timelines/' + saved._sbId);
  }
  if (saved) { state._tl = JSON.parse(JSON.stringify(saved)); }
  return saved;
}
async function tlSave() { if (await _tlWrite({})) renderTimelineEditor(); }
async function tlShare() {
  const t = state._tl;
  if (!t) return;
  if (!String(t.title || '').trim()) { _showSaveError('Give the project a name'); return; }
  if (!t.kickoffDate) { _showSaveError('Pick a kickoff date'); return; }
  if (!tlSchedule(t).steps.length) { _showSaveError('Switch on at least one step'); return; }
  const saved = await _tlWrite({ status: 'shared' });
  if (!saved) return;
  try { await navigator.clipboard.writeText(tlShareUrl(saved)); showToast('Link copied. Send it to the brand.'); }
  catch (e) { state._tlLinkFor = saved._sbId; }
  renderTimelineEditor();
}
async function tlUnshare() {
  if (!state._tl || !state._tlEditingId) return;
  if (!confirm('Take the link down? The brand will see "link not active" until you share again (same link).')) return;
  if (await _tlWrite({ status: 'draft' })) renderTimelineEditor();
}
function tlEditorIcs() { if (state._tl) _tlDownloadIcs(state._tl); }

/* ============================================================
   PDF (browser print -> Save as PDF)
   ============================================================ */
function tlPrintDoc(t) {
  let host = document.getElementById('timelinePrintHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'timelinePrintHost';
    document.body.appendChild(host);
  }
  host.innerHTML = renderTimelineCard(t);
  document.body.classList.add('printing-timeline');
  const done = () => { document.body.classList.remove('printing-timeline'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}
function tlDownloadPDF() { if (state._tl) tlPrintDoc(state._tl); }

/* ============================================================
   THE BRAND PAGE (#t/TOKEN, public, no login)
   ============================================================ */
async function renderPublicTimeline(token) {
  const el = document.getElementById('view-timeline-public');
  if (!el) return;
  state._tlPublicToken = token;
  el.innerHTML = '<div class="tl-public"><div class="skeleton" style="height:480px"></div></div>';
  const data = await db.sbFetchSharedTimeline(token);
  if (state._tlPublicToken !== token) return; // navigated away meanwhile
  state._tlPublic = data ? { ...data, shareToken: token } : data;
  _paintPublicTimeline();
}
function _paintPublicTimeline() {
  const el = document.getElementById('view-timeline-public');
  if (!el) return;
  const t = state._tlPublic;
  if (!t || t._error) {
    document.title = 'Timeline · Arkives';
    el.innerHTML = `
      <div class="tl-public">
        <div class="tl-card tl-missing">
          <h2 class="tl-title">Timeline unavailable</h2>
          <p>${t && t._error ? 'This timeline could not load. Check your connection and refresh the page.' : 'This link is not active. Ask the sender for the current link.'}</p>
        </div>
      </div>`;
    return;
  }
  document.title = (t.title || 'Production timeline') + (t.fromName ? ' · ' + t.fromName : '');
  const hasCal = tlSchedule(t).steps.some(s => s.cal);
  el.innerHTML = `
    <div class="tl-public">
      <div class="quote-public-bar">
        <span>${_esc(t.fromName || 'Production timeline')}</span>
        <div class="gap-row">
          ${hasCal ? '<button class="btn btn-sm" data-action="tlPublicIcs">Add dates to calendar</button>' : ''}
          <button class="btn btn-sm" data-action="tlPublicPDF">Download PDF</button>
        </div>
      </div>
      ${renderTimelineCard(t, { live: true })}
      ${hasCal ? '<p class="tl-cal-hint">"Add dates to calendar" downloads a file that Google Calendar, Apple Calendar and Outlook all open. Or use the Google Calendar link on any single date.</p>' : ''}
    </div>`;
}
function tlPublicPDF() { if (state._tlPublic && !state._tlPublic._error) tlPrintDoc(state._tlPublic); }
function tlPublicIcs() { if (state._tlPublic && !state._tlPublic._error) _tlDownloadIcs(state._tlPublic); }

act({ tlAddStep, tlBack, tlCopyLink, tlDelete, tlDismissLink, tlDownloadPDF, tlDuplicate, tlEditorIcs, tlField, tlKickoff, tlLogoClear, tlLogoUpload, tlMoveStep, tlNew, tlOpen, tlPublicIcs, tlPublicPDF, tlRemoveStep, tlRowPDF, tlSave, tlShare, tlStepField, tlStepOn, tlUnshare });

export { TL_PHASES, TL_TEMPLATE, _tlAddBiz, _tlApplyRoute, _tlBizStart, _tlPayload, renderPublicTimeline, renderTimelineCard, renderTimelineEditor, renderTimelines, tlDefaultSteps, tlGoogleUrl, tlIcs, tlPrintDoc, tlRange, tlSchedule, tlShareUrl, tlStatus, unmountTimelines };
