import { computed, toValue } from 'vue'
import {
    useQuery,
} from '@vue/apollo-composable'

import ONTOLOGY_RELATIONSHIPS_QUERY from '@/graphql/ontology/relationships.graphql'

import { useCurrentVersionQuery } from "@/composables/ontology/currentVersion";


export function useOntologyRelationshipsQuery({entryIds, view}) {

    // we need the current version to be able to read from cache
    // this is also required for the custom read policy,
    // not required in the graphql spec which does allow nullable version
    const { version } = useCurrentVersionQuery()

    const variables = computed(() => {
      return {
          entryIds: toValue(entryIds),
          versionId: version.value?.id,
          view: view
      }
    });
    const {
        result: relationshipsResult,
        loading: relationshipsLoading,
        error: relationshipsError,
        onResult: onRelationshipsResult,
        refetch
    } = useQuery(
        ONTOLOGY_RELATIONSHIPS_QUERY,
        variables,
        {
            enabled: computed(() => Boolean(toValue(entryIds)))
        },
        {
            fetchPolicy: 'cache-and-network'
        }
    )

    const relationships = computed(() => {
        if (!relationshipsResult.value?.ontologyRelationships?.result) {
            return []
        }
        return relationshipsResult.value.ontologyRelationships.result
    })

    return {
        relationships, onRelationshipsResult,
        relationshipsLoading,
        relationshipsError,
        refetch
    }
}