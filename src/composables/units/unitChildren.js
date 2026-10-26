import { useApolloClient } from '@vue/apollo-composable'

import UNIT_CHILDREN_QUERY from '@/graphql/units/unitChildren.graphql'

/**
 * A unit's children, read from the API rather than the cache, as children may have been added since the unit was
 * read: readChildren(unitId) gives [{ id, name }], or [] if it can't be read
 */
export function useUnitChildren() {
  const { resolveClient } = useApolloClient()
  const client = resolveClient()

  const readChildren = async (unitId) => {
    try {
      const { data } = await client.query({ query: UNIT_CHILDREN_QUERY, variables: { ids: [unitId] }, fetchPolicy: 'network-only' })
      return data?.unitsUnits?.result?.[0]?.children ?? []
    } catch (error) {
      console.warn('Could not read the unit\'s children', error)
      return []
    }
  }

  return { readChildren }
}
