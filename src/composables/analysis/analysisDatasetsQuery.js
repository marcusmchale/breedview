import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import ANALYSIS_DATASET_DIMENSIONS_QUERY from '@/graphql/analysis/analysisDatasetDimensions.graphql'

/**
 * The selected datasets with their concept and dimensions: counts, the time range, the record times and
 * values at each percentile, and the record group codes by grouping. The records themselves are not loaded.
 * Nothing is read while no dataset is selected. Dimensions follow the records, so they bypass the cache.
 */
export function useAnalysisDatasetsQuery({ datasetIds }) {
  const ids = computed(() => toValue(datasetIds) ?? [])
  const enabled = computed(() => ids.value.length > 0)

  const { result, loading, error } = useQuery(
    ANALYSIS_DATASET_DIMENSIONS_QUERY,
    () => ({ datasetIds: ids.value }),
    () => ({ enabled: enabled.value, fetchPolicy: 'no-cache' })
  )

  const datasets = computed(() => (enabled.value ? (result.value?.datasets?.result ?? []) : []))

  return { datasets, loading, error }
}
