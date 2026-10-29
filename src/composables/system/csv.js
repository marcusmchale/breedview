// CSV text for a table, as RFC 4180 has it: a cell quoted where it holds a comma, a quote or a line break, lines ended
// by CRLF, after a byte order mark so that spreadsheets read it as UTF-8. Numbers are written in full; a missing value
// is an empty cell. Text a spreadsheet would take for a formula (=, +, -, @, a tab or a carriage return first) is
// prefixed with an apostrophe, as names come from users. Imports nothing, so the unit tests can load it.

const FORMULA_START = /^[=+\-@\t\r]/

function cell (value) {
  if (value == null) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let text = String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** The CSV of a header row and rows, each an array of cells */
export function toCsv (header, rows) {
  return '\uFEFF' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
