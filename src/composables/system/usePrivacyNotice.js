import { ref } from 'vue'
import { renderMarkdown } from '@/composables/system/markdown'

// The published privacy notice (public/privacy_notice.md) as HTML, loaded once and shared by the registration form
// and the privacy page. It is our own static file, rendered by the shared markdown renderer. The notice is written in
// breedgraph docs/legal/privacy-notice.md and copied here, from its title to the end of "Changes to this notice".
const html = ref('')
const loading = ref(false)
const error = ref(false)

export function usePrivacyNotice() {
  const load = async () => {
    if (html.value || loading.value) return
    loading.value = true
    error.value = false
    try {
      const response = await fetch('/privacy_notice.md')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      html.value = renderMarkdown(await response.text())
    } catch (e) {
      console.error('Failed to load privacy notice:', e)
      error.value = true
    } finally {
      loading.value = false
    }
  }

  return { html, loading, error, load }
}
