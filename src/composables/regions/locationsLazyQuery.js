import { useItemsLazyQuery } from "@/composables/queryBase/itemsLazyBase";

import LOCATIONS_QUERY from "@/graphql/regions/locations.graphql";
import LOCATION_FRAGMENT from "@/graphql/regions/locationFragment.graphql";


export function useLocationsLazyQuery() {

    const {
        items: locations,
        itemsLoading: locationsLoading,
        itemsError: locationsError,
        loadItems: loadLocations,
        loadChildren: loadChildLocations
    } = useItemsLazyQuery({
        itemsQueryGraphql: LOCATIONS_QUERY,
        itemQueryFragment: LOCATION_FRAGMENT,
        queryName: 'regionsLocations',
        variableName: 'locationIds',
        typeName: 'Location'
    })

    return {
        locations,
        locationsLoading,
        locationsError,

        loadLocations,
        loadChildLocations
    }
}