import { ref, computed, watch } from 'vue'
import {
    useApolloClient,
    useQuery
} from '@vue/apollo-composable'

import LOCATIONS_QUERY from "@/graphql/locations/locations.graphql";
import LOCATION_FRAGMENT from "@/graphql/locations/locationFragment.graphql";

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
        return locationResult.value?.locationsLocations?.result?.[0]
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
        return childLocationsResult?.value?.locationsLocations?.result
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

    // Fetch the country (region root) of the selected location, used to scope place searches
    const regionId = computed(() => {
        if (!selectedLocation.value) return null
        if (!selectedLocation.value.parent) return null  // the selected location is itself the country
        return selectedLocation.value.root?.id ?? null
    })
    const {
        result: regionResult
    } = useQuery(
        LOCATIONS_QUERY,
        () => ({ locationIds: [regionId.value] }),
        () => ({ enabled: regionId.value !== null })
    )
    const regionCountry = computed(() => {
        if (!selectedLocation.value) return null
        if (!selectedLocation.value.parent) return selectedLocation.value
        if (regionId.value === null) return null
        return regionResult.value?.locationsLocations?.result?.[0] ?? null
    })

    return {
        locationId,
        selectedLocation,
        childLocations,
        regionCountry
    }
}
