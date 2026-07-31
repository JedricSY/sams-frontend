/**
 * api.js
 * Thin wrapper around the Apps Script Web App deployment.
 *
 * Gotcha: Apps Script Web Apps can't send custom CORS response headers.
 * If the browser sends a preflight (OPTIONS) request — which it does
 * automatically for any fetch with "Content-Type: application/json" —
 * the preflight fails and the whole call breaks. Sending the body as
 * "text/plain" keeps this a CORS "simple request" and skips preflight,
 * while Apps Script's e.postData.contents still receives the raw JSON
 * string just fine.
 */

const SAMS_API = (function () {
  // Fill this in after deploying the Apps Script project as a Web App.
  const API_URL = 'https://script.google.com/macros/s/AKfycbz_bHw92cy7bqkauPwOs134E19rhza0gF3Jmt83DMVjLOfr9-bJjcCFSHpx9MAAHMBH/exec';

  function getToken() {
    return sessionStorage.getItem('sams_token') || '';
  }

  function setToken(token) {
    if (token) sessionStorage.setItem('sams_token', token);
    else sessionStorage.removeItem('sams_token');
  }

  // Pages live at both the site root (index.html) and one level down
  // (pages/whatever.html), so a single absolute "/index.html" redirect
  // breaks on GitHub Pages, which serves from a /repo-name/ subpath rather
  // than the domain root. Figure out the right relative path from wherever
  // this script happens to be running.
  function loginPagePath() {
    return window.location.pathname.indexOf('/pages/') !== -1 ? '../index.html' : 'index.html';
  }

  async function call(action, payload) {
    payload = payload || {};
    if (!payload.token) payload.token = getToken();

    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, payload: payload }),
      });
    } catch (networkErr) {
      return { success: false, data: null, error: 'Network error — check your connection.' };
    }

    let result;
    try {
      result = await response.json();
    } catch (parseErr) {
      return { success: false, data: null, error: 'Unexpected server response.' };
    }

    if (!result.success && (result.error === 'AUTH_REQUIRED' || result.error === 'SESSION_EXPIRED')) {
      setToken(null);
      window.location.href = loginPagePath();
    }

    return result;
  }

  // Cached so every page that shows a logo (sidebar, kiosk, QR cards)
  // doesn't each fire their own request. Cache is per-page-load, not
  // persisted — a freshly uploaded logo shows up on next navigation.
  let brandingPromise = null;
  function getBranding() {
    if (!isLoggedIn()) return Promise.resolve({ success: false, data: null });
    if (!brandingPromise) brandingPromise = call('getBranding', {});
    return brandingPromise;
  }

  function isLoggedIn() { return !!getToken(); }

  // Swaps in the school's uploaded logo wherever the page has marked a
  // slot for it, so individual pages don't each need custom wiring.
  // Looked for: .sidebar .mark (nav header) and .kiosk-brand-logo (scanner
  // kiosk topbar). Falls back silently to whatever markup is already there
  // (text mark / placeholder SVG) if no custom logo has been uploaded.
  function applyBranding() {
    getBranding().then(function (result) {
      if (!result.success || !result.data || !result.data.logoUrl) return;
      const url = result.data.logoUrl;

      document.querySelectorAll('.sidebar .mark').forEach(function (el) {
        if (el.querySelector('img')) return;
        el.innerHTML = '<img src="' + url + '" alt="" class="brand-logo-img" />' + el.textContent;
      });

      document.querySelectorAll('.kiosk-brand-logo').forEach(function (img) {
        img.src = url;
      });

      document.querySelectorAll('.id-card-logo').forEach(function (img) {
        img.src = url;
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBranding);
  } else {
    applyBranding();
  }

  return {
    call: call,
    getToken: getToken,
    setToken: setToken,
    isLoggedIn: isLoggedIn,
    getBranding: getBranding,
  };
})();
