import { ref, toValue } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'
import STUDY_QUERY from '@/graphql/programs/study.graphql'

/**
 * Loads groupings for multiple studies (curation can span studies).
 * Returns { [studyId]: [Grouping] }.
 */
export function useStudiesGroupings() {
  const { resolveClient } = useApolloClient()

  const groupingsByStudy = ref({})
  const loading = ref(false)
  const error = ref(null)

  const fetchGroupings = async (studyIds) => {
    const ids = [...new Set((toValue(studyIds) || []).filter((id) => id != null))]
    if (ids.length === 0) {
      groupingsByStudy.value = {}
      return {}
    }

    loading.value = true
    error.value = null
    try {
      const client = resolveClient()
      const results = await Promise.all(
        ids.map((studyId) => client.query({ query: STUDY_QUERY, variables: { studyId } }))
      )
      const map = {}
      results.forEach((result, i) => {
        map[ids[i]] = result?.data?.programsStudy?.result?.groupings || []
      })
      groupingsByStudy.value = map
      return map
    } catch (err) {
      console.error('Error fetching study groupings:', err)
      error.value = err.message || 'Failed to fetch study groupings'
      return {}
    } finally {
      loading.value = false
    }
  }

  return { groupingsByStudy, loading, error, fetchGroupings }
}