import { computed, toValue } from 'vue'
import {
    useQuery,
} from '@vue/apollo-composable'

import ONTOLOGY_ENTRIES_QUERY from '@/graphql/ontology/entries.graphql'

export function useOntologyEntriesQuery({entryIds, labels}) {

    const {
        result,
        loading: entriesLoading,
        error: entriesError
    } = useQuery(
        ONTOLOGY_ENTRIES_QUERY,
        {
            entryIds: toValue(entryIds) || null,
            labels: toValue(labels) || null
        }
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