import { computed} from "vue";
import {useApolloClient, useQuery} from "@vue/apollo-composable"

import LOCATIONS_ROOTS_QUERY from '@/graphql/locations/locationsRoots.graphql'
import LOCATIONS_QUERY from '@/graphql/locations/locations.graphql'

export function useLocationRootsQuery(){

    const { resolveClient} = useApolloClient()
    const client = resolveClient()

    const {
        result: regionsResult,
        loading: regionsLoading,
        onResult: onRegionsResult,
        error: regionsError,
        refetch: refetchRegions
    } = useQuery(LOCATIONS_ROOTS_QUERY)

    const regions = computed(() => {
        const regions = [...regionsResult.value?.locationsRoots?.result ?? []]
        regions.sort((a, b) => a?.name.localeCompare(b?.name))
        return regions
    })

    // Cache regions as locations when they're loaded
    onRegionsResult((result) => {
        if (result?.data?.locationsRoots?.status !== "SUCCESS") return
        if (result?.data?.locationsRoots?.result) {
            client.cache.writeQuery({
                query: LOCATIONS_QUERY,
                variables: {locationIds: result.data.locationsRoots.result.map(location => location.id)},
                data: {
                    locationsLocations: {
                        __typename: "LocationsPayload",
                        status: result.data.locationsRoots.status,
                        result: result.data.locationsRoots.result,
                        errors: result.data.locationsRoots.errors
                    }
                }
            })
        }
    })
    return {
        regions,
        regionsLoading,
        regionsError,
        refetchRegions
    }
}