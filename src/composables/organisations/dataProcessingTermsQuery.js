import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import DATA_PROCESSING_TERMS_QUERY from '@/graphql/organisations/dataProcessingTerms.graphql'

// The current data processing terms, accepted when declaring an organisation's legal entity.
// When no terms are configured on the server, version is null and declaring is not possible.
export function useDataProcessingTermsQuery() {
  const { result, loading: termsLoading, error: termsError } = useQuery(DATA_PROCESSING_TERMS_QUERY)

  const terms = computed(() => result.value?.organisationsDataProcessingTerms?.result ?? null)
  const termsVersion = computed(() => terms.value?.version ?? null)
  const termsUrl = computed(() => terms.value?.url ?? null)
  const termsAvailable = computed(() => !!termsVersion.value)

  return {
    terms,
    termsVersion,
    termsUrl,
    termsAvailable,
    termsLoading,
    termsError
  }
}
