import { computed, toValue, watch, ref } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import ANALYSIS_QUERY from "@/graphql/analysis/analysisSubmission.graphql"

export function useAnalysisQuery(analysisId, options = {}) {
  const { pollInterval = 2000, onComplete } = options

  const queryEnabled = computed(() => {
    const id = toValue(analysisId)
    return id !== null && id !== undefined
  })

  const {
    result: analysisResult,
    loading: analysisLoading,
    error: analysisError,
    refetch: refetchAnalysis
  } = useQuery(
    ANALYSIS_QUERY,
    () => ({ analysisId: toValue(analysisId) }),
    () => ({
      enabled: queryEnabled.value,
      fetchPolicy: 'network-only',
      pollInterval: queryEnabled.value ? pollInterval : 0
    })
  )

  const submission = computed(() => {
    return analysisResult.value?.analysisSubmission
  })

  const graphqlResult = computed(() => {
    return submission.value?.result
  })

  const status = computed(() => {
    return graphqlResult.value?.status
  })

  const result = computed(() => {
    return graphqlResult.value?.result
  })

  const errors = computed(() => {
    return graphqlResult.value?.errors || submission.value?.errors || []
  })

  const isComplete = computed(() => {
    console.log('Checking analysis completion status:', status.value)
    return status.value === 'COMPLETED' || status.value === 'FAILED'
  })

  // Watch for completion and stop polling
  watch(isComplete, (complete) => {
    if (complete && onComplete) {
      onComplete({
        status: status.value,
        result: result.value,
        errors: errors.value
      })
    }
  })

  return {
    submission,
    status,
    result,
    errors,
    isComplete,
    analysisLoading,
    analysisError,
    refetchAnalysis
  }
}