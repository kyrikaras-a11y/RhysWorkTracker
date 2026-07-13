/**
 * api.js
 * Thin client for the Apps Script Web App JSON API.
 * The API base URL is user-configured (Settings page) and stored in
 * localStorage, since every tradesperson deploys their own Apps Script
 * project bound to their own Google Sheet.
 */

const Api = (() => {
  const STORAGE_KEY = 'tradesapp_api_url';

  function getBaseUrl() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  function setBaseUrl(url) {
    localStorage.setItem(STORAGE_KEY, url.trim());
  }

  async function get(action, params = {}) {
    const base = getBaseUrl();
    if (!base) throw new Error('No API URL configured. Set it up in Settings.');
    const qs = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${base}?${qs}`, { method: 'GET' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'API error');
    return json.data;
  }

  async function post(action, payload = {}) {
    const base = getBaseUrl();
    if (!base) throw new Error('No API URL configured. Set it up in Settings.');
    // Sent as x-www-form-urlencoded to avoid a CORS preflight, which
    // Apps Script Web Apps do not handle.
    const body = new URLSearchParams({ action, payload: JSON.stringify(payload) });
    const res = await fetch(base, { method: 'POST', body });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'API error');
    return json.data;
  }

  async function testConnection() {
    return get('ping');
  }

  return { getBaseUrl, setBaseUrl, get, post, testConnection };
})();
