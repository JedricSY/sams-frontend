/**
 * scanner.js — Phase 6: QR Scanner (+ fullscreen kiosk mode)
 *
 * Uses html5-qrcode to read the camera feed. Every decoded QR string is the
 * student's QRUUID (see Students.gs / addStudent_), sent straight to the
 * scanQR backend action. The backend — not this file — decides whether the
 * scan counts as Success, Late, Duplicate, or Invalid; this file just
 * displays whatever comes back.
 *
 * There are two scan surfaces sharing one camera controller: the normal
 * in-app card, and a full-screen "kiosk" overlay meant for a tablet/PC
 * mounted at a gate. Only one runs at a time — switching modes stops the
 * camera in one container and restarts it in the other, since a browser
 * can't stream the same camera into two <video> elements at once.
 *
 * Student photos: Photo is optional in the Students sheet. Whenever it's
 * blank, both the normal result card and the kiosk view fall back to the
 * school logo placeholder rather than a broken image icon.
 */

(function () {
  if (!SAMS_API.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  const SCAN_COOLDOWN_MS = 2500;
  const LOGO_SRC = '../assets/images/school-logo-placeholder.svg';

  let html5QrCode = null;
  let isRunning = false;
  let activeContainer = null; // 'reader' | 'kioskReader'
  let lastScanTime = 0;
  let lastScanValue = '';

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const sessionSelect = document.getElementById('sessionSelect');
  const resultCard = document.getElementById('resultCard');
  const scanLogBody = document.getElementById('scanLogBody');

  const kioskBtn = document.getElementById('kioskBtn');
  const kioskOverlay = document.getElementById('kioskOverlay');
  const kioskExitBtn = document.getElementById('kioskExitBtn');
  const kioskSessionSelect = document.getElementById('kioskSessionSelect');
  const kioskResultCard = document.getElementById('kioskResultCard');
  const kioskResultPhoto = document.getElementById('kioskResultPhoto');
  const kioskResultStatus = document.getElementById('kioskResultStatus');
  const kioskResultName = document.getElementById('kioskResultName');
  const kioskResultMeta = document.getElementById('kioskResultMeta');
  const kioskClock = document.getElementById('kioskClock');

  document.getElementById('logoutLink').addEventListener('click', async function (e) {
    e.preventDefault();
    await SAMS_API.call('logout', {});
    SAMS_API.setToken(null);
    window.location.href = '../index.html';
  });

  function currentSession() {
    return activeContainer === 'kioskReader' ? kioskSessionSelect.value : sessionSelect.value;
  }

  async function startScanner(containerId) {
    if (isRunning) await stopScanner();
    html5QrCode = new Html5Qrcode(containerId);
    activeContainer = containerId;

    try {
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: containerId === 'kioskReader' ? 340 : 260, height: containerId === 'kioskReader' ? 340 : 260 } },
        onScanSuccess,
        function () { /* per-frame decode failures are normal, ignore */ }
      );
      isRunning = true;
      if (containerId === 'reader') {
        startBtn.disabled = true;
        stopBtn.disabled = false;
      }
    } catch (err) {
      const message = 'Could not access the camera: ' + err;
      if (containerId === 'kioskReader') {
        kioskResultMeta.textContent = message;
      } else {
        showResult('error', message);
      }
    }
  }

  async function stopScanner() {
    if (!isRunning || !html5QrCode) return;
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (err) {
      // Ignore — camera may already be released.
    }
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }

  async function onScanSuccess(decodedText) {
    const now = Date.now();
    if (decodedText === lastScanValue && (now - lastScanTime) < SCAN_COOLDOWN_MS) {
      return; // same code still in frame, ignore until cooldown passes
    }
    lastScanValue = decodedText;
    lastScanTime = now;

    const inKiosk = activeContainer === 'kioskReader';
    if (inKiosk) showKioskResult('pending', 'Checking…', '', LOGO_SRC);
    else showResult('pending', 'Checking…');

    const result = await SAMS_API.call('scanQR', {
      qrUuid: decodedText,
      session: currentSession(),
      gate: inKiosk ? 'Kiosk' : 'Main',
      device: navigator.userAgent.slice(0, 40),
    });

    if (!result.success) {
      if (inKiosk) showKioskResult('error', result.error || 'Scan failed.', '', LOGO_SRC);
      else showResult('error', result.error || 'Scan failed.');
      return;
    }

    if (inKiosk) renderKioskResult(result.data);
    else renderScanResult(result.data);
  }

  // ---------- Normal (in-app) result rendering ----------

  function renderScanResult(data) {
    const status = data.status;

    if (status === 'Invalid') {
      showResult('invalid', 'QR code not recognized.');
      prependLogRow(nowTime(), '—', '—', status);
      return;
    }

    const student = data.student;
    const label = statusLabel(status);
    const photoSrc = student.photo || LOGO_SRC;

    resultCard.innerHTML =
      '<img src="' + photoSrc + '" alt="" class="result-photo" onerror="this.src=\'' + LOGO_SRC + '\'" />' +
      '<div class="result-status status-chip ' + status.toLowerCase() + '">' + label + '</div>' +
      '<div class="result-name">' + student.name + '</div>' +
      '<div class="result-meta">Grade ' + student.grade + ' — ' + student.section + '</div>';

    prependLogRow(nowTime(), student.name, 'Grade ' + student.grade + ' / ' + student.section, status);
    rememberLastResult(data, student);
  }

  function showResult(kind, message) {
    resultCard.innerHTML = '<div class="result-empty ' + kind + '">' + message + '</div>';
  }

  let lastResultHtml = null;

  // ---------- Kiosk result rendering ----------

  function renderKioskResult(data) {
    const status = data.status;

    if (status === 'Invalid') {
      showKioskResult('invalid', 'QR code not recognized', '', LOGO_SRC);
      prependLogRow(nowTime(), '—', '—', status);
      return;
    }

    const student = data.student;
    kioskResultCard.className = 'kiosk-result-pane state-' + status.toLowerCase();
    kioskResultPhoto.src = student.photo || LOGO_SRC;
    kioskResultPhoto.onerror = function () { kioskResultPhoto.src = LOGO_SRC; };
    kioskResultStatus.textContent = statusLabel(status);
    kioskResultStatus.className = 'kiosk-result-status status-chip ' + status.toLowerCase();
    kioskResultName.textContent = student.name;
    kioskResultMeta.textContent = 'Grade ' + student.grade + ' — ' + student.section;

    prependLogRow(nowTime(), student.name, 'Grade ' + student.grade + ' / ' + student.section, status);
    rememberLastResult(data, student);
  }

  // Keeps the normal in-app card in sync with whatever the kiosk last saw,
  // so switching back out of kiosk mode doesn't make it look like nothing
  // happened — the "Recent scans" table already proves it did.
  function rememberLastResult(data, student) {
    const status = data.status;
    if (status === 'Invalid') {
      lastResultHtml = '<div class="result-empty invalid">QR code not recognized.</div>';
      return;
    }
    const photoSrc = student.photo || LOGO_SRC;
    lastResultHtml =
      '<img src="' + photoSrc + '" alt="" class="result-photo" onerror="this.src=\'' + LOGO_SRC + '\'" />' +
      '<div class="result-status status-chip ' + status.toLowerCase() + '">' + statusLabel(status) + '</div>' +
      '<div class="result-name">' + student.name + '</div>' +
      '<div class="result-meta">Grade ' + student.grade + ' — ' + student.section + '</div>';
  }

  function showKioskResult(kind, message, name, photoSrc) {
    kioskResultCard.className = 'kiosk-result-pane state-' + kind;
    kioskResultPhoto.src = photoSrc;
    kioskResultStatus.textContent = '';
    kioskResultStatus.className = 'kiosk-result-status';
    kioskResultName.textContent = name || message;
    kioskResultMeta.textContent = name ? message : '';
  }

  function statusLabel(status) {
    switch (status) {
      case 'Success': return 'Marked present';
      case 'Late': return 'Marked late';
      case 'Duplicate': return 'Already recorded today';
      default: return status;
    }
  }

  function prependLogRow(time, name, gradeSection, status) {
    const emptyRow = scanLogBody.querySelector('.empty-row');
    if (emptyRow) emptyRow.parentElement.remove();

    const row = document.createElement('tr');
    row.innerHTML =
      '<td>' + time + '</td>' +
      '<td>' + name + '</td>' +
      '<td>' + gradeSection + '</td>' +
      '<td><span class="status-chip ' + status.toLowerCase() + '">' + status + '</span></td>';
    scanLogBody.insertBefore(row, scanLogBody.firstChild);
  }

  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ---------- Kiosk mode open/close ----------

  let clockInterval = null;

  async function enterKiosk() {
    kioskSessionSelect.value = sessionSelect.value;
    kioskOverlay.classList.add('visible');
    document.body.classList.add('kiosk-active');

    clockInterval = setInterval(updateKioskClock, 1000);
    updateKioskClock();

    // Best-effort native fullscreen; the overlay itself already covers the
    // viewport via CSS, so this still works fine if the browser blocks it.
    const el = kioskOverlay;
    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (request) {
      try { await request.call(el); } catch (err) { /* not fatal */ }
    }

    startScanner('kioskReader');
  }

  async function exitKiosk() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) { try { await exit.call(document); } catch (err) { /* not fatal */ } }
    }

    clearInterval(clockInterval);
    kioskOverlay.classList.remove('visible');
    document.body.classList.remove('kiosk-active');

    await stopScanner();

    // Show whatever the last scan was (from either surface) rather than
    // wiping the card back to empty — the "Recent scans" table below it
    // already carries the full history either way.
    resultCard.innerHTML = lastResultHtml || '<div class="result-empty">No scans yet this session.</div>';

    // Resume the normal camera automatically so returning from kiosk mode
    // doesn't require an extra click to keep scanning.
    startScanner('reader');
  }

  function updateKioskClock() {
    const now = new Date();
    kioskClock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' · ' + now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }

  kioskBtn.addEventListener('click', enterKiosk);
  kioskExitBtn.addEventListener('click', exitKiosk);

  // If the user backs out of native fullscreen (Esc key), close kiosk mode
  // fully rather than leaving a windowed overlay stuck on screen.
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && kioskOverlay.classList.contains('visible')) {
      exitKiosk();
    }
  });

  startBtn.addEventListener('click', function () { startScanner('reader'); });
  stopBtn.addEventListener('click', stopScanner);

  window.addEventListener('beforeunload', function () {
    if (isRunning) stopScanner();
  });
})();
