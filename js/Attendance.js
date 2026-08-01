/**
 * attendance.js — Attendance record viewer (read-only)
 *
 * getAttendance_ returns raw rows keyed by StudentID; this joins them
 * against the student roster client-side so the table can show names
 * instead of bare IDs.
 */

(function () {
  if (!SAMS_API.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  const attendanceBody = document.getElementById('attendanceBody');
  let studentById = {};

  document.getElementById('logoutLink').addEventListener('click', async function (e) {
    e.preventDefault();
    await SAMS_API.call('logout', {});
    SAMS_API.setToken(null);
    window.location.href = '../index.html';
  });

  async function loadStudentIndex() {
    const result = await SAMS_API.call('getStudents', {});
    if (result.success) {
      (result.data || []).forEach(function (s) { studentById[s.StudentID] = s; });
    }
  }

  async function loadAttendance() {
    attendanceBody.innerHTML = '<tr><td colspan="6" class="empty-row">Loading attendance…</td></tr>';

    const filters = {};
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const session = document.getElementById('sessionFilter').value;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (session) filters.session = session;

    const result = await SAMS_API.call('getAttendance', filters);
    if (!result.success) {
      attendanceBody.innerHTML = '<tr><td colspan="6" class="empty-row">' + (result.error || 'Could not load attendance.') + '</td></tr>';
      return;
    }

    const records = (result.data || []).slice().sort(function (a, b) {
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });

    if (records.length === 0) {
      attendanceBody.innerHTML = '<tr><td colspan="6" class="empty-row">No records match this filter.</td></tr>';
      return;
    }

    attendanceBody.innerHTML = records.map(function (r) {
      const s = studentById[r.StudentID];
      const name = s ? (s.LastName + ', ' + s.FirstName) : ('Student #' + r.StudentID);
      const ts = new Date(r.Timestamp);
      const dateStr = isNaN(ts) ? '' : ts.toLocaleDateString();
      const timeStr = isNaN(ts) ? '' : ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const statusClass = (r.Status || '').toLowerCase();

      return '<tr>' +
        '<td>' + dateStr + '</td>' +
        '<td>' + timeStr + '</td>' +
        '<td>' + escapeHtml(name) + '</td>' +
        '<td>' + escapeHtml(r.Session) + '</td>' +
        '<td><span class="status-chip ' + statusClass + '">' + escapeHtml(r.Status) + '</span></td>' +
        '<td>' + escapeHtml(r.Gate) + '</td>' +
      '</tr>';
    }).join('');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  document.getElementById('filterBtn').addEventListener('click', loadAttendance);

  document.getElementById('showAllBtn').addEventListener('click', function () {
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    loadAttendance();
  });

  function setDefaultDateRange() {
    // Loading the entire history by default gets slower every day the
    // school uses this — defaulting to "today" keeps the common case fast.
    // The date inputs are still fully editable for anyone who wants a
    // wider range; it just costs more time the wider it gets.
    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    document.getElementById('dateFrom').value = todayStr;
    document.getElementById('dateTo').value = todayStr;
  }

  (async function init() {
    setDefaultDateRange();
    await loadStudentIndex();
    await loadAttendance();
  })();
})();
