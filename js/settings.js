/**
 * settings.js — Attendance Sessions config + Change Password
 */

(function () {
  if (!SAMS_API.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  const sessionsList = document.getElementById('sessionsList');
  const sessionsError = document.getElementById('sessionsError');
  const sessionsStatus = document.getElementById('sessionsStatus');
  const saveSessionsBtn = document.getElementById('saveSessionsBtn');

  const passwordForm = document.getElementById('passwordForm');
  const passwordError = document.getElementById('passwordError');
  const passwordStatus = document.getElementById('passwordStatus');
  const savePasswordBtn = document.getElementById('savePasswordBtn');

  const logoError = document.getElementById('logoError');
  const logoStatus = document.getElementById('logoStatus');
  const logoPreview = document.getElementById('logoPreview');
  const logoInput = document.getElementById('f_logo');

  document.getElementById('logoutLink').addEventListener('click', async function (e) {
    e.preventDefault();
    await SAMS_API.call('logout', {});
    SAMS_API.setToken(null);
    window.location.href = '../index.html';
  });

  // ---------- School branding ----------

  SAMS_API.getBranding().then(function (result) {
    if (result.success && result.data && result.data.logoUrl) {
      logoPreview.src = result.data.logoUrl;
    }
  });

  logoInput.addEventListener('change', async function () {
    const file = logoInput.files[0];
    if (!file) return;

    logoError.classList.remove('visible');
    logoStatus.textContent = '';

    if (file.size > 4 * 1024 * 1024) {
      logoError.textContent = 'Logo image is too large (max 4MB).';
      logoError.classList.add('visible');
      logoInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async function () {
      logoPreview.src = reader.result;
      logoStatus.textContent = 'Uploading…';

      const result = await SAMS_API.call('uploadPhoto', {
        targetType: 'school',
        imageBase64: reader.result,
        mimeType: file.type || 'image/png',
      });

      if (!result.success) {
        logoError.textContent = result.error || 'Could not upload logo.';
        logoError.classList.add('visible');
        logoStatus.textContent = '';
        return;
      }

      logoStatus.textContent = 'Logo updated. It will appear on other pages next time they load.';
      setTimeout(function () { logoStatus.textContent = ''; }, 5000);
    };
    reader.readAsDataURL(file);
  });

  // ---------- Attendance session times ----------

  let sessions = [];

  async function loadSessions() {
    const result = await SAMS_API.call('getAttendanceSessions', {});
    if (!result.success) {
      sessionsList.innerHTML = '';
      sessionsError.textContent = result.error || 'Could not load session settings.';
      sessionsError.classList.add('visible');
      return;
    }
    sessions = result.data || [];
    renderSessions();
  }

  function renderSessions() {
    sessionsList.innerHTML = sessions.map(function (s, i) {
      return '<div class="session-row">' +
        '<div class="session-name">' + escapeHtml(s.Name) + '</div>' +
        '<label class="session-time-label">Start time' +
          '<input type="time" data-index="' + i + '" value="' + escapeHtml(s.StartTime || '') + '" />' +
        '</label>' +
      '</div>';
    }).join('');
  }

  saveSessionsBtn.addEventListener('click', async function () {
    sessionsError.classList.remove('visible');
    sessionsStatus.textContent = '';

    const inputs = sessionsList.querySelectorAll('input[data-index]');
    inputs.forEach(function (input) {
      const idx = parseInt(input.getAttribute('data-index'), 10);
      sessions[idx].StartTime = input.value;
    });

    saveSessionsBtn.disabled = true;
    saveSessionsBtn.textContent = 'Saving…';

    const result = await SAMS_API.call('saveAttendanceSessions', { sessions: sessions });

    saveSessionsBtn.disabled = false;
    saveSessionsBtn.textContent = 'Save session times';

    if (!result.success) {
      sessionsError.textContent = result.error || 'Could not save session times.';
      sessionsError.classList.add('visible');
      return;
    }
    sessionsStatus.textContent = 'Saved.';
    setTimeout(function () { sessionsStatus.textContent = ''; }, 3000);
  });

  // ---------- Change password ----------

  passwordForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    passwordError.classList.remove('visible');
    passwordStatus.textContent = '';

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
      passwordError.textContent = 'New password and confirmation do not match.';
      passwordError.classList.add('visible');
      return;
    }

    savePasswordBtn.disabled = true;
    savePasswordBtn.textContent = 'Updating…';

    const result = await SAMS_API.call('changePassword', {
      currentPassword: currentPassword,
      newPassword: newPassword,
    });

    savePasswordBtn.disabled = false;
    savePasswordBtn.textContent = 'Update password';

    if (!result.success) {
      passwordError.textContent = result.error || 'Could not update password.';
      passwordError.classList.add('visible');
      return;
    }

    passwordForm.reset();
    passwordStatus.textContent = 'Password updated.';
    setTimeout(function () { passwordStatus.textContent = ''; }, 4000);
  });

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  loadSessions();
})();
