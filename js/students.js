/**
 * students.js — Phase 8: Student Management
 *
 * Loads the full roster once, then filters/searches client-side (fine for
 * a school-sized dataset — a few hundred to a couple thousand rows). Add,
 * edit, and delete all call the corresponding backend actions and then
 * reload the table so what you see always matches the sheet.
 */

(function () {
  if (!SAMS_API.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  let allStudents = [];

  const studentsBody = document.getElementById('studentsBody');
  const searchInput = document.getElementById('searchInput');
  const gradeFilter = document.getElementById('gradeFilter');
  const sectionFilter = document.getElementById('sectionFilter');

  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalError = document.getElementById('modalError');
  const studentForm = document.getElementById('studentForm');

  document.getElementById('logoutLink').addEventListener('click', async function (e) {
    e.preventDefault();
    await SAMS_API.call('logout', {});
    SAMS_API.setToken(null);
    window.location.href = '../index.html';
  });

  async function loadStudents() {
    const result = await SAMS_API.call('getStudents', {});
    if (!result.success) {
      studentsBody.innerHTML = '<tr><td colspan="6" class="empty-row">' + (result.error || 'Could not load students.') + '</td></tr>';
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
      studentsBody.innerHTML = '<tr><td colspan="6" class="empty-row">No students match this filter.</td></tr>';
      return;
    }

    studentsBody.innerHTML = filtered.map(function (s) {
      return '<tr>' +
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
    } else {
      modalTitle.textContent = 'Add student';
      document.getElementById('f_studentId').value = '';
    }

    modalOverlay.classList.add('visible');
  }

  function closeModal() {
    modalOverlay.classList.remove('visible');
  }

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

    let result;
    if (studentId) {
      payload.StudentID = studentId;
      result = await SAMS_API.call('editStudent', { student: payload });
    } else {
      result = await SAMS_API.call('addStudent', { student: payload });
    }

    if (!result.success) {
      modalError.textContent = result.error || 'Could not save student.';
      modalError.classList.add('visible');
      return;
    }

    closeModal();
    loadStudents();
  });

  document.getElementById('addStudentBtn').addEventListener('click', function () { openModal(null); });
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) closeModal(); });

  searchInput.addEventListener('input', renderTable);
  gradeFilter.addEventListener('change', renderTable);
  sectionFilter.addEventListener('change', renderTable);

  loadStudents();
})();
