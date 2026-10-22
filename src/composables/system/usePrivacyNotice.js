import { ref } from 'vue'
import apolloClient from '@/graphql/apollo'
import { renderMarkdown } from '@/composables/system/markdown'
import PRIVACY_NOTICE from '@/graphql/terms/privacyNotice.graphql'

// The privacy notice as HTML, loaded once and shared by the registration form and the privacy page. The API serves
// it to anyone, before the Terms of Use are accepted too, as it does the Terms (breedgraph docs/licences.md §4); it is
// written in breedgraph docs/legal/privacy-notice.md and rendered by the shared markdown renderer.
const html = ref('')
const loading = ref(false)
const error = ref(false)

export function usePrivacyNotice() {
  const load = async () => {
    if (html.value || loading.value) return
    loading.value = true
    error.value = false
    try {
      const { data } = await apolloClient.query({ query: PRIVACY_NOTICE })
      const result = data?.privacyNotice?.result
      if (!result) throw new Error(data?.privacyNotice?.errors?.[0]?.message || 'The privacy notice could not be read')
      html.value = renderMarkdown(result.text)
    } catch (e) {
      console.error('Failed to load privacy notice:', e)
      error.value = true
    } finally {
      loading.value = false
    }
  }

  return { html, loading, error, load }
}
