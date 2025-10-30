
import { ref } from 'vue'
import { useLazyQuery } from '@vue/apollo-composable'
import CONTROLLERS_QUERY from '../graphql/controls/controllers.graphql'

export function useControllerData() {
  const controller = ref(null)
  const loading = ref(false)
  const error = ref('')
  const hasLoaded = ref(false)

  // Store variables in a ref for dynamic updates
  const queryVariables = ref({
    entityLabel: null,
    entityIds: []
  })

  // Use lazy query with the variables ref
  const { load: loadControllers, onResult, onError, refetch } = useLazyQuery(
    CONTROLLERS_QUERY,
    () => queryVariables.value
  )

  onResult((result) => {
    if (result?.data?.controlsControllers) {
      const response = result.data.controlsControllers

      if (response.status === 'SUCCESS' && response.result && response.result.length > 0) {
        controller.value = response.result[0]
        error.value = ''
        hasLoaded.value = true
      } else if (response.errors && response.errors.length > 0) {
        error.value = response.errors[0].message
      } else {
        error.value = 'No controller information available'
      }
    }
    loading.value = false
  })

  onError((err) => {
    console.error('Controller fetch error:', err)
    error.value = err.message || 'Failed to load controller information'
    loading.value = false
  })

  const fetchController = async (entityLabel, entityId) => {
    loading.value = true
    error.value = ''

    // Update the variables
    queryVariables.value = {
      entityLabel,
      entityIds: [entityId]
    }

    try {
      await loadControllers()
    } catch (err) {
      console.error('Error loading controllers:', err)
      error.value = err.message || 'Failed to load controller information'
      loading.value = false
    }
  }

  const refetchController = async () => {
    loading.value = true
    error.value = ''

    try {
      if (hasLoaded.value && refetch) {
        await refetch()
      } else {
        loading.value = false
      }
    } catch (err) {
      console.error('Error reloading controllers:', err)
      error.value = err.message || 'Failed to reload controller information'
      loading.value = false
    }
  }

  const resetController = () => {
    controller.value = null
    error.value = ''
    hasLoaded.value = false
  }

  return {
    controller,
    loading,
    error,
    fetchController,
    refetchController,
    resetController
  }
}