// The printable report of an analysis's summary download (useAnalysisSummary.js): one self-contained HTML page, its
// styles inline and nothing fetched, that a browser opens offline and prints to PDF. Every text is escaped; the charts
// are the result's SVGs as the page drew them. The tables are summaryTables.js's, formatted as the result views format
// them. Imports nothing from Vue or the app, so the unit tests can load it.
import { formatNumber, formatPValue } from '../../components/analysis/results/format.js'

export const escapeHtml = (text) => String(text ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const SHARE = (value) => (value == null ? '—' : `${Math.round(value * 100)}%`)

/** A cell as the report shows it, by its column's format */
export function formatCell (value, format) {
  if (format === 'text') return value == null ? '' : String(value)
  if (typeof value === 'string') return value
  if (format === 'p') return formatPValue(value)
  if (format === 'df') return formatNumber(value, 3)
  if (format === 'r') return formatNumber(value, 3)
  if (format === 'share') return SHARE(value)
  return formatNumber(value)
}

function tableHtml (table) {
  const head = table.columns
    .map((c) => `<th${c.format === 'text' ? '' : ' class="num"'}>${escapeHtml(c.label)}</th>`).join('')
  const body = table.rows.map((row, i) => {
    const cells = row.map((value, j) => {
      const { format } = table.columns[j]
      const mark = format === 'p' && table.significant?.[i] ? '<span class="sig">*</span>' : ''
      return `<td${format === 'text' ? '' : ' class="num"'}>${escapeHtml(formatCell(value, format))}${mark}</td>`
    }).join('')
    return `<tr${table.significant?.[i] ? ' class="significant"' : ''}>${cells}</tr>`
  }).join('\n')
  return `<section class="table">
<h3>${escapeHtml(table.title)}</h3>
${table.note ? `<p class="note">${escapeHtml(table.note)}</p>\n` : ''}<table>
<thead><tr>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
<p class="file">Also in <code>${escapeHtml(table.file)}.csv</code>, at full precision.</p>
</section>`
}

const STYLE = `
body { font-family: "Noto Sans", "DejaVu Sans", Arial, sans-serif; font-size: 10.5pt; color: #111; margin: 24px; max-width: 1100px; }
h1 { font-size: 18pt; margin: 0 0 4px; }
h2 { font-size: 13pt; margin: 22px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
h3 { font-size: 11pt; margin: 16px 0 4px; }
.meta, .note, .file { color: #555; font-size: 9.5pt; margin: 2px 0 6px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; }
dt { color: #555; }
dd { margin: 0; }
table { border-collapse: collapse; margin: 4px 0; font-size: 9.5pt; }
th, td { border: 1px solid #ccc; padding: 3px 6px; text-align: left; vertical-align: top; }
th { background: #f3f3f3; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr.significant td { background: #fff4d6; }
.sig { color: #a15c00; margin-left: 2px; }
.messages li { margin: 2px 0; }
.chart { margin: 8px 0 8px 48px; page-break-inside: avoid; }
.chart svg { max-width: 100%; height: auto; overflow: visible; }
section.table { page-break-inside: avoid; }
code { font-size: 9pt; }
@media print { body { margin: 0; } }
`

/**
 * The report: { title, generated (Date), site, analysis: { id, type }, datasets: [{ name, study, licence }], settings:
 * [[label, value]], errors, warnings, tables, charts: [svg markup], files: [file names in the archive] }
 */
export function summaryReport ({ title, generated, site, analysis, datasets, settings, errors, warnings, tables, charts, files }) {
  const when = generated.toISOString().replace('T', ' ').slice(0, 16)
  const datasetRows = datasets.map((d) => `<tr><td>${escapeHtml(d.name)}</td><td>${escapeHtml(d.study)}</td>` +
    `<td>${escapeHtml(d.licence ?? 'None: private to the teams that hold it')}</td></tr>`).join('\n')
  const settingRows = settings.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('\n')
  const messages = [
    ...errors.map((m) => `<li><strong>Error:</strong> ${escapeHtml(m)}</li>`),
    ...warnings.map((m) => `<li><strong>Warning:</strong> ${escapeHtml(m)}</li>`)
  ]
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">BreedGraph analysis ${escapeHtml(analysis.id)}, ${escapeHtml(analysis.type)}. Downloaded ${escapeHtml(when)} UTC from
${escapeHtml(site)}.</p>

<h2>Data</h2>
<table>
<thead><tr><th>Dataset</th><th>Study</th><th>Licence of the study</th></tr></thead>
<tbody>
${datasetRows}
</tbody>
</table>
<p class="note">These results come from the data of the studies above. Give the credit their licences ask, and use and
pass on the results only as the licences allow. Cite BreedGraph, and the studies, the people credited and the
references the data names.</p>

<h2>Settings</h2>
<dl>
${settingRows}
</dl>
<p class="note">The settings in full, as submitted, are in <code>analysis.json</code>.</p>
${messages.length ? `\n<h2>Messages</h2>\n<ul class="messages">\n${messages.join('\n')}\n</ul>\n` : ''}
<h2>Results</h2>
${tables.length ? tables.map(tableHtml).join('\n') : '<p class="note">No results.</p>'}
${charts.length ? `\n<h2>Charts</h2>\n${charts.map((svg) => `<div class="chart">${svg}</div>`).join('\n')}\n` : ''}
<h2>Files</h2>
<p class="note">${files.map((f) => `<code>${escapeHtml(f)}</code>`).join(', ')}</p>
</body>
</html>
`
}
