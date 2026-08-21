import { computed, toValue } from 'vue'
import {
    useQuery
} from '@vue/apollo-composable'

import LOCATIONS_QUERY from "@/graphql/regions/locations.graphql";

export function useLocationNodeQueries({ locationId }) {

    //Fetch location
    const {
        result: locationResult,
        loading: locationLoading,
        error: locationError,
        refetch: refetchLocation
    } = useQuery(
      LOCATIONS_QUERY,
        ()=>({ locationIds: [toValue(locationId)] }),
        { enabled: () => !!toValue(locationId) }
    )

    const location = computed( () => {
        return locationResult?.value?.regionsLocations?.result?.find(loc => loc.id === toValue(locationId))
    })

    return {
        location,
        locationLoading,
        locationError,
        refetchLocation
    }
}
