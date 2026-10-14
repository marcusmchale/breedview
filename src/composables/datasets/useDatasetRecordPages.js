import { computed, ref, toValue, watch } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import DATASET_UNITS_QUERY from '@/graphql/datasets/datasetUnits.graphql'
import { useDatasetsQuery } from './datasetsQuery'

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
    datasetsLoading,
    datasetsError
  }
}
