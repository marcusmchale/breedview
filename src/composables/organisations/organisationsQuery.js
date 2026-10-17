import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import ORGANISATIONS_QUERY from '@/graphql/organisations/organisations.graphql'

// Organisation root teams visible to the user
export function useOrganisationsQuery() {
  const {
    result,
    loading: organisationsLoading,
    error: organisationsError,
    refetch: refetchOrganisations
  } = useQuery(ORGANISATIONS_QUERY, {}, { fetchPolicy: 'cache-and-network' })

  const organisations = computed(() => result.value?.teamsRoots?.result ?? [])

  return {
    organisations,
    organisationsLoading,
    organisationsError,
    refetchOrganisations
  }
}
