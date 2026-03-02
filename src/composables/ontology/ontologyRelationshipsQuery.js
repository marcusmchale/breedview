import { computed, toValue } from 'vue'
import {
    useQuery,
} from '@vue/apollo-composable'

import ONTOLOGY_RELATIONSHIPS_QUERY from '@/graphql/ontology/relationships.graphql'

export function useOntologyRelationshipsQuery({entryIds, labels, phases, versionId}) {

    const enabled = computed(() => (toValue(entryIds)?.length ?? 0) > 0)

    const variables = computed( () => ({
        entryIds: toValue(entryIds) || null,
        labels: toValue(labels) || null,
        phases: toValue(phases) || null,
        versionId: toValue(versionId) || null
    }))

    const {
        result,
        loading: relationshipsLoading,
        error: relationshipsError
    } = useQuery(
        ONTOLOGY_RELATIONSHIPS_QUERY,
        variables,
        {enabled: enabled}
    )

    const relationships = computed(() => {
        return result?.value?.ontologyRelationships?.result || []
    })

    return {
        relationships,
        relationshipsLoading,
        relationshipsError
    }
}