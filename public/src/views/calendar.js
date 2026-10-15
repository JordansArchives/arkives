// Arkives — Content calendar view.
import { state } from '../state.js';
import { _args, act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { _showSaveError, _showSaveSuccess } from '../lib/toast.js';
import { isPrivate, pv } from '../lib/privacy.js';
import { _shortDay, _shortMonth, _slug } from './dashboard.js';
import { _localISODate } from './tasks.js';
import { db } from '../lib/sb.js';

/* ---- Google Calendar overlay (worker/google.js) ----
   Google events are fetched live per month and never stored in Arkives.
   Events Arkives itself pushed to Google are skipped (the Arkives row
   already shows them). */
const _gcalLoading = new Set();

function _monthKey(y, m) { return y + '-' + String(m + 1).padStart(2, '0'); }

function _isoLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Google event -> the local dates it covers (all-day end is exclusive)
function _gcalDates(e) {
  if (e.allDay) {
    const out = [];
    const d = new Date(e.start + 'T00:00:00');
    const end = new Date((e.end || e.start) + 'T00:00:00');
    for (let i = 0; i < 31 && (i === 0 || d < end); i++) { out.push(_isoLocal(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  const t = new Date(e.start);
  return isNaN(t) ? [] : [_isoLocal(t)];
}

function _gcalTime(e) {
  if (e.allDay) return '';
  const t = new Date(e.start);
  return isNaN(t) ? '' : t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(' ', '').toLowerCase();
}

async function _loadGoogleMonth(y, m) {
  if (state.GOOGLE === undefined) await db.sbGoogleStatus();
  if (!state.GOOGLE || state.GOOGLE.status !== 'active') return;
  const key = _monthKey(y, m);
  if (state.GCAL_EVENTS[key] || _gcalLoading.has(key)) return;
  _gcalLoading.add(key);
  const out = await db.sbGoogleEvents(new Date(y, m, 1).toISOString(), new Date(y, m + 1, 1).toISOString());
  _gcalLoading.delete(key);
  if (out && out.ok) {
    state.GCAL_EVENTS[key] = (out.events || []).filter(e => !e.arkives);
    state._gcalError = '';
  } else {
    state._gcalError = out && out.error === 'reconnect' ? 'reconnect' : 'unavailable';
    if (out && out.error === 'reconnect' && state.GOOGLE) state.GOOGLE.status = 'revoked';
  }
  // Repaint only if the user is still looking at that month
  if (document.getElementById('view-calendar')?.offsetParent && state._calendarYear === y && state._calendarMonth === m) renderCalendar();
}

function _googleConnected() { return !!(state.GOOGLE && state.GOOGLE.status === 'active'); }


function renderCalendar() {
  const container = document.getElementById("view-calendar");

  const now = new Date();
  const monthDate = new Date(state._calendarYear, state._calendarMonth, 1);
  const monthName = monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const startDay = new Date(state._calendarYear, state._calendarMonth, 1).getDay(); // 0-6
  const daysInMonth = new Date(state._calendarYear, state._calendarMonth + 1, 0).getDate();

  // Group events by date string
  const eventsByDate = {};
  (state.CALENDAR_EVENTS || []).forEach(e => {
    if (!e.date) return;
    (eventsByDate[e.date] = eventsByDate[e.date] || []).push(e);
  });

  // Google events for this month (fetched in the background, then repainted)
  const gByDate = {};
  const gMonth = state.GCAL_EVENTS[_monthKey(state._calendarYear, state._calendarMonth)] || [];
  gMonth.forEach(e => _gcalDates(e).forEach(d => { (gByDate[d] = gByDate[d] || []).push(e); }));
  _loadGoogleMonth(state._calendarYear, state._calendarMonth);

  // Build 6-week grid (42 cells)
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ empty: true });
    } else {
      const iso = `${state._calendarYear}-${String(state._calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const isToday = (dayNum === now.getDate() && state._calendarMonth === now.getMonth() && state._calendarYear === now.getFullYear());
      cells.push({ day: dayNum, iso, isToday, events: eventsByDate[iso] || [], gevents: gByDate[iso] || [] });
    }
  }

  // Split into weeks (6 rows of 7)
  const weeks = [];
  for (let i = 0; i < 6; i++) weeks.push(cells.slice(i*7, i*7+7));

  // Upcoming list
  const today = _localISODate();
  const nowMs = Date.now();
  const gUpcoming = Object.values(state.GCAL_EVENTS).flat()
    .filter(e => e.allDay ? (e.end || e.start) > today : Date.parse(e.end || e.start) >= nowMs)
    .map(e => ({ google: e, date: _gcalDates(e)[0] || '' }));
  const upcoming = [...(state.CALENDAR_EVENTS || []).filter(e => e.date && e.date >= today), ...gUpcoming]
    .filter((e, i, all) => !e.google || all.findIndex(x => x.google && x.google.id === e.google.id) === i)
    .sort((a,b) => (a.date + (a.google ? a.google.start : '')).localeCompare(b.date + (b.google ? b.google.start : '')))
    .slice(0, 12);
  const gStatus = _googleConnected()
    ? (state._gcalError === 'unavailable' ? '<span class="cal-gstatus">Google Calendar unavailable right now</span>' : '<span class="cal-gstatus"><span class="cal-gdot" aria-hidden="true"></span>Google Calendar</span>')
    : (state.GOOGLE === undefined ? '' : `<button class="btn btn-secondary btn-sm" data-action="openGoogleSettings">${state.GOOGLE && state.GOOGLE.status === 'revoked' ? 'Reconnect' : 'Connect'} Google Calendar</button>`);

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Content Calendar</h1>
        <p class="view-subtitle">Publishing schedule and deal deliverables</p>
      </div>
      <div class="view-header-actions">
        <button class="btn btn-primary" data-action="openAddEventModal">+ Add Event</button>
      </div>
    </div>

    <div class="calendar-container">
      <div class="calendar-main">
        <div class="calendar-toolbar">
          <button class="btn-icon" data-action="calendarPrev" title="Previous month">‹</button>
          <h2 class="calendar-month-title">${monthName}</h2>
          <button class="btn-icon" data-action="calendarNext" title="Next month">›</button>
          <button class="btn btn-secondary btn-sm" data-action="calendarToday">Today</button>
          ${gStatus}
        </div>

        <div class="calendar-grid">
          <div class="calendar-weekdays">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          ${weeks.map(week => `
            <div class="calendar-week">
              ${week.map(cell => cell.empty ? '<div class="calendar-cell empty"></div>' :
                `<div class="calendar-cell ${cell.isToday ? 'is-today' : ''}" data-action="openAddEventModal" data-args="${_args(cell.iso)}">
                  <div class="calendar-day-num">${cell.day}</div>
                  ${cell.events.slice(0, 3).map(e => `
                    <div class="calendar-event status-${_slug(e.status || 'draft')}" title="${isPrivate() ? _esc(e.type) : _esc(e.brand) + ' — ' + _esc(e.type)}">
                      ${pv(_esc(e.brand || 'Event'))}
                    </div>
                  `).join('')}
                  ${cell.gevents.slice(0, Math.max(0, 3 - cell.events.length)).map(e => `
                    <div class="calendar-event gcal" data-action="openGoogleEvent" data-args="${_args(e.link)}" title="${isPrivate() ? '' : _esc(e.title)}">
                      ${_gcalTime(e) ? `<span class="gcal-time">${_esc(_gcalTime(e))}</span> ` : ''}${pv(_esc(e.title))}
                    </div>
                  `).join('')}
                  ${cell.events.length + cell.gevents.length > 3 ? `<div class="calendar-more">+${cell.events.length + cell.gevents.length - 3} more</div>` : ''}
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
        ` : upcoming.map(e => e.google ? `
          <div class="upcoming-item upcoming-gcal">
            <div class="upcoming-date">
              <span class="upcoming-month">${_shortMonth(e.date)}</span>
              <span class="upcoming-day">${_shortDay(e.date)}</span>
            </div>
            <div class="upcoming-body">
              <div class="upcoming-brand">${pv(_esc(e.google.title))}</div>
              <div class="upcoming-meta">Google Calendar${_gcalTime(e.google) ? ' · ' + _esc(_gcalTime(e.google)) : ''}</div>
            </div>
            <div class="upcoming-actions">
              ${e.google.meet ? `<button class="btn btn-secondary btn-sm" data-action="openGoogleEvent" data-args="${_args(e.google.meet)}">Join</button>` : ''}
              ${e.google.link ? `<button class="btn-icon" data-action="openGoogleEvent" data-args="${_args(e.google.link)}" title="Open in Google Calendar">↗</button>` : ''}
            </div>
          </div>
        ` : `
          <div class="upcoming-item" data-id="${e._sbId || ''}">
            <div class="upcoming-date">
              <span class="upcoming-month">${_shortMonth(e.date)}</span>
              <span class="upcoming-day">${_shortDay(e.date)}</span>
            </div>
            <div class="upcoming-body">
              <div class="upcoming-brand">${pv(_esc(e.brand || 'Event'))}</div>
              <div class="upcoming-meta">${_esc(e.type || '')}${e.platform ? ' · ' + _esc(e.platform) : ''}</div>
            </div>
            <div class="upcoming-actions">
              <button class="btn-icon btn-danger" data-action="deleteCalendarEvent" data-args="${_args(e._sbId)}" title="Delete">×</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  _ensureCalendarModal();
}

// The modal lives on <body>: .main is a lower stacking context than the
// sidebar, so an overlay rendered inside a view can never cover it.
function _ensureCalendarModal() {
  if (document.getElementById('addEventModal')) return;
  var host = document.createElement('div');
  host.id = 'calendarModalHost';
  host.innerHTML = `
    <div class="modal-overlay" id="addEventModal" style="display:none;" data-action="closeAddEventModal" data-args="[&quot;$event&quot;,&quot;$el&quot;]">
      <div class="modal-card" data-action="stop" data-args="[&quot;$event&quot;]">
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
        <div class="form-group" id="evGoogleRow" style="display:none;">
          <label class="checkbox-label"><input type="checkbox" id="evGoogle"> Also add to Google Calendar</label>
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
          <button class="btn btn-secondary" data-action="closeAddEventModal">Cancel</button>
          <button class="btn btn-primary" data-action="saveCalendarEvent">Save Event</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(host);
}

function calendarPrev() {
  state._calendarMonth--;
  if (state._calendarMonth < 0) { state._calendarMonth = 11; state._calendarYear--; }
  renderCalendar();
}
function calendarNext() {
  state._calendarMonth++;
  if (state._calendarMonth > 11) { state._calendarMonth = 0; state._calendarYear++; }
  renderCalendar();
}
function calendarToday() {
  const n = new Date();
  state._calendarMonth = n.getMonth();
  state._calendarYear = n.getFullYear();
  renderCalendar();
}

function openAddEventModal(prefillDate) {
  const modal = document.getElementById('addEventModal');
  if (!modal) return;
  document.getElementById('evDate').value = prefillDate || _localISODate();
  document.getElementById('evBrand').value = '';
  document.getElementById('evType').value = '';
  document.getElementById('evPlatform').value = '';
  document.getElementById('evStatus').value = 'draft';
  document.getElementById('evGoogleRow').style.display = _googleConnected() ? '' : 'none';
  document.getElementById('evGoogle').checked = false;
  modal.style.display = 'flex';
}
function closeAddEventModal(event, el) {
  if (event && event.target !== (el || event.currentTarget)) return;
  const m = document.getElementById('addEventModal');
  if (m) m.style.display = 'none';
}

async function saveCalendarEvent() {
  if (!state._sb || !state.CREATOR?._sbId) { _showSaveError('Not connected'); return; }
  const date = document.getElementById('evDate').value;
  const brand = document.getElementById('evBrand').value.trim();
  const type = document.getElementById('evType').value.trim();
  const platform = document.getElementById('evPlatform').value.trim();
  const status = document.getElementById('evStatus').value;
  if (!date || !brand) { _showSaveError('Date and brand are required'); return; }

  const { data, error } = await state._sb.from('calendar_events').insert({
    user_id: state.CREATOR._sbId, date, brand, type, platform, status
  }).select().single();
  if (error) { _showSaveError('Failed: ' + error.message); return; }
  const ev = { _sbId: data.id, date, brand, type, platform, status, googleEventId: '' };
  state.CALENDAR_EVENTS.push(ev);
  const toGoogle = _googleConnected() && document.getElementById('evGoogle').checked;
  closeAddEventModal();
  renderCalendar();
  if (toGoogle) {
    const out = await db.sbGooglePush({ date, title: brand + (type ? ' · ' + type : ''), details: platform ? 'Platform: ' + platform : '' });
    if (out && out.ok && out.id && await db.sbSetCalendarGoogleId(data.id, out.id)) ev.googleEventId = out.id;
    else { _showSaveError('Saved in Arkives, but could not add it to Google Calendar'); return; }
  }
  _showSaveSuccess();
}

async function deleteCalendarEvent(sbId) {
  if (!state._sb || !sbId) return;
  if (!confirm('Delete this event?')) return;
  const gid = (state.CALENDAR_EVENTS.find(e => e._sbId === sbId) || {}).googleEventId;
  const { error } = await state._sb.from('calendar_events').delete().eq('id', sbId);
  if (error) { _showSaveError('Failed: ' + error.message); return; }
  state.CALENDAR_EVENTS = state.CALENDAR_EVENTS.filter(e => e._sbId !== sbId);
  renderCalendar();
  if (gid) {
    const out = await db.sbGoogleRemove(gid);
    if (!out || !out.ok) { _showSaveError('Deleted in Arkives. Remove it from Google Calendar by hand.'); return; }
  }
  _showSaveSuccess();
}

// Only Google's own https links are ever opened (slimEvent filters them server side too)
function openGoogleEvent(url) {
  if (/^https:\/\/(www\.google\.com\/calendar\/|meet\.google\.com\/)/.test(String(url || ''))) window.open(url, '_blank', 'noopener');
}

function openGoogleSettings() {
  state._settingsTabNext = 'connections';
  window.location.hash = 'settings';
}

act({ calendarNext, calendarPrev, calendarToday, closeAddEventModal, deleteCalendarEvent, openAddEventModal, openGoogleEvent, openGoogleSettings, saveCalendarEvent });

export { _ensureCalendarModal, _gcalDates, calendarNext, calendarPrev, calendarToday, closeAddEventModal, deleteCalendarEvent, openAddEventModal, openGoogleEvent, openGoogleSettings, renderCalendar, saveCalendarEvent };
