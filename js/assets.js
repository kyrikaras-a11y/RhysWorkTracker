/**
 * assets.js
 * Stage 5 frontend: Assets Register — larger purchases tracked separately
 * from day-to-day Expenses, with warranty/serial/disposal tracking.
 */

Router.register('assets', async () => {
  let assets = [];
  try { assets = await Api.get('getAssets'); } catch (e) {}
  window._assetsCache = assets;
  return renderAssetsList(assets);
});

function renderAssetsList(assets) {
  const totalValue = assets.reduce((s, a) => s + (parseFloat(a['Cost']) || 0), 0);

  const rows = assets.map(a => {
    const disposed = !!a['Disposal Date'];
    return `
    <div class="list-item" data-asset-id="${escapeHtml(a['Asset ID'])}">
      <div class="li-main">
        <div class="li-title">${escapeHtml(a['Asset Name'])}${disposed ? ' <span class="badge badge-cancelled">Disposed</span>' : ''}</div>
        <div class="li-sub">${formatDate(a['Purchase Date'])} · ${escapeHtml(a['Supplier'] || '')}</div>
      </div>
      <div class="li-amount">${money(a['Cost'])}</div>
    </div>
  `;
  }).join('');

  return `
    <h1>Assets Register</h1>
    <div class="card-row" style="margin-bottom:10px"><span class="label">Total Asset Value (excl. GST)</span><span class="value">${money(totalValue)}</span></div>
    <div id="asset-list">${assets.length ? rows : '<div class="empty-state">No assets registered yet. Tap + to add one.</div>'}</div>
    <button class="fab" id="add-asset-fab">+</button>
  `;
}

function wireAssetsPage() {
  document.querySelectorAll('#asset-list .list-item').forEach(item => {
    item.addEventListener('click', () => {
      const a = (window._assetsCache || []).find(x => x['Asset ID'] === item.dataset.assetId);
      if (a) showAssetForm(a);
    });
  });
  const fab = document.getElementById('add-asset-fab');
  if (fab) fab.addEventListener('click', () => showAssetForm(null));
}

function showAssetForm(asset) {
  document.getElementById('page-container').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <button class="icon-btn" id="back-to-assets">←</button>
      <h1 style="margin:0">${asset ? 'Edit Asset' : 'New Asset'}</h1>
    </div>
    <form id="asset-form">
      <div class="field"><label>Asset Name</label><input name="assetName" value="${escapeHtml(asset ? asset['Asset Name'] : '')}" placeholder="e.g. Makita Combo Kit" required /></div>
      <div class="field-row">
        <div class="field"><label>Purchase Date</label><input name="purchaseDate" type="date" value="${formatDateForInput(asset ? asset['Purchase Date'] : new Date())}" /></div>
        <div class="field"><label>Supplier</label><input name="supplier" value="${escapeHtml(asset ? asset['Supplier'] : '')}" /></div>
      </div>
      <div class="field"><label>Cost excl. GST ($)</label><input name="cost" type="number" step="0.01" value="${asset ? asset['Cost'] : ''}" required /></div>
      <div class="field-row">
        <div class="field"><label>Serial Number</label><input name="serialNumber" value="${escapeHtml(asset ? asset['Serial Number'] : '')}" /></div>
        <div class="field"><label>Warranty Expiry</label><input name="warrantyExpiry" type="date" value="${formatDateForInput(asset ? asset['Warranty Expiry'] : '')}" /></div>
      </div>

      <div class="field">
        <label>Receipt / Proof of Purchase</label>
        <input id="asset-receipt-input" type="file" accept="image/*,application/pdf" />
        <div id="asset-receipt-preview" style="margin-top:8px">
          ${asset && asset['Receipt Link'] ? `<a href="${escapeHtml(asset['Receipt Link'])}" target="_blank">📎 View current receipt</a>` : ''}
        </div>
      </div>

      <h3 style="margin-top:16px">Disposal (if sold/scrapped)</h3>
      <div class="field-row">
        <div class="field"><label>Disposal Date</label><input name="disposalDate" type="date" value="${formatDateForInput(asset ? asset['Disposal Date'] : '')}" /></div>
        <div class="field"><label>Disposal Value ($)</label><input name="disposalValue" type="number" step="0.01" value="${asset ? asset['Disposal Value'] : ''}" /></div>
      </div>

      <button class="btn btn-primary btn-block" type="submit">${asset ? 'Save Changes' : 'Save Asset'}</button>
      <div style="height:10px"></div>
      ${asset ? `<button class="btn btn-danger btn-block" type="button" id="delete-asset-btn">Delete Asset</button><div style="height:10px"></div>` : ''}
      <button class="btn btn-secondary btn-block" type="button" id="cancel-asset-btn">Cancel</button>
    </form>
  `;

  document.getElementById('back-to-assets').addEventListener('click', () => navigateAndWire('assets'));
  document.getElementById('cancel-asset-btn').addEventListener('click', () => navigateAndWire('assets'));

  const deleteBtn = document.getElementById('delete-asset-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this asset record?')) return;
      try {
        await Api.post('deleteAsset', { assetId: asset['Asset ID'] });
        Toast.show('Asset deleted');
        navigateAndWire('assets');
      } catch (err) {
        Toast.show('Error: ' + err.message);
      }
    });
  }

  let pendingAssetReceipt = null;
  const assetReceiptInput = document.getElementById('asset-receipt-input');
  assetReceiptInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('asset-receipt-preview').innerHTML = '<span class="li-sub">Processing file…</span>';
    try {
      pendingAssetReceipt = await processReceiptFile(file);
      document.getElementById('asset-receipt-preview').innerHTML = `<span class="li-sub">✅ File ready to attach (${pendingAssetReceipt.fileName})</span>`;
    } catch (err) {
      document.getElementById('asset-receipt-preview').innerHTML = `<span class="li-sub">Couldn't process file: ${err.message}</span>`;
    }
  });

  document.getElementById('asset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (pendingAssetReceipt) {
      data.receiptBase64 = pendingAssetReceipt.base64;
      data.receiptMimeType = pendingAssetReceipt.mimeType;
      data.receiptFileName = pendingAssetReceipt.fileName;
    }
    try {
      if (asset) {
        data.assetId = asset['Asset ID'];
        await Api.post('updateAsset', data);
        Toast.show('Asset updated');
      } else {
        await Api.post('createAsset', data);
        Toast.show('Asset saved');
      }
      navigateAndWire('assets');
    } catch (err) {
      Toast.show('Error: ' + err.message);
    }
  });
}
