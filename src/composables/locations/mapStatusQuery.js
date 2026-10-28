import { computed, watch } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import MAP_STATUS_QUERY from '@/graphql/locations/mapStatus.graphql'
import { mapsUnderWay } from './mapStatus'

const POLL_MS = 10000

/**
 * Where the detailed maps of the country with this code (a ref) stand (mapStatus.js): read from the server each time
 * the country is shown, and again every ten seconds while some are under way
 */
export function useMapStatusQuery(code) {
  const { result, query } = useQuery(
    MAP_STATUS_QUERY,
    () => ({ code: code.value }),
    () => ({ enabled: Boolean(code.value), fetchPolicy: 'network-only' })
  )
  const status = computed(() => (code.value ? result.value?.locationsMapStatus?.result ?? null : null))
  // polled through Apollo's query itself, as vue-apollo's useQuery has no startPolling or stopPolling
  watch(status, (current) => (mapsUnderWay(current) ? query.value?.startPolling(POLL_MS) : query.value?.stopPolling()))
  return { status }
}
