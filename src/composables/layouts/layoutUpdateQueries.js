import { useLayoutQuery } from "@/composables/layouts/layoutQuery";
import { useLayoutsLazyQuery } from "@/composables/layouts/layoutsLazyQuery";
import { useLocationQuery } from "@/composables/locations/locationQuery";
import { useLocationRootsQuery } from "@/composables/locations/locationRootsQuery";
import { useLocationsLazyQuery } from "@/composables/locations/locationsLazyQuery";

export function useLayoutUpdateQueries({arrangementId, parentId, locationId}) {

    const {
        layout: arrangementLayout,
        layoutLoading: arrangementLoading,
        layoutError: arrangementError
    } = useLayoutQuery(arrangementId)

    const {
        layout: parentLayout,
        layoutLoading: parentLoading,
        layoutError: parentError
    } = useLayoutQuery(parentId)

    const {
        layouts,
        layoutsLoading,
        loadChildLayouts
    } = useLayoutsLazyQuery()

    // For location breadcrumb
    const {
      regions
    } = useLocationRootsQuery()

    const {
      location
    } = useLocationQuery(locationId)

    const {
        locations: currentChildLocations,
        locationsLoading: childLocationsLoading,
        loadChildLocations
    } = useLocationsLazyQuery()

    return {
        arrangementLayout,
        arrangementLoading,
        arrangementError,

        parentLayout,
        parentLoading,
        parentError,

        layouts,
        layoutsLoading,
        loadChildLayouts,

        regions,
        location,
        loadChildLocations,
        childLocationsLoading,
        currentChildLocations
    }
}