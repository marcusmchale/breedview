import { useApolloClient } from '@vue/apollo-composable'

import ENTRIES_NAMED_QUERY from '@/graphql/germplasm/entriesNamed.graphql'

/**
 * Looks germplasm entries up by the names typed or pasted, e.g. into the table of units placed at once:
 * lookUp(names) gives { entries, error }, the entries the user can read with one of the names or a synonym
 */
export function useGermplasmNamed() {
  const { resolveClient } = useApolloClient()
  const client = resolveClient()

  const lookUp = async (names) => {
    if (!names.length) return { entries: [], error: null }
    try {
      const { data } = await client.query({ query: ENTRIES_NAMED_QUERY, variables: { names }, fetchPolicy: 'network-only' })
      const payload = data?.germplasmEntriesNamed
      if (payload?.status !== 'SUCCESS') {
        return { entries: [], error: payload?.errors?.map((e) => e.message).join(', ') || 'The germplasm could not be looked up.' }
      }
      return { entries: payload.result ?? [], error: null }
    } catch (error) {
      return { entries: [], error: error?.message || 'The germplasm could not be looked up.' }
    }
  }

  return { lookUp }
}
