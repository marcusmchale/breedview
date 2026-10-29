import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import ATTRIBUTIONS_QUERY from '@/graphql/controls/attributions.graphql'

/**
 * How to credit entities of one label, for anyone, signed in or not: the attributions of the teams that control each
 * one the user can read (none for the others), by entity id. Ask for a page's entities at once where it lists many.
 * `enabled` holds the query back until it is needed.
 */
export function useAttributionsQuery({ entityLabel, entityIds, enabled = true }) {
  const ids = computed(() => (toValue(entityIds) ?? []).filter((id) => id != null).map(String))
  const { result, loading, error } = useQuery(
    ATTRIBUTIONS_QUERY,
    () => ({ entityLabel: toValue(entityLabel), entityIds: ids.value }),
    () => ({ enabled: !!toValue(entityLabel) && ids.value.length > 0 && !!toValue(enabled) })
  )

  const attributionsById = computed(() => Object.fromEntries(
    (result.value?.controlsAttributions?.result ?? []).map((item) => [String(item.entityId), item.attributions])
  ))

  return { attributionsById, loading, error }
}
