import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import ORCID_LINKING_QUERY from '@/graphql/people/orcidLinking.graphql'

// Whether this site can link an ORCID iD (breedgraph peopleOrcidLinking): not where it has no ORCID client, as the
// demonstration site has none. Null until known.
export function useOrcidLinkingQuery() {
  const { result } = useQuery(ORCID_LINKING_QUERY, {}, { fetchPolicy: 'cache-first' })
  const orcidLinking = computed(() => {
    const payload = result.value?.peopleOrcidLinking
    return payload?.status === 'SUCCESS' ? payload.result : null
  })
  return { orcidLinking }
}
