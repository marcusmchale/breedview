import {ref, computed, toValue} from 'vue'
import { useLazyQuery, useApolloClient } from "@vue/apollo-composable";

import ENTRIES_QUERY from '@/graphql/germplasm/entries.graphql'
import ENTRY_FRAGMENT from '@/graphql/germplasm/entryFragment.graphql'

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
        error: germplasmError
    } = useLazyQuery(ENTRIES_QUERY, variables)

    const germplasm = computed(() => {
        const result = germplasmResult.value?.germplasmEntries?.result || []
        const germplasm = [...result]
        germplasm.sort((a, b) => (a?.name || "").localeCompare(b?.name || "") || (a?.id - b?.id))
        return germplasm
    })

    const loadChildGermplasm = (germplasmId) => {
        const cachedGermplasm = client.cache.readFragment({
            id: `GermplasmEntry:${germplasmId}`,
            fragment: ENTRY_FRAGMENT
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

    return {
        germplasm,
        germplasmLoading,
        germplasmError,

        loadGermplasm,
        loadChildGermplasm,
        loadGermplasmByIds

    }
}