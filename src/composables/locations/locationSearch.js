import { ref } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'

import SEARCH_LOCATIONS_QUERY from '@/graphql/locations/searchLocations.graphql'

/**
 * BreedGraph's own locations by name, those the user can read, for the location map's search box. Open to signed-out
 * visitors, who find the public ones. searchLocations resolves to [{ id, name, root: { id, name } }].
 */
export function useLocationSearch() {
  const { resolveClient } = useApolloClient()
  const client = resolveClient()
  const loading = ref(false)
  const error = ref(null)

  const searchLocations = async (name, { limit = 10 } = {}) => {
    if (!name?.trim()) return []
    loading.value = true
    error.value = null
    try {
      const { data } = await client.query({
        query: SEARCH_LOCATIONS_QUERY,
        variables: { name: name.trim(), limit },
        fetchPolicy: 'network-only'
      })
      const payload = data?.locationsSearch
      if (payload?.status !== 'SUCCESS') {
        throw new Error(payload?.errors?.map((e) => e.message).join(', ') || 'Location search failed')
      }
      return payload.result ?? []
    } catch (err) {
      error.value = err.message
      return []
    } finally {
      loading.value = false
    }
  }

  return { loading, error, searchLocations }
}
