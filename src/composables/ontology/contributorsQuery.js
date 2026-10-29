import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import ONTOLOGY_CONTRIBUTORS_QUERY from '@/graphql/ontology/ontologyContributors.graphql'

/**
 * The people named among the contributors to an ontology version (null for the current one), for anyone: those who
 * chose to be named, from their own account, and whose work is in that version. Everyone who contributes is credited
 * together; these are the ones named.
 */
export function useOntologyContributorsQuery({ versionId = null, enabled = true } = {}) {
  const { result, loading, error } = useQuery(
    ONTOLOGY_CONTRIBUTORS_QUERY,
    () => ({ versionId: toValue(versionId) ?? null }),
    () => ({ enabled: !!toValue(enabled), fetchPolicy: 'cache-and-network' })
  )

  const contributors = computed(() => result.value?.ontologyContributors?.result ?? [])

  return { contributors, contributorsLoading: loading, contributorsError: error }
}
