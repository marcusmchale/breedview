import { computed } from "vue";
import { useQuery } from "@vue/apollo-composable";

import ENTRIES_QUERY from '@/graphql/germplasm/entries.graphql'


export function useAllGermplasmQuery() {

    const {
        result: germplasmResult,
        loading: germplasmLoading,
        error: germplasmError,
        refetch: refetchGermplasm
    } = useQuery(ENTRIES_QUERY)

    const germplasm = computed(() => {
        const result = germplasmResult.value?.germplasmEntries.result || []
        const items = [...result]
        items.sort((a, b) => (a?.name || "").localeCompare(b?.name || "") || (a?.id - b?.id))
        return items
    })

    return {
        germplasm,
        germplasmResult,
        germplasmLoading,
        germplasmError,
        refetchGermplasm
    }
}