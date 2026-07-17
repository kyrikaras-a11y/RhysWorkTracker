/**
 * contractors.js
 * Stage 5 frontend: contractor profiles + payment log + annual summary.
 */

Router.register('contractors', async () => {
  let contractors = [];
  try { contractors = await Api.get('getContractors'); } catch (e) {}
  window._contractorsCache = contractors;
  return renderContractorsList(contractors);
});

function renderContractorsList(contractors) {
  const rows = contractors.map(c => `
    <div class="list-item" data-contractor-id="${escapeHtml(c['Contractor ID'])}">
      <div class="li-main">
        <div class="li-title">${escapeHtml(c['Name'] || c['Business Name'] || 'Unnamed')}</div>
        <div class="li-sub">${escapeHtml(c['Business Name'] || '')}${c['ABN'] ? ' · ABN ' + escapeHtml(c['ABN']) : ''}</div>
      </div>
      <div class="li-sub">${escapeHtml(c['Contractor ID'])}</div>
    </div>
  `).join('');

  return `
    <h1>Contractors</h1>
    <div class="search-bar"><span>🔍</span><input id="contractor-search" placeholder="Search contractors..." /></div>
    <button class="btn btn-secondary btn-block" id="view-annual-summary-btn">📊 Annual Payment Summary</button>
    <div style="height:14px"></div>
    <div id="contractor-list">${contractors.length ? rows : '<div class="empty-state">No contractors yet. Tap + to add one.</div>'}</div>
    <button class="fab" id="add-contractor-fab">+</button>
  `;
}

function wireContractorsPage() {
  const searchInput = document.getElementById('contractor-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#contractor-list .list-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }
  document.querySelectorAll('#contractor-list .list-item').forEach(item => {
    item.addEventListener('click', () => {
      const c = (window._contractorsCache || []).find(x => x['Contractor ID'] === item.dataset.contractorId);
      if (c) showContractorDetail(c);
    });
  });
  const fab = document.getElementById('add-contractor-fab');
  if (fab) fab.addEventListener('click', () => showContractorForm(null));
  const summaryBtn = document.getElementById('view-annual-summary-btn');
  if (summaryBtn) summaryBtn.addEventListener('click', showContractorAnnualSummary);
}

// ---------- Add / edit contractor profile ----------

function showContractorForm(contractor) {
  document.getElementById('page-container').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="icon-btn" id="back-to-contractors">←</button>
      <h1 style="margin:0">${contractor ? 'Edit Contractor' : 'New Contractor'}</h1>
    </div>
    <form id="contractor-form">
      <div class="field"><label>Name</label><input name="name" value="${escapeHtml(contractor ? contractor['Name'] : '')}" required /></div>
      <div class="field"><label>Business Name</label><input name="businessName" value="${escapeHtml(contractor ? contractor['Business Name'] : '')}" /></div>
      <div class="field"><label>ABN</label><input name="abn" value="${escapeHtml(contractor ? contractor['ABN'] : '')}" /></div>
      <div class="field-row">
        <div class="field"><label>Phone</label><input name="phone" type="tel" value="${escapeHtml(contractor ? contractor['Phone'] : '')}" /></div>
        <div class="field"><label>Email</label><input name="email" type="email" value="${escapeHtml(contractor ? contractor['Email'] : '')}" /></div>
      </div>
      <div class="field"><label>Address</label><textarea name="address">${escapeHtml(contractor ? contractor['Address'] : '')}</textarea></div>
      <div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(contractor ? contractor['Notes'] : '')}</textarea></div>
      <button class="btn btn-primary btn-block" type="submit">${contractor ? 'Save Changes' : 'Save Contractor'}</button>
      <div style="height:10px"></div>
      ${contractor ? `<button class="btn btn-danger btn-block" type="button" id="delete-contractor-btn">Delete Contractor</button><div style="height:10px"></div>` : ''}
      <button class="btn btn-secondary btn-block" type="button" id="cancel-contractor-btn">Cancel</button>
    </form>
  `;
  document.getElementById('back-to-contractors').addEventListener('click', () => navigateAndWire('contractors'));
  document.getElementById('cancel-contractor-btn').addEventListener('click', () => navigateAndWire('contractors'));

  const deleteBtn = document.getElementById('delete-contractor-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete ${contractor['Name']}? This won't delete their payment history.`)) return;
      try {
        await Api.post('deleteContractor', { contractorId: contractor['Contractor ID'] });
        Toast.show('Contractor deleted');
        navigateAndWire('contractors');
      } catch (err) {
        Toast.show('Error: ' + err.message);
      }
    });
  }

  document.getElementById('contractor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (contractor) {
        data.contractorId = contractor['Contractor ID'];
        await Api.post('updateContractor', data);
        Toast.show('Contractor updated');
      } else {
        await Api.post('createContractor', data);
        Toast.show('Contractor saved');
      }
      navigateAndWire('contractors');
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  });
}

// ---------- Contractor detail + payment log ----------

async function showContractorDetail(contractor) {
  const container = document.getElementById('page-container');
  container.innerHTML = '<div class="spinner"></div>';
  let history = [];
  try { history = await Api.get('getContractorPaymentHistory', { contractorId: contractor['Contractor ID'] }); } catch (e) {}

  const totalPaid = history.reduce((s, p) => s + (parseFloat(p.total) || 0), 0);

  const rows = history.map(p => `
    <div class="list-item" data-payment-id="${escapeHtml(p.id)}" data-source="${escapeHtml(p.source)}">
      <div class="li-main">
        <div class="li-title">${formatDate(p.date)} — ${escapeHtml(p.description || 'Payment')}</div>
        <div class="li-sub">${escapeHtml(p.jobId || 'No job linked')}${p.invoiceNumber ? ' · ' + escapeHtml(p.invoiceNumber) : ''} · <span style="opacity:0.7">via ${escapeHtml(p.source)}</span></div>
      </div>
      <div class="li-amount">${money(p.total)}</div>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="icon-btn" id="back-to-contractors-2">←</button>
      <h1 style="margin:0">${escapeHtml(contractor['Name'])}</h1>
    </div>
    <div class="card">
      <div class="card-row"><span class="label">Business</span><span class="value">${escapeHtml(contractor['Business Name'] || '—')}</span></div>
      <div class="card-row"><span class="label">ABN</span><span class="value">${escapeHtml(contractor['ABN'] || '—')}</span></div>
      <div class="card-row"><span class="label">Phone</span><span class="value">${escapeHtml(contractor['Phone'] || '—')}</span></div>
      <div class="card-row"><span class="label">Email</span><span class="value">${escapeHtml(contractor['Email'] || '—')}</span></div>
      <button class="btn btn-secondary btn-block" id="edit-contractor-btn" style="margin-top:12px">Edit Profile</button>
    </div>
    <div class="card-row"><span class="label">Total Paid (Payment Log + Expenses)</span><span class="value">${money(totalPaid)}</span></div>
    <h3 style="margin-top:14px">Payment History</h3>
    <div id="payment-list">${history.length ? rows : '<div class="empty-state">No payments logged yet.</div>'}</div>
    <button class="fab" id="add-payment-fab">+</button>
  `;

  document.getElementById('back-to-contractors-2').addEventListener('click', () => navigateAndWire('contractors'));
  document.getElementById('edit-contractor-btn').addEventListener('click', () => showContractorForm(contractor));
  document.getElementById('add-payment-fab').addEventListener('click', () => showPaymentForm(contractor, null));
  document.querySelectorAll('#payment-list .list-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.dataset.source === 'Expense') {
        Toast.show('This was logged as an Expense — edit it from the Expenses tab');
        return;
      }
      const p = history.find(x => x.id === item.dataset.paymentId && x.source === 'Payment Log');
      if (p) {
        // showPaymentForm expects the raw sheet shape; re-fetch it precisely
        Api.get('getContractorPayments', { contractorId: contractor['Contractor ID'] }).then(payments => {
          const full = payments.find(x => x['Payment ID'] === item.dataset.paymentId);
          if (full) showPaymentForm(contractor, full);
        });
      }
    });
  });
}

async function showPaymentForm(contractor, payment) {
  let jobs = [];
  try { jobs = await Api.get('getJobs'); } catch (e) {}
  const jobOptions = `<option value="">— None —</option>` + jobs.map(j =>
    `<option value="${escapeHtml(j['Job ID'])}" ${payment && payment['Job ID'] === j['Job ID'] ? 'selected' : ''}>${escapeHtml(j['Customer Name'])} — ${escapeHtml(j['Job ID'])}</option>`
  ).join('');

  document.getElementById('page-container').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="icon-btn" id="back-to-contractor-detail">←</button>
      <h1 style="margin:0">${payment ? 'Edit Payment' : 'New Payment'}</h1>
    </div>
    <form id="payment-form">
      <div class="field"><label>Date</label><input name="date" type="date" value="${formatDateForInput(payment ? payment['Date'] : new Date())}" required /></div>
      <div class="field"><label>Description</label><input name="description" value="${escapeHtml(payment ? payment['Description'] : '')}" placeholder="e.g. Frame carpentry - Smith job" /></div>
      <div class="field"><label>Link to Job (optional)</label><select name="jobId">${jobOptions}</select></div>
      <div class="field"><label>Invoice/Reference Number (their invoice to you)</label><input name="invoiceNumber" value="${escapeHtml(payment ? payment['Invoice Number'] : '')}" /></div>
      <div class="field"><label>Amount excl. GST ($)</label><input name="amountExGst" type="number" step="0.01" value="${payment ? payment['Amount Ex GST'] : ''}" required /></div>
      <div class="field-row">
        <div class="field"><label>Payment Method</label><input name="paymentMethod" value="${escapeHtml(payment ? payment['Payment Method'] : '')}" /></div>
        <div class="field"><label>Payment Reference</label><input name="paymentReference" value="${escapeHtml(payment ? payment['Payment Reference'] : '')}" /></div>
      </div>
      <button class="btn btn-primary btn-block" type="submit">${payment ? 'Save Changes' : 'Save Payment'}</button>
      <div style="height:10px"></div>
      ${payment ? `<button class="btn btn-danger btn-block" type="button" id="delete-payment-btn">Delete Payment</button><div style="height:10px"></div>` : ''}
      <button class="btn btn-secondary btn-block" type="button" id="cancel-payment-btn">Cancel</button>
    </form>
  `;

  document.getElementById('back-to-contractor-detail').addEventListener('click', () => showContractorDetail(contractor));
  document.getElementById('cancel-payment-btn').addEventListener('click', () => showContractorDetail(contractor));

  const deleteBtn = document.getElementById('delete-payment-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this payment?')) return;
      try {
        await Api.post('deleteContractorPayment', { paymentId: payment['Payment ID'] });
        Toast.show('Payment deleted');
        showContractorDetail(contractor);
      } catch (err) {
        Toast.show('Error: ' + err.message);
      }
    });
  }

  document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.contractorId = contractor['Contractor ID'];
    try {
      if (payment) {
        data.paymentId = payment['Payment ID'];
        await Api.post('updateContractorPayment', data);
        Toast.show('Payment updated');
      } else {
        await Api.post('createContractorPayment', data);
        Toast.show('Payment saved');
      }
      showContractorDetail(contractor);
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  });
}

// ---------- Annual summary ----------

async function showContractorAnnualSummary() {
  const container = document.getElementById('page-container');
  container.innerHTML = '<div class="spinner"></div>';
  let summary = { financialYear: '', contractors: [] };
  try { summary = await Api.get('getContractorAnnualSummary'); } catch (e) {}

  const withPayments = summary.contractors.filter(c => c.paymentCount > 0);
  const rows = withPayments.map(c => `
    <div class="card-row">
      <span class="label">${escapeHtml(c.name)}${c.abn ? ' · ABN ' + escapeHtml(c.abn) : ''}</span>
      <span class="value">${money(c.totalIncGst)}</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="icon-btn" id="back-to-contractors-3">←</button>
      <h1 style="margin:0">Annual Payment Summary</h1>
    </div>
    <p>Financial Year ${escapeHtml(summary.financialYear)}</p>
    <div class="card">
      ${withPayments.length ? rows : '<p>No contractor payments recorded this financial year.</p>'}
    </div>
  `;
  document.getElementById('back-to-contractors-3').addEventListener('click', () => navigateAndWire('contractors'));
}
