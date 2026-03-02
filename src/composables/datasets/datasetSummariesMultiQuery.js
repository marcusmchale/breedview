import { computed, toValue, ref } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'
import DATASET_SUMMARIES_QUERY from '@/graphql/datasets/datasetSummaries.graphql'

/**
 * Fetches dataset summaries for multiple studies.
 * Since the GraphQL query only supports a single studyId,
 * we fetch summaries for each study and merge them.

 * // todo update breedview to support multiple studyIds in a single query
 *
 *
 */

export function useDatasetSummariesMultiQuery() {
  const { resolveClient } = useApolloClient()

  const summaries = ref([])
  const loading = ref(false)
  const error = ref(null)

  /**
   * Fetch summaries for multiple study IDs
   * @param {number[]} studyIds - Array of study IDs
   */
  const fetchSummaries = async (studyIds) => {
    const ids = toValue(studyIds)

    if (!ids || ids.length === 0) {
      summaries.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const client = resolveClient()

      // Fetch summaries for each study in parallel
      const results = await Promise.all(
        ids.map(studyId =>
          client.query({
            query: DATASET_SUMMARIES_QUERY,
            variables: { studyId },
            fetchPolicy: 'network-only'
          })
        )
      )

      // Merge all summaries
      const allSummaries = []
      results.forEach((result, index) => {
        const studySummaries = result?.data?.datasetsSummaries?.result || []
        // Add studyId to each summary for reference
        studySummaries.forEach(summary => {
          allSummaries.push({
            ...summary,
            _studyId: ids[index]
          })
        })
      })

      summaries.value = allSummaries
    } catch (err) {
      console.error('Error fetching dataset summaries:', err)
      error.value = err.message || 'Failed to fetch dataset summaries'
    } finally {
      loading.value = false
    }
  }

  // Extract unique concepts from summaries
  const availableConcepts = computed(() => {
    const conceptMap = new Map()

    summaries.value.forEach(summary => {
      if (summary.concept) {
        conceptMap.set(summary.concept.id, summary.concept)
      }
    })

    return Array.from(conceptMap.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    )
  })

  // Get dataset IDs for selected concept IDs
  const getDatasetIdsForConcepts = (conceptIds) => {
    const ids = toValue(conceptIds)
    if (!ids || ids.length === 0) return []

    return summaries.value
      .filter(summary => ids.includes(summary.concept?.id))
      .map(summary => summary.id)
  }

  return {
    summaries,
    loading,
    error,
    fetchSummaries,
    availableConcepts,
    getDatasetIdsForConcepts
  }
}