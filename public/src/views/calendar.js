// Arkives — Content calendar view.
import { state } from '../state.js';
import { _args, act } from '../lib/actions.js';
import { _esc } from '../lib/esc.js';
import { _showSaveError, _showSaveSuccess } from '../lib/toast.js';
import { _shortDay, _shortMonth, _slug } from './dashboard.js';
import { _localISODate } from './tasks.js';


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

  // Build 6-week grid (42 cells)
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ empty: true });
    } else {
      const iso = `${state._calendarYear}-${String(state._calendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const isToday = (dayNum === now.getDate() && state._calendarMonth === now.getMonth() && state._calendarYear === now.getFullYear());
      cells.push({ day: dayNum, iso, isToday, events: eventsByDate[iso] || [] });
    }
  }

  // Split into weeks (6 rows of 7)
  const weeks = [];
  for (let i = 0; i < 6; i++) weeks.push(cells.slice(i*7, i*7+7));

  // Upcoming list
  const today = _localISODate();
  const upcoming = (state.CALENDAR_EVENTS || [])
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
  state.CALENDAR_EVENTS.push({ _sbId: data.id, date, brand, type, platform, status });
  closeAddEventModal();
  renderCalendar();
  _showSaveSuccess();
}

async function deleteCalendarEvent(sbId) {
  if (!state._sb || !sbId) return;
  if (!confirm('Delete this event?')) return;
  const { error } = await state._sb.from('calendar_events').delete().eq('id', sbId);
  if (error) { _showSaveError('Failed: ' + error.message); return; }
  state.CALENDAR_EVENTS = state.CALENDAR_EVENTS.filter(e => e._sbId !== sbId);
  renderCalendar();
  _showSaveSuccess();
}

act({ calendarNext, calendarPrev, calendarToday, closeAddEventModal, deleteCalendarEvent, openAddEventModal, saveCalendarEvent });

export { _ensureCalendarModal, calendarNext, calendarPrev, calendarToday, closeAddEventModal, deleteCalendarEvent, openAddEventModal, renderCalendar, saveCalendarEvent };
