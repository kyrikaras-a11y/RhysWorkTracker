/**
 * timesheets.js
 * Calendar + list view for logging hours against a job. Entries can be
 * added/edited/deleted here, and later pulled into an invoice from the
 * Job Detail page (see pickerForInvoice below).
 */

let tsViewMode = 'calendar';
let tsCurrentMonth = new Date();

function monthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function monthLabel(d) { return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }); }

Router.register('timesheets', async () => {
  const entries = await Api.get('getTimesheets', { month: monthKey(tsCurrentMonth) }).catch(() => []);
  window._tsEntries = entries;
  return renderTimesheetsPage(entries);
});

function renderTimesheetsPage(entries) {
  return `
    <h1>Timesheets</h1>
    <div class="tab-strip">
      <button data-view="calendar" class="${tsViewMode === 'calendar' ? 'active' : ''}">📅 Calendar</button>
      <button data-view="list" class="${tsViewMode === 'list' ? 'active' : ''}">☰ List</button>
    </div>
    ${tsViewMode === 'calendar' ? renderCalendar(entries) : renderTsList(entries)}
    <button class="fab" id="add-ts-fab">+</button>
  `;
}

// ---------- Calendar view ----------

function renderCalendar(entries) {
  const y = tsCurrentMonth.getFullYear(), m = tsCurrentMonth.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const byDay = {};
  entries.forEach(e => {
    const d = new Date(e['Date']);
    if (isNaN(d)) return;
    const key = d.getDate();
    (byDay[key] = byDay[key] || []).push(e);
  });

  let cells = '';
  for (let i = 0; i < startOffset; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEntries = byDay[day] || [];
    const totalHours = dayEntries.reduce((s, e) => s + (parseFloat(e['Hours']) || 0), 0);
    cells += `
      <div class="cal-cell${dayEntries.length ? ' has-entries' : ''}" data-day="${day}">
        <span class="cal-day-num">${day}</span>
        ${dayEntries.length ? `<span class="cal-hours">${totalHours}h</span>` : ''}
      </div>
    `;
  }

  return `
    <div class="cal-header">
      <button class="icon-btn" id="cal-prev">‹</button>
      <div class="cal-month-label">${monthLabel(tsCurrentMonth)}</div>
      <button class="icon-btn" id="cal-next">›</button>
    </div>
    <div class="cal-grid cal-weekdays">
      ${['S','M','T','W','T','F','S'].map(d => `<div class="cal-weekday">${d}</div>`).join('')}
    </div>
    <div class="cal-grid">${cells}</div>
    <div id="cal-day-detail"></div>
  `;
}

// ---------- List view ----------

function renderTsList(entries) {
  if (!entries.length) return '<div class="empty-state">No timesheet entries this month.</div>';
  const rows = entries.map(e => `
    <div class="list-item" data-ts-id="${e['Timesheet ID']}">
      <div class="li-main">
        <div class="li-title">${formatDate(e['Date'])} · ${escapeHtml(e['Customer Name'] || '')}</div>
        <div class="li-sub">${escapeHtml(e['Job ID'])} — ${escapeHtml(e['Description'] || '')}</div>
      </div>
      <div style="text-align:right">
        <div class="li-amount">${e['Hours']}h</div>
        ${e['Invoiced'] === true || e['Invoiced'] === 'TRUE' ? `<span class="badge badge-paid">Invoiced</span>` : ''}
      </div>
    </div>
  `).join('');
  return `<div id="ts-list">${rows}</div>`;
}

// ---------- Wiring ----------

function wireTimesheetsPage() {
  document.querySelectorAll('.tab-strip button[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      tsViewMode = btn.dataset.view;
      document.getElementById('page-container').innerHTML = renderTimesheetsPage(window._tsEntries || []);
      wireTimesheetsPage();
    });
  });

  const prev = document.getElementById('cal-prev');
  const next = document.getElementById('cal-next');
  if (prev) prev.addEventListener('click', () => shiftMonth(-1));
  if (next) next.addEventListener('click', () => shiftMonth(1));

  document.querySelectorAll('.cal-cell.has-entries').forEach(cell => {
    cell.addEventListener('click', () => showDayDetail(parseInt(cell.dataset.day, 10)));
  });

  document.querySelectorAll('#ts-list .list-item').forEach(item => {
    item.addEventListener('click', () => {
      const entry = (window._tsEntries || []).find(e => e['Timesheet ID'] === item.dataset.tsId);
      if (entry) showTimesheetForm(entry);
    });
  });

  const fab = document.getElementById('add-ts-fab');
  if (fab) fab.addEventListener('click', () => showTimesheetForm(null));
}

async function shiftMonth(delta) {
  tsCurrentMonth = new Date(tsCurrentMonth.getFullYear(), tsCurrentMonth.getMonth() + delta, 1);
  await navigateAndWire('timesheets');
}

function showDayDetail(day) {
  const y = tsCurrentMonth.getFullYear(), m = tsCurrentMonth.getMonth();
  const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayEntries = (window._tsEntries || []).filter(e => {
    const d = new Date(e['Date']);
    return !isNaN(d) && d.getDate() === day;
  });
  const rows = dayEntries.map(e => `
    <div class="list-item" data-ts-id="${e['Timesheet ID']}">
      <div class="li-main">
        <div class="li-title">${escapeHtml(e['Job ID'])} — ${escapeHtml(e['Customer Name'] || '')}</div>
        <div class="li-sub">${escapeHtml(e['Start Time'] || '')} – ${escapeHtml(e['End Time'] || '')} · ${escapeHtml(e['Description'] || '')}</div>
      </div>
      <div class="li-amount">${e['Hours']}h</div>
    </div>
  `).join('');
  const panel = document.getElementById('cal-day-detail');
  panel.innerHTML = `
    <div class="card">
      <h3>${new Date(dateStr).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      ${rows || '<p>No entries.</p>'}
      <button class="btn btn-secondary btn-block" id="add-entry-for-day">+ Add entry for this day</button>
    </div>
  `;
  panel.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('click', () => {
      const entry = dayEntries.find(e => e['Timesheet ID'] === item.dataset.tsId);
      if (entry) showTimesheetForm(entry);
    });
  });
  document.getElementById('add-entry-for-day').addEventListener('click', () => showTimesheetForm(null, dateStr));
}

// ---------- Add / edit form ----------

async function showTimesheetForm(entry, prefillDate) {
  let jobs = [];
  try { jobs = await Api.get('getJobs'); } catch (e) {}
  if (!jobs.length) {
    document.getElementById('page-container').innerHTML = `
      <h1>${entry ? 'Edit' : 'New'} Timesheet Entry</h1>
      <div class="empty-state">Create a job first before logging hours.</div>
      <button class="btn btn-secondary btn-block" onclick="navigateAndWire('jobs')">Go to Jobs</button>
    `;
    return;
  }

  const isInvoiced = entry && (entry['Invoiced'] === true || entry['Invoiced'] === 'TRUE');
  const jobOptions = jobs.map(j =>
    `<option value="${escapeHtml(j['Job ID'])}" ${entry && entry['Job ID'] === j['Job ID'] ? 'selected' : ''}>${escapeHtml(jobDropdownLabel(j))}</option>`
  ).join('');

  let defaultRate = 65;
  let customers = [];
  try {
    const s = await Api.get('getSettings');
    defaultRate = parseFloat(s['Default Hourly Rate']) || 65;
  } catch (e) {}
  try { customers = await Api.get('getCustomers'); } catch (e) {}

  const customerRateById = {};
  customers.forEach(c => {
    if (c['Hourly Rate'] !== '' && c['Hourly Rate'] !== undefined && c['Hourly Rate'] !== null) {
      customerRateById[c['Customer ID']] = parseFloat(c['Hourly Rate']);
    }
  });
  const jobToCustomer = {};
  jobs.forEach(j => { jobToCustomer[j['Job ID']] = j['Customer ID']; });

  function rateForJob(jobId) {
    const custId = jobToCustomer[jobId];
    return customerRateById[custId] !== undefined ? customerRateById[custId] : defaultRate;
  }

  const dateVal = entry ? formatDateForInput(entry['Date']) : (prefillDate || formatDateForInput(new Date()));

  document.getElementById('page-container').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="icon-btn" id="back-to-ts">←</button>
      <h1 style="margin:0">${entry ? 'Edit Entry' : 'New Entry'}</h1>
    </div>
    ${isInvoiced ? `<div class="card"><p>This entry is on invoice <strong>${escapeHtml(entry['Invoice Number'])}</strong> and can't be edited. Remove it from the invoice's line items first if you need to change it.</p></div>` : `
    <form id="ts-form">
      <div class="field"><label>Job</label><select id="ts-job" name="jobId" required>${jobOptions}</select></div>
      <div class="field"><label>Date</label><input name="date" type="date" value="${dateVal}" required /></div>
      <div class="field-row">
        <div class="field"><label>Start Time</label><input id="ts-start" name="startTime" type="time" value="${escapeHtml(entry ? entry['Start Time'] : '')}" /></div>
        <div class="field"><label>End Time</label><input id="ts-end" name="endTime" type="time" value="${escapeHtml(entry ? entry['End Time'] : '')}" /></div>
      </div>
      <div class="card-row"><span class="label">Hours (auto-calculated)</span><span class="value" id="ts-hours-preview">${entry ? entry['Hours'] : '0'}h</span></div>
      <div class="field"><label>Hourly Rate ($)</label><input id="ts-rate" name="hourlyRate" type="number" step="0.01" value="${entry ? entry['Hourly Rate'] : rateForJob(jobs[0] && jobs[0]['Job ID'])}" /></div>
      <div class="field"><label>Description</label><input name="description" value="${escapeHtml(entry ? entry['Description'] : '')}" placeholder="e.g. Site work, install..." /></div>
      <div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(entry ? entry['Notes'] : '')}</textarea></div>
      <button class="btn btn-primary btn-block" type="submit">${entry ? 'Save Changes' : 'Save Entry'}</button>
      <div style="height:10px"></div>
      ${entry ? `<button class="btn btn-danger btn-block" type="button" id="delete-ts-btn">Delete Entry</button><div style="height:10px"></div>` : ''}
      <button class="btn btn-secondary btn-block" type="button" id="cancel-ts-btn">Cancel</button>
    </form>
    `}
  `;

  document.getElementById('back-to-ts').addEventListener('click', () => navigateAndWire('timesheets'));

  if (isInvoiced) return;

  const startInput = document.getElementById('ts-start');
  const endInput = document.getElementById('ts-end');
  const preview = document.getElementById('ts-hours-preview');
  function updatePreview() {
    if (startInput.value && endInput.value) {
      preview.textContent = calcHoursClientSide(startInput.value, endInput.value) + 'h';
    }
  }
  startInput.addEventListener('input', updatePreview);
  endInput.addEventListener('input', updatePreview);

  const jobSelect = document.getElementById('ts-job');
  const rateInput = document.getElementById('ts-rate');
  if (jobSelect && rateInput && !entry) {
    // only auto-update for new entries — don't clobber a rate someone already saved
    jobSelect.addEventListener('change', () => {
      rateInput.value = rateForJob(jobSelect.value);
    });
  }

  document.getElementById('cancel-ts-btn').addEventListener('click', () => navigateAndWire('timesheets'));

  const deleteBtn = document.getElementById('delete-ts-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this timesheet entry?')) return;
      try {
        await Api.post('deleteTimesheetEntry', { timesheetId: entry['Timesheet ID'] });
        Toast.show('Entry deleted');
        navigateAndWire('timesheets');
      } catch (err) {
        Toast.show('Error: ' + err.message);
      }
    });
  }

  document.getElementById('ts-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (entry) {
        data.timesheetId = entry['Timesheet ID'];
        await Api.post('updateTimesheetEntry', data);
        Toast.show('Entry updated');
      } else {
        await Api.post('createTimesheetEntry', data);
        Toast.show('Entry saved');
      }
      navigateAndWire('timesheets');
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  });
}

function calcHoursClientSide(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

function formatDateForInput(val) {
  const d = new Date(val);
  if (isNaN(d)) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ---------- Picker used from Job Detail to add timesheet hours to an invoice ----------

async function showTimesheetPickerForInvoice(jobId) {
  let entries = [];
  try { entries = await Api.get('getUnbilledTimesheetsForJob', { jobId }); } catch (e) {}

  if (!entries.length) {
    document.getElementById('page-container').innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <button class="icon-btn" id="back-to-job">←</button>
        <h1 style="margin:0">Add from Timesheets</h1>
      </div>
      <div class="empty-state">No unbilled timesheet entries for this job.<br>Log hours in Timesheets first.</div>
    `;
    document.getElementById('back-to-job').addEventListener('click', () => showJobDetail(jobId));
    return;
  }

  const totalHours = entries.reduce((s, e) => s + (parseFloat(e['Hours']) || 0), 0);
  const totalAmount = entries.reduce((s, e) => s + (parseFloat(e['Hours']) || 0) * (parseFloat(e['Hourly Rate']) || 0), 0);

  const rows = entries.map(e => `
    <div class="list-item">
      <label style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer">
        <input type="checkbox" class="ts-pick" data-ts-id="${e['Timesheet ID']}" data-hours="${e['Hours']}" data-rate="${e['Hourly Rate']}" data-desc="${escapeHtml(e['Description'] || '')}" data-date="${formatDate(e['Date'])}" checked style="width:20px;height:20px" />
        <div class="li-main" style="flex:1">
          <div class="li-title">${formatDate(e['Date'])} — ${e['Hours']}h</div>
          <div class="li-sub">${escapeHtml(e['Description'] || '')}</div>
        </div>
      </label>
      <label class="ts-show-hours-wrap" style="display:flex;align-items:center;gap:4px;font-size:0.7rem;color:var(--text-muted);white-space:nowrap;cursor:pointer">
        <input type="checkbox" class="ts-show-hours" data-ts-id="${e['Timesheet ID']}" checked style="width:16px;height:16px" />
        Show hrs
      </label>
    </div>
  `).join('');

  document.getElementById('page-container').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="icon-btn" id="back-to-job">←</button>
      <h1 style="margin:0">Add from Timesheets</h1>
    </div>
    <div class="card">${rows}</div>
    <p style="margin-top:-6px">Untick "Show hrs" on any day to bill it as a flat amount instead of hours × rate — handy for a quoted job where you don't want the hours visible for that entry.</p>

    <div class="card">
      <h3>Combine into one line?</h3>
      <div class="field">
        <label><input type="radio" name="ts-mode" value="breakdown" checked /> Keep as separate lines (one per day, using the "Show hrs" setting above)</label>
      </div>
      <div class="field">
        <label><input type="radio" name="ts-mode" value="lumpsum" /> Combine everything into a single lump sum line</label>
      </div>
      <div id="lumpsum-fields" style="display:none">
        <div class="field"><label>Line description</label><input id="lumpsum-desc" value="Labour" /></div>
        <div class="field"><label>Total amount ($)</label><input id="lumpsum-amount" type="number" step="0.01" value="${totalAmount.toFixed(2)}" /></div>
        <p>Suggested total is ${totalHours}h × rate. Edit freely — e.g. enter your quoted price instead.</p>
      </div>
    </div>

    <button class="btn btn-primary btn-block" id="add-selected-btn">Add to Invoice</button>
    <div style="height:10px"></div>
    <button class="btn btn-secondary btn-block" id="cancel-picker-btn">Cancel</button>
  `;

  document.getElementById('back-to-job').addEventListener('click', () => showJobDetail(jobId));
  document.getElementById('cancel-picker-btn').addEventListener('click', () => showJobDetail(jobId));

  document.querySelectorAll('input[name="ts-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isLumpSum = document.querySelector('input[name="ts-mode"]:checked').value === 'lumpsum';
      document.getElementById('lumpsum-fields').style.display = isLumpSum ? 'block' : 'none';
      document.querySelectorAll('.ts-show-hours-wrap').forEach(el => {
        el.style.visibility = isLumpSum ? 'hidden' : 'visible';
      });
    });
  });

  document.getElementById('add-selected-btn').addEventListener('click', () => {
    const checked = Array.from(document.querySelectorAll('.ts-pick:checked'));
    if (!checked.length) { Toast.show('Select at least one entry'); return; }
    const mode = document.querySelector('input[name="ts-mode"]:checked').value;
    const timesheetIds = checked.map(c => c.dataset.tsId);

    const showHoursMap = {};
    document.querySelectorAll('.ts-show-hours').forEach(cb => { showHoursMap[cb.dataset.tsId] = cb.checked; });

    let pendingLines;
    if (mode === 'breakdown') {
      pendingLines = checked.map(c => {
        const showHours = showHoursMap[c.dataset.tsId];
        const label = `${c.dataset.date} — ${c.dataset.desc || 'Labour'}`;
        if (showHours) {
          return { description: label, quantity: c.dataset.hours, unitPrice: c.dataset.rate, sourceType: 'Timesheet', sourceId: c.dataset.tsId };
        }
        const total = (parseFloat(c.dataset.hours) || 0) * (parseFloat(c.dataset.rate) || 0);
        return { description: label, quantity: 1, unitPrice: total.toFixed(2), sourceType: 'Timesheet', sourceId: c.dataset.tsId };
      });
    } else {
      pendingLines = [{
        description: document.getElementById('lumpsum-desc').value || 'Labour',
        quantity: 1,
        unitPrice: document.getElementById('lumpsum-amount').value,
        sourceType: 'Timesheet',
        sourceId: timesheetIds.join(',')
      }];
    }

    window._pendingTimesheetLines = pendingLines;
    showJobDetail(jobId);
  });
}
