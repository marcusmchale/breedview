import { useLayoutQuery } from "@/composables/arrangements/layoutQuery";
import { useLayoutsLazyQuery } from "@/composables/arrangements/layoutsLazyQuery";
import { useLocationQuery } from "@/composables/regions/locationQuery";
import { useRegionsQuery } from "@/composables/regions/regionsQuery";
import { useLocationsLazyQuery } from "@/composables/regions/locationsLazyQuery";

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
    } = useRegionsQuery()

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