import { computed } from 'vue'
import {
    useQuery,
} from '@vue/apollo-composable'

import ONTOLOGY_ENTRIES_QUERY from '@/graphql/ontology/entries.graphql'

export function useOntologyEntriesQuery({labels}) {

    const {
        result,
        loading: entriesLoading,
        error: entriesError
    } = useQuery(
        ONTOLOGY_ENTRIES_QUERY,
        { labels: labels },
        { fetchPolicy: "cache-and-network"}
    )

    const entries = computed(() => {
        if (!result.value?.ontologyEntries?.result) {
            return []
        }
        return result.value.ontologyEntries.result
    })

    return {
        entries,
        entriesLoading,
        entriesError
    }
}