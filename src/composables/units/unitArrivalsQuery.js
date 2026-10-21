import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import UNITS_ARRIVALS_QUERY from '@/graphql/units/unitsArrivals.graphql'

/**
 * The arrivals at locations (breedgraph unitsArrivals): the units that came there together from elsewhere in their
 * unit graphs, newest first, undated last; with unitId, only the arrivals of units at, below or above it
 */
export function useUnitArrivalsQuery({ locationIds, unitId = null }) {

    const enabled = computed(() => (toValue(locationIds)?.length ?? 0) > 0)

    const {
        result,
        loading: arrivalsLoading,
        error: arrivalsError,
        refetch: refetchArrivals
    } = useQuery(
        UNITS_ARRIVALS_QUERY,
        () => ({ locationIds: toValue(locationIds), unitId: toValue(unitId) || null }),
        { enabled }
    )

    const arrivals = computed(() => (enabled.value ? result.value?.unitsArrivals?.result ?? [] : []))

    return {
        arrivals,
        arrivalsLoading,
        arrivalsError,
        refetchArrivals
    }
}
