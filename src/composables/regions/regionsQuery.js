import { computed} from "vue";
import {useApolloClient, useQuery} from "@vue/apollo-composable"

import REGIONS_QUERY from '@/graphql/regions/regions.graphql'
import LOCATIONS_QUERY from '@/graphql/regions/locations.graphql'

export function useRegionsQuery(){

    const { resolveClient} = useApolloClient()
    const client = resolveClient()

    const {
        result: regionsResult,
        loading: regionsLoading,
        onResult: onRegionsResult,
        error: regionsError,
        refetch: refetchRegions
    } = useQuery(REGIONS_QUERY)

    const regions = computed(() => {
        if (!regionsResult.value) {
            return []
        }
        const regions = [...regionsResult.value.regions.result]
        regions.sort((a, b) => a?.name.localeCompare(b?.name))
        return regions
    })

    // Cache regions as locations when they're loaded
    onRegionsResult((result) => {
        if (result?.data?.regions?.status !== "SUCCESS") return

        if (result?.data?.regions?.result) {
            client.cache.writeQuery({
                query: LOCATIONS_QUERY,
                variables: {locationIds: result.data.regions.result.map(location => location.id)},
                data: {
                    regionsLocations: {
                        __typename: "LocationsPayload",
                        status: result.data.regions.status,
                        result: result.data.regions.result,
                        errors: result.data.regions.errors
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