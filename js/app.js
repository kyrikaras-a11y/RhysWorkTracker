/**
 * app.js
 * Stage 1: app shell, routing, theme toggle, connection setup,
 * and a working Customers module as the reference pattern.
 * Jobs / Invoices / Expenses / Contractors / Assets / GST / EOFY
 * screens arrive in later stages and are stubbed as "coming soon" here.
 */

const Toast = {
  el: null,
  show(msg) {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.className = 'toast';
      document.body.appendChild(this.el);
    }
    this.el.textContent = msg;
    this.el.classList.add('show');
    clearTimeout(this._t);
    this._t = setTimeout(() => this.el.classList.remove('show'), 2200);
  }
};

const Theme = {
  init() {
    const saved = localStorage.getItem('tradesapp_theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('theme-toggle').addEventListener('click', () => this.toggle());
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('tradesapp_theme', next);
  }
};

const Router = {
  routes: {},
  register(name, renderFn) { this.routes[name] = renderFn; },
  async go(name) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.route === name));
    const container = document.getElementById('page-container');
    container.innerHTML = '<div class="spinner"></div>';
    try {
      const html = await this.routes[name]();
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="empty-state">Couldn't load this page.<br><small>${err.message}</small></div>`;
    }
    window.location.hash = name;
  }
};

// ---------- Dashboard (placeholder — full version in Stage 6) ----------
// ---------- Customers (full working reference module) ----------
Router.register('customers', async () => {
  let customers = [];
  try { customers = await Api.get('getCustomers'); } catch (e) { /* not connected yet */ }
  window._customersCache = customers;

  const rows = customers.map(c => `
    <div class="list-item" data-customer-id="${escapeHtml(c['Customer ID'])}">
      <div class="li-main">
        <div class="li-title">${escapeHtml(c['Customer Name'] || c['Business Name'] || 'Unnamed')}</div>
        <div class="li-sub">${escapeHtml(c['Phone'] || c['Email'] || '')}</div>
      </div>
      <div class="li-sub">${escapeHtml(c['Customer ID'] || '')}</div>
    </div>
  `).join('');

  return `
    <h1>Customers</h1>
    <div class="search-bar">
      <span>🔍</span>
      <input id="customer-search" placeholder="Search customers..." />
    </div>
    <div id="customer-list">
      ${customers.length ? rows : '<div class="empty-state">No customers yet. Tap + to add one.</div>'}
    </div>
    <button class="fab" id="add-customer-fab">+</button>
  `;
});

function wireCustomerPage() {
  const searchInput = document.getElementById('customer-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#customer-list .list-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }
  document.querySelectorAll('#customer-list .list-item').forEach(item => {
    item.addEventListener('click', () => {
      const customer = (window._customersCache || []).find(c => c['Customer ID'] === item.dataset.customerId);
      if (customer) showEditCustomerForm(customer);
    });
  });
  const fab = document.getElementById('add-customer-fab');
  if (fab) fab.addEventListener('click', showAddCustomerForm);
}

function showAddCustomerForm() {
  document.getElementById('page-container').innerHTML = `
    <h1>New Customer</h1>
    <form id="customer-form">
      <div class="field"><label>Customer Name</label><input name="customerName" required /></div>
      <div class="field"><label>Business Name</label><input name="businessName" /></div>
      <div class="field"><label>Phone</label><input name="phone" type="tel" /></div>
      <div class="field"><label>Email</label><input name="email" type="email" /></div>
      <div class="field"><label>Billing Address</label><textarea name="billingAddress"></textarea></div>
      <div class="field"><label>Job Address</label><textarea name="jobAddress"></textarea></div>
      <div class="field"><label>Hourly Rate ($) <span style="font-weight:400;text-transform:none">— used to prefill timesheets for this customer</span></label><input name="hourlyRate" type="number" step="0.01" placeholder="Leave blank to use your default rate" /></div>
      <div class="field"><label>Notes</label><textarea name="notes"></textarea></div>
      <button class="btn btn-primary btn-block" type="submit">Save Customer</button>
      <div style="height:10px"></div>
      <button class="btn btn-secondary btn-block" type="button" id="cancel-btn">Cancel</button>
    </form>
  `;
  document.getElementById('cancel-btn').addEventListener('click', () => Router.go('customers'));
  document.getElementById('customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      await Api.post('createCustomer', data);
      Toast.show('Customer saved');
      Router.go('customers');
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  });
}

function showEditCustomerForm(customer) {
  document.getElementById('page-container').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="icon-btn" id="back-to-customers">←</button>
      <h1 style="margin:0">Edit Customer</h1>
    </div>
    <form id="customer-edit-form">
      <div class="field"><label>Customer Name</label><input name="customerName" value="${escapeHtml(customer['Customer Name'] || '')}" required /></div>
      <div class="field"><label>Business Name</label><input name="businessName" value="${escapeHtml(customer['Business Name'] || '')}" /></div>
      <div class="field"><label>Contact Person</label><input name="contactPerson" value="${escapeHtml(customer['Contact Person'] || '')}" /></div>
      <div class="field"><label>Phone</label><input name="phone" type="tel" value="${escapeHtml(customer['Phone'] || '')}" /></div>
      <div class="field"><label>Email</label><input name="email" type="email" value="${escapeHtml(customer['Email'] || '')}" /></div>
      <div class="field"><label>Billing Address</label><textarea name="billingAddress">${escapeHtml(customer['Billing Address'] || '')}</textarea></div>
      <div class="field"><label>Job Address</label><textarea name="jobAddress">${escapeHtml(customer['Job Address'] || '')}</textarea></div>
      <div class="field"><label>Hourly Rate ($) <span style="font-weight:400;text-transform:none">— used to prefill timesheets for this customer</span></label><input name="hourlyRate" type="number" step="0.01" value="${customer['Hourly Rate'] !== undefined && customer['Hourly Rate'] !== '' ? customer['Hourly Rate'] : ''}" placeholder="Leave blank to use your default rate" /></div>
      <div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(customer['Notes'] || '')}</textarea></div>
      <button class="btn btn-primary btn-block" type="submit">Save Changes</button>
      <div style="height:10px"></div>
      <button class="btn btn-danger btn-block" type="button" id="delete-customer-btn">Delete Customer</button>
      <div style="height:10px"></div>
      <button class="btn btn-secondary btn-block" type="button" id="cancel-edit-btn">Cancel</button>
    </form>
  `;
  document.getElementById('back-to-customers').addEventListener('click', () => navigateAndWire('customers'));
  document.getElementById('cancel-edit-btn').addEventListener('click', () => navigateAndWire('customers'));

  document.getElementById('delete-customer-btn').addEventListener('click', async () => {
    if (!confirm(`Delete ${customer['Customer Name']}? This cannot be undone. Existing jobs will keep this customer's name but the link will be lost.`)) return;
    try {
      await Api.post('deleteCustomer', { customerId: customer['Customer ID'] });
      Toast.show('Customer deleted');
      navigateAndWire('customers');
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  });

  document.getElementById('customer-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.customerId = customer['Customer ID'];
    try {
      await Api.post('updateCustomer', data);
      Toast.show('Customer updated');
      navigateAndWire('customers');
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  });
}

// ---------- Stub pages for modules arriving in later stages ----------
function stubPage(title, stage) {
  return `
    <h1>${title}</h1>
    <div class="empty-state">
      <div style="font-size:2rem;margin-bottom:8px">🚧</div>
      ${title} is being built in Stage ${stage}.<br>Say the word and we'll move on to it next.
    </div>
  `;
}
Router.register('jobs', async () => {
  let jobs = [];
  try { jobs = await Api.get('getJobs'); } catch (e) {}
  window._jobsCache = jobs;
  return renderJobsList(jobs, 'All');
});
Router.register('more', async () => `
  <h1>More</h1>
  <div class="card" onclick="navigateAndWire('settings')"><div class="card-row"><span class="label">⚙️ Settings (connect your Apps Script)</span><span>→</span></div></div>
  <div class="card" onclick="navigateAndWire('contractors')"><div class="card-row"><span class="label">🧑‍🔧 Contractors</span><span>→</span></div></div>
  <div class="card" onclick="navigateAndWire('assets')"><div class="card-row"><span class="label">🧰 Assets Register</span><span>→</span></div></div>
  <div class="card" onclick="navigateAndWire('gst')"><div class="card-row"><span class="label">📋 GST Summary</span><span>→</span></div></div>
  <div class="card" onclick="navigateAndWire('eofy')"><div class="card-row"><span class="label">📑 EOFY Reports</span><span>→</span></div></div>
`);
// ---------- Settings ----------
Router.register('settings', async () => {
  const apiUrl = Api.getBaseUrl();
  let settings = {};
  try { settings = await Api.get('getSettings'); } catch (e) {}

  return `
    <h1>Settings</h1>

    <div class="card">
      <h3>Connection</h3>
      <div class="field">
        <label>Apps Script Web App URL</label>
        <input id="api-url" value="${escapeHtml(apiUrl)}" placeholder="https://script.google.com/macros/s/.../exec" />
      </div>
      <button class="btn btn-secondary btn-block" id="save-url-btn">Save & Test Connection</button>
    </div>

    <div class="card">
      <h3>Business Details</h3>
      <div class="field"><label>Business Name</label><input id="s-business-name" value="${escapeHtml(settings['Business Name'] || '')}" /></div>
      <div class="field"><label>ABN</label><input id="s-abn" value="${escapeHtml(settings['ABN'] || '')}" /></div>
      <div class="field"><label>Address</label><textarea id="s-address">${escapeHtml(settings['Address'] || '')}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Phone</label><input id="s-phone" value="${escapeHtml(settings['Phone'] || '')}" /></div>
        <div class="field"><label>Email</label><input id="s-email" value="${escapeHtml(settings['Email'] || '')}" /></div>
      </div>
      <div class="field"><label>Default GST Rate</label><input id="s-gst" value="${escapeHtml(settings['Default GST Rate'] || '0.10')}" /></div>
      <div class="field"><label>Default Hourly Rate ($)</label><input id="s-hourly-rate" type="number" step="0.01" value="${escapeHtml(settings['Default Hourly Rate'] || '65')}" /></div>
      <div class="field"><label>Trade Licence Number <span style="font-weight:400;text-transform:none">— shown on quotes & invoices</span></label><input id="s-licence-number" value="${escapeHtml(settings['Licence Number'] || '')}" /></div>
      <div class="field-row">
        <div class="field"><label>Invoice Payment Terms (days)</label><input id="s-invoice-terms-days" type="number" value="${escapeHtml(settings['Invoice Payment Terms (days)'] || '14')}" /></div>
        <div class="field"><label>Quote Validity (days)</label><input id="s-quote-validity-days" type="number" value="${escapeHtml(settings['Quote Validity (days)'] || '30')}" /></div>
      </div>
    </div>

    <div class="card">
      <h3>Bank Details <span style="font-weight:400;text-transform:none">— shown on invoices</span></h3>
      <div class="field"><label>Account Name</label><input id="s-bank-name" value="${escapeHtml(settings['Bank Account Name'] || '')}" /></div>
      <div class="field-row">
        <div class="field"><label>BSB <span style="font-weight:400;text-transform:none">— leading 0 is kept</span></label><input id="s-bank-bsb" value="${escapeHtml(settings['Bank BSB'] || '')}" placeholder="e.g. 011123" /></div>
        <div class="field"><label>Account Number</label><input id="s-bank-account" value="${escapeHtml(settings['Bank Account Number'] || '')}" placeholder="e.g. 0412345678" /></div>
      </div>
    </div>

    <div class="card">
      <h3>Quote Email Template</h3>
      <p style="margin-top:4px">Available placeholders: <code>{customerName}</code>, <code>{quoteNumber}</code>, <code>{total}</code>, <code>{expiryDate}</code>, <code>{businessName}</code></p>
      <div class="field"><label>Subject</label><input id="s-quote-email-subject" value="${escapeHtml(settings['Quote Email Subject'] || 'Quote {quoteNumber} from {businessName}')}" /></div>
      <div class="field"><label>Body</label><textarea id="s-quote-email-body" rows="6">${escapeHtml(settings['Quote Email Body'] || 'Hi {customerName},\n\nPlease find attached your quote {quoteNumber} for {total}. This quote is valid until {expiryDate}.\n\nLet me know if you have any questions.\n\nThanks,\n{businessName}')}</textarea></div>
    </div>

    <div class="card">
      <h3>Invoice Email Template</h3>
      <p style="margin-top:4px">Used as the starting subject/message whenever you email an invoice — still fully editable at send time. Available placeholders: <code>{customerName}</code>, <code>{invoiceNumber}</code>, <code>{total}</code>, <code>{dueDate}</code>, <code>{businessName}</code></p>
      <div class="field"><label>Subject</label><input id="s-email-subject" value="${escapeHtml(settings['Invoice Email Subject'] || 'Invoice {invoiceNumber} from {businessName}')}" /></div>
      <div class="field"><label>Body</label><textarea id="s-email-body" rows="6">${escapeHtml(settings['Invoice Email Body'] || 'Hi {customerName},\n\nPlease find attached invoice {invoiceNumber} for {total}, due {dueDate}.\n\nThanks,\n{businessName}')}</textarea></div>
      <button class="btn btn-primary btn-block" id="save-settings-btn">Save Settings</button>
    </div>

    <div class="card">
      <h3>Appearance</h3>
      <p>Use the moon/sun icon in the top bar to switch light/dark mode.</p>
    </div>
  `;
});

function wireSettingsPage() {
  const saveUrlBtn = document.getElementById('save-url-btn');
  if (saveUrlBtn) {
    saveUrlBtn.addEventListener('click', async () => {
      const url = document.getElementById('api-url').value;
      Api.setBaseUrl(url);
      try {
        await Api.testConnection();
        Toast.show('Connected successfully');
      } catch (err) {
        Toast.show('Could not connect: ' + err.message);
      }
    });
  }
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
      const payload = {
        'Business Name': document.getElementById('s-business-name').value,
        'ABN': document.getElementById('s-abn').value,
        'Address': document.getElementById('s-address').value,
        'Phone': document.getElementById('s-phone').value,
        'Email': document.getElementById('s-email').value,
        'Default GST Rate': document.getElementById('s-gst').value,
        'Default Hourly Rate': document.getElementById('s-hourly-rate').value,
        'Licence Number': document.getElementById('s-licence-number').value,
        'Invoice Payment Terms (days)': document.getElementById('s-invoice-terms-days').value,
        'Quote Validity (days)': document.getElementById('s-quote-validity-days').value,
        'Bank Account Name': document.getElementById('s-bank-name').value,
        'Bank BSB': document.getElementById('s-bank-bsb').value,
        'Bank Account Number': document.getElementById('s-bank-account').value,
        'Quote Email Subject': document.getElementById('s-quote-email-subject').value,
        'Quote Email Body': document.getElementById('s-quote-email-body').value,
        'Invoice Email Subject': document.getElementById('s-email-subject').value,
        'Invoice Email Body': document.getElementById('s-email-body').value
      };
      try {
        await Api.post('saveSettings', payload);
        Toast.show('Settings saved');
      } catch (err) {
        Toast.show('Error: ' + err.message);
      }
    });
  }
}

// ---------- Shared helpers ----------

/**
 * Label used in job <select> dropdowns across the app — includes the job
 * description in brackets for easier picking, but this is purely a UI
 * label; it never gets pulled into invoices or any other document.
 */
function jobDropdownLabel(j) {
  const desc = (j['Job Description'] || '').trim();
  const truncated = desc.length > 40 ? desc.slice(0, 40) + '…' : desc;
  return `${j['Customer Name']} — ${j['Job ID']}${truncated ? ' (' + truncated + ')' : ''}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// ---------- Boot ----------
async function navigateAndWire(route) {
  await Router.go(route);
  if (route === 'customers') wireCustomerPage();
  if (route === 'settings') wireSettingsPage();
  if (route === 'jobs') wireJobsListPage();
  if (route === 'timesheets') wireTimesheetsPage();
  if (route === 'expenses') wireExpensesPage();
  if (route === 'contractors') wireContractorsPage();
  if (route === 'assets') wireAssetsPage();
  if (route === 'gst') wireGstPage();
  if (route === 'dashboard') wireDashboardPage();
  if (route === 'eofy') wireEofyPage();
}

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateAndWire(btn.dataset.route));
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }

  const initialRoute = window.location.hash.replace('#', '') || 'dashboard';
  navigateAndWire(initialRoute);
});
