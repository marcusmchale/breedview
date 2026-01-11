import { useItemQuery } from "@/composables/queryBase/itemBase";
import ENTRIES_QUERY from '@/graphql/germplasm/entries.graphql'

export function useGermplasmQuery(germplasmId) {

    const {
        item: germplasm,
        itemLoading: germplasmLoading,
        itemError: germplasmError
    } = useItemQuery( {
        itemId: germplasmId,
        itemsQueryGraphql: ENTRIES_QUERY,
        queryName: 'germplasmEntries',
        variableName: 'entryIds'
    })

    return {
        germplasm,
        germplasmLoading,
        germplasmError
    }
}
