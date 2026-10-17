import { useItemsQuery } from "@/composables/queryBase/itemsBase";

import LOCATIONS_QUERY from "@/graphql/locations/locations.graphql";

export function useLocationsQuery({locationIds}) {

    const {
        items: locations,
        itemsLoading: locationsLoading,
        itemsError: locationsError
    } = useItemsQuery({
        itemIds: locationIds,
        itemsQueryGraphql: LOCATIONS_QUERY,
        queryName: 'locationsLocations',
        variableName: 'locationIds'
    })

    return {
        locations,
        locationsLoading,
        locationsError
    }
}