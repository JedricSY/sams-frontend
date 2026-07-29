/**
 * scanner.js — Phase 6: QR Scanner
 *
 * Uses html5-qrcode to read the camera feed. Every decoded QR string is the
 * student's QRUUID (see Students.gs / addStudent_), sent straight to the
 * scanQR backend action. The backend — not this file — decides whether the
 * scan counts as Success, Late, Duplicate, or Invalid; this file just
 * displays whatever comes back.
 *
 * A short cooldown after each scan stops the same still-visible QR code
 * from being read a dozen times a second while the student walks past.
 */

(function () {
  if (!SAMS_API.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  const READER_ID = 'reader';
  const SCAN_COOLDOWN_MS = 2500;

  let html5QrCode = null;
  let isRunning = false;
  let lastScanTime = 0;
  let lastScanValue = '';

  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const sessionSelect = document.getElementById('sessionSelect');
  const resultCard = document.getElementById('resultCard');
  const scanLogBody = document.getElementById('scanLogBody');

  document.getElementById('logoutLink').addEventListener('click', async function (e) {
    e.preventDefault();
    await SAMS_API.call('logout', {});
    SAMS_API.setToken(null);
    window.location.href = '../index.html';
  });

  async function startScanner() {
    if (isRunning) return;
    html5QrCode = new Html5Qrcode(READER_ID);

    try {
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        onScanSuccess,
        function () { /* per-frame decode failures are normal, ignore */ }
      );
      isRunning = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (err) {
      showResult('error', 'Could not access the camera: ' + err);
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

    showResult('pending', 'Checking…');

    const result = await SAMS_API.call('scanQR', {
      qrUuid: decodedText,
      session: sessionSelect.value,
      gate: 'Main',
      device: navigator.userAgent.slice(0, 40),
    });

    if (!result.success) {
      showResult('error', result.error || 'Scan failed.');
      return;
    }

    renderScanResult(result.data);
  }

  function renderScanResult(data) {
    const status = data.status; // Success | Late | Duplicate | Invalid

    if (status === 'Invalid') {
      showResult('invalid', 'QR code not recognized.');
      prependLogRow(nowTime(), '—', '—', status);
      return;
    }

    const student = data.student;
    const label = statusLabel(status);

    resultCard.innerHTML =
      '<div class="result-status status-chip ' + status.toLowerCase() + '">' + label + '</div>' +
      '<div class="result-name">' + student.name + '</div>' +
      '<div class="result-meta">Grade ' + student.grade + ' — ' + student.section + '</div>';

    prependLogRow(nowTime(), student.name, 'Grade ' + student.grade + ' / ' + student.section, status);
  }

  function statusLabel(status) {
    switch (status) {
      case 'Success': return 'Marked present';
      case 'Late': return 'Marked late';
      case 'Duplicate': return 'Already recorded today';
      default: return status;
    }
  }

  function showResult(kind, message) {
    resultCard.innerHTML = '<div class="result-empty ' + kind + '">' + message + '</div>';
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

  startBtn.addEventListener('click', startScanner);
  stopBtn.addEventListener('click', stopScanner);

  // Stop the camera cleanly if the user navigates away.
  window.addEventListener('beforeunload', function () {
    if (isRunning) stopScanner();
  });
})();
