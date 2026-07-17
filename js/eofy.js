/**
 * eofy.js
 * Stage 7 frontend: one-tap "Generate EOFY Accountant Pack" plus a history
 * of previously generated packs (each a Drive folder link).
 */

Router.register('eofy', async () => {
  let history = [];
  try { history = await Api.get('getEofyReportHistory'); } catch (e) {}
  window._eofyHistoryCache = history;
  return renderEofyPage(history);
});

function currentFyLabelForEofy() {
  const now = new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return startYear + '-' + String(startYear + 1).slice(2);
}

function renderEofyPage(history) {
  const rows = history.map(h => `
    <div class="card-row">
      <span class="label">FY ${escapeHtml(h['Financial Year'])} <span style="font-weight:400">(${formatDate(h['Generated Date'])})</span></span>
      <span class="value"><a href="${escapeHtml(h['Drive Folder Link'])}" target="_blank">📁 Open</a></span>
    </div>
  `).join('');

  return `
    <h1>EOFY Reports</h1>
    <div class="card">
      <h3>Generate Accountant Pack</h3>
      <p style="margin-top:6px">Builds 16 PDF reports — Profit & Loss, Income, Outstanding Invoices, GST Summary, all 9 Expense category reports, Asset Register, Contractor Summary, and Job Profitability — and saves them into one dated Drive folder, ready to send to your accountant.</p>
      <div class="field" style="margin-top:10px">
        <label>Financial Year</label>
        <input id="eofy-fy-input" value="${currentFyLabelForEofy()}" placeholder="e.g. 2025-26" />
      </div>
      <button class="btn btn-primary btn-block" id="generate-pack-btn">Generate EOFY Accountant Pack</button>
      <p style="margin-top:8px">This can take a minute or two — don't close the app while it runs.</p>
    </div>

    <h3 style="margin-top:20px">Previous Packs</h3>
    <div class="card">${rows || '<p>No packs generated yet.</p>'}</div>
  `;
}

function wireEofyPage() {
  const btn = document.getElementById('generate-pack-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const fyLabel = document.getElementById('eofy-fy-input').value.trim();
    btn.disabled = true;
    btn.textContent = 'Generating... this may take a minute';
    try {
      const result = await Api.post('generateAccountantPack', { fyLabel });
      Toast.show(`Generated ${result.fileCount} reports for FY${result.financialYear}`);
      navigateAndWire('eofy');
    } catch (err) {
      Toast.show('Error: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Generate EOFY Accountant Pack';
    }
  });
}
