import { useLocationRootsQuery } from "@/composables/locations/locationRootsQuery"
import { useLocationsQuery } from "@/composables/locations/locationsQuery"
import { useLocationsLazyQuery } from "@/composables/locations/locationsLazyQuery";

export function useSelectLocationsQuery({locationIds}) {
    const {
        regions,
        regionsLoading,
        regionsError
    } = useLocationRootsQuery();

    const {
        locations: selectedLocations,
        locationsLoading: selectedLocationsLoading,
        locationsError: selectedLocationsError
    } = useLocationsQuery({locationIds: locationIds})

    const {
        locations: displayedLocations,
        loadLocations: loadDisplayedLocations,
        loadChildLocations: loadDisplayedChildLocations,
        locationsLoading: displayedLocationsLoading
    } = useLocationsLazyQuery()

    return {
        regions,
        regionsLoading,
        regionsError,

        selectedLocations,
        selectedLocationsLoading,
        selectedLocationsError,

        displayedLocations,
        displayedLocationsLoading,
        loadDisplayedLocations,
        loadDisplayedChildLocations,

    }

}