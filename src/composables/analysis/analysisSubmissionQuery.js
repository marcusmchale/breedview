import { computed, onScopeDispose, toValue, watch } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import ANALYSIS_SUBMISSION_QUERY from '@/graphql/analysis/analysisSubmission.graphql'
import ANALYSIS_SUBMISSION_SUMMARY_QUERY from '@/graphql/analysis/analysisSubmissionSummary.graphql'

export const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED'])

/**
 * Loads an analysis submission and polls it with backoff until it completes or fails.
 *
 * The interval starts at initialInterval and grows by 1.5x up to maxInterval,
 * resetting whenever the status changes.
 *
 * The summary and full queries share the cached submission, so only one of them should
 * poll a given submission: if the summary saw the terminal status first, the full query
 * would read it from the cache without the result. Pass poll: false to leave polling to
 * the other query.
 */
export function useAnalysisSubmissionQuery(analysisId, {
  summary = false,
  poll = true,
  initialInterval = 1000,
  maxInterval = 15000
} = {}) {
  const enabled = computed(() => toValue(analysisId) != null)

  const { result, loading, error, refetch } = useQuery(
    summary ? ANALYSIS_SUBMISSION_SUMMARY_QUERY : ANALYSIS_SUBMISSION_QUERY,
    () => ({ analysisId: toValue(analysisId) }),
    () => ({ enabled: enabled.value, fetchPolicy: 'cache-and-network' })
  )

  const payload = computed(() => result.value?.analysisSubmission)
  const submission = computed(() => payload.value?.result ?? null)
  const status = computed(() => submission.value?.status ?? null)
  const isTerminal = computed(() => TERMINAL_STATUSES.has(status.value))
  const notFound = computed(() => payload.value != null && payload.value.status !== 'SUCCESS')
  const queryErrors = computed(() => payload.value?.errors ?? [])

  let timer = null
  let interval = initialInterval

  const clear = () => {
    clearTimeout(timer)
    timer = null
  }

  const schedule = () => {
    clear()
    if (!enabled.value || !toValue(poll) || !submission.value || isTerminal.value || notFound.value) return
    timer = setTimeout(async () => {
      try {
        await refetch()
      } catch (err) {
        console.error('Error polling analysis submission:', err)
      }
      interval = Math.min(interval * 1.5, maxInterval)
      schedule()
    }, interval)
  }

  watch(
    [() => toValue(analysisId), status, () => toValue(poll)],
    () => {
      interval = initialInterval
      schedule()
    },
    { immediate: true }
  )

  onScopeDispose(clear)

  return {
    submission,
    status,
    isTerminal,
    notFound,
    queryErrors,
    loading,
    error,
    refetch
  }
}
