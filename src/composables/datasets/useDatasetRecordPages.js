import { computed, ref, toValue, watch } from 'vue'
import { useApolloClient, useQuery } from '@vue/apollo-composable'

import DATASET_UNITS_QUERY from '@/graphql/datasets/datasetUnits.graphql'
import DATASETS_QUERY from '@/graphql/datasets/datasets.graphql'
import UNITS_WITH_ANCESTORS_QUERY from '@/graphql/units/unitsWithAncestors.graphql'
import { useDatasetsQuery } from './datasetsQuery'

// Units per page by default: their records from every selected dataset arrive in one request, and the table
// renders them all, so a page of 1,000 units (25,000 records with five datasets) took seconds to load
export const DEFAULT_UNITS_PAGE_SIZE = 250

const isFactor = (dataset) => dataset.concept?.__typename === 'Factor'

/**
 * The selected datasets with their records, a page of units at a time.
 *
 * The curation table merges the records of one unit and time from every dataset into one row, so a page must hold
 * every record of its units: paging records per dataset would split rows across pages. Instead the units each
 * dataset has records for are read first (one light query), a page is a slice of their sorted union, and the
 * records of those units are then read from every dataset. Narrowing (units and what they contain, a time window)
 * applies to both reads, so the page count reflects it.
 *
 * Factors selected with variables describe the variables' units, from those units or the units above them (breedgraph
 * docs/analysis.md §2), so pages are then of the variables' units alone, and each page has the factor records on its
 * units and on every unit above them, at any time: an undated factor describes every time.
 */
export function useDatasetRecordPages({ datasetIds, filters, pageSize }) {
  const { resolveClient } = useApolloClient()
  const page = ref(1)

  const narrowing = computed(() => {
    const f = toValue(filters) ?? {}
    return {
      unitIds: f.unitIds?.length ? f.unitIds : null,
      start: f.start || null,
      end: f.end || null
    }
  })

  const ids = computed(() => toValue(datasetIds) ?? [])

  // Which units have records, per dataset, under the narrowing
  const { result: unitsResult, loading: unitsLoading, error: unitsQueryError } = useQuery(
    DATASET_UNITS_QUERY,
    () => ({ datasetIds: ids.value, ...narrowing.value }),
    () => ({ enabled: ids.value.length > 0, fetchPolicy: 'no-cache' })
  )
  const unitsPayload = computed(() => unitsResult.value?.datasets)
  const unitsKnown = computed(() => !!unitsPayload.value?.result)

  const selected = computed(() => unitsPayload.value?.result ?? [])
  const factorsApply = computed(() => selected.value.some(isFactor) && selected.value.some((d) => !isFactor(d)))
  const factorIds = computed(() => (factorsApply.value ? selected.value.filter(isFactor).map((d) => d.id) : []))
  // the datasets whose units are paged: the variables', when factors describe them
  const paged = computed(() => (factorsApply.value ? selected.value.filter((d) => !isFactor(d)) : selected.value))
  const pagedIds = computed(() => paged.value.map((d) => d.id))

  const allUnitIds = computed(() => {
    const seen = new Set()
    for (const dataset of paged.value) {
      for (const id of dataset.unitIds ?? []) seen.add(id)
    }
    return [...seen].sort((a, b) => Number(a) - Number(b))
  })
  const totalRecords = computed(() => paged.value.reduce((n, d) => n + (d.recordCount ?? 0), 0))

  const size = computed(() => Math.max(1, Number(toValue(pageSize)) || 1))
  const pageCount = computed(() => Math.max(1, Math.ceil(allUnitIds.value.length / size.value)))

  // A new selection starts from its first page; a shrunken set keeps the page in range
  watch([ids, narrowing, size], () => { page.value = 1 })
  watch(pageCount, (count) => { if (page.value > count) page.value = count })

  const pageUnitIds = computed(() => {
    const from = (page.value - 1) * size.value
    return allUnitIds.value.slice(from, from + size.value)
  })

  // The records of the page's units from the paged datasets: no offset or limit, so each unit's rows are complete
  const { datasets: pageDatasets, datasetsLoading: recordsLoading, datasetsError: recordsError } = useDatasetsQuery({
    datasetIds: () => (pageUnitIds.value.length > 0 ? pagedIds.value : null),
    unitIds: pageUnitIds,
    start: () => narrowing.value.start,
    end: () => narrowing.value.end
  })

  // The page's units with the units above them, closest first, read as soon as the page is known: for their germplasm,
  // the location of the nearest positioned one (trees and plots in a field are not positioned themselves), and the
  // factors recorded on them
  let unitsRead = { key: '', promise: Promise.resolve([]) }
  const readUnits = (unitIds) => {
    const key = unitIds.join(',')
    if (unitsRead.key !== key) {
      unitsRead = {
        key,
        promise: unitIds.length === 0 ? Promise.resolve([]) : resolveClient()
          .query({ query: UNITS_WITH_ANCESTORS_QUERY, variables: { unitIds } })
          .then(({ data }) => (data?.unitsUnits?.result ?? []).filter(Boolean))
      }
    }
    return unitsRead.promise
  }
  watch(pageUnitIds, (unitIds) => { readUnits(unitIds).catch(() => {}) }, { immediate: true })

  // The factor records on exactly these units, at any time
  const readFactorRecords = async (unitIds) => {
    const { data } = await resolveClient().query({
      query: DATASETS_QUERY,
      variables: { datasetIds: factorIds.value, unitIds, includeBelow: false },
      fetchPolicy: 'no-cache'
    })
    return data?.datasets?.result ?? []
  }

  // unitIds on the API also selects what lies below a unit; a page lists only units that have records themselves,
  // so records of units below them belong to those units' own pages. The datasets and units change together, once
  // the page's records, units and factor records are all in, so the table initialises once per page; a later page
  // supersedes one still being read.
  const datasets = ref([])
  const unitsById = ref({})
  const lineageError = ref(null)
  let composing = 0
  watch(pageDatasets, async (list) => {
    const run = ++composing
    const unitIds = pageUnitIds.value
    const inPage = new Set(unitIds)
    const pageRecords = list.map((dataset) => ({
      ...dataset,
      records: (dataset.records ?? []).filter((record) => inPage.has(record.unit?.id))
    }))
    let units = []
    let factorDatasets = []
    lineageError.value = null
    try {
      units = await readUnits(unitIds)
      if (run !== composing) return
      if (factorIds.value.length > 0) {
        const lineage = new Set(unitIds)
        units.forEach((unit) => (unit.ancestors ?? []).forEach((ancestor) => lineage.add(String(ancestor.id))))
        factorDatasets = await readFactorRecords([...lineage])
        if (run !== composing) return
      }
    } catch (error) {
      if (run !== composing) return
      console.warn('Could not read the units above the page\'s units, or their factor records', error)
      lineageError.value = error
    }
    const known = {}
    units.forEach((unit) => (unit.ancestors ?? []).forEach((ancestor) => { known[String(ancestor.id)] = ancestor }))
    units.forEach((unit) => { known[String(unit.id)] = unit })
    unitsById.value = known
    datasets.value = [...pageRecords, ...factorDatasets]
  })
  watch(pageUnitIds, (list) => {
    if (list.length === 0) {
      composing++
      datasets.value = []
      unitsById.value = {}
    }
  })
  const shownRecords = computed(() =>
    datasets.value.filter((d) => pagedIds.value.includes(d.id)).reduce((n, d) => n + d.records.length, 0))

  const pageSummary = computed(() => {
    if (!unitsKnown.value) return ''
    const units = allUnitIds.value.length
    const records = totalRecords.value.toLocaleString()
    if (pageCount.value === 1) return `${units.toLocaleString()} unit${units === 1 ? '' : 's'}, ${records} records`
    const from = (page.value - 1) * size.value + 1
    const to = Math.min(page.value * size.value, units)
    return `Units ${from.toLocaleString()}–${to.toLocaleString()} of ${units.toLocaleString()}`
      + ` (${shownRecords.value.toLocaleString()} of ${records} records)`
  })

  const datasetsLoading = computed(() => unitsLoading.value || recordsLoading.value)
  const datasetsError = computed(() => unitsQueryError.value || unitsPayload.value?.errors || recordsError.value)

  return {
    page,
    pageCount,
    pageSummary,
    unitsKnown,
    allUnitIds,
    totalRecords,
    datasets,
    // whether factors describe the variables' rows, so the page holds the factor records on and above its units
    factorsApply,
    unitsById,
    datasetsLoading,
    datasetsError,
    // the units above the page's, or their factor records, could not be read: the records are shown without them
    lineageError
  }
}
