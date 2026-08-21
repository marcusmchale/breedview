import {ref, computed, toValue} from 'vue'
import { useLazyQuery, useApolloClient } from "@vue/apollo-composable";

import ENTRIES_NAVIGATION_QUERY from '@/graphql/germplasm/entriesNavigation.graphql'
import ENTRY_NAVIGATION_FRAGMENT from '@/graphql/germplasm/entryFragmentNavigation.graphql'

export function useGermplasmLazyQuery() {

    const { resolveClient} = useApolloClient()
    const client = resolveClient()

    const germplasmIds = ref([])
    const variables = computed( () => ({
        names: null,
        entryIds: toValue(germplasmIds)
    }))

    const {
        result: germplasmResult,
        load: loadGermplasm,
        loading: germplasmLoading,
        error: germplasmError,
        refetch: refetchGermplasm
    } = useLazyQuery(ENTRIES_NAVIGATION_QUERY, variables)

    const germplasm = computed(() => {
        console.log('germplasmResult', germplasmResult.value)
        const result = germplasmResult.value?.germplasmEntries?.result || []
        const germplasm = [...result]
        germplasm.sort((a, b) => (a?.name || "").localeCompare(b?.name || "") || (a?.id - b?.id))
        return germplasm
    })

    const loadChildGermplasm = (germplasmId) => {
        const cachedGermplasm = client.cache.readFragment({
            id: `GermplasmEntry:${germplasmId}`,
            fragment: ENTRY_NAVIGATION_FRAGMENT
        })
        if (cachedGermplasm?.sinks && cachedGermplasm?.sinks?.length > 0) {
            germplasmIds.value = cachedGermplasm.sinks.map(rel => rel.sink.id)
        }
        loadGermplasm()
    }

    const loadGermplasmByIds = (ids) => {
        germplasmIds.value = ids
        loadGermplasm()
    }

    const refetchGermplasmByIds = async (ids) => {
        germplasmIds.value = ids
        await refetchGermplasm()
    }

    return {
        germplasm,
        germplasmLoading,
        germplasmError,

        loadGermplasm,
        loadChildGermplasm,
        loadGermplasmByIds,
        refetchGermplasmByIds

    }
}