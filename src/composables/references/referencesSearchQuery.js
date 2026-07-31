import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import { toValue } from 'vue'

import REFERENCES_SEARCH from '@/graphql/references/referencesSearch.graphql'

export function useReferencesSearchQuery({description, referenceTypes}) {

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
        REFERENCES_SEARCH,
        () => (
            {
                description: toValue(description),
                referenceTypes: toValue(referenceTypes)
            }
        ),
        { enabled: queryEnabled, debounce: 500 }
    )

    const searchResults = computed(() => {
        if (searchResult.value?.referencesSearch?.status === 'SUCCESS') {
            return searchResult.value.referencesSearch.result || []
        }
        return []
    })

    const queryErrors = computed(() => {
        return searchResult.value?.referencesSearch?.errors || []
    })

    return {
        searchResults,
        searchLoading,
        searchError,
        queryErrors,
        refetchSearch
    }
}