import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import TRANSFERS_QUERY from '@/graphql/controls/transfers.graphql'

// Control transfers offered to or from teams the user administers, optionally by status
export function useTransfersQuery(statuses = null) {
  const {
    result,
    loading: transfersLoading,
    error: transfersError,
    refetch: refetchTransfers
  } = useQuery(
    TRANSFERS_QUERY,
    () => ({ statuses: toValue(statuses) }),
    { fetchPolicy: 'cache-and-network' }
  )

  const transfers = computed(() => {
    const items = [...(result.value?.controlsTransfers?.result ?? [])]
    items.sort((a, b) => (b.offeredAt || '').localeCompare(a.offeredAt || ''))
    return items
  })

  return {
    transfers,
    transfersLoading,
    transfersError,
    refetchTransfers
  }
}
