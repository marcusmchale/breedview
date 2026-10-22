import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import DATASET_LICENCES from '@/graphql/licences/datasetLicences.graphql'

// The licences of the chosen datasets' studies that the user must still accept before getting their data (breedgraph
// docs/licences.md §5): one entry per licence, with the datasets it covers. Read from the network each time, as the
// acceptances are a cookie the API reads; refetch after accepting.
export function useLicenceRequirements (datasetIds) {
  const ids = computed(() => [...new Set((toValue(datasetIds) ?? []).map(String))].sort())
  const { result, loading, error, refetch } = useQuery(
    DATASET_LICENCES,
    () => ({ datasetIds: ids.value }),
    () => ({ enabled: ids.value.length > 0, fetchPolicy: 'network-only' })
  )

  const pending = computed(() => {
    if (!ids.value.length) return []
    const byLicence = new Map()
    for (const dataset of result.value?.datasets?.result ?? []) {
      const licence = dataset.licence
      if (!dataset.licenceRequired || !licence || licence.accepted) continue
      if (!byLicence.has(licence.id)) byLicence.set(licence.id, { licence, datasetIds: [] })
      byLicence.get(licence.id).datasetIds.push(dataset.id)
    }
    return [...byLicence.values()]
  })
  // whether what the chosen datasets need is known, so their data may be asked for once nothing is pending
  const known = computed(() => ids.value.length === 0 || (!loading.value && !error.value && !!result.value))

  return { pending, known, loading, error, refetch }
}
