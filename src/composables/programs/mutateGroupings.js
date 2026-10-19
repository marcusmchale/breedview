
import { useMutation } from '@vue/apollo-composable'

import CREATE_GROUPING_MUTATION from '@/graphql/programs/createGrouping.graphql'
import UPDATE_GROUPING_MUTATION from '@/graphql/programs/updateGrouping.graphql'
import DELETE_GROUPING_MUTATION from '@/graphql/programs/deleteGrouping.graphql'


import { useStudyQuery } from "@/composables/programs/studyQuery";
import { toValue } from "vue";


export function useMutateGroupings( { studyId } ) {

  const { refetchStudy } = useStudyQuery(studyId)


  // Create grouping
  const {
    mutate: createGroupingMutation,
    loading: createGroupingLoading,
    error: createGroupingError
  } = useMutation(CREATE_GROUPING_MUTATION)

  const createGrouping = async ({ groupingData }) => {
    console.log('createGrouping with', groupingData)
    const response = await createGroupingMutation({
      grouping: toValue(groupingData)
    })
    if (response?.data?.programsCreateGrouping) {
      const { status, errors } = response.data.programsCreateGrouping
      if (status === 'SUCCESS') {
          await refetchStudy()
      }
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  // Update grouping
  const {
    mutate: updateGroupingMutation,
    loading: updateGroupingLoading,
    error: updateGroupingError
  } = useMutation(UPDATE_GROUPING_MUTATION)

  const updateGrouping = async ({ groupingData }) => {
    const response = await updateGroupingMutation({ grouping: groupingData })
    if (response?.data?.programsUpdateGrouping) {
      const { status, errors } = response.data.programsUpdateGrouping
      if (status === 'SUCCESS') {
          await refetchStudy()
      }
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  // Delete grouping
  const {
    mutate: deleteGroupingMutation,
    loading: deleteGroupingLoading,
    error: deleteGroupingError
  } = useMutation(DELETE_GROUPING_MUTATION)

  const deleteGrouping = async (groupingId) => {
    const response = await deleteGroupingMutation({ id: groupingId })
    if (response?.data?.programsDeleteGrouping) {
      const { status, errors } = response.data.programsDeleteGrouping
      if (status === 'SUCCESS') {
          await refetchStudy()
      }
      return { status, errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  return {
    createGrouping,
    createGroupingLoading,
    createGroupingError,

    updateGrouping,
    updateGroupingLoading,
    updateGroupingError,

    deleteGrouping,
    deleteGroupingLoading,
    deleteGroupingError
  }
}