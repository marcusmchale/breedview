// A small markdown renderer for text people write, such as the privacy notice and licences given as markdown files.
// It escapes everything first, then makes only attribute-free tags (headings, paragraphs, lists, rules, bold and
// italics) and links, whose addresses must be http, https or mailto, so what it returns is safe for v-html.

const escape = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const LINKABLE = /^(https?:\/\/|mailto:)/i

// [text](address), **bold** and *italics*, in text escaped first; a link to any other kind of address stays as written
const inline = (text) => escape(text)
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (written, label, address) => (LINKABLE.test(address)
    ? `<a href="${address}" target="_blank" rel="noopener noreferrer">${label}</a>`
    : written))
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')

// Line by line: headings (# to ######), paragraphs, lists of `-`, `*` or `+` items or of numbered items (`1.` or
// `1)`), and `---` rules. Lines of a paragraph or item are joined, as markdown does.
export function renderMarkdown (md) {
  const blocks = []
  let paragraph = []
  let items = []
  let numbered = false
  const close = () => {
    if (paragraph.length) blocks.push(`<p>${inline(paragraph.join(' '))}</p>`)
    if (items.length) {
      const tag = numbered ? 'ol' : 'ul'
      blocks.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`)
    }
    paragraph = []
    items = []
  }
  for (const line of md.split(/\r?\n/).map((line) => line.trim())) {
    const heading = line.match(/^(#{1,6}) (.*)$/)
    const item = line.match(/^[-*+] (.*)$/) ?? line.match(/^\d+[.)] (.*)$/)
    if (heading) {
      close()
      blocks.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`)
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      close()
      blocks.push('<hr>')
    } else if (item) {
      const isNumbered = /^\d/.test(line)
      if (paragraph.length || (items.length && isNumbered !== numbered)) close()
      numbered = isNumbered
      items.push(item[1])
    } else if (!line) {
      close()
    } else if (items.length) {
      items[items.length - 1] += ` ${line}` // the last item continues
    } else {
      paragraph.push(line)
    }
  }
  close()
  return blocks.join('\n')
}
