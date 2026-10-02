import { ref, computed, toValue, watch } from 'vue'

/**
 * Dataset submission grouping configuration.
 * mergeTargets values:
 *   null      -> create a new scope
 *   ''        -> "merge" chosen but no dataset selected yet (invalid)
 *   datasetId -> merge new datasets into that dataset's scope
 */
export function useDatasetGroupingConfig(studyGroupings) {
  const selectedGroupingIds = ref([])
  const mergeTargets = ref({})

  const availableGroupings = computed(() => toValue(studyGroupings) || [])

  const selectedGroupings = computed(() =>
    availableGroupings.value.filter((g) => selectedGroupingIds.value.includes(g.id))
  )

  const datasetScopedGroupings = computed(() =>
    selectedGroupings.value.filter((g) => g.scope === 'DATASET_SCOPED')
  )

  // Drop selections for groupings that no longer exist (e.g. deleted on Study Panel)
  watch(availableGroupings, (groupings) => {
    const ids = new Set(groupings.map((g) => g.id))
    selectedGroupingIds.value = selectedGroupingIds.value.filter((id) => ids.has(id))
  })

  const setMergeTarget = (groupingId, datasetId) => {
    mergeTargets.value = { ...mergeTargets.value, [groupingId]: datasetId ?? null }
  }

  // Merge instructions for DATASET_SCOPED groupings only
  const mergeConfig = computed(() =>
    datasetScopedGroupings.value.map((g) => ({
      groupingId: g.id,
      groupingName: g.name,
      mergeTargetDatasetId: mergeTargets.value[g.id] || null
    }))
  )
  const getMergeConfig = () => mergeConfig.value

  const isConfigValid = computed(() =>
    datasetScopedGroupings.value.every((g) => mergeTargets.value[g.id] !== '')
  )

  const resetConfig = () => {
    selectedGroupingIds.value = []
    mergeTargets.value = {}
  }

  return {
    availableGroupings,
    selectedGroupingIds,
    selectedGroupings,
    datasetScopedGroupings,
    mergeTargets,
    mergeConfig,
    isConfigValid,
    setMergeTarget,
    getMergeConfig,
    resetConfig
  }
}