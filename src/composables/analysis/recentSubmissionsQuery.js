import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import RECENT_SUBMISSIONS_QUERY from '@/graphql/analysis/analysisRecentSubmissions.graphql'

/** IDs of the user's unexpired analysis submissions, most recently updated first. */
export function useRecentSubmissions() {
  const { result, loading, error, refetch } = useQuery(RECENT_SUBMISSIONS_QUERY, null, {
    fetchPolicy: 'cache-and-network'
  })

  const ids = computed(() => result.value?.analysisRecentSubmissions?.result ?? [])

  return {
    ids,
    recentLoading: loading,
    recentError: error,
    refetchRecent: refetch
  }
}
