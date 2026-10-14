import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import CONTROLLERS_QUERY from '../../graphql/controls/controllers.graphql'

/**
 * The controller of one entity. Pass `query` to read fewer fields, as long as it reads `controlsControllers`,
 * and `enabled` to hold the query back until it is needed. Queries reading different fields share the cached
 * controllers through the ControllersPayload merge policy (see apollo.js).
 * `variables` adds to the entity label and id, such as `lastWrites` for the full controller query.
 */
export function useControllerQuery({
  entityLabel,
  entityId,
  query = CONTROLLERS_QUERY,
  enabled = true,
  variables: extraVariables = {}
}) {

  const variables = computed( () => ({
    entityLabel: toValue(entityLabel),
    entityIds: [toValue(entityId)],
    ...toValue(extraVariables)
  }))

  const queryEnabled = computed(() => {
    return !!toValue(entityLabel) && toValue(entityId) != null && !!toValue(enabled)
  })

  const { result, loading, error, refetch } = useQuery(
    query,
    variables,
    { enabled: queryEnabled }
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
