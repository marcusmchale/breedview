import { useMutation } from '@vue/apollo-composable'
import DELETE_ANALYSIS from '@/graphql/analysis/deleteAnalysis.graphql'

// NOT_FOUND means the analysis is already gone, e.g. it expired, which is what the caller wanted
const DELETED_STATUSES = new Set(['SUCCESS', 'NOT_FOUND'])

/** Deletes an analysis, cancelling it if it is still queued or running. */
export function useDeleteAnalysis() {
  const { mutate, loading: deleteLoading } = useMutation(DELETE_ANALYSIS, {
    // Drop the cached submission and the query that reads it, so nothing shows the deleted analysis
    update: (cache, { data }, { variables }) => {
      if (!DELETED_STATUSES.has(data?.analysisDelete?.status)) return
      cache.evict({ id: cache.identify({ __typename: 'AnalysisSubmission', id: variables.id }) })
      cache.evict({ id: 'ROOT_QUERY', fieldName: 'analysisSubmission', args: { id: variables.id } })
      cache.gc()
    }
  })

  /** Resolves to { deleted, errors }. */
  const deleteAnalysis = async (id) => {
    const payload = (await mutate({ id }))?.data?.analysisDelete
    return {
      deleted: DELETED_STATUSES.has(payload?.status),
      errors: payload?.errors ?? []
    }
  }

  return { deleteAnalysis, deleteLoading }
}
