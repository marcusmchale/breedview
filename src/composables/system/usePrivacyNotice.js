import { ref } from 'vue'

// The published privacy notice (public/privacy_notice.md) as HTML, loaded once and shared by the registration form
// and the privacy page. It is our own static file, rendered by a simple parser.
const html = ref('')
const loading = ref(false)
const error = ref(false)

// Simple markdown to HTML parser
const parseMarkdown = (md) => {
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/^---$/gim, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hulo]|<li|<hr)/gim, '<p>')
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
