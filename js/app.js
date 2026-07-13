/**
 * app.js
 * Stage 1: app shell, routing, theme toggle, connection setup,
 * and a working Customers module as the reference pattern.
 * Jobs / Invoices / Expenses / Subcontractors / Assets / GST / EOFY
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
Router.register('dashboard', async () => {
  let connected = false;
  try { await Api.testConnection(); connected = true; } catch (e) {}

  return `
    <h1>Dashboard</h1>
    <p>${connected ? 'Connected to your Google Sheet.' : 'Not connected yet — head to Settings to add your API URL.'}</p>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Income (FYTD)</div><div class="stat-value">—</div></div>
      <div class="stat-card"><div class="stat-label">Expenses (FYTD)</div><div class="stat-value">—</div></div>
      <div class="stat-card"><div class="stat-label">Net Profit</div><div class="stat-value">—</div></div>
      <div class="stat-card"><div class="stat-label">GST Payable (est.)</div><div class="stat-value">—</div></div>
    </div>
    <div class="card">
      <h3>Coming in later stages</h3>
      <p style="margin-top:8px">Live income/expense/profit figures, GST tracking, job stats and charts land in Stage 6 once Jobs, Invoices and Expenses modules (Stages 2–5) are built.</p>
    </div>
  `;
});

// ---------- Customers (full working reference module) ----------
Router.register('customers', async () => {
  let customers = [];
  try { customers = await Api.get('getCustomers'); } catch (e) { /* not connected yet */ }

  const rows = customers.map(c => `
    <div class="list-item">
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
Router.register('jobs', async () => stubPage('Jobs & Invoices', 2));
Router.register('expenses', async () => stubPage('Expenses', 3));
Router.register('more', async () => `
  <h1>More</h1>
  <div class="card" onclick="Router.go('subcontractors')"><div class="card-row"><span class="label">Subcontractors</span><span>Stage 5 →</span></div></div>
  <div class="card" onclick="Router.go('assets')"><div class="card-row"><span class="label">Assets Register</span><span>Stage 5 →</span></div></div>
  <div class="card" onclick="Router.go('gst')"><div class="card-row"><span class="label">GST Summary</span><span>Stage 5 →</span></div></div>
  <div class="card" onclick="Router.go('eofy')"><div class="card-row"><span class="label">EOFY Reports</span><span>Stage 7 →</span></div></div>
`);
Router.register('subcontractors', async () => stubPage('Subcontractors', 5));
Router.register('assets', async () => stubPage('Assets Register', 5));
Router.register('gst', async () => stubPage('GST Summary', 5));
Router.register('eofy', async () => stubPage('EOFY Reports', 7));

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
      <button class="btn btn-primary btn-block" id="save-settings-btn">Save Business Details</button>
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
        'Default GST Rate': document.getElementById('s-gst').value
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

// ---------- Helpers ----------
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
