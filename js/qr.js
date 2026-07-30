/**
 * qr.js — Phase 9: QR Generation (frontend)
 *
 * The backend already assigns every student a QRUUID when they're created
 * (see addStudent_ in Students.gs). This page just renders that UUID as an
 * actual scannable QR image, client-side, using the qrcode.js library —
 * no image files are generated or stored server-side.
 *
 * "Print all shown" uses the browser's native print dialog with CSS that
 * hides everything except the card grid, so each card comes out sized for
 * a standard ID card layout.
 */

(function () {
  if (!SAMS_API.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  const LOGO_SRC = '../assets/images/school-logo-placeholder.svg';

  let allStudents = [];

  const cardsGrid = document.getElementById('cardsGrid');
  const searchInput = document.getElementById('searchInput');
  const gradeFilter = document.getElementById('gradeFilter');
  const sectionFilter = document.getElementById('sectionFilter');

  document.getElementById('logoutLink').addEventListener('click', async function (e) {
    e.preventDefault();
    await SAMS_API.call('logout', {});
    SAMS_API.setToken(null);
    window.location.href = '../index.html';
  });

  async function loadStudents() {
    const result = await SAMS_API.call('getStudents', {});
    if (!result.success) {
      cardsGrid.innerHTML = '<p class="empty-row">' + (result.error || 'Could not load students.') + '</p>';
      return;
    }
    allStudents = (result.data || []).filter(function (s) { return s.Status !== 'Deleted' && s.QRUUID; });
    populateFilters();
    renderCards();
  }

  function populateFilters() {
    const grades = uniqueSorted(allStudents.map(function (s) { return s.Grade; }));
    const sections = uniqueSorted(allStudents.map(function (s) { return s.Section; }));
    fillSelect(gradeFilter, grades, 'All grades');
    fillSelect(sectionFilter, sections, 'All sections');
  }

  function fillSelect(select, values, placeholder) {
    const current = select.value;
    select.innerHTML = '<option value="">' + placeholder + '</option>' +
      values.map(function (v) { return '<option value="' + v + '">' + v + '</option>'; }).join('');
    select.value = current;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort();
  }

  function renderCards() {
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
      cardsGrid.innerHTML = '<p class="empty-row">No students match this filter.</p>';
      return;
    }

    cardsGrid.innerHTML = filtered.map(function (s) {
      return '<div class="id-card" data-card="' + s.StudentID + '">' +
        '<div class="id-card-header">' +
          '<img src="' + LOGO_SRC + '" alt="" class="id-card-logo" />' +
          '<div class="id-card-school">Student ID</div>' +
        '</div>' +
        '<div class="id-card-qr" id="qr-' + s.StudentID + '"></div>' +
        '<div class="id-card-name">' + escapeHtml(s.FirstName + ' ' + s.LastName) + '</div>' +
        '<div class="id-card-meta">Grade ' + escapeHtml(s.Grade) + ' — ' + escapeHtml(s.Section) + '</div>' +
        '<div class="id-card-lrn">LRN ' + escapeHtml(s.LRN) + '</div>' +
      '</div>';
    }).join('');

    filtered.forEach(function (s) {
      const el = document.getElementById('qr-' + s.StudentID);
      if (el) {
        new QRCode(el, {
          text: s.QRUUID,
          width: 120,
          height: 120,
          colorDark: '#16283f',
          colorLight: '#ffffff',
        });
      }
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  document.getElementById('printAllBtn').addEventListener('click', function () {
    window.print();
  });

  searchInput.addEventListener('input', renderCards);
  gradeFilter.addEventListener('change', renderCards);
  sectionFilter.addEventListener('change', renderCards);

  loadStudents();
})();
