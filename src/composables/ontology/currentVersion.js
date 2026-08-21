import { computed } from 'vue'
import {
    useQuery,
} from '@vue/apollo-composable'

import ONTOLOGY_CURRENT_VERSION from '@/graphql/ontology/currentVersion.graphql'

export function useCurrentVersionQuery() {

    const {
        result,
        loading: versionLoading,
        error: versionError,
        refetch: refetchVersion
    } = useQuery(
        ONTOLOGY_CURRENT_VERSION,
        {},
        {
            fetchPolicy: "cache-and-network"
        }
    )

    const version = computed(
      () => result.value?.ontologyVersion?.result ?? null
    );

    return {
        version,
        versionLoading,
        versionError,
        refetchVersion
    }
}