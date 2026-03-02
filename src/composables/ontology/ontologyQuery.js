import { computed, toValue } from 'vue'
import {
    useQuery,
} from '@vue/apollo-composable'

import ONTOLOGY_QUERY from '@/graphql/ontology/ontology.graphql'

export function useOntologyQuery({versionId}) {

    const {
        result,
        loading: ontologyLoading,
        error: ontologyError,
        refetch: ontologyRefetch
    } = useQuery(
        ONTOLOGY_QUERY,
        {
            versionId: toValue(versionId) || null
        }
    )

    const ontology = computed(() => {
        return result.value?.ontology?.result
    })

    const ontologyErrors = computed( () => {
        if (ontologyError.value) return [ontologyError.value]
        return result.value?.ontology?.errors || []
    })

    return {
        ontology,
        ontologyLoading,
        ontologyErrors,
        ontologyRefetch
    }
}