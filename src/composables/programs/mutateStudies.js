import { useMutation } from '@vue/apollo-composable'

import CREATE_STUDY_MUTATION from '@/graphql/programs/createStudy.graphql'
import UPDATE_STUDY_MUTATION from '@/graphql/programs/updateStudy.graphql'
import DELETE_STUDY_MUTATION from '@/graphql/programs/deleteStudy.graphql'

export function useMutateStudies() {
  // Create study
  const {
    mutate: createStudyMutation,
    loading: createStudyLoading,
    error: createStudyError
  } = useMutation(CREATE_STUDY_MUTATION)

  const createStudy = async (studyData) => {
    const response = await createStudyMutation({ study: studyData })
    if (response?.data?.programsCreateStudy) {
      const { status, errors } = response.data.programsCreateStudy
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  // Update study
  const {
    mutate: updateStudyMutation,
    loading: updateStudyLoading,
    error: updateStudyError
  } = useMutation(UPDATE_STUDY_MUTATION)

  const updateStudy = async (studyData) => {
    const response = await updateStudyMutation({ study: studyData })
    if (response?.data?.programsUpdateStudy) {
      const { status, errors } = response.data.programsUpdateStudy
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  // Delete study
  const {
    mutate: deleteStudyMutation,
    loading: deleteStudyLoading,
    error: deleteStudyError
  } = useMutation(DELETE_STUDY_MUTATION)

  const deleteStudy = async (studyId) => {
    const response = await deleteStudyMutation({ studyId })
    if (response?.data?.programsDeleteStudy) {
      const { status, errors } = response.data.programsDeleteStudy
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  return {
    createStudy,
    createStudyLoading,
    createStudyError,

    updateStudy,
    updateStudyLoading,
    updateStudyError,

    deleteStudy,
    deleteStudyLoading,
    deleteStudyError
  }
}