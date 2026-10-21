import { computed, toValue } from 'vue'
import {
    useQuery
} from '@vue/apollo-composable'

import LOCATIONS_QUERY from "@/graphql/locations/locations.graphql";

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
        // a ref: given a function, the option is always truthy and the query asked for no location
        { enabled: computed(() => !!toValue(locationId)) }
    )

    const location = computed( () => {
        return locationResult?.value?.locationsLocations?.result?.find(loc => loc.id === toValue(locationId))
    })

    return {
        location,
        locationLoading,
        locationError,
        refetchLocation
    }
}
