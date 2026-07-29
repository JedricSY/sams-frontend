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
  const API_URL = 'https://script.google.com/macros/s/AKfycbzWkZA1vmFTsS-VXi3TTflRUTx57_LRLWJUZi-lkOn9Nl1af_X3oIGbxWVStuhVGyGZ/exec';

  function getToken() {
    return sessionStorage.getItem('sams_token') || '';
  }

  function setToken(token) {
    if (token) sessionStorage.setItem('sams_token', token);
    else sessionStorage.removeItem('sams_token');
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
      window.location.href = '/index.html';
    }

    return result;
  }

  return {
    call: call,
    getToken: getToken,
    setToken: setToken,
    isLoggedIn: function () { return !!getToken(); },
  };
})();
