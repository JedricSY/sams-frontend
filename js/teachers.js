/**
 * teachers.js — Teacher Management (+ photo upload, bulk import)
 */

(function () {
  if (!SAMS_API.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  const PLACEHOLDER_PHOTO = '../assets/images/school-logo-placeholder.svg';

  let allTeachers = [];
  let pendingPhotoDataUrl = null;

  const teachersBody = document.getElementById('teachersBody');
  const searchInput = document.getElementById('searchInput');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalError = document.getElementById('modalError');
  const teacherForm = document.getElementById('teacherForm');
  const photoPreview = document.getElementById('photoPreview');
  const photoInput = document.getElementById('f_photo');

  document.getElementById('logoutLink').addEventListener('click', async function (e) {
    e.preventDefault();
    await SAMS_API.call('logout', {});
    SAMS_API.setToken(null);
    window.location.href = '../index.html';
  });

  async function loadTeachers() {
    const result = await SAMS_API.call('getTeachers', {});
    if (!result.success) {
      teachersBody.innerHTML = '<tr><td colspan="7" class="empty-row">' + (result.error || 'Could not load teachers.') + '</td></tr>';
      return;
    }
    allTeachers = result.data || [];
    renderTable();
  }

  function renderTable() {
    const search = searchInput.value.trim().toLowerCase();
    const filtered = allTeachers.filter(function (t) {
      if (!search) return true;
      return (t.Name + ' ' + t.Email).toLowerCase().indexOf(search) !== -1;
    });

    if (filtered.length === 0) {
      teachersBody.innerHTML = '<tr><td colspan="7" class="empty-row">No teachers match this search.</td></tr>';
      return;
    }

    teachersBody.innerHTML = filtered.map(function (t) {
      const photoSrc = t.Photo || PLACEHOLDER_PHOTO;
      const hasLogin = !!t.AccountID;
      const loginAction = hasLogin
        ? '<button class="link-btn" data-reset="' + t.TeacherID + '">Reset password</button>'
        : '<button class="link-btn" data-generate="' + t.TeacherID + '">Generate login</button>';

      return '<tr>' +
        '<td><img src="' + photoSrc + '" class="row-thumb" alt="" onerror="this.src=\'' + PLACEHOLDER_PHOTO + '\'" /></td>' +
        '<td>' + escapeHtml(t.Name) + '</td>' +
        '<td>' + escapeHtml(t.Email) + '</td>' +
        '<td>' + escapeHtml(t.Phone) + '</td>' +
        '<td>' + escapeHtml(t.SectionAssigned) + '</td>' +
        '<td>' + (hasLogin
          ? '<span class="status-chip success">Has login</span>'
          : '<span class="status-chip invalid">No login yet</span>') + '</td>' +
        '<td class="row-actions">' +
          loginAction + ' ' +
          '<button class="link-btn" data-edit="' + t.TeacherID + '">Edit</button>' +
          '<button class="link-btn danger" data-delete="' + t.TeacherID + '">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    teachersBody.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { openModal(btn.getAttribute('data-edit')); });
    });
    teachersBody.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () { confirmDelete(btn.getAttribute('data-delete')); });
    });
    teachersBody.querySelectorAll('[data-generate]').forEach(function (btn) {
      btn.addEventListener('click', function () { generateLogin(btn.getAttribute('data-generate')); });
    });
    teachersBody.querySelectorAll('[data-reset]').forEach(function (btn) {
      btn.addEventListener('click', function () { resetPassword(btn.getAttribute('data-reset')); });
    });
  }

  const credentialsOverlay = document.getElementById('credentialsOverlay');
  const credentialsBody = document.getElementById('credentialsBody');

  function showCredentials(title, username, tempPassword) {
    document.getElementById('credentialsTitle').textContent = title;
    credentialsBody.innerHTML =
      '<p class="section-sub">Share these with the teacher directly — this is the only time the password is shown. They should change it via Settings → Change password after logging in.</p>' +
      '<div class="credentials-row"><span>Username</span><code>' + escapeHtml(username) + '</code></div>' +
      '<div class="credentials-row"><span>Temporary password</span><code>' + escapeHtml(tempPassword) + '</code></div>';
    credentialsOverlay.classList.add('visible');
  }

  document.getElementById('credentialsCloseBtn').addEventListener('click', function () {
    credentialsOverlay.classList.remove('visible');
  });
  credentialsOverlay.addEventListener('click', function (e) {
    if (e.target === credentialsOverlay) credentialsOverlay.classList.remove('visible');
  });

  async function generateLogin(teacherId) {
    const result = await SAMS_API.call('generateTeacherLogin', { teacherId: teacherId });
    if (!result.success) {
      window.alert(result.error || 'Could not generate a login.');
      return;
    }
    showCredentials('Login created', result.data.username, result.data.tempPassword);
    loadTeachers();
  }

  async function resetPassword(teacherId) {
    if (!window.confirm("This replaces the teacher's current password with a new temporary one. Continue?")) return;
    const result = await SAMS_API.call('resetTeacherPassword', { teacherId: teacherId });
    if (!result.success) {
      window.alert(result.error || 'Could not reset password.');
      return;
    }
    showCredentials('Password reset', result.data.username, result.data.tempPassword);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function openModal(teacherId) {
    modalError.classList.remove('visible');
    teacherForm.reset();
    pendingPhotoDataUrl = null;
    photoPreview.src = PLACEHOLDER_PHOTO;

    if (teacherId) {
      const t = allTeachers.find(function (r) { return String(r.TeacherID) === String(teacherId); });
      modalTitle.textContent = 'Edit teacher';
      document.getElementById('f_teacherId').value = t.TeacherID;
      document.getElementById('f_name').value = t.Name || '';
      document.getElementById('f_email').value = t.Email || '';
      document.getElementById('f_phone').value = t.Phone || '';
      document.getElementById('f_section').value = t.SectionAssigned || '';
      if (t.Photo) photoPreview.src = t.Photo;
    } else {
      modalTitle.textContent = 'Add teacher';
      document.getElementById('f_teacherId').value = '';
    }

    modalOverlay.classList.add('visible');
  }

  function closeModal() {
    modalOverlay.classList.remove('visible');
  }

  photoInput.addEventListener('change', function () {
    const file = photoInput.files[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      modalError.textContent = 'Photo is too large (max 4MB).';
      modalError.classList.add('visible');
      photoInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      pendingPhotoDataUrl = reader.result;
      photoPreview.src = pendingPhotoDataUrl;
    };
    reader.readAsDataURL(file);
  });

  async function confirmDelete(teacherId) {
    const t = allTeachers.find(function (r) { return String(r.TeacherID) === String(teacherId); });
    const name = t ? t.Name : 'this teacher';
    if (!window.confirm('Remove ' + name + ' from the teacher list?')) return;

    const result = await SAMS_API.call('deleteTeacher', { teacherId: teacherId });
    if (!result.success) {
      window.alert(result.error || 'Could not delete teacher.');
      return;
    }
    loadTeachers();
  }

  teacherForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    modalError.classList.remove('visible');

    const teacherId = document.getElementById('f_teacherId').value;
    const payload = {
      Name: document.getElementById('f_name').value.trim(),
      Email: document.getElementById('f_email').value.trim(),
      Phone: document.getElementById('f_phone').value.trim(),
      SectionAssigned: document.getElementById('f_section').value.trim(),
    };

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    let result;
    let resolvedTeacherId = teacherId;
    if (teacherId) {
      payload.TeacherID = teacherId;
      result = await SAMS_API.call('editTeacher', { teacher: payload });
    } else {
      result = await SAMS_API.call('addTeacher', { teacher: payload });
      if (result.success) resolvedTeacherId = result.data.teacherId;
    }

    if (!result.success) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save teacher';
      modalError.textContent = result.error || 'Could not save teacher.';
      modalError.classList.add('visible');
      return;
    }

    if (pendingPhotoDataUrl && resolvedTeacherId) {
      saveBtn.textContent = 'Uploading photo…';
      const photoResult = await SAMS_API.call('uploadPhoto', {
        targetType: 'teacher',
        teacherId: resolvedTeacherId,
        imageBase64: pendingPhotoDataUrl,
        mimeType: (photoInput.files[0] && photoInput.files[0].type) || 'image/jpeg',
      });
      if (!photoResult.success) {
        window.alert('Teacher saved, but the photo upload failed: ' + (photoResult.error || 'unknown error'));
      }
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save teacher';
    closeModal();
    loadTeachers();
  });

  document.getElementById('addTeacherBtn').addEventListener('click', function () { openModal(null); });
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) closeModal(); });
  searchInput.addEventListener('input', renderTable);

  // ---------- Bulk import ----------

  const EXPECTED_HEADERS = ['Name', 'Email', 'Phone', 'SectionAssigned'];
  const bulkModalOverlay = document.getElementById('bulkModalOverlay');
  const bulkError = document.getElementById('bulkError');
  const bulkStatus = document.getElementById('bulkStatus');
  const bulkTextarea = document.getElementById('bulkTextarea');

  document.getElementById('bulkImportBtn').addEventListener('click', function () {
    bulkError.classList.remove('visible');
    bulkStatus.textContent = '';
    bulkTextarea.value = '';
    bulkModalOverlay.classList.add('visible');
  });

  document.getElementById('bulkCancelBtn').addEventListener('click', function () {
    bulkModalOverlay.classList.remove('visible');
  });

  bulkModalOverlay.addEventListener('click', function (e) {
    if (e.target === bulkModalOverlay) bulkModalOverlay.classList.remove('visible');
  });

  document.getElementById('bulkSubmitBtn').addEventListener('click', async function () {
    bulkError.classList.remove('visible');
    bulkStatus.textContent = '';

    const rows = CsvUtils.parse(bulkTextarea.value, EXPECTED_HEADERS);
    if (rows.length === 0) {
      bulkError.textContent = 'Paste at least one row of teacher data.';
      bulkError.classList.add('visible');
      return;
    }

    const btn = document.getElementById('bulkSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Importing…';

    const result = await SAMS_API.call('bulkImportTeachers', { rows: rows });

    btn.disabled = false;
    btn.textContent = 'Import teachers';

    if (!result.success) {
      bulkError.textContent = result.error || 'Import failed.';
      bulkError.classList.add('visible');
      return;
    }

    bulkStatus.textContent = result.data.created + ' teacher(s) imported' +
      (result.data.skipped ? ', ' + result.data.skipped + ' row(s) skipped (see below).' : '.');
    if (result.data.errors && result.data.errors.length > 0) {
      bulkStatus.textContent += ' ' + result.data.errors.join(' ');
    }

    loadTeachers();
  });

  loadTeachers();
})();
