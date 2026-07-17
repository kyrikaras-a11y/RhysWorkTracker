/**
 * dashboard.js
 * Stage 6: pulls getDashboardData() and renders stat cards + charts.
 * Charts use Chart.js (loaded via CDN in index.html). Chart instances are
 * tracked and destroyed on re-render to avoid leaking canvases when the
 * user navigates away and back.
 */

let dashboardCharts = [];

function dbMoney(n) {
  const num = parseFloat(n) || 0;
  return '$' + num.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

Router.register('dashboard', async () => {
  let connected = false;
  try { await Api.testConnection(); connected = true; } catch (e) {}

  if (!connected) {
    return `
      <h1>Dashboard</h1>
      <div class="empty-state">Not connected yet.<br>Head to <strong>More → Settings</strong> to add your Apps Script URL.</div>
    `;
  }

  let data = null;
  try { data = await Api.get('getDashboardData'); } catch (e) {}
  if (!data) {
    return `<h1>Dashboard</h1><div class="empty-state">Couldn't load dashboard data. Pull to refresh or check your connection in Settings.</div>`;
  }
  window._dashboardData = data;
  return renderDashboard(data);
});

function renderDashboard(data) {
  const netClass = data.profit.netFYTD >= 0 ? 'positive' : 'negative';
  const gstClass = data.gst.netPayable >= 0 ? 'negative' : 'positive';

  return `
    <h1>Dashboard</h1>

    <h3>Income</h3>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">This Month</div><div class="stat-value">${dbMoney(data.income.thisMonth)}</div></div>
      <div class="stat-card"><div class="stat-label">FY to Date</div><div class="stat-value">${dbMoney(data.income.fytd)}</div></div>
      <div class="stat-card"><div class="stat-label">Paid Invoices</div><div class="stat-value positive">${data.income.paidInvoices.count} · ${dbMoney(data.income.paidInvoices.amount)}</div></div>
      <div class="stat-card"><div class="stat-label">Overdue</div><div class="stat-value ${data.income.overdueInvoices.count ? 'negative' : ''}">${data.income.overdueInvoices.count} · ${dbMoney(data.income.overdueInvoices.amount)}</div></div>
    </div>
    <div class="card" style="margin-top:10px">
      <div class="card-row"><span class="label">Outstanding (Sent / Part Paid)</span><span class="value">${data.income.outstandingInvoices.count} · ${dbMoney(data.income.outstandingInvoices.amount)}</span></div>
    </div>

    <h3 style="margin-top:20px">Expenses</h3>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">This Month</div><div class="stat-value">${dbMoney(data.expenses.thisMonth)}</div></div>
      <div class="stat-card"><div class="stat-label">FY to Date</div><div class="stat-value">${dbMoney(data.expenses.fytd)}</div></div>
    </div>

    <h3 style="margin-top:20px">Profit</h3>
    <div class="card">
      <div class="card-row"><span class="label">Revenue (FYTD)</span><span class="value">${dbMoney(data.income.fytd)}</span></div>
      <div class="card-row"><span class="label">minus Expenses (FYTD)</span><span class="value">${dbMoney(data.expenses.fytd)}</span></div>
      <div class="card-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:8px"><span class="label" style="font-weight:700">Net Profit</span><span class="value ${netClass}" style="font-weight:800">${dbMoney(data.profit.netFYTD)}</span></div>
    </div>

    <h3 style="margin-top:20px">GST (FY ${escapeHtml(data.gst.periodLabel || '')})</h3>
    <div class="card">
      <div class="card-row"><span class="label">Collected</span><span class="value">${dbMoney(data.gst.gstCollected)}</span></div>
      <div class="card-row"><span class="label">Paid</span><span class="value">${dbMoney(data.gst.gstPaid)}</span></div>
      <div class="card-row" style="border-top:1px solid var(--border);margin-top:4px;padding-top:8px"><span class="label" style="font-weight:700">${data.gst.netPayable >= 0 ? 'Estimated Payable' : 'Refund Owed to You'}</span><span class="value ${gstClass}" style="font-weight:800">${dbMoney(Math.abs(data.gst.netPayable))}</span></div>
    </div>

    <h3 style="margin-top:20px">Jobs</h3>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-label">Active</div><div class="stat-value">${data.jobs.active}</div></div>
      <div class="stat-card"><div class="stat-label">Completed</div><div class="stat-value">${data.jobs.completed}</div></div>
      <div class="stat-card"><div class="stat-label">Avg Job Value</div><div class="stat-value">${dbMoney(data.jobs.averageValue)}</div></div>
      <div class="stat-card"><div class="stat-label">Most Profitable</div><div class="stat-value" style="font-size:1rem">${data.jobs.mostProfitable[0] ? escapeHtml(data.jobs.mostProfitable[0].jobId) : '—'}</div></div>
    </div>
    ${data.jobs.mostProfitable.length ? `
      <div class="card" style="margin-top:10px">
        <h3>Top 5 Most Profitable Jobs</h3>
        ${data.jobs.mostProfitable.map(j => `
          <div class="card-row"><span class="label">${escapeHtml(j.customerName)} (${escapeHtml(j.jobId)})</span><span class="value positive">${dbMoney(j.profit)} (${j.profitPct}%)</span></div>
        `).join('')}
      </div>
    ` : ''}

    <h3 style="margin-top:20px">Trends (Last 6 Months)</h3>
    <div class="card"><canvas id="chart-income-expenses" height="200"></canvas></div>
    <div class="card"><canvas id="chart-profit-trend" height="200"></canvas></div>
    ${data.charts.expenseCategoryBreakdown.length ? `<div class="card"><h3>Expenses by Category (FYTD)</h3><canvas id="chart-expense-categories" height="240"></canvas></div>` : ''}
  `;
}

function wireDashboardPage() {
  const data = window._dashboardData;
  if (!data || typeof Chart === 'undefined') return;

  // destroy any previous chart instances before re-rendering, to avoid canvas reuse errors
  dashboardCharts.forEach(c => c.destroy());
  dashboardCharts = [];

  const isDark = (document.documentElement.getAttribute('data-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#9aa1ad' : '#5b6270';
  const accent = isDark ? '#f59e0b' : '#b45309';

  const incomeExpensesCanvas = document.getElementById('chart-income-expenses');
  if (incomeExpensesCanvas) {
    dashboardCharts.push(new Chart(incomeExpensesCanvas, {
      type: 'bar',
      data: {
        labels: data.charts.monthlyIncome.map(m => m.label),
        datasets: [
          { label: 'Income', data: data.charts.monthlyIncome.map(m => m.value), backgroundColor: accent },
          { label: 'Expenses', data: data.charts.monthlyExpenses.map(m => m.value), backgroundColor: isDark ? '#f8717166' : '#b91c1c66' }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
        }
      }
    }));
  }

  const profitCanvas = document.getElementById('chart-profit-trend');
  if (profitCanvas) {
    dashboardCharts.push(new Chart(profitCanvas, {
      type: 'line',
      data: {
        labels: data.charts.profitTrend.map(m => m.label),
        datasets: [{ label: 'Net Profit', data: data.charts.profitTrend.map(m => m.value), borderColor: accent, backgroundColor: accent + '33', fill: true, tension: 0.3 }]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
        }
      }
    }));
  }

  const categoryCanvas = document.getElementById('chart-expense-categories');
  if (categoryCanvas) {
    const palette = ['#f59e0b', '#0ea5e9', '#8b5cf6', '#15803d', '#b91c1c', '#64748b', '#ec4899', '#14b8a6', '#eab308'];
    dashboardCharts.push(new Chart(categoryCanvas, {
      type: 'doughnut',
      data: {
        labels: data.charts.expenseCategoryBreakdown.map(c => c.label),
        datasets: [{ data: data.charts.expenseCategoryBreakdown.map(c => c.value), backgroundColor: palette }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { color: textColor, boxWidth: 12, font: { size: 11 } } } }
      }
    }));
  }
}
