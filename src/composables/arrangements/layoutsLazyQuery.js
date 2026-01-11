import { useItemsLazyQuery } from "@/composables/queryBase/itemsLazyBase";

import LAYOUTS_QUERY from "@/graphql/arrangements/layouts.graphql";
import LAYOUT_FRAGMENT from "@/graphql/arrangements/layoutFragment.graphql";


export function useLayoutsLazyQuery() {

    const {
        items: layouts,
        loadItems: loadLayouts,
        itemsLoading: layoutsLoading,
        itemsError: layoutsError,
        loadChildren: loadChildLayouts
    } = useItemsLazyQuery({
        itemsQueryGraphql: LAYOUTS_QUERY,
        itemQueryFragment: LAYOUT_FRAGMENT,
        queryName: 'arrangementsLayouts',
        variableName: 'layoutIds',
        typeName: 'Layout'
    })

    return {
        layouts,
        loadLayouts,
        layoutsLoading,
        layoutsError,
        loadChildLayouts
    }
}