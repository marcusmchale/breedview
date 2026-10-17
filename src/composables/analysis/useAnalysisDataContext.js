import { computed, ref, toValue, watch } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'

import STUDY_QUERY from '@/graphql/programs/study.graphql'
import { useDatasetSummariesMultiQuery } from '@/composables/datasets/datasetSummariesMultiQuery'
import { useAnalysisDatasetsQuery } from '@/composables/analysis/analysisDatasetsQuery'
import { datasetConcepts, registerNames, useAnalysisNames } from '@/composables/analysis/useAnalysisNames'

/**
 * Data available to the analysis editor for the selected studies and datasets:
 * studies and their record groupings, dataset summaries, concepts with their
 * scales, and what the records span (record group codes, times and values at each
 * percentile), read as dimensions of each dataset rather than as the records themselves.
 */
export function useAnalysisDataContext(form) {
  const { resolveClient } = useApolloClient()
  const { registerDatasets } = useAnalysisNames()

  const studyIds = computed(() => toValue(form).studyIds)
  const datasetIds = computed(() => toValue(form).datasetIds)

  /* ---------- studies and groupings ---------- */

  const studiesById = ref({})
  const studiesLoading = ref(false)

  const fetchStudies = async (ids) => {
    const missing = ids.filter((id) => !studiesById.value[id])
    if (missing.length === 0) return
    studiesLoading.value = true
    try {
      const client = resolveClient()
      const results = await Promise.all(
        missing.map((studyId) => client.query({ query: STUDY_QUERY, variables: { studyId } }))
      )
      const next = { ...studiesById.value }
      results.forEach((r) => {
        const study = r?.data?.programsStudy?.result
        if (study) next[study.id] = study
      })
      studiesById.value = next
      registerNames('study', Object.values(next))
      registerNames('grouping', Object.values(next).flatMap((s) => s.groupings ?? []))
    } catch (err) {
      console.error('Error loading studies:', err)
    } finally {
      studiesLoading.value = false
    }
  }

  const studies = computed(() => studyIds.value.map((id) => studiesById.value[id]).filter(Boolean))

  /* ---------- dataset summaries ---------- */

  const { summaries, loading: summariesLoading, fetchSummaries } = useDatasetSummariesMultiQuery()

  watch(
    studyIds,
    (ids) => {
      fetchStudies(ids)
      fetchSummaries(ids)
    },
    { immediate: true }
  )

  // Datasets of unselected studies (e.g. from a loaded submission) are known from the dataset query only
  const datasetStudy = computed(() => ({
    ...Object.fromEntries(summaries.value.map((s) => [s.id, s._studyId])),
    ...Object.fromEntries(
      datasetIds.value.filter((id) => datasetConcepts[id]?.studyId != null).map((id) => [id, datasetConcepts[id].studyId])
    )
  }))

  /* ---------- datasets with dimensions ---------- */

  const { datasets, loading: datasetsLoading } = useAnalysisDatasetsQuery({ datasetIds })

  const selectedDatasets = computed(() => {
    const byId = Object.fromEntries(datasets.value.map((d) => [d.id, d]))
    return datasetIds.value.map((id) => byId[id]).filter(Boolean)
  })

  // Datasets loaded from a submission may belong to studies that aren't selected; the dimensions query reads
  // them by id all the same, so their concepts and studies are known from it
  watch(selectedDatasets, (list) => registerDatasets(list), { immediate: true })

  // Keep the studies of selected datasets selected, so their datasets and groupings are listed
  watch(
    () => datasetIds.value.map((id) => datasetStudy.value[id]).filter((id) => id != null),
    (ids) => {
      const missing = [...new Set(ids)].filter((id) => !studyIds.value.includes(id))
      if (missing.length > 0) toValue(form).studyIds = [...studyIds.value, ...missing]
    },
    { immediate: true }
  )

  const concepts = computed(() => {
    const map = new Map()
    for (const d of selectedDatasets.value) {
      if (!d.concept) continue
      const entry = map.get(d.concept.id) ?? {
        id: d.concept.id,
        name: d.concept.name,
        kind: d.concept.__typename ?? null,
        scaleType: d.concept.scale?.scaleType ?? null,
        categories: d.concept.scale?.categories ?? [],
        datasetIds: []
      }
      entry.datasetIds.push(d.id)
      map.set(d.concept.id, entry)
    }
    return [...map.values()].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  })

  const conceptsById = computed(() => Object.fromEntries(concepts.value.map((c) => [c.id, c])))

  /* ---------- dimensions ---------- */

  // What each selected dataset's records span, without the records: counts, time range, times and values at
  // each percentile from 0 to 100, and record group codes by grouping
  const dimensionsByDataset = computed(() =>
    Object.fromEntries(selectedDatasets.value.filter((d) => d.dimensions).map((d) => [d.id, d.dimensions]))
  )

  const recordCount = computed(() =>
    Object.values(dimensionsByDataset.value).reduce((count, d) => count + d.recordCount, 0)
  )

  /**
   * Record times at each percentile of the selected datasets, shaped like records ({start, end}) for time
   * binning suggestions. Every dataset contributes the same number of samples whatever its size.
   */
  const timeSamples = computed(() =>
    Object.values(dimensionsByDataset.value).flatMap((d) =>
      (d.timePercentiles ?? []).map((time) => ({ start: time, end: null }))
    )
  )

  /** Record values at each percentile of the given datasets, as strings, for value binning suggestions */
  const valueSamples = (ids) => ids.flatMap((id) => dimensionsByDataset.value[id]?.valuePercentiles ?? [])

  /* ---------- record groupings ---------- */

  // Studies of the selected datasets
  const selectedStudyIds = computed(() => [
    ...new Set(datasetIds.value.map((id) => datasetStudy.value[id]).filter((id) => id != null))
  ])

  const groupings = computed(() =>
    selectedStudyIds.value.flatMap((studyId) =>
      (studiesById.value[studyId]?.groupings ?? []).map((g) => ({
        ...g,
        studyId,
        studyName: studiesById.value[studyId]?.name,
        // Groupings whose type has no extent are treated as SHARED
        extent: g.type?.extent ?? 'SHARED'
      }))
    )
  )

  const groupingsById = computed(() => Object.fromEntries(groupings.value.map((g) => [g.id, g])))

  // Replicates are possible only where a study of the selected datasets has a WITHIN_UNIT grouping
  const hasWithinUnitGroupings = computed(() => groupings.value.some((g) => g.extent === 'WITHIN_UNIT'))

  /**
   * Codes present for each grouping, as {code, datasetId}.
   * datasetId is set only for dataset-scoped groupings, where it selects the scope.
   */
  const codesByGrouping = computed(() => {
    const out = {}
    const seen = new Set()
    for (const d of selectedDatasets.value) {
      for (const g of d.dimensions?.groups ?? []) {
        const grouping = groupingsById.value[g.groupingId]
        const datasetId = grouping?.scope === 'DATASET_SCOPED' ? d.id : null
        for (const code of g.codes) {
          const key = `${g.groupingId}|${datasetId}|${code}`
          if (seen.has(key)) continue
          seen.add(key)
          ;(out[g.groupingId] ??= []).push({ code, datasetId })
        }
      }
    }
    Object.values(out).forEach((list) => list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })))
    return out
  })

  /* ---------- units, germplasm, locations ---------- */

  const summariesForSelected = computed(() => summaries.value.filter((s) => datasetIds.value.includes(s.id)))

  const blockIds = computed(() => [
    ...new Set(summariesForSelected.value.flatMap((s) => (s.unitRoots ?? []).map((b) => b.id)))
  ])

  const locations = computed(() => {
    const map = new Map()
    summariesForSelected.value.forEach((s) => (s.locations ?? []).forEach((l) => map.set(l.id, l)))
    return [...map.values()]
  })

  return {
    studies,
    studiesById,
    studiesLoading,
    summaries,
    summariesLoading,
    datasetStudy,
    selectedDatasets,
    datasetsLoading,
    concepts,
    conceptsById,
    dimensionsByDataset,
    recordCount,
    timeSamples,
    valueSamples,
    groupings,
    groupingsById,
    hasWithinUnitGroupings,
    codesByGrouping,
    blockIds,
    locations
  }
}
