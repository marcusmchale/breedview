import { useApolloClient } from '@vue/apollo-composable'

import DESCENDANTS_BY_TYPE_QUERY from '@/graphql/locations/descendantsByType.graphql'

/**
 * Every readable location below some locations, grouped by location type, for selecting all of a type at once.
 * loadLocationGroups resolves to [{ key, label, nodes: [{ id, name }] }], one group per type.
 */
export function useLocationsByType() {
  const { resolveClient } = useApolloClient()
  const client = resolveClient()

  const loadLocationGroups = async (startNodes) => {
    const locationIds = (startNodes ?? []).map((node) => node.id).filter((id) => id != null)
    if (locationIds.length === 0) return []
    const { data } = await client.query({ query: DESCENDANTS_BY_TYPE_QUERY, variables: { locationIds }, fetchPolicy: 'cache-first' })
    return (data?.locationsDescendantsByType?.result ?? []).map((group) => ({
      key: group.type?.id ?? 'none',
      label: group.type?.name ?? 'No type',
      nodes: group.locations ?? []
    }))
  }

  return { loadLocationGroups }
}
