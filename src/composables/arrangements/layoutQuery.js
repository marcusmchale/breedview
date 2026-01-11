import { useItemQuery } from "@/composables/queryBase/itemBase";
import LAYOUTS_QUERY from "@/graphql/arrangements/layouts.graphql";

export function useLayoutQuery(layoutId) {
    const {
        item: layout,
        itemLoading: layoutLoading,
        itemError: layoutError,
        refetchItem: refetchLayout
    } = useItemQuery( {
        itemId: layoutId,
        itemsQueryGraphql: LAYOUTS_QUERY,
        queryName: 'arrangementsLayouts',
        variableName: 'layoutIds'
    })

    return {
        layout,
        layoutLoading,
        layoutError,
        refetchLayout
    }
}