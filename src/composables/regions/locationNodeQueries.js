import { computed } from 'vue'
import {
    useQuery
} from '@vue/apollo-composable'

import LOCATIONS_QUERY from "@/graphql/regions/locations.graphql";

export function useLocationNodeQueries({locationId}) {

    //Fetch location
    const {
        result: locationResult,
        refetch: refetchLocation
    } = useQuery(
      LOCATIONS_QUERY,
      { locationIds: [locationId] }
    )

    const displayedLocation = computed( () => {
        return locationResult?.value?.regionsLocations?.result?.find(location => location.id === locationId)
    })

    return {
        displayedLocation,
        refetchLocation
    }
}
