import { computed, toValue } from 'vue'
import {
    useQuery,
} from '@vue/apollo-composable'

import { useCurrentVersionQuery } from "@/composables/ontology/currentVersion";

import ONTOLOGY_ENTRIES_QUERY from '@/graphql/ontology/entries.graphql'

export function useOntologyEntriesQuery({entryIds, labels}) {

    // to support caching with updates we first always fetch the version ID, then apollo can decide whether
    const { version } = useCurrentVersionQuery()

    const variables = computed(() => {
      return {
          entryIds: toValue(entryIds) ?? null,
          labels: toValue(labels) ?? null,
          versionId: version.value?.id ?? null,  // ensure versionID is still reactive
      }
    });

    const {
        result,
        loading: entriesLoading,
        error: entriesError
    } = useQuery(
        ONTOLOGY_ENTRIES_QUERY,
        variables,
        {
            enabled: computed(() => !!version.value)
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