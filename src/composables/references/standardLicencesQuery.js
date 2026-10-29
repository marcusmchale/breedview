import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import STANDARD_LICENCES_QUERY from '@/graphql/references/standardLicences.graphql'

// The standard licences, CC BY 4.0 then CC0 1.0, for licence pickers to offer first; asked for once enabled
export function useStandardLicencesQuery({ enabled = true } = {}) {
  const { result, loading, error } = useQuery(STANDARD_LICENCES_QUERY, {}, { enabled: computed(() => !!toValue(enabled)) })
  const standardLicences = computed(() => result.value?.referencesStandardLicences?.result ?? [])
  return { standardLicences, standardLicencesLoading: loading, standardLicencesError: error }
}
