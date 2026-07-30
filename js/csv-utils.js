/**
 * csv-utils.js
 * Minimal CSV parser shared by any page that needs to read pasted CSV text
 * (currently: bulk import on Students and Teachers). Handles quoted fields
 * containing commas — good enough for hand-edited spreadsheet exports
 * without pulling in a full library.
 */

const CsvUtils = (function () {
  function parseLine(line) {
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
    return cells.map(function (c) { return c.trim(); });
  }

  // Parses CSV text into an array of objects, one per data row, keyed by
  // `expectedHeaders` (case-insensitive match against the first line if it
  // looks like a header row; otherwise every line is treated as data and
  // mapped positionally to expectedHeaders).
  function parse(text, expectedHeaders) {
    const lines = text.split(/\r\n|\n|\r/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
    if (lines.length === 0) return [];

    const firstCells = parseLine(lines[0]).map(function (c) { return c.toLowerCase(); });
    const looksLikeHeader = expectedHeaders.some(function (h) { return firstCells.indexOf(h.toLowerCase()) !== -1; });

    let headerRow = expectedHeaders;
    let dataLines = lines;

    if (looksLikeHeader) {
      headerRow = parseLine(lines[0]);
      dataLines = lines.slice(1);
    }

    return dataLines.map(function (line) {
      const cells = parseLine(line);
      const obj = {};
      headerRow.forEach(function (h, i) { obj[h] = cells[i] !== undefined ? cells[i] : ''; });
      return obj;
    });
  }

  return { parse: parse, parseLine: parseLine };
})();
