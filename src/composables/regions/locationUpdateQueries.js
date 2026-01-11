import { useLocationQuery } from "@/composables/regions/locationQuery";
import { useLocationsLazyQuery } from "@/composables/regions/locationsLazyQuery";


export function useLocationUpdateQueries({regionId, parentId}) {

    const {
        location: regionLocation,
        locationLoading: regionLoading,
        locationError: regionError
    } = useLocationQuery(regionId)

    const {
        location: parentLocation,
        locationLoading: parentLoading,
        locationError: parentError
    } = useLocationQuery(parentId)

    const {
        locations,
        locationsLoading,
        loadChildLocations
    } = useLocationsLazyQuery()

    return {
        regionLocation,
        regionLoading,
        regionError,

        parentLocation,
        parentLoading,
        parentError,

        locations,
        locationsLoading,
        loadChildLocations
    }
}
