// A small markdown renderer for text people write, such as the privacy notice and licences given as markdown files.
// It escapes everything first, then makes only attribute-free tags (headings, paragraphs, lists, rules, bold and
// italics) and links, whose addresses must be http, https or mailto, so what it returns is safe for v-html.
//
// The user guide's chapters (src/guide/chapters), which we write, take options for what they need, each as safe:
// - media: name => url, for images given as the bare file name of a picture in the guide's media ([alt](shot.png));
// - internalLinks: links to a path within the app (/guide/joining), opened in the same tab; or, as a function of the
//   path, only where it returns true, a link elsewhere showing as its text alone (a chapter not yet written);
// - base: the path the app is served under (/demo/), which an internal link's address is given under;
// - tables: pipe tables, their cells as inline text;
// - callouts: names of the boxes `> [!NAME]` may open (an aside, class callout-<name>); other quotes are blockquotes;
// - code: `code` spans.
// Without options the output is as it always was.

const escape = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const LINKABLE = /^(https?:\/\/|mailto:)/i
// a path within the app: one slash, then the characters of a path, a query and a fragment, but no &, so nothing
// escaped for HTML (<, >, ") gets in
const INTERNAL = /^\/(?!\/)[\w\-./#?=%]*$/
// a picture of the guide's media, by its bare file name
const PICTURE = /^[\w.-]+\.(png|jpe?g|webp|gif)$/i

// [text](address), **bold** and *italics*, in text escaped first; a link to any other kind of address stays as written
const inline = (text, options = {}) => {
  let html = escape(text)
  if (options.code) html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  if (options.media) {
    html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (written, alt, name) => (PICTURE.test(name)
      ? `<img src="${options.media(name)}" alt="${alt}">`
      : written))
  }
  return html
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (written, label, address) => {
      if (LINKABLE.test(address)) return `<a href="${address}" target="_blank" rel="noopener noreferrer">${label}</a>`
      if (options.internalLinks && INTERNAL.test(address)) {
        if (typeof options.internalLinks === 'function' && !options.internalLinks(address)) return label
        return `<a href="${(options.base ?? '/').replace(/\/$/, '')}${address}">${label}</a>`
      }
      return written
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

const cells = (line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
const TABLE_RULE = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/

// Line by line: headings (# to ######), paragraphs, lists of `-`, `*` or `+` items or of numbered items (`1.` or
// `1)`), and `---` rules. Lines of a paragraph or item are joined, as markdown does. With options, also tables and
// quotes, which take whole runs of lines.
export function renderMarkdown (md, options = {}) {
  const blocks = []
  let paragraph = []
  let items = []
  let numbered = false
  const close = () => {
    if (paragraph.length) blocks.push(`<p>${inline(paragraph.join(' '), options)}</p>`)
    if (items.length) {
      const tag = numbered ? 'ol' : 'ul'
      blocks.push(`<${tag}>${items.map((item) => `<li>${inline(item, options)}</li>`).join('')}</${tag}>`)
    }
    paragraph = []
    items = []
  }
  const lines = md.split(/\r?\n/).map((line) => line.trim())
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (options.tables && line.startsWith('|') && TABLE_RULE.test(lines[i + 1] ?? '')) {
      close()
      const head = cells(line)
      const rows = []
      for (i += 2; i < lines.length && lines[i].startsWith('|'); i++) rows.push(cells(lines[i]))
      i--
      blocks.push(`<table><thead><tr>${head.map((cell) => `<th>${inline(cell, options)}</th>`).join('')}</tr></thead>` +
        `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell, options)}</td>`).join('')}</tr>`).join('')}` +
        '</tbody></table>')
      continue
    }
    if (options.callouts && line.startsWith('>')) {
      close()
      const quoted = []
      for (; i < lines.length && lines[i].startsWith('>'); i++) quoted.push(lines[i].replace(/^>\s?/, ''))
      i--
      const name = /^\[!([A-Z]+)\]$/.exec(quoted[0] ?? '')?.[1]
      const allowed = name && options.callouts.includes(name)
      const inner = renderMarkdown((allowed ? quoted.slice(1) : quoted).join('\n'), options)
      blocks.push(allowed
        ? `<aside class="callout callout-${name.toLowerCase()}">${inner}</aside>`
        : `<blockquote>${inner}</blockquote>`)
      continue
    }
    const heading = line.match(/^(#{1,6}) (.*)$/)
    const item = line.match(/^[-*+] (.*)$/) ?? line.match(/^\d+[.)] (.*)$/)
    if (heading) {
      close()
      blocks.push(`<h${heading[1].length}>${inline(heading[2], options)}</h${heading[1].length}>`)
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
