/**
 * reports.js — CSV Export / Reports
 *
 * "Generate report" calls exportCSV_ on the backend and shows a quick
 * on-screen preview (first 20 rows) so you can sanity-check the filters
 * before downloading. "Download CSV" turns the returned CSV string into a
 * Blob and triggers a normal browser file download — no extra backend
 * round-trip needed since the CSV text is already in hand.
 */

(function () {
  if (!SAMS_API.isLoggedIn()) {
    window.location.href = '../index.html';
    return;
  }

  const PREVIEW_ROW_LIMIT = 20;

  let lastCsv = '';
  let lastFilename = '';

  const generateBtn = document.getElementById('generateBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const reportStatus = document.getElementById('reportStatus');
  const previewCard = document.getElementById('previewCard');
  const previewTable = document.getElementById('previewTable');
  const reportSummary = document.getElementById('reportSummary');

  document.getElementById('logoutLink').addEventListener('click', async function (e) {
    e.preventDefault();
    await SAMS_API.call('logout', {});
    SAMS_API.setToken(null);
    window.location.href = '../index.html';
  });

  function currentFilters() {
    const filters = {};
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const session = document.getElementById('sessionFilter').value;
    const grade = document.getElementById('gradeFilter').value.trim();
    const section = document.getElementById('sectionFilter').value.trim();

    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (session) filters.session = session;
    if (grade) filters.grade = grade;
    if (section) filters.section = section;
    return filters;
  }

  generateBtn.addEventListener('click', async function () {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating…';
    reportStatus.textContent = '';
    downloadBtn.disabled = true;
    previewCard.style.display = 'none';

    const result = await SAMS_API.call('exportCSV', currentFilters());

    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate report';

    if (!result.success) {
      reportStatus.textContent = result.error || 'Could not generate report.';
      return;
    }

    lastCsv = result.data.csv;
    lastFilename = result.data.filename;

    if (result.data.rowCount === 0) {
      reportStatus.textContent = 'No attendance records match these filters.';
      return;
    }

    reportStatus.textContent = '';
    downloadBtn.disabled = false;
    renderPreview(lastCsv, result.data.rowCount);
  });

  downloadBtn.addEventListener('click', function () {
    if (!lastCsv) return;
    const blob = new Blob([lastCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = lastFilename || 'attendance_export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  function renderPreview(csv, rowCount) {
    const lines = csv.split('\r\n').filter(function (l) { return l.length > 0; });
    const headerLine = lines[0];
    const dataLines = lines.slice(1, 1 + PREVIEW_ROW_LIMIT);

    const headerCells = parseCsvLine(headerLine);
    let html = '<thead><tr>' + headerCells.map(function (h) { return '<th>' + escapeHtml(h) + '</th>'; }).join('') + '</tr></thead>';
    html += '<tbody>' + dataLines.map(function (line) {
      const cells = parseCsvLine(line);
      return '<tr>' + cells.map(function (c) { return '<td>' + escapeHtml(c) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody>';

    previewTable.innerHTML = html;
    reportSummary.textContent = rowCount + ' record' + (rowCount === 1 ? '' : 's') + ' total' +
      (rowCount > PREVIEW_ROW_LIMIT ? ' — showing first ' + PREVIEW_ROW_LIMIT + ' below' : '') + '.';
    previewCard.style.display = 'block';
  }

  // Minimal CSV line parser matching the quoting rules used by csvRow_ on
  // the backend (quotes fields containing commas/quotes/newlines).
  function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (char === '"') { inQuotes = false; }
        else { current += char; }
      } else {
        if (char === '"') inQuotes = true;
        else if (char === ',') { cells.push(current); current = ''; }
        else current += char;
      }
    }
    cells.push(current);
    return cells;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
