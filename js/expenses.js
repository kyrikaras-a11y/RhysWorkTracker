/**
 * expenses.js
 * Stage 3 frontend: master expense list (filterable by category), add/edit
 * form with category-specific fields, and camera/photo receipt capture
 * (compressed client-side before upload to keep requests small).
 */

const EXPENSE_CATEGORIES = [
  'Vehicle Expenses', 'Materials & Job Costs', 'Tools & Equipment',
  'Labour & Contractors', 'Business Operations', 'Insurance',
  'Premises & Overheads', 'Assets', 'Miscellaneous'
];

Router.register('expenses', async () => {
  let expenses = [];
  try { expenses = await Api.get('getExpenses'); } catch (e) {}
  window._expensesCache = expenses;
  return renderExpensesList(expenses, 'All');
});

function expMoney(n) {
  const num = parseFloat(n) || 0;
  return '$' + num.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderExpensesList(expenses, activeFilter) {
  const filtered = activeFilter === 'All' ? expenses : expenses.filter(e => e['Category'] === activeFilter);
  const tabs = ['All', ...EXPENSE_CATEGORIES].map(c =>
    `<button data-cat="${escapeHtml(c)}" class="${c === activeFilter ? 'active' : ''}">${escapeHtml(c)}</button>`
  ).join('');

  const total = filtered.reduce((s, e) => s + (parseFloat(e['Total Amount']) || 0), 0);

  const rows = filtered.map(e => `
    <div class="list-item" data-expense-id="${escapeHtml(e['Expense ID'])}">
      <div class="li-main">
        <div class="li-title">${escapeHtml(e['Supplier'] || e['Description'] || 'Expense')}</div>
        <div class="li-sub">${formatDate(e['Date'])} · ${escapeHtml(e['Category'] || '')}${e['Receipt Link'] ? ' · 📎' : ''}</div>
      </div>
      <div class="li-amount">${expMoney(e['Total Amount'])}</div>
    </div>
  `).join('');

  return `
    <h1>Expenses</h1>
    <div class="search-bar"><span>🔍</span><input id="expense-search" placeholder="Search expenses..." /></div>
    <div class="tab-strip" id="expense-cat-tabs">${tabs}</div>
    <div class="card-row" style="margin-bottom:8px"><span class="label">Total (${escapeHtml(activeFilter)})</span><span class="value">${expMoney(total)}</span></div>
    <div id="expense-list">${filtered.length ? rows : '<div class="empty-state">No expenses in this view. Tap + to add one.</div>'}</div>
    <button class="fab" id="add-expense-fab">+</button>
  `;
}

function wireExpensesPage() {
  const searchInput = document.getElementById('expense-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#expense-list .list-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }
  document.querySelectorAll('#expense-cat-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('page-container').innerHTML = renderExpensesList(window._expensesCache || [], btn.dataset.cat);
      wireExpensesPage();
    });
  });
  document.querySelectorAll('#expense-list .list-item').forEach(item => {
    item.addEventListener('click', () => {
      const exp = (window._expensesCache || []).find(e => e['Expense ID'] === item.dataset.expenseId);
      if (exp) showExpenseForm(exp);
    });
  });
  const fab = document.getElementById('add-expense-fab');
  if (fab) fab.addEventListener('click', () => showExpenseForm(null));
}

// ---------- Category-specific field blocks ----------

function categoryExtraFieldsHtml(category, e) {
  e = e || {};
  if (category === 'Vehicle Expenses') {
    return `
      <div class="field"><label>Vehicle</label><input name="vehicle" value="${escapeHtml(e['Vehicle'] || '')}" placeholder="e.g. Hilux, Van 1..." /></div>
      <div class="field-row">
        <div class="field"><label>Odometer Reading</label><input name="odometerReading" value="${escapeHtml(e['Odometer Reading'] || '')}" /></div>
        <div class="field"><label>Business Use %</label><input name="businessUsePercent" type="number" value="${escapeHtml(e['Business Use %'] || '')}" /></div>
      </div>
    `;
  }
  if (category === 'Insurance') {
    return `
      <div class="field"><label>Provider</label><input name="provider" value="${escapeHtml(e['Provider'] || '')}" /></div>
      <div class="field-row">
        <div class="field"><label>Policy Number</label><input name="policyNumber" value="${escapeHtml(e['Policy Number'] || '')}" /></div>
        <div class="field"><label>Renewal Date</label><input name="renewalDate" type="date" value="${formatDateForInput(e['Renewal Date'])}" /></div>
      </div>
      <div class="field"><label>Premium ($)</label><input name="premium" type="number" step="0.01" value="${escapeHtml(e['Premium'] || '')}" /></div>
    `;
  }
  return '';
}

function recurringFieldsHtml(e) {
  e = e || {};
  const checked = e['Is Recurring'] === true || e['Is Recurring'] === 'TRUE' ? 'checked' : '';
  return `
    <div class="field">
      <label><input type="checkbox" id="is-recurring" name="isRecurring" ${checked} /> Recurring expense</label>
    </div>
    <div class="field" id="recurrence-freq-field" style="${checked ? '' : 'display:none'}">
      <label>Frequency</label>
      <select name="recurrenceFrequency">
        ${['Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Annually'].map(f =>
          `<option value="${f}" ${e['Recurrence Frequency'] === f ? 'selected' : ''}>${f}</option>`
        ).join('')}
      </select>
    </div>
  `;
}

// ---------- Add / edit form ----------

async function showExpenseForm(expense) {
  let jobs = [];
  let settings = {};
  try { jobs = await Api.get('getJobs'); } catch (e) {}
  try { settings = await Api.get('getSettings'); } catch (e) {}

  const jobOptions = `<option value="">— None —</option>` + jobs.map(j =>
    `<option value="${escapeHtml(j['Job ID'])}" ${expense && expense['Job ID'] === j['Job ID'] ? 'selected' : ''}>${escapeHtml(j['Customer Name'])} — ${escapeHtml(j['Job ID'])}</option>`
  ).join('');

  const category = expense ? expense['Category'] : EXPENSE_CATEGORIES[0];
  const dateVal = expense ? formatDateForInput(expense['Date']) : formatDateForInput(new Date());

  document.getElementById('page-container').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="icon-btn" id="back-to-expenses">←</button>
      <h1 style="margin:0">${expense ? 'Edit Expense' : 'New Expense'}</h1>
    </div>
    <form id="expense-form">
      <div class="field">
        <label>Category</label>
        <select id="expense-category" name="category">
          ${EXPENSE_CATEGORIES.map(c => `<option value="${c}" ${c === category ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field"><label>Date</label><input name="date" type="date" value="${dateVal}" required /></div>
        <div class="field"><label>Supplier</label><input name="supplier" value="${escapeHtml(expense ? expense['Supplier'] : '')}" /></div>
      </div>
      <div class="field"><label>Description</label><input name="description" value="${escapeHtml(expense ? expense['Description'] : '')}" /></div>
      <div class="field"><label>Link to Job (optional)</label><select name="jobId">${jobOptions}</select></div>

      <div class="field-row">
        <div class="field"><label>Amount excl. GST ($)</label><input id="exp-amount" name="amountExGst" type="number" step="0.01" value="${expense ? expense['Amount Ex GST'] : ''}" required /></div>
        <div class="field"><label>Payment Method</label><input name="paymentMethod" value="${escapeHtml(expense ? expense['Payment Method'] : '')}" placeholder="Card, cash..." /></div>
      </div>
      <div class="card-row"><span class="label">GST (${((parseFloat(settings['Default GST Rate']) || 0.10) * 100).toFixed(0)}%)</span><span class="value" id="exp-gst-preview">${expMoney(expense ? expense['GST Amount'] : 0)}</span></div>
      <div class="card-row"><span class="label">Total incl. GST</span><span class="value" id="exp-total-preview">${expMoney(expense ? expense['Total Amount'] : 0)}</span></div>

      <div id="category-extra-fields">${categoryExtraFieldsHtml(category, expense)}</div>
      <div id="recurring-fields">${recurringFieldsHtml(expense)}</div>

      <div class="field">
        <label>Receipt Photo</label>
        <input id="receipt-input" type="file" accept="image/*" capture="environment" />
        <div id="receipt-preview" style="margin-top:8px">
          ${expense && expense['Receipt Link'] ? `<a href="${escapeHtml(expense['Receipt Link'])}" target="_blank">📎 View current receipt</a>` : ''}
        </div>
      </div>

      <div class="field"><label>Notes</label><textarea name="notes">${escapeHtml(expense ? expense['Notes'] : '')}</textarea></div>

      <button class="btn btn-primary btn-block" type="submit" id="expense-submit-btn">${expense ? 'Save Changes' : 'Save Expense'}</button>
      <div style="height:10px"></div>
      ${expense ? `<button class="btn btn-danger btn-block" type="button" id="delete-expense-btn">Delete Expense</button><div style="height:10px"></div>` : ''}
      <button class="btn btn-secondary btn-block" type="button" id="cancel-expense-btn">Cancel</button>
    </form>
  `;

  document.getElementById('back-to-expenses').addEventListener('click', () => navigateAndWire('expenses'));
  document.getElementById('cancel-expense-btn').addEventListener('click', () => navigateAndWire('expenses'));

  const gstRate = parseFloat(settings['Default GST Rate']) || 0.10;
  const amountInput = document.getElementById('exp-amount');
  amountInput.addEventListener('input', () => {
    const amt = parseFloat(amountInput.value) || 0;
    const gst = Math.round(amt * gstRate * 100) / 100;
    document.getElementById('exp-gst-preview').textContent = expMoney(gst);
    document.getElementById('exp-total-preview').textContent = expMoney(amt + gst);
  });

  document.getElementById('expense-category').addEventListener('change', (e) => {
    document.getElementById('category-extra-fields').innerHTML = categoryExtraFieldsHtml(e.target.value, expense);
  });

  wireRecurringToggle();

  let pendingReceipt = null; // { base64, mimeType, fileName }
  const receiptInput = document.getElementById('receipt-input');
  receiptInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('receipt-preview').innerHTML = '<span class="li-sub">Processing photo…</span>';
    try {
      pendingReceipt = await compressImageToBase64(file);
      document.getElementById('receipt-preview').innerHTML = `<span class="li-sub">✅ Photo ready to attach (${pendingReceipt.fileName})</span>`;
    } catch (err) {
      document.getElementById('receipt-preview').innerHTML = `<span class="li-sub">Couldn't process photo: ${err.message}</span>`;
    }
  });

  const deleteBtn = document.getElementById('delete-expense-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this expense?')) return;
      try {
        await Api.post('deleteExpense', { expenseId: expense['Expense ID'] });
        Toast.show('Expense deleted');
        navigateAndWire('expenses');
      } catch (err) {
        Toast.show('Error: ' + err.message);
      }
    });
  }

  document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('expense-submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.isRecurring = document.getElementById('is-recurring').checked;
    if (pendingReceipt) {
      data.receiptBase64 = pendingReceipt.base64;
      data.receiptMimeType = pendingReceipt.mimeType;
      data.receiptFileName = pendingReceipt.fileName;
    }
    try {
      if (expense) {
        data.expenseId = expense['Expense ID'];
        await Api.post('updateExpense', data);
        Toast.show('Expense updated');
      } else {
        await Api.post('createExpense', data);
        Toast.show('Expense saved');
      }
      navigateAndWire('expenses');
    } catch (err) {
      Toast.show('Error: ' + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = expense ? 'Save Changes' : 'Save Expense';
    }
  });
}

function wireRecurringToggle() {
  const checkbox = document.getElementById('is-recurring');
  if (!checkbox) return;
  checkbox.addEventListener('change', () => {
    document.getElementById('recurrence-freq-field').style.display = checkbox.checked ? '' : 'none';
  });
}

// ---------- Receipt image compression ----------

/**
 * Resizes an image file down to a max dimension and moderate JPEG quality
 * before upload, since raw phone camera photos (3-10MB) are overkill for
 * a receipt and would make every expense save slow on-site.
 */
function compressImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read image'));
      img.onload = () => {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const base64 = dataUrl.split(',')[1];
        resolve({
          base64,
          mimeType: 'image/jpeg',
          fileName: 'receipt-' + Date.now() + '.jpg'
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
