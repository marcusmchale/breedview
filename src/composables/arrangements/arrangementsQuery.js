import { computed, toValue } from 'vue'
import {
    useQuery,
    useApolloClient
} from '@vue/apollo-composable'

import ARRANGEMENTS_QUERY from '@/graphql/arrangements/arrangements.graphql'
import LAYOUTS_QUERY from '@/graphql/arrangements/layouts.graphql'

export function useArrangementsQuery(locationId) {
    const { resolveClient} = useApolloClient()
    const client = resolveClient()

    const arrangementsEnabled = computed( () => {
        return toValue(locationId) !== null
    })

    // Fetch root layouts (arrangements) for location
    const {
        result: arrangementsResult,
        loading: arrangementsLoading,
        onResult: onArrangementsResult,
        error: arrangementsError,
        refetch: refetchArrangements
    } = useQuery(
        ARRANGEMENTS_QUERY,
        () => ({ 'locationId': toValue(locationId) }),
        { enabled: arrangementsEnabled }
    )

    const arrangements = computed( () => {
        if (!arrangementsResult.value) {
            return []
        }
        const arrangements = [...arrangementsResult.value.arrangements.result]
        arrangements.sort((a,b) => a?.name.localeCompare(b?.name))
        return arrangements
    })

    onArrangementsResult((result) => {
        updateCachedLocationArrangements(result)
    })

    const updateCachedLocationArrangements = (result) => {
        if (result?.data?.arrangements?.status !== "SUCCESS") return
        if (result?.data?.arrangements?.result) {
            client.cache.writeQuery( {
                query: LAYOUTS_QUERY,
                variables: {layoutIds: result.data.arrangements.result.map(layout => layout.id)},
                data: {
                    arrangementsLayouts: {
                        __typename: "LayoutsPayload",
                        status: result.data.arrangements.status,
                        result: result.data.arrangements.result,
                        errors: result.data.arrangements.errors
                    }
                }
            })
        }
    }

    return {
        arrangements,
        arrangementsLoading,
        arrangementsError,
        refetchArrangements
    }
}