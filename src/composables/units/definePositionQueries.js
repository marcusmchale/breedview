
import { useLocationQuery } from "@/composables/locations/locationQuery";
import { useLocationRootsQuery } from "@/composables/locations/locationRootsQuery";
import { useLocationsLazyQuery } from "@/composables/locations/locationsLazyQuery";

import { useLayoutQuery } from "@/composables/layouts/layoutQuery";
import { useLayoutRootsQuery } from "@/composables/layouts/layoutRootsQuery";
import { useLayoutsLazyQuery } from "@/composables/layouts/layoutsLazyQuery";

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
    } = useLocationRootsQuery()

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
    } = useLayoutRootsQuery(locationId)

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