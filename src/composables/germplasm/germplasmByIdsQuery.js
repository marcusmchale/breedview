import { useItemsQuery } from "@/composables/queryBase/itemsBase";
import ENTRIES_QUERY from '@/graphql/germplasm/entries.graphql'

export function useGermplasmByIdsQuery(germplasmIds) {

    const {
        items: germplasm,
        itemsLoading: germplasmLoading,
        itemsError: germplasmError,
        refetchItems: refetchGermplasm
    } = useItemsQuery( {
        itemIds: germplasmIds,
        itemsQueryGraphql: ENTRIES_QUERY,
        queryName: 'germplasmEntries',
        variableName: 'entryIds',
    }, { fetchPolicy: 'network-only' })

    return {
        germplasm,
        germplasmLoading,
        germplasmError,
        refetchGermplasm
    }
}
