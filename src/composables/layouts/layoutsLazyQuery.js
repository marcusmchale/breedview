import { useItemsLazyQuery } from "@/composables/queryBase/itemsLazyBase";

import LAYOUTS_QUERY from "@/graphql/layouts/layouts.graphql";
import LAYOUT_FRAGMENT from "@/graphql/layouts/layoutFragment.graphql";


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
        queryName: 'layoutsLayouts',
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