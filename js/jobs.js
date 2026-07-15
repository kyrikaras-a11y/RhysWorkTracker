/**
 * jobs.js
 * Stage 2 frontend: Jobs & Invoices list, filtering, job detail with
 * invoice line items and payment tracking.
 */

const JOB_STATUSES = ['Quote', 'Approved', 'Scheduled', 'In Progress', 'Complete', 'Invoiced', 'Paid', 'Cancelled'];

function jobBadgeClass(status) {
  const map = {
    'Quote': 'badge-quote', 'Approved': 'badge-approved', 'Scheduled': 'badge-scheduled',
    'In Progress': 'badge-progress', 'Complete': 'badge-complete', 'Invoiced': 'badge-invoiced',
    'Paid': 'badge-paid', 'Cancelled': 'badge-cancelled'
  };
  return map[status] || 'badge-quote';
}

function paymentBadgeClass(status) {
  const map = {
    'Draft': 'badge-draft', 'Sent': 'badge-sent', 'Paid': 'badge-paid',
    'Part Paid': 'badge-part-paid', 'Overdue': 'badge-overdue'
  };
  return map[status] || 'badge-draft';
}

function money(n) {
  const num = parseFloat(n) || 0;
  return '$' + num.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- List view ----------

function renderJobsList(jobs, activeFilter) {
  const filtered = activeFilter === 'All' ? jobs : jobs.filter(j => j['Job Status'] === activeFilter);
  const tabs = ['All', ...JOB_STATUSES].map(s =>
    `<button data-status="${s}" class="${s === activeFilter ? 'active' : ''}">${s}</button>`
  ).join('');

  const rows = filtered.map(j => `
    <div class="list-item" data-job-id="${j['Job ID']}">
      <div class="li-main">
        <div class="li-title">${escapeHtml(j['Customer Name'] || 'Unknown customer')}</div>
        <div class="li-sub">${escapeHtml(j['Job ID'])} · ${escapeHtml(j['Job Address'] || '')}</div>
      </div>
      <div style="text-align:right">
        <div class="li-amount">${money(j['Total Amount'] || j['Quote Amount'])}</div>
        <span class="badge ${jobBadgeClass(j['Job Status'])}">${escapeHtml(j['Job Status'])}</span>
      </div>
    </div>
  `).join('');

  return `
    <h1>Jobs & Invoices</h1>
    <div class="search-bar"><span>🔍</span><input id="job-search" placeholder="Search jobs..." /></div>
    <div class="tab-strip" id="job-status-tabs">${tabs}</div>
    <div id="job-list">${filtered.length ? rows : '<div class="empty-state">No jobs in this view. Tap + to add one.</div>'}</div>
    <button class="fab" id="add-job-fab">+</button>
  `;
}

function wireJobsListPage() {
  const searchInput = document.getElementById('job-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#job-list .list-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }
  document.querySelectorAll('#job-status-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.dataset.status;
      document.getElementById('page-container').innerHTML = renderJobsList(window._jobsCache || [], status);
      wireJobsListPage();
    });
  });
  document.querySelectorAll('#job-list .list-item').forEach(item => {
    item.addEventListener('click', () => showJobDetail(item.dataset.jobId));
  });
  const fab = document.getElementById('add-job-fab');
  if (fab) fab.addEventListener('click', showAddJobForm);
}

// ---------- Add job form ----------

async function showAddJobForm() {
  let customers = [];
  try { customers = await Api.get('getCustomers'); } catch (e) {}

  if (!customers.length) {
    document.getElementById('page-container').innerHTML = `
      <h1>New Job</h1>
      <div class="empty-state">Add a customer first before creating a job.</div>
      <button class="btn btn-secondary btn-block" onclick="navigateAndWire('customers')">Go to Customers</button>
    `;
    return;
  }

  const options = customers.map(c => `<option value="${escapeHtml(c['Customer ID'])}">${escapeHtml(c['Customer Name'])}</option>`).join('');

  document.getElementById('page-container').innerHTML = `
    <h1>New Job</h1>
    <form id="job-form">
      <div class="field"><label>Customer</label><select name="customerId" required>${options}</select></div>
      <div class="field"><label>Job Address</label><textarea name="jobAddress"></textarea></div>
      <div class="field"><label>Job Description</label><textarea name="jobDescription"></textarea></div>
      <div class="field-row">
        <div class="field"><label>Quote Amount ($)</label><input name="quoteAmount" type="number" step="0.01" /></div>
        <div class="field"><label>Status</label>
          <select name="jobStatus">${JOB_STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Start Date</label><input name="startDate" type="date" /></div>
        <div class="field"><label>Completion Date</label><input name="completionDate" type="date" /></div>
      </div>
      <div class="field"><label>Notes</label><textarea name="notes"></textarea></div>
      <button class="btn btn-primary btn-block" type="submit">Save Job</button>
      <div style="height:10px"></div>
      <button class="btn btn-secondary btn-block" type="button" id="cancel-job-btn">Cancel</button>
    </form>
  `;
  document.getElementById('cancel-job-btn').addEventListener('click', () => navigateAndWire('jobs'));
  document.getElementById('job-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await Api.post('createJob', data);
      Toast.show('Job created');
      navigateAndWire('jobs');
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  });
}

// ---------- Job detail ----------

async function showJobDetail(jobId) {
  const container = document.getElementById('page-container');
  container.innerHTML = '<div class="spinner"></div>';
  let job;
  try {
    job = await Api.get('getJob', { id: jobId });
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Couldn't load job.<br><small>${err.message}</small></div>`;
    return;
  }
  container.innerHTML = renderJobDetail(job);
  wireJobDetail(job);

  if (window._pendingTimesheetLines && window._pendingTimesheetLines.length) {
    const tbody = document.getElementById('line-items-body');
    if (tbody) {
      window._pendingTimesheetLines.forEach(line => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><input class="li-desc" value="${escapeHtml(line.description)}" /></td>
          <td style="width:60px"><input class="li-qty" type="number" step="0.01" value="${line.quantity}" /></td>
          <td style="width:90px"><input class="li-price" type="number" step="0.01" value="${line.unitPrice}" /></td>
          <td style="width:34px"><button type="button" class="li-remove">×</button></td>
        `;
        tbody.appendChild(row);
      });
      wireLineItemRemoveButtons();
      Toast.show(`${window._pendingTimesheetLines.length} line(s) added — review and hit Save Line Items`);
    }
    window._pendingTimesheetLines = null;
    // _pendingTimesheetIds is intentionally kept until the save succeeds
  }
}

function renderJobDetail(job) {
  const hasInvoice = !!job['Invoice Number'];
  const lineItems = job._lineItems || [];

  const lineItemRows = lineItems.map((li, i) => `
    <tr data-index="${i}">
      <td><input class="li-desc" value="${escapeHtml(li['Description'] || '')}" placeholder="Description" /></td>
      <td style="width:60px"><input class="li-qty" type="number" step="0.01" value="${li['Quantity'] || 1}" /></td>
      <td style="width:90px"><input class="li-price" type="number" step="0.01" value="${li['Unit Price'] || 0}" /></td>
      <td style="width:34px"><button type="button" class="li-remove">×</button></td>
    </tr>
  `).join('');

  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="icon-btn" id="back-to-jobs" aria-label="Back">←</button>
      <h1 style="margin:0">${escapeHtml(job['Job ID'])}</h1>
    </div>

    <div class="card">
      <div class="card-row"><span class="label">Customer</span><span class="value">${escapeHtml(job['Customer Name'] || '')}</span></div>
      <div class="card-row"><span class="label">Address</span><span class="value">${escapeHtml(job['Job Address'] || '—')}</span></div>
      <div class="card-row"><span class="label">Description</span><span class="value">${escapeHtml(job['Job Description'] || '—')}</span></div>
      <div class="card-row"><span class="label">Quote Amount</span><span class="value">${money(job['Quote Amount'])}</span></div>
      <div class="field" style="margin-top:12px">
        <label>Job Status</label>
        <select id="job-status-select">
          ${JOB_STATUSES.map(s => `<option value="${s}" ${s === job['Job Status'] ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="card">
      <h3>Job Costs</h3>
      <p style="margin-top:4px">Auto-filled from Expenses/Contractors in later stages — editable manually for now.</p>
      <div class="field-row">
        <div class="field"><label>Materials ($)</label><input id="cost-materials" type="number" step="0.01" value="${job['Materials Cost'] || 0}" /></div>
        <div class="field"><label>Contractors ($)</label><input id="cost-contractor" type="number" step="0.01" value="${job['Contractor Cost'] || 0}" /></div>
      </div>
      <div class="field"><label>Other Costs ($)</label><input id="cost-other" type="number" step="0.01" value="${job['Other Job Costs'] || 0}" /></div>
      <button class="btn btn-secondary btn-block" id="save-costs-btn">Save Costs</button>
      <div class="card-row" style="margin-top:10px">
        <span class="label">Job Profit</span>
        <span class="value ${parseFloat(job['Job Profit']) >= 0 ? 'positive' : 'negative'}">${money(job['Job Profit'])} (${job['Job Profit %'] || 0}%)</span>
      </div>
    </div>

    <div class="card">
      <h3>Invoice</h3>
      ${hasInvoice ? `
        <div class="card-row"><span class="label">Invoice Number</span><span class="value">${escapeHtml(job['Invoice Number'])}</span></div>
        <div class="card-row"><span class="label">Due Date</span><span class="value">${formatDate(job['Due Date'])}</span></div>
        <div class="card-row"><span class="label">Payment Status</span><span class="badge ${paymentBadgeClass(job['Payment Status'])}">${escapeHtml(job['Payment Status'] || 'Draft')}</span></div>

        <table class="li-table" id="line-items-table" style="margin-top:12px">
          <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th></th></tr></thead>
          <tbody id="line-items-body">${lineItemRows}</tbody>
        </table>
        <button class="btn btn-secondary btn-block" id="add-line-item-btn" type="button">+ Add Line Item</button>
        <div style="height:10px"></div>
        <button class="btn btn-secondary btn-block" id="add-from-timesheets-btn" type="button">🕒 Add from Timesheets</button>
        <div style="height:10px"></div>
        <button class="btn btn-primary btn-block" id="save-line-items-btn" type="button">Save Line Items</button>

        <div style="margin-top:14px">
          <div class="summary-line"><span>Subtotal</span><span>${money(job['Subtotal'])}</span></div>
          <div class="summary-line"><span>GST</span><span>${money(job['GST'])}</span></div>
          <div class="summary-line total"><span>Total</span><span>${money(job['Total Amount'])}</span></div>
        </div>

        <div style="height:16px"></div>
        <h3>Payment</h3>
        <div class="field"><label>Amount Paid ($)</label><input id="amount-paid" type="number" step="0.01" value="${job['Amount Paid'] || 0}" /></div>
        <div class="field-row">
          <div class="field"><label>Method</label><input id="payment-method" value="${escapeHtml(job['Payment Method'] || '')}" placeholder="Bank transfer, cash..." /></div>
          <div class="field"><label>Reference</label><input id="payment-reference" value="${escapeHtml(job['Payment Reference'] || '')}" /></div>
        </div>
        <div class="card-row"><span class="label">Remaining Balance</span><span class="value">${money(job['Remaining Balance'])}</span></div>
        <button class="btn btn-primary btn-block" id="record-payment-btn">Record Payment</button>

        <p style="margin-top:14px">PDF generation & emailing arrive in Stage 4.</p>
      ` : `
        <p>No invoice yet.</p>
        <button class="btn btn-primary btn-block" id="generate-invoice-btn">Generate Invoice</button>
      `}
    </div>

    <button class="btn btn-danger btn-block" id="delete-job-btn">Delete Job</button>
  `;
}

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString('en-AU');
}

function wireJobDetail(job) {
  document.getElementById('back-to-jobs').addEventListener('click', () => navigateAndWire('jobs'));

  document.getElementById('job-status-select').addEventListener('change', async (e) => {
    try {
      await Api.post('updateJobStatus', { jobId: job['Job ID'], status: e.target.value });
      Toast.show('Status updated');
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  });

  document.getElementById('save-costs-btn').addEventListener('click', async () => {
    try {
      await Api.post('updateJob', {
        jobId: job['Job ID'],
        materialsCost: document.getElementById('cost-materials').value,
        contractorCost: document.getElementById('cost-contractor').value,
        otherJobCosts: document.getElementById('cost-other').value
      });
      Toast.show('Costs saved');
      showJobDetail(job['Job ID']);
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  });

  const genInvoiceBtn = document.getElementById('generate-invoice-btn');
  if (genInvoiceBtn) {
    genInvoiceBtn.addEventListener('click', async () => {
      try {
        await Api.post('generateInvoice', { jobId: job['Job ID'] });
        Toast.show('Invoice generated');
        showJobDetail(job['Job ID']);
      } catch (err) {
        Toast.show('Error: ' + err.message);
      }
    });
  }

  const addLineItemBtn = document.getElementById('add-line-item-btn');
  if (addLineItemBtn) {
    addLineItemBtn.addEventListener('click', () => {
      const tbody = document.getElementById('line-items-body');
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input class="li-desc" placeholder="Description" /></td>
        <td style="width:60px"><input class="li-qty" type="number" step="0.01" value="1" /></td>
        <td style="width:90px"><input class="li-price" type="number" step="0.01" value="0" /></td>
        <td style="width:34px"><button type="button" class="li-remove">×</button></td>
      `;
      tbody.appendChild(row);
      wireLineItemRemoveButtons();
    });
    wireLineItemRemoveButtons();
  }

  const addFromTimesheetsBtn = document.getElementById('add-from-timesheets-btn');
  if (addFromTimesheetsBtn) {
    addFromTimesheetsBtn.addEventListener('click', () => showTimesheetPickerForInvoice(job['Job ID']));
  }

  const saveLineItemsBtn = document.getElementById('save-line-items-btn');
  if (saveLineItemsBtn) {
    saveLineItemsBtn.addEventListener('click', async () => {
      const rows = document.querySelectorAll('#line-items-body tr');
      const lineItems = Array.from(rows).map(row => ({
        description: row.querySelector('.li-desc').value,
        quantity: row.querySelector('.li-qty').value,
        unitPrice: row.querySelector('.li-price').value
      })).filter(li => li.description.trim() !== '');
      const timesheetIds = window._pendingTimesheetIds || [];
      try {
        await Api.post('saveLineItems', { jobId: job['Job ID'], lineItems, timesheetIds });
        window._pendingTimesheetIds = null;
        Toast.show('Line items saved');
        showJobDetail(job['Job ID']);
      } catch (err) {
        Toast.show('Error: ' + err.message);
      }
    });
  }

  const recordPaymentBtn = document.getElementById('record-payment-btn');
  if (recordPaymentBtn) {
    recordPaymentBtn.addEventListener('click', async () => {
      try {
        await Api.post('recordPayment', {
          jobId: job['Job ID'],
          amountPaid: document.getElementById('amount-paid').value,
          paymentMethod: document.getElementById('payment-method').value,
          paymentReference: document.getElementById('payment-reference').value
        });
        Toast.show('Payment recorded');
        showJobDetail(job['Job ID']);
      } catch (err) {
        Toast.show('Error: ' + err.message);
      }
    });
  }

  document.getElementById('delete-job-btn').addEventListener('click', async () => {
    if (!confirm('Delete this job and its line items? This cannot be undone.')) return;
    try {
      await Api.post('deleteJob', { jobId: job['Job ID'] });
      Toast.show('Job deleted');
      navigateAndWire('jobs');
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  });
}

function wireLineItemRemoveButtons() {
  document.querySelectorAll('.li-remove').forEach(btn => {
    btn.onclick = () => btn.closest('tr').remove();
  });
}
