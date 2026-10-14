import { gql } from '@apollo/client/core'
import { useApolloClient } from '@vue/apollo-composable'

/**
 * The name of a cached entity by id, for labelling a selection without a query: whatever was listed, picked or
 * selected by type has been read with at least its id and name. Falls back to the type and id.
 */
export function useCachedName(typeName) {
  const { resolveClient } = useApolloClient()
  const client = resolveClient()
  const fragment = gql`
    fragment ${typeName}Name on ${typeName} {
      id
      name
    }
  `
  return (id) => {
    try {
      return client.cache.readFragment({ id: `${typeName}:${id}`, fragment })?.name ?? `${typeName} ${id}`
    } catch {
      return `${typeName} ${id}`
    }
  }
}
