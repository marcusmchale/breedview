import { computed } from 'vue'
import {
    useQuery,
    useApolloClient
} from '@vue/apollo-composable'

import LOCATIONS_QUERY from "@/graphql/regions/locations.graphql";
import LOCATION_FRAGMENT from "@/graphql/regions/locationFragment.graphql";


export function useLocationNodeQueries({locationId, regionId}) {
    const { client } = useApolloClient()

    //Fetch location by ID
    const {
        result: locationResult
    } = useQuery(
      LOCATIONS_QUERY,
      { locationIds: [locationId] }
    )
    const displayedLocation = computed( () => {
        return locationResult?.value?.regionsLocations?.result?.[0]
    })

    //Fetch region root location
    const {
        result: regionResult
    } = useQuery(
        LOCATIONS_QUERY,
        { locationIds: [regionId] }
    )
    const regionRootLocation = computed (() => {
        return regionResult?.value?.regionsLocations?.result?.[0]
    })


    const getCachedChildren = (locationId) => {
        const cachedLocation = client.cache.readFragment({
            id: `Location:${locationId}`,
            fragment: LOCATION_FRAGMENT
        })
        if (cachedLocation?.children) {
            const cachedChildren = cachedLocation.children.map(child => client.cache.readFragment({
                id: `Location:${child.id}`,
                fragment: LOCATION_FRAGMENT
            }))
            return cachedChildren.filter(Boolean)
        } else {
            return []
        }
    }

    return {
        displayedLocation,
        regionRootLocation,

        getCachedChildren
    }
}
