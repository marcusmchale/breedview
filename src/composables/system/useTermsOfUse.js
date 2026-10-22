import { ref } from 'vue'
import apolloClient from '@/graphql/apollo'
import { renderMarkdown } from '@/composables/system/markdown'
import { termsAccepted } from '@/composables/system/termsOfUseState'
import TERMS_OF_USE from '@/graphql/terms/termsOfUse.graphql'
import TERMS_ACCEPT from '@/graphql/terms/termsAccept.graphql'

// The Terms of Use everyone accepts before using BreedGraph (breedgraph docs/licences.md §4). The API refuses all else
// until they are accepted, so the router reads them first, and App shows them in place of the page until then. The
// acceptance is a cookie the API sets, for the signed-in user or for a visitor who isn't signed in.
const terms = ref(null) // { text, contentHash, html }
const loading = ref(false)
const error = ref(null)
let pending = null

// Whether the Terms are accepted, asking the API once, or again when forced
const load = async (force = false) => {
  if (pending) return pending
  if (termsAccepted.value !== null && terms.value && !force) return termsAccepted.value
  pending = (async () => {
    loading.value = true
    try {
      const { data } = await apolloClient.query({ query: TERMS_OF_USE, fetchPolicy: 'network-only' })
      const result = data?.termsOfUse?.result
      if (!result) throw new Error(data?.termsOfUse?.errors?.[0]?.message || 'The Terms of Use could not be read')
      terms.value = { text: result.text, contentHash: result.contentHash, html: renderMarkdown(result.text) }
      termsAccepted.value = result.accepted
      error.value = null
    } catch (e) {
      console.error('Failed to read the Terms of Use:', e)
      error.value = e.message
    } finally {
      loading.value = false
      pending = null
    }
    return termsAccepted.value
  })()
  return pending
}

// Accept the Terms read; if they changed since, they are read again, to be read before accepting
const accept = async () => {
  const { data } = await apolloClient.mutate({ mutation: TERMS_ACCEPT, variables: { contentHash: terms.value.contentHash } })
  const payload = data?.termsAccept
  if (payload?.status === 'SUCCESS') {
    termsAccepted.value = true
    return { status: 'SUCCESS', errors: null }
  }
  await load(true)
  return { status: 'ERROR', errors: payload?.errors ?? [{ message: 'The Terms of Use could not be accepted' }] }
}

export function useTermsOfUse () {
  return { terms, accepted: termsAccepted, loading, error, load, accept }
}
