import { useMutation } from '@vue/apollo-composable'

import CREATE_TRIAL_MUTATION from '@/graphql/programs/createTrial.graphql'
import UPDATE_TRIAL_MUTATION from '@/graphql/programs/updateTrial.graphql'
import DELETE_TRIAL_MUTATION from '@/graphql/programs/deleteTrial.graphql'

export function useMutateTrials() {
  // Create trial
  const {
    mutate: createTrialMutation,
    loading: createTrialLoading,
    error: createTrialError
  } = useMutation(CREATE_TRIAL_MUTATION)

  const createTrial = async (trialData) => {
    const response = await createTrialMutation({ trial: trialData })
    if (response?.data?.programsCreateTrial) {
      const { status, errors } = response.data.programsCreateTrial
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  // Update trial
  const {
    mutate: updateTrialMutation,
    loading: updateTrialLoading,
    error: updateTrialError
  } = useMutation(UPDATE_TRIAL_MUTATION)

  const updateTrial = async (trialData) => {
    const response = await updateTrialMutation({ trial: trialData })
    if (response?.data?.programsUpdateTrial) {
      const { status, errors } = response.data.programsUpdateTrial
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  // Delete trial
  const {
    mutate: deleteTrialMutation,
    loading: deleteTrialLoading,
    error: deleteTrialError
  } = useMutation(DELETE_TRIAL_MUTATION)

  const deleteTrial = async (trialId) => {
    const response = await deleteTrialMutation({ trialId })
    if (response?.data?.programsDeleteTrial) {
      const { status, errors } = response.data.programsDeleteTrial
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  return {
    createTrial,
    createTrialLoading,
    createTrialError,

    updateTrial,
    updateTrialLoading,
    updateTrialError,

    deleteTrial,
    deleteTrialLoading,
    deleteTrialError
  }
}