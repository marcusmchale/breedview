// Small documents for tests of legal references given as files, made here so the tests need no fixture files. As
// breedgraph's tests/breedgraph/utilities/documents.py.

const pdfString = (text) => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

// A PDF with a page for each text given, its lines shown in Helvetica, so a PDF reader finds that text. ASCII only.
export function pdfWithText (...pages) {
  const kids = pages.map((_, i) => `${4 + 2 * i} 0 R`).join(' ')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  pages.forEach((text, i) => {
    const lines = text.split('\n').map((line) => `(${pdfString(line)}) Tj`).join(' T* ')
    const stream = `BT /F1 12 Tf 14 TL 72 720 Td ${lines} ET`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + 2 * i} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`)
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })
  let document = '%PDF-1.4\n'
  const offsets = objects.map((body, i) => {
    const offset = document.length
    document += `${i + 1} 0 obj\n${body}\nendobj\n`
    return offset
  })
  const xref = document.length
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) document += `${String(offset).padStart(10, '0')} 00000 n \n`
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(document, 'latin1')
}
