import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'

// Introspection query for data formats enum
import DATA_FORMATS from "@/graphql/references/dataFormats.graphql"

export function useReferenceSchema() {

  // Query to fetch enum descriptions
  const { result } = useQuery(DATA_FORMATS)

  const dataFormats = computed(() => {
    console.log('Data formats fetched:', result.value?.__type?.enumValues)
    return result.value?.__type?.enumValues || []
  })
  return {
    dataFormats
  }
}