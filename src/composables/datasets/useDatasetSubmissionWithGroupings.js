import { ref, computed, toValue } from 'vue'
import { useMergeScope } from '@/composables/programs/mergeScope'

export function useDatasetSubmissionWithGroupings({ columnStatus, mergeConfig }) {
  const { mergeScope, mergeScopeLoading } = useMergeScope()

  const mergeStatus = ref({}) // { [groupingId]: 'merging' | 'success' | 'failed' }
  const mergeErrors = ref({}) // { [groupingId]: message }

  const submittedDatasetIds = computed(() => {
    const statuses = Object.values(toValue(columnStatus) || {})
    return [...new Set(
      statuses.filter((s) => s.status === 'success' && s.datasetId).map((s) => s.datasetId)
    )]
  })

  const pendingMergeCalls = computed(() => {
    const newIds = submittedDatasetIds.value
    if (newIds.length === 0) return []
    return (toValue(mergeConfig) || [])
      .filter((c) => mergeStatus.value[c.groupingId] !== 'success')
      .map((c) => ({
        ...c,
        datasetIds: c.mergeTargetDatasetId
          ? [...newIds.filter((id) => id !== c.mergeTargetDatasetId), c.mergeTargetDatasetId]
          : newIds
      }))
  })

  const isMerging = computed(() =>
    Object.values(mergeStatus.value).some((s) => s === 'merging')
  )

  const failedMerges = computed(() =>
    (toValue(mergeConfig) || []).filter((c) => mergeStatus.value[c.groupingId] === 'failed')
  )

  const setStatus = (groupingId, status, error = null) => {
    mergeStatus.value = { ...mergeStatus.value, [groupingId]: status }
    const rest = { ...mergeErrors.value }
    delete rest[groupingId]
    mergeErrors.value = error ? { ...rest, [groupingId]: error } : rest
  }

  const executePendingMerges = async () => {
    const calls = pendingMergeCalls.value
    await Promise.allSettled(calls.map(async (call) => {
      setStatus(call.groupingId, 'merging')
      try {
        const { status, errors } = await mergeScope({
          groupingId: call.groupingId,
          datasetIds: call.datasetIds
        })
        if (status === 'SUCCESS') {
          setStatus(call.groupingId, 'success')
        } else {
          throw new Error(errors?.map((e) => e.message).join('; ') || 'Scope merge failed')
        }
      } catch (error) {
        setStatus(call.groupingId, 'failed', error.message || 'Scope merge failed')
      }
    }))
    return { failed: failedMerges.value }
  }

  const resetMerges = () => {
    mergeStatus.value = {}
    mergeErrors.value = {}
  }

  return {
    submittedDatasetIds,
    pendingMergeCalls,
    executePendingMerges,
    mergeStatus,
    mergeErrors,
    failedMerges,
    isMerging,
    mergeScopeLoading,
    resetMerges
  }
}