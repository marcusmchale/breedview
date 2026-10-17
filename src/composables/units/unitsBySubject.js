import { useApolloClient } from '@vue/apollo-composable'

import DESCENDANTS_BY_SUBJECT_QUERY from '@/graphql/units/descendantsBySubject.graphql'

/**
 * Every readable unit below some units, grouped by subject, for selecting all the units of a subject at once.
 * loadUnitGroups resolves to [{ key, label, nodes: [{ id, name }] }], one group per subject.
 */
export function useUnitsBySubject() {
  const { resolveClient } = useApolloClient()
  const client = resolveClient()

  const loadUnitGroups = async (startNodes) => {
    const unitIds = (startNodes ?? []).map((node) => node.id).filter((id) => id != null)
    if (unitIds.length === 0) return []
    const { data } = await client.query({ query: DESCENDANTS_BY_SUBJECT_QUERY, variables: { unitIds }, fetchPolicy: 'cache-first' })
    return (data?.unitsDescendantsBySubject?.result ?? []).map((group) => ({
      key: group.subject?.id ?? 'none',
      label: group.subject?.name ?? 'No subject',
      nodes: group.units ?? []
    }))
  }

  return { loadUnitGroups }
}
