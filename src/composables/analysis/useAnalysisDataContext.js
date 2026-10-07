import { computed, ref, toValue, watch } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'

import STUDY_QUERY from '@/graphql/programs/study.graphql'
import { useDatasetSummariesMultiQuery } from '@/composables/datasets/datasetSummariesMultiQuery'
import { useDatasetsQuery } from '@/composables/datasets/datasetsQuery'
import { datasetConcepts, registerNames, useAnalysisNames } from '@/composables/analysis/useAnalysisNames'

/**
 * Data available to the analysis editor for the selected studies and datasets:
 * studies and their record groupings, dataset summaries, concepts with their
 * scales, and record-derived options (record group codes, units, germplasm, times).
 */
export function useAnalysisDataContext(form) {
  const { resolveClient } = useApolloClient()
  const { registerDatasets, ensureDatasets } = useAnalysisNames()

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

  /* ---------- datasets with records ---------- */

  const { datasets, datasetsLoading } = useDatasetsQuery({
    datasetIds: () => (datasetIds.value.length > 0 ? datasetIds.value : null)
  })

  const selectedDatasets = computed(() => {
    const byId = Object.fromEntries(datasets.value.map((d) => [d.id, d]))
    return datasetIds.value.map((id) => byId[id]).filter(Boolean)
  })

  watch(selectedDatasets, (list) => registerDatasets(list), { immediate: true })

  // Datasets loaded from a submission may belong to studies that aren't selected
  watch(datasetIds, (ids) => ensureDatasets(ids), { immediate: true })

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

  const records = computed(() =>
    selectedDatasets.value.flatMap((d) => (d.records ?? []).map((r) => ({ ...r, datasetId: d.id })))
  )

  watch(records, (list) => {
    registerNames('unit', list.map((r) => r.unit))
    registerNames('germplasm', list.map((r) => r.unit?.germplasm))
  })

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
        studyName: studiesById.value[studyId]?.name
      }))
    )
  )

  const groupingsById = computed(() => Object.fromEntries(groupings.value.map((g) => [g.id, g])))

  /**
   * Codes present for each grouping, as {code, datasetId}.
   * datasetId is set only for dataset-scoped groupings, where it selects the scope.
   */
  const codesByGrouping = computed(() => {
    const out = {}
    const seen = new Set()
    for (const r of records.value) {
      for (const g of r.groups ?? []) {
        const grouping = groupingsById.value[g.id]
        const datasetId = grouping?.scope === 'DATASET_SCOPED' ? r.datasetId : null
        const key = `${g.id}|${datasetId}|${g.code}`
        if (seen.has(key)) continue
        seen.add(key)
        ;(out[g.id] ??= []).push({ code: g.code, datasetId })
      }
    }
    Object.values(out).forEach((list) => list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })))
    return out
  })

  /* ---------- units, germplasm, locations ---------- */

  const summariesForSelected = computed(() => summaries.value.filter((s) => datasetIds.value.includes(s.id)))

  const blockIds = computed(() => [
    ...new Set(summariesForSelected.value.flatMap((s) => (s.blocks ?? []).map((b) => b.id)))
  ])

  const locations = computed(() => {
    const map = new Map()
    summariesForSelected.value.forEach((s) => (s.locations ?? []).forEach((l) => map.set(l.id, l)))
    return [...map.values()]
  })

  const unitIds = computed(() => [...new Set(records.value.map((r) => r.unit?.id).filter(Boolean))])

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
    records,
    groupings,
    groupingsById,
    codesByGrouping,
    blockIds,
    locations,
    unitIds
  }
}
