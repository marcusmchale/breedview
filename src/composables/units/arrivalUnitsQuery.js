import { ref, watch, toValue } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'

import ARRIVAL_UNITS_QUERY from '@/graphql/units/arrivalUnits.graphql'

/**
 * An arrival's units, by name, a page at a time: the first page when the arrival is set, the next with loadMore.
 * arrival: { locationId, start, unitId } as the API takes it (ArrivalInput), or null. Each page asks for one more unit
 * than it shows, to know whether there is another.
 */
export function useArrivalUnitsQuery({ arrival, pageSize = 100 }) {

    const { resolveClient } = useApolloClient()
    const client = resolveClient()

    const units = ref([])
    const hasMore = ref(false)
    const unitsLoading = ref(false)
    const unitsError = ref(null)
    // an arrival changed while its page was loading replaces what that page brings
    let requested = 0

    const loadPage = async (offset) => {
        const value = toValue(arrival)
        const request = ++requested
        if (!value) {
            units.value = []
            hasMore.value = false
            return
        }
        unitsLoading.value = true
        unitsError.value = null
        try {
            const { data } = await client.query({
                query: ARRIVAL_UNITS_QUERY,
                variables: { arrival: value, offset, limit: pageSize + 1 }
            })
            if (request !== requested) return
            const payload = data?.unitsArrivalUnits
            if (payload?.status !== 'SUCCESS') {
                throw new Error(payload?.errors?.map((e) => e.message).join(', ') || 'The arrival\'s units could not be read')
            }
            const page = payload.result ?? []
            units.value = [...(offset ? units.value : []), ...page.slice(0, pageSize)]
            hasMore.value = page.length > pageSize
        } catch (error) {
            if (request === requested) unitsError.value = error
        } finally {
            if (request === requested) unitsLoading.value = false
        }
    }

    const loadMore = () => loadPage(units.value.length)
    const reload = () => loadPage(0)

    watch(() => JSON.stringify(toValue(arrival) ?? null), () => loadPage(0), { immediate: true })

    return {
        units,
        hasMore,
        unitsLoading,
        unitsError,
        loadMore,
        reload
    }
}
