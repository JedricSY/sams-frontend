/**
 * teachers.js — Teacher Management
 */

(function () {
  if (!SAMS_API.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  let allTeachers = [];

  const teachersBody = document.getElementById('teachersBody');
  const searchInput = document.getElementById('searchInput');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalError = document.getElementById('modalError');
  const teacherForm = document.getElementById('teacherForm');

  document.getElementById('logoutLink').addEventListener('click', async function (e) {
    e.preventDefault();
    await SAMS_API.call('logout', {});
    SAMS_API.setToken(null);
    window.location.href = '../index.html';
  });

  async function loadTeachers() {
    const result = await SAMS_API.call('getTeachers', {});
    if (!result.success) {
      teachersBody.innerHTML = '<tr><td colspan="5" class="empty-row">' + (result.error || 'Could not load teachers.') + '</td></tr>';
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
      teachersBody.innerHTML = '<tr><td colspan="5" class="empty-row">No teachers match this search.</td></tr>';
      return;
    }

    teachersBody.innerHTML = filtered.map(function (t) {
      return '<tr>' +
        '<td>' + escapeHtml(t.Name) + '</td>' +
        '<td>' + escapeHtml(t.Email) + '</td>' +
        '<td>' + escapeHtml(t.Phone) + '</td>' +
        '<td>' + escapeHtml(t.SectionAssigned) + '</td>' +
        '<td class="row-actions">' +
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
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function openModal(teacherId) {
    modalError.classList.remove('visible');
    teacherForm.reset();

    if (teacherId) {
      const t = allTeachers.find(function (r) { return String(r.TeacherID) === String(teacherId); });
      modalTitle.textContent = 'Edit teacher';
      document.getElementById('f_teacherId').value = t.TeacherID;
      document.getElementById('f_name').value = t.Name || '';
      document.getElementById('f_email').value = t.Email || '';
      document.getElementById('f_phone').value = t.Phone || '';
      document.getElementById('f_section').value = t.SectionAssigned || '';
    } else {
      modalTitle.textContent = 'Add teacher';
      document.getElementById('f_teacherId').value = '';
    }

    modalOverlay.classList.add('visible');
  }

  function closeModal() {
    modalOverlay.classList.remove('visible');
  }

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

    let result;
    if (teacherId) {
      payload.TeacherID = teacherId;
      result = await SAMS_API.call('editTeacher', { teacher: payload });
    } else {
      result = await SAMS_API.call('addTeacher', { teacher: payload });
    }

    if (!result.success) {
      modalError.textContent = result.error || 'Could not save teacher.';
      modalError.classList.add('visible');
      return;
    }

    closeModal();
    loadTeachers();
  });

  document.getElementById('addTeacherBtn').addEventListener('click', function () { openModal(null); });
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) closeModal(); });
  searchInput.addEventListener('input', renderTable);

  loadTeachers();
})();
