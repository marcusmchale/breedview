import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import { toValue } from 'vue'

import REFERENCES_DESCRIPTION from '@/graphql/references/referencesDescription.graphql'

export function useReferencesSearchQuery(description) {

    const queryEnabled = computed(() => {
        const desc = toValue(description)
        return desc !== null && desc !== undefined && desc.trim().length >= 2
    })

    const {
        result: searchResult,
        loading: searchLoading,
        error: searchError,
        refetch: refetchSearch
    } = useQuery(
        REFERENCES_DESCRIPTION,
        () => ({ description: toValue(description) }),
        { enabled: queryEnabled, debounce: 500 }
    )

    const searchResults = computed(() => {
        if (searchResult.value?.referencesDescription?.status === 'SUCCESS') {
            return searchResult.value.referencesDescription.result || []
        }
        return []
    })

    const queryErrors = computed(() => {
        return searchResult.value?.referencesDescription?.errors || []
    })

    return {
        searchResults,
        searchLoading,
        searchError,
        queryErrors,
        refetchSearch
    }
}