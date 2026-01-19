import { useMutation } from '@vue/apollo-composable'

import CREATE_PROGRAM_MUTATION from '@/graphql/programs/createProgram.graphql'
import UPDATE_PROGRAM_MUTATION from '@/graphql/programs/updateProgram.graphql'
import DELETE_PROGRAM_MUTATION from '@/graphql/programs/deleteProgram.graphql'

export function useMutatePrograms() {
  // Create program
  const {
    mutate: createProgramMutation,
    loading: createProgramLoading,
    error: createProgramError
  } = useMutation(CREATE_PROGRAM_MUTATION)

  const createProgram = async (programData) => {
    const response = await createProgramMutation({ program: programData })
    if (response?.data?.programsCreateProgram) {
      const { status, errors } = response.data.programsCreateProgram
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  // Update program
  const {
    mutate: updateProgramMutation,
    loading: updateProgramLoading,
    error: updateProgramError
  } = useMutation(UPDATE_PROGRAM_MUTATION)

  const updateProgram = async (programData) => {
    const response = await updateProgramMutation({ program: programData })
    if (response?.data?.programsUpdateProgram) {
      const { status, errors } = response.data.programsUpdateProgram
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  // Delete program
  const {
    mutate: deleteProgramMutation,
    loading: deleteProgramLoading,
    error: deleteProgramError
  } = useMutation(DELETE_PROGRAM_MUTATION)

  const deleteProgram = async (programId) => {
    const response = await deleteProgramMutation({ programId })
    if (response?.data?.programsDeleteProgram) {
      const { status, errors } = response.data.programsDeleteProgram
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  return {
    createProgram,
    createProgramLoading,
    createProgramError,

    updateProgram,
    updateProgramLoading,
    updateProgramError,

    deleteProgram,
    deleteProgramLoading,
    deleteProgramError
  }
}