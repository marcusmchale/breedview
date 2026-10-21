import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import ANALYSIS_PLACES_QUERY from '@/graphql/analysis/analysisPlaces.graphql'

/**
 * Where position grouping could place the records of the selected datasets: the locations of the location types,
 * by name, with how many recorded units each places, and the layouts of the positions there with the axis names they
 * give. Nothing is read until datasets and location types are selected. Places follow the units' positions, so they
 * bypass the cache.
 */
export function useAnalysisPlacesQuery({ datasetIds, locationTypeIds }) {
  const datasets = computed(() => toValue(datasetIds) ?? [])
  const types = computed(() => toValue(locationTypeIds) ?? [])
  const enabled = computed(() => datasets.value.length > 0 && types.value.length > 0)

  const { result, loading, error } = useQuery(
    ANALYSIS_PLACES_QUERY,
    () => ({ datasetIds: datasets.value, locationTypeIds: types.value }),
    () => ({ enabled: enabled.value, fetchPolicy: 'no-cache' })
  )

  const places = computed(() =>
    enabled.value
      ? [...(result.value?.datasetsPlaces?.result ?? [])].sort((a, b) =>
          (a.location?.name ?? '').localeCompare(b.location?.name ?? '')
        )
      : []
  )

  return { places, loading, error }
}
