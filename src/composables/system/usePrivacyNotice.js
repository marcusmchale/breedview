import { ref } from 'vue'

// The published privacy notice (public/privacy_notice.md) as HTML, loaded once and shared by the registration form
// and the privacy page. It is our own static file, rendered by a simple parser. The notice is written in breedgraph
// docs/legal/privacy-notice.md and copied here, from its title to the end of "Changes to this notice".
const html = ref('')
const loading = ref(false)
const error = ref(false)

// **bold** and *italics*, in text escaped first
const inline = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')

// Simple markdown to HTML parser, line by line: headings, paragraphs, lists of `-` or `*` items and `---` rules
const parseMarkdown = (md) => {
  const blocks = []
  let paragraph = []
  let items = []
  const close = () => {
    if (paragraph.length) blocks.push(`<p>${inline(paragraph.join(' '))}</p>`)
    if (items.length) blocks.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`)
    paragraph = []
    items = []
  }
  for (const line of md.split('\n').map((line) => line.trim())) {
    const heading = line.match(/^(#{1,3}) (.*)$/)
    const item = line.match(/^[-*] (.*)$/)
    if (heading) {
      close()
      blocks.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`)
    } else if (line === '---') {
      close()
      blocks.push('<hr>')
    } else if (item) {
      if (paragraph.length) close()
      items.push(item[1])
    } else if (!line) {
      close()
    } else if (items.length) {
      items[items.length - 1] += ` ${line}`  // the last item continues
    } else {
      paragraph.push(line)
    }
  }
  close()
  return blocks.join('\n')
}

export function usePrivacyNotice() {
  const load = async () => {
    if (html.value || loading.value) return
    loading.value = true
    error.value = false
    try {
      const response = await fetch('/privacy_notice.md')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      html.value = parseMarkdown(await response.text())
    } catch (e) {
      console.error('Failed to load privacy notice:', e)
      error.value = true
    } finally {
      loading.value = false
    }
  }

  return { html, loading, error, load }
}
