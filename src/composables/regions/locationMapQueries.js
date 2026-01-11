import { ref, computed, watch } from 'vue'
import {
    useApolloClient,
    useQuery
} from '@vue/apollo-composable'

import LOCATIONS_QUERY from "@/graphql/regions/locations.graphql";
import LOCATION_FRAGMENT from "@/graphql/regions/locationFragment.graphql";

export function useLocationMapQueries() {
    const { client } = useApolloClient()

    //Fetch location by ID
    const locationId = ref(null)
    const locationQueryVariables = computed( () => {
        const variables = locationId.value !== null ? { locationIds:  [locationId.value] } : null
      return variables
    })
    const locationQueryEnabled = computed( () => {
        return locationQueryVariables.value !== null
    })
    const {
        result: locationResult
    } = useQuery(
        LOCATIONS_QUERY,
        locationQueryVariables,
        {enabled: locationQueryEnabled}
    )
    const selectedLocation = computed(() => {
        if (locationId.value === null) return null
        return locationResult.value?.regionsLocations?.result?.[0]
    })

    const childLocationIds = ref(null)
    const validChildLocationIds = computed( () => {
        if (childLocationIds.value === null) return []
        return [...new Set(childLocationIds.value)].filter(Boolean)
    })
    const childLocationsQueryVariables = computed( () => {
      return {locationIds: validChildLocationIds.value}
    })
    const childLocationsEnabled = computed( () => {
        return validChildLocationIds.value.length > 0
    })
    const {
        result: childLocationsResult
    } = useQuery(
        LOCATIONS_QUERY,
        childLocationsQueryVariables,
        {enabled: childLocationsEnabled}
    )
    const childLocations = computed( () => {
        if (!validChildLocationIds.value) return []
        if (validChildLocationIds.value.length === 0)  return []
        return childLocationsResult?.value?.regionsLocations?.result
    })

    //Fetch child locations
    watch(locationId, (newLocationId) => {
        if (newLocationId) {
            const cachedLocation = client.cache.readFragment({
                id: `Location:${newLocationId}`,
                fragment: LOCATION_FRAGMENT
            })
            childLocationIds.value = cachedLocation.children.map(child => child.id)
        }
    })

    return {
        locationId,
        selectedLocation,
        childLocations
    }
}
