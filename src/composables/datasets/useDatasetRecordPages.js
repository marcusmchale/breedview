import { computed, ref, toValue, watch } from 'vue'
import { useApolloClient, useQuery } from '@vue/apollo-composable'

import DATASET_UNITS_QUERY from '@/graphql/datasets/datasetUnits.graphql'
import UNITS_QUERY from '@/graphql/units/units.graphql'
import { useDatasetsQuery } from './datasetsQuery'
import { useUnitsQuery } from '@/composables/units/unitsQuery'

// Units per page by default: their records from every selected dataset arrive in one request, and the table
// renders them all, so a page of 1,000 units (25,000 records with five datasets) took seconds to load
export const DEFAULT_UNITS_PAGE_SIZE = 250

/**
 * The selected datasets with their records, a page of units at a time.
 *
 * The curation table merges the records of one unit and time from every dataset into one row, so a page must hold
 * every record of its units: paging records per dataset would split rows across pages. Instead the units each
 * dataset has records for are read first (one light query), a page is a slice of their sorted union, and the
 * records of those units are then read from every dataset. Narrowing (units and what they contain, a time window)
 * applies to both reads, so the page count reflects it.
 */
export function useDatasetRecordPages({ datasetIds, filters, pageSize }) {
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

  const allUnitIds = computed(() => {
    const seen = new Set()
    for (const dataset of unitsPayload.value?.result ?? []) {
      for (const id of dataset.unitIds ?? []) seen.add(id)
    }
    return [...seen].sort((a, b) => Number(a) - Number(b))
  })
  const totalRecords = computed(() =>
    (unitsPayload.value?.result ?? []).reduce((n, d) => n + (d.recordCount ?? 0), 0)
  )

  const size = computed(() => Math.max(1, Number(toValue(pageSize)) || 1))
  const pageCount = computed(() => Math.max(1, Math.ceil(allUnitIds.value.length / size.value)))

  // A new selection starts from its first page; a shrunken set keeps the page in range
  watch([ids, narrowing, size], () => { page.value = 1 })
  watch(pageCount, (count) => { if (page.value > count) page.value = count })

  const pageUnitIds = computed(() => {
    const from = (page.value - 1) * size.value
    return allUnitIds.value.slice(from, from + size.value)
  })

  // The records of the page's units from every dataset: no offset or limit, so each unit's rows are complete
  const { datasets: pageDatasets, datasetsLoading: recordsLoading, datasetsError: recordsError } = useDatasetsQuery({
    datasetIds: () => (pageUnitIds.value.length > 0 ? ids.value : null),
    unitIds: pageUnitIds,
    start: () => narrowing.value.start,
    end: () => narrowing.value.end
  })

  // unitIds on the API also selects what lies below a unit; a page lists only units that have records themselves,
  // so records of units below them belong to those units' own pages. The datasets change only when a page's
  // records arrive (or there is nothing to read), so the table initialises once per page.
  const datasets = ref([])
  watch(pageDatasets, (list) => {
    const inPage = new Set(pageUnitIds.value)
    datasets.value = list.map((dataset) => ({
      ...dataset,
      records: (dataset.records ?? []).filter((record) => inPage.has(record.unit?.id))
    }))
  })
  watch(pageUnitIds, (list) => { if (list.length === 0) datasets.value = [] })
  const shownRecords = computed(() => datasets.value.reduce((n, d) => n + d.records.length, 0))

  // Factors selected with variables describe the variables' units from those units or their ancestors, so every
  // record of the factors is read, whatever the narrowing: a plot's factor is outside a narrowing to its trees, and an
  // undated one outside any time window. Factor datasets are small (a record per unit, not per reading).
  const isFactor = (dataset) => dataset.concept?.__typename === 'Factor'
  const factorsApply = computed(() => datasets.value.some(isFactor) && datasets.value.some((d) => !isFactor(d)))
  const factorDatasetIds = computed(() => (factorsApply.value ? datasets.value.filter(isFactor).map((d) => d.id) : []))
  const { datasets: factorDatasets } = useDatasetsQuery({
    datasetIds: () => (factorDatasetIds.value.length > 0 ? factorDatasetIds.value : null)
  })

  // The page's units, once each, for their germplasm and positions, and the ancestors of those with no position up to
  // one that has one (usually a field: the trees and plots in it are not positioned themselves). With factors applied,
  // every ancestor, for the factors recorded on them.
  const { units: pageUnits } = useUnitsQuery({ unitIds: pageUnitIds })
  const { resolveClient } = useApolloClient()
  const unitsById = ref({})
  const parentsToRead = (units, known, all) => [...new Set(units
    .filter((unit) => all || !unit.positions?.length)
    .flatMap((unit) => (unit.parents ?? []).map((parent) => String(parent.id)))
    .filter((id) => !known[id]))]
  // a later walk (new units, or factors now known to apply) supersedes one still running
  let walk = 0
  watch([pageUnits, factorsApply], async ([units, all]) => {
    const current = ++walk
    const known = Object.fromEntries((units ?? []).filter(Boolean).map((unit) => [String(unit.id), unit]))
    unitsById.value = { ...known }
    let frontier = parentsToRead(Object.values(known), known, all)
    try {
      for (let depth = 0; depth < 20 && frontier.length > 0; depth++) {
        const { data } = await resolveClient().query({ query: UNITS_QUERY, variables: { unitIds: frontier } })
        if (current !== walk) return
        const ancestors = (data?.unitsUnits?.result ?? []).filter(Boolean)
        ancestors.forEach((unit) => { known[String(unit.id)] = unit })
        frontier = parentsToRead(ancestors, known, all)
      }
    } catch (error) {
      console.warn('Could not read the ancestors of the page\'s units', error)
    }
    if (current === walk) unitsById.value = known
  }, { immediate: true })

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
    factorDatasets,
    unitsById,
    datasetsLoading,
    datasetsError
  }
}
