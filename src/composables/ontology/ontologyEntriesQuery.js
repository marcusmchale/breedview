import { computed, toValue } from 'vue'
import {
    useQuery,
} from '@vue/apollo-composable'

import ONTOLOGY_ENTRIES_QUERY from '@/graphql/ontology/entries.graphql'

import { useCurrentVersionQuery } from "@/composables/ontology/currentVersion";

export function useOntologyEntriesQuery({entryIds, labels, view}) {

    // we need the current version to be able to read from cache
    // this is also required for the custom read policy,
    // not required in the graphql spec which does allow nullable version
    const { version } = useCurrentVersionQuery()

    const variables = computed(() => {
      return {
          entryIds: toValue(entryIds),
          labels: toValue(labels),
          versionId: version.value?.id,
          view: view
      }
    });

    const {
        result,
        loading: entriesLoading,
        error: entriesError,
        refetch
    } = useQuery(
        ONTOLOGY_ENTRIES_QUERY,
        variables,
        {
            enabled: computed(() => Boolean(toValue(entryIds) || toValue(labels)))
        }
    )

    const entries = computed(() =>
        result.value?.ontologyEntries?.result ?? []
    )

    return {
        entries,
        entriesLoading,
        entriesError,
        refetch
    }
}