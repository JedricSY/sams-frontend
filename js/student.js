/**
 * student.js — Student portal
 *
 * Deliberately narrow: a student can see their own profile and their own
 * attendance history, and log out. Nothing else. getProfile_ already
 * returns the matching Students row when the account's Role is 'Student'
 * (see Auth.gs), and getAttendance_ already accepts a studentId filter, so
 * this page just wires those two together — no new backend endpoints
 * needed.
 *
 * If a non-student account somehow lands here, this bounces them to the
 * admin dashboard instead of showing an empty/broken student view.
 */

(function () {
  if (!SAMS_API.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  const PLACEHOLDER_PHOTO = '../assets/images/school-logo-placeholder.svg';
  const profileCard = document.getElementById('profileCard');
  const attendanceBody = document.getElementById('attendanceBody');

  document.getElementById('logoutLink').addEventListener('click', async function (e) {
    e.preventDefault();
    await SAMS_API.call('logout', {});
    SAMS_API.setToken(null);
    window.location.href = '../index.html';
  });

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function init() {
    const profileResult = await SAMS_API.call('getProfile', {});
    if (!profileResult.success) {
      profileCard.innerHTML = '<div class="student-profile-loading">' +
        escapeHtml(profileResult.error || 'Could not load your profile.') + '</div>';
      return;
    }

    const profile = profileResult.data;

    if (profile.role !== 'Student' || !profile.student) {
      // Wrong portal for this account — send them where they belong
      // instead of showing a broken/empty student view.
      window.location.href = 'dashboard.html';
      return;
    }

    const s = profile.student;
    const photoSrc = s.Photo || PLACEHOLDER_PHOTO;

    profileCard.innerHTML =
      '<img src="' + photoSrc + '" alt="" class="student-profile-photo" onerror="this.src=\'' + PLACEHOLDER_PHOTO + '\'" />' +
      '<div>' +
        '<div class="student-profile-name">' + escapeHtml(s.FirstName + ' ' + s.LastName) + '</div>' +
        '<div class="student-profile-meta">Grade ' + escapeHtml(s.Grade) + ' — ' + escapeHtml(s.Section) + '</div>' +
        '<div class="student-profile-meta">LRN ' + escapeHtml(s.LRN) + '</div>' +
      '</div>';

    const attendanceResult = await SAMS_API.call('getAttendance', { studentId: s.StudentID });
    if (!attendanceResult.success) {
      attendanceBody.innerHTML = '<tr><td colspan="4" class="empty-row">' +
        escapeHtml(attendanceResult.error || 'Could not load your attendance.') + '</td></tr>';
      return;
    }

    const records = (attendanceResult.data || []).slice().sort(function (a, b) {
      return new Date(b.Timestamp) - new Date(a.Timestamp);
    });

    if (records.length === 0) {
      attendanceBody.innerHTML = '<tr><td colspan="4" class="empty-row">No attendance recorded yet.</td></tr>';
      return;
    }

    attendanceBody.innerHTML = records.map(function (r) {
      const ts = new Date(r.Timestamp);
      const dateStr = isNaN(ts) ? '' : ts.toLocaleDateString();
      const timeStr = isNaN(ts) ? '' : ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const statusClass = (r.Status || '').toLowerCase();

      return '<tr>' +
        '<td>' + dateStr + '</td>' +
        '<td>' + timeStr + '</td>' +
        '<td>' + escapeHtml(r.Session) + '</td>' +
        '<td><span class="status-chip ' + statusClass + '">' + escapeHtml(r.Status) + '</span></td>' +
      '</tr>';
    }).join('');
  }

  init();
})();
