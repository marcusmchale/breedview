import { toValue } from "vue";
import { useMutation } from '@vue/apollo-composable'

import MERGE_SCOPE_MUTATION from '@/graphql/programs/mergeScope.graphql'

export function useMergeScope() {
  const {
    mutate: mergeScopeMutation,
    loading: mergeScopeLoading,
    error: mergeScopeError
  } = useMutation(MERGE_SCOPE_MUTATION, { refetchQueries: ['programsStudy'] })
    // this will refetch all active studies so watch for performance cost, but should be minimal

  const mergeScope = async ({ groupingId, datasetIds }) => {
    const response = await mergeScopeMutation({
      groupingId: toValue(groupingId),
      datasetIds: toValue(datasetIds)
    })
    const payload = response?.data?.programsMergeScope
    if (payload) {
      return { status: payload.status, errors: payload.errors }
    }
    return { status: 'ERROR', errors: [{ message: 'No response from server' }] }
  }

  return { mergeScope, mergeScopeLoading, mergeScopeError }
}