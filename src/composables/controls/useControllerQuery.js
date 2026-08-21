import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import CONTROLLERS_QUERY from '../../graphql/controls/controllers.graphql'

export function useControllerQuery({ entityLabel, entityId }) {

  const variables = computed( () => ({
    entityLabel: toValue(entityLabel),
    entityIds: [toValue(entityId)]
  }))

  const enabled = computed(() => {
    return !!toValue(entityLabel) && toValue(entityId != null)
  })

  const { result, loading, error, refetch } = useQuery(
    CONTROLLERS_QUERY,
    variables,
    { enabled: enabled }
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