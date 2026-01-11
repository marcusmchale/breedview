import { ref } from 'vue'
import { useLazyQuery, useMutation } from '@vue/apollo-composable'
import { useCacheUpdates } from "@/composables/system/cacheUpdates";

import DELETE_LOCATION_MUTATION from '@/graphql/regions/deleteLocation.graphql'
import UPDATE_LOCATION_MUTATION from '@/graphql/regions/updateLocation.graphql'
import CREATE_LOCATION_MUTATION from '@/graphql/regions/createLocation.graphql'
import LOCATION_FRAGMENT from '@/graphql/regions/locationFragment.graphql'
import LOCATIONS_QUERY from "@/graphql/regions/locations.graphql";

export function useMutateLocations() {

    const { updateItem, deleteItem } = useCacheUpdates({
        typename: "Location",
        fragment: LOCATION_FRAGMENT
    })

    const loadLocationIds = ref(null)
    const {
        load: loadLocations,
        refetch: refetchLocations
    } = useLazyQuery(
        LOCATIONS_QUERY,
        () => ({ 'locationIds': loadLocationIds.value }),
        { fetchPolicy: "cache-and-network" }
    )

    const reloadLocations = (locationIds) => {
        let unique = [...new Set(locationIds)].filter(Boolean)
        if (unique.length === 0) return
        loadLocationIds.value = unique
        loadLocations() || refetchLocations()
    }

    // Create a location and load it to the cache, return status and errors
    const {
        mutate: createLocationMutation,
        loading: createLocationLoading,
    } = useMutation(CREATE_LOCATION_MUTATION)

    const createLocation = async (locationData) => {
        const response = await createLocationMutation({location: locationData})

        if (response?.data?.regionsCreateLocation) {
          const result = response.data.regionsCreateLocation
          if (result.status === 'SUCCESS') {
              reloadLocations([locationData.parentId])
          }
          const { status, errors } = result
          return { status, errors }
        }
    }

    // Update a location
    const {
        mutate: updateLocationMutation,
        loading: updateLocationLoading
    } = useMutation(UPDATE_LOCATION_MUTATION)

    const updateLocation = async (locationData) => {
        const response = await updateLocationMutation({location: locationData})
        if (response?.data?.regionsUpdateLocation) {
            const result = response.data.regionsUpdateLocation
            if (result.status === 'SUCCESS') {
                updateItem({
                    updateData: locationData,
                    idField: 'locationId'
                })
            }
            const { status, errors} = result
            return { status, errors}
        }
    }

    // Delete a location
    const {
        mutate: deleteLocationMutation,
        loading: deleteLocationLoading,
    } = useMutation(DELETE_LOCATION_MUTATION)

    const deleteLocation = async (locationId) => {
        const response = await deleteLocationMutation({
            locationId: locationId
        })
        if (response?.data?.regionsDeleteLocation) {
            const result = response.data.regionsDeleteLocation

            if (result.status === 'SUCCESS') {
                deleteItem({itemId: locationId })
            }
            const {status, errors} = result
            return {status, errors}
        }
    }

    return {
        createLocation,
        createLocationLoading,

        updateLocation,
        updateLocationLoading,

        deleteLocation,
        deleteLocationLoading
    }

}

