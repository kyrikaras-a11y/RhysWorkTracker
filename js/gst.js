/**
 * gst.js
 * Stage 5 frontend: GST collected vs paid, by month / BAS quarter / financial
 * year, with the option to save a snapshot to the GST Summary sheet.
 */

Router.register('gst', async () => {
  const now = new Date();
  const fy = getCurrentFyLabel(now);
  const report = await Api.get('getGstReport', { periodType: 'fy', periodValue: fy }).catch(() => null);
  let snapshots = [];
  try { snapshots = await Api.get('getGstSnapshots'); } catch (e) {}
  window._gstSnapshotsCache = snapshots;
  return renderGstPage(report, 'fy', fy, snapshots);
});

function getCurrentFyLabel(date) {
  const y = date.getFullYear();
  const startYear = date.getMonth() >= 6 ? y : y - 1;
  return startYear + '-' + String(startYear + 1).slice(2);
}

function renderGstPage(report, periodType, periodValue, snapshots) {
  const netLabel = report && report.netPayable >= 0 ? 'GST Payable' : 'GST Refund Owed to You';
  const netClass = report && report.netPayable >= 0 ? 'negative' : 'positive'; // payable = money going out

  const snapshotRows = (snapshots || []).map(s => `
    <div class="card-row">
      <span class="label">${escapeHtml(s['Period'])} <span style="font-weight:400">(${formatDate(s['Generated Date'])})</span></span>
      <span class="value">${money(s['Net GST Payable'])}</span>
    </div>
  `).join('');

  return `
    <h1>GST Summary</h1>
    <div class="tab-strip" id="gst-period-tabs">
      <button data-type="month" class="${periodType === 'month' ? 'active' : ''}">This Month</button>
      <button data-type="quarter" class="${periodType === 'quarter' ? 'active' : ''}">This BAS Quarter</button>
      <button data-type="fy" class="${periodType === 'fy' ? 'active' : ''}">Financial Year</button>
    </div>

    <div class="card">
      <h3>${report ? escapeHtml(report.periodLabel) : ''}</h3>
      <div class="card-row"><span class="label">GST Collected (from invoices)</span><span class="value">${report ? money(report.gstCollected) : '—'}</span></div>
      <div class="card-row"><span class="label">GST Paid (expenses + contractors)</span><span class="value">${report ? money(report.gstPaid) : '—'}</span></div>
      <div class="card-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:8px">
        <span class="label" style="font-weight:700">${netLabel}</span>
        <span class="value ${netClass}" style="font-weight:800">${report ? money(Math.abs(report.netPayable)) : '—'}</span>
      </div>
    </div>

    <button class="btn btn-secondary btn-block" id="save-gst-snapshot-btn">Save Snapshot for Records</button>

    <h3 style="margin-top:20px">Saved Snapshots</h3>
    <div class="card">${snapshotRows || '<p>No snapshots saved yet.</p>'}</div>
  `;
}

function computePeriodValue(periodType) {
  const now = new Date();
  if (periodType === 'month') {
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }
  if (periodType === 'quarter') {
    const fyLabel = getCurrentFyLabel(now);
    const month = now.getMonth(); // 0-indexed
    const qNum = month >= 6 && month <= 8 ? 1 : month >= 9 && month <= 11 ? 2 : month >= 0 && month <= 2 ? 3 : 4;
    return fyLabel + '-Q' + qNum;
  }
  return getCurrentFyLabel(now);
}

function wireGstPage() {
  document.querySelectorAll('#gst-period-tabs button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const periodType = btn.dataset.type;
      const periodValue = computePeriodValue(periodType);
      const container = document.getElementById('page-container');
      container.innerHTML = '<div class="spinner"></div>';
      const report = await Api.get('getGstReport', { periodType, periodValue }).catch(() => null);
      container.innerHTML = renderGstPage(report, periodType, periodValue, window._gstSnapshotsCache || []);
      wireGstPage();
    });
  });

  const saveBtn = document.getElementById('save-gst-snapshot-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const activeTab = document.querySelector('#gst-period-tabs button.active');
      const periodType = activeTab ? activeTab.dataset.type : 'fy';
      const periodValue = computePeriodValue(periodType);
      try {
        await Api.post('saveGstSnapshot', { periodType, periodValue });
        Toast.show('Snapshot saved');
        navigateAndWire('gst');
      } catch (err) {
        Toast.show('Error: ' + err.message);
      }
    });
  }
}
