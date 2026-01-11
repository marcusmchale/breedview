import { useRegionsQuery } from "@/composables/regions/regionsQuery"
import { useLocationsQuery } from "@/composables/regions/locationsQuery"
import { useLocationsLazyQuery } from "@/composables/regions/locationsLazyQuery";

export function useSelectLocationsQuery({locationIds}) {
    const {
        regions,
        regionsLoading,
        regionsError
    } = useRegionsQuery();

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