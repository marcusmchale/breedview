
import { useLocationQuery } from "@/composables/regions/locationQuery";
import { useRegionsQuery } from "@/composables/regions/regionsQuery";
import { useLocationsLazyQuery } from "@/composables/regions/locationsLazyQuery";

import { useLayoutQuery } from "@/composables/arrangements/layoutQuery";
import { useArrangementsQuery } from "@/composables/arrangements/arrangementsQuery";
import { useLayoutsLazyQuery } from "@/composables/arrangements/layoutsLazyQuery";

export function useDefinePositionQueries({locationId, layoutId}) {

    // For current selected location
    const {
        location,
        locationLoading,
        locationError
    } = useLocationQuery(locationId)

    // For locations breadcrumb
    const {
        regions,
        regionsLoading,
        regionsError
    } = useRegionsQuery()

    const {
        locations: currentChildLocations,
        locationsLoading: childLocationsLoading,
        loadChildLocations
    } = useLocationsLazyQuery()

    // For current selected layout
    const {
        layout,
        layoutLoading,
        layoutError
    } = useLayoutQuery(layoutId)

    // For layouts breadcrumb
    const {
        arrangements,
        arrangementsLoading,
        arrangementsError
    } = useArrangementsQuery(locationId)

    const {
        layouts: currentChildLayouts,
        layoutsLoading: childLayoutsLoading,
        loadChildLayouts
    } = useLayoutsLazyQuery()


    return {
        location,
        locationLoading,
        locationError,

        regions,
        regionsLoading,
        regionsError,

        loadChildLocations,
        childLocationsLoading,
        currentChildLocations,

        layout,
        layoutLoading,
        layoutError,

        arrangements,
        arrangementsLoading,
        arrangementsError,

        loadChildLayouts,
        childLayoutsLoading,
        currentChildLayouts
    }
}