import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import DATASET_SUMMARIES_QUERY from '@/graphql/datasets/datasetSummaries.graphql'

/**
 * The dataset summaries of a study. Pass `query` to read fewer fields, as long as it reads `datasetsSummaries`.
 */
export function useDatasetSummariesQuery(studyId, { query = DATASET_SUMMARIES_QUERY } = {}) {
  const queryEnabled = computed(() => {
    const id = toValue(studyId)
    return id !== null && id !== undefined
  })

  const {
    result: summariesResult,
    loading: summariesLoading,
    error: summariesError,
    refetch: refetchSummaries
  } = useQuery(
    query,
    () => ({ studyId: toValue(studyId) }),
    { enabled: queryEnabled }
  )

  const datasetSummaries = computed(() => {
    return summariesResult.value?.datasetsSummaries?.result || []
  })

  const queryErrors = computed(() => {
    return summariesResult.value?.datasetsSummaries?.errors || []
  })

  return {
    datasetSummaries,
    summariesLoading,
    summariesError,
    queryErrors,
    refetchSummaries
  }
}