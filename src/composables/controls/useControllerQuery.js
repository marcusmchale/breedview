import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import CONTROLLERS_QUERY from '../../graphql/controls/controllers.graphql'

/**
 * The controller of one entity. Pass `query` to read fewer fields, as long as it reads `controlsControllers`,
 * and `enabled` to hold the query back until it is needed. The controllers payload is not normalised, so a query
 * reading fewer fields should use the 'no-cache' fetchPolicy, or it replaces the full controller in the cache.
 */
export function useControllerQuery({
  entityLabel,
  entityId,
  query = CONTROLLERS_QUERY,
  enabled = true,
  fetchPolicy = undefined
}) {

  const variables = computed( () => ({
    entityLabel: toValue(entityLabel),
    entityIds: [toValue(entityId)]
  }))

  const queryEnabled = computed(() => {
    return !!toValue(entityLabel) && toValue(entityId) != null && !!toValue(enabled)
  })

  const { result, loading, error, refetch } = useQuery(
    query,
    variables,
    () => ({ enabled: queryEnabled.value, ...(fetchPolicy ? { fetchPolicy } : {}) })
  )

  const controller = computed(() =>
      result.value?.controlsControllers?.result?.[0] ?? null
  )

  return {
    controller,
    loading,
    error,
    refetch
  }
}
