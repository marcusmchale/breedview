import { useItemQuery } from "@/composables/queryBase/itemBase";
import LOCATIONS_QUERY from "@/graphql/regions/locations.graphql";

export function useLocationQuery(locationId) {

    const {
        item: location,
        itemLoading: locationLoading,
        itemError: locationError
    } = useItemQuery( {
        itemId: locationId,
        itemsQueryGraphql: LOCATIONS_QUERY,
        queryName: 'regionsLocations',
        variableName: 'locationIds'
    })

    return {
        location,
        locationLoading,
        locationError
    }
}