/**
 * students.js — Phase 8: Student Management (+ photo upload, bulk import)
 *
 * Loads the full roster once, then filters/searches client-side (fine for
 * a school-sized dataset). Add, edit, and delete all call the
 * corresponding backend actions and then reload the table.
 *
 * Photo upload: the file is read client-side into a base64 data URL
 * (FileReader), then sent to the uploadPhoto_ backend action along with
 * the student's ID — the backend stores it in Drive and writes the
 * resulting URL straight into the Students sheet, so no second "save"
 * call is needed after upload.
 */

(function () {
  if (!SAMS_API.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  const PLACEHOLDER_PHOTO = '../assets/images/school-logo-placeholder.svg';

  let allStudents = [];
  let pendingPhotoDataUrl = null;

  const studentsBody = document.getElementById('studentsBody');
  const searchInput = document.getElementById('searchInput');
  const gradeFilter = document.getElementById('gradeFilter');
  const sectionFilter = document.getElementById('sectionFilter');

  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalError = document.getElementById('modalError');
  const studentForm = document.getElementById('studentForm');
  const photoPreview = document.getElementById('photoPreview');
  const photoInput = document.getElementById('f_photo');

  const bulkModalOverlay = document.getElementById('bulkModalOverlay');
  const bulkError = document.getElementById('bulkError');
  const bulkStatus = document.getElementById('bulkStatus');
  const bulkTextarea = document.getElementById('bulkTextarea');

  document.getElementById('logoutLink').addEventListener('click', async function (e) {
    e.preventDefault();
    await SAMS_API.call('logout', {});
    SAMS_API.setToken(null);
    window.location.href = '../index.html';
  });

  async function loadStudents() {
    const result = await SAMS_API.call('getStudents', {});
    if (!result.success) {
      studentsBody.innerHTML = '<tr><td colspan="7" class="empty-row">' + (result.error || 'Could not load students.') + '</td></tr>';
      return;
    }
    allStudents = (result.data || []).filter(function (s) { return s.Status !== 'Deleted'; });
    populateFilterOptions();
    renderTable();
  }

  function populateFilterOptions() {
    const grades = uniqueSorted(allStudents.map(function (s) { return s.Grade; }));
    const sections = uniqueSorted(allStudents.map(function (s) { return s.Section; }));
    fillSelect(gradeFilter, grades, 'All grades');
    fillSelect(sectionFilter, sections, 'All sections');
  }

  function fillSelect(select, values, placeholderLabel) {
    const current = select.value;
    select.innerHTML = '<option value="">' + placeholderLabel + '</option>' +
      values.map(function (v) { return '<option value="' + v + '">' + v + '</option>'; }).join('');
    select.value = current;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort();
  }

  function renderTable() {
    const search = searchInput.value.trim().toLowerCase();
    const grade = gradeFilter.value;
    const section = sectionFilter.value;

    const filtered = allStudents.filter(function (s) {
      if (grade && String(s.Grade) !== String(grade)) return false;
      if (section && s.Section !== section) return false;
      if (search) {
        const haystack = (s.LastName + ' ' + s.FirstName + ' ' + s.LRN).toLowerCase();
        if (haystack.indexOf(search) === -1) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      studentsBody.innerHTML = '<tr><td colspan="7" class="empty-row">No students match this filter.</td></tr>';
      return;
    }

    studentsBody.innerHTML = filtered.map(function (s) {
      const photoSrc = s.Photo || PLACEHOLDER_PHOTO;
      return '<tr>' +
        '<td><img src="' + photoSrc + '" class="row-thumb" alt="" onerror="this.src=\'' + PLACEHOLDER_PHOTO + '\'" /></td>' +
        '<td>' + escapeHtml(s.LRN) + '</td>' +
        '<td>' + escapeHtml(s.LastName + ', ' + s.FirstName) + '</td>' +
        '<td>' + escapeHtml(s.Grade) + '</td>' +
        '<td>' + escapeHtml(s.Section) + '</td>' +
        '<td><span class="status-chip ' + (s.Status === 'Active' ? 'success' : 'invalid') + '">' + escapeHtml(s.Status) + '</span></td>' +
        '<td class="row-actions">' +
          '<button class="link-btn" data-edit="' + s.StudentID + '">Edit</button>' +
          '<button class="link-btn danger" data-delete="' + s.StudentID + '">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    studentsBody.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { openModal(btn.getAttribute('data-edit')); });
    });
    studentsBody.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () { confirmDelete(btn.getAttribute('data-delete')); });
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function openModal(studentId) {
    modalError.classList.remove('visible');
    studentForm.reset();
    pendingPhotoDataUrl = null;
    photoPreview.src = PLACEHOLDER_PHOTO;

    if (studentId) {
      const s = allStudents.find(function (r) { return String(r.StudentID) === String(studentId); });
      modalTitle.textContent = 'Edit student';
      document.getElementById('f_studentId').value = s.StudentID;
      document.getElementById('f_lrn').value = s.LRN || '';
      document.getElementById('f_lastName').value = s.LastName || '';
      document.getElementById('f_firstName').value = s.FirstName || '';
      document.getElementById('f_middleName').value = s.MiddleName || '';
      document.getElementById('f_gender').value = s.Gender || '';
      document.getElementById('f_grade').value = s.Grade || '';
      document.getElementById('f_section').value = s.Section || '';
      if (s.Photo) photoPreview.src = s.Photo;
    } else {
      modalTitle.textContent = 'Add student';
      document.getElementById('f_studentId').value = '';
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

  async function confirmDelete(studentId) {
    const s = allStudents.find(function (r) { return String(r.StudentID) === String(studentId); });
    const name = s ? (s.FirstName + ' ' + s.LastName) : 'this student';
    if (!window.confirm('Remove ' + name + '? Their attendance history is kept, but they will no longer appear in this list.')) return;

    const result = await SAMS_API.call('deleteStudent', { studentId: studentId });
    if (!result.success) {
      window.alert(result.error || 'Could not delete student.');
      return;
    }
    loadStudents();
  }

  studentForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    modalError.classList.remove('visible');

    const studentId = document.getElementById('f_studentId').value;
    const payload = {
      LRN: document.getElementById('f_lrn').value.trim(),
      LastName: document.getElementById('f_lastName').value.trim(),
      FirstName: document.getElementById('f_firstName').value.trim(),
      MiddleName: document.getElementById('f_middleName').value.trim(),
      Gender: document.getElementById('f_gender').value,
      Grade: document.getElementById('f_grade').value.trim(),
      Section: document.getElementById('f_section').value.trim(),
    };

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    let result;
    let resolvedStudentId = studentId;
    if (studentId) {
      payload.StudentID = studentId;
      result = await SAMS_API.call('editStudent', { student: payload });
    } else {
      result = await SAMS_API.call('addStudent', { student: payload });
      if (result.success) resolvedStudentId = result.data.studentId;
    }

    if (!result.success) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save student';
      modalError.textContent = result.error || 'Could not save student.';
      modalError.classList.add('visible');
      return;
    }

    if (pendingPhotoDataUrl && resolvedStudentId) {
      saveBtn.textContent = 'Uploading photo…';
      const photoResult = await SAMS_API.call('uploadPhoto', {
        targetType: 'student',
        studentId: resolvedStudentId,
        imageBase64: pendingPhotoDataUrl,
        mimeType: (photoInput.files[0] && photoInput.files[0].type) || 'image/jpeg',
      });
      if (!photoResult.success) {
        // The student record itself saved fine — only the photo failed —
        // so let them know without blocking the rest of the workflow.
        window.alert('Student saved, but the photo upload failed: ' + (photoResult.error || 'unknown error'));
      }
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save student';
    closeModal();
    loadStudents();
  });

  document.getElementById('addStudentBtn').addEventListener('click', function () { openModal(null); });
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) closeModal(); });

  searchInput.addEventListener('input', renderTable);
  gradeFilter.addEventListener('change', renderTable);
  sectionFilter.addEventListener('change', renderTable);

  // ---------- Bulk import ----------

  const EXPECTED_HEADERS = ['LRN', 'LastName', 'FirstName', 'MiddleName', 'Gender', 'Grade', 'Section'];

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
      bulkError.textContent = 'Paste at least one row of student data.';
      bulkError.classList.add('visible');
      return;
    }

    const btn = document.getElementById('bulkSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Importing…';

    const result = await SAMS_API.call('bulkImportStudents', { rows: rows });

    btn.disabled = false;
    btn.textContent = 'Import students';

    if (!result.success) {
      bulkError.textContent = result.error || 'Import failed.';
      bulkError.classList.add('visible');
      return;
    }

    bulkStatus.textContent = result.data.created + ' student(s) imported' +
      (result.data.skipped ? ', ' + result.data.skipped + ' row(s) skipped (see below).' : '.');
    if (result.data.errors && result.data.errors.length > 0) {
      bulkStatus.textContent += ' ' + result.data.errors.join(' ');
    }

    loadStudents();
  });

  loadStudents();
})();
