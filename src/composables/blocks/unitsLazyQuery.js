import { useItemsLazyQuery } from "@/composables/queryBase/itemsLazyBase";

import UNITS_QUERY from "@/graphql/blocks/units.graphql";
import UNIT_FRAGMENT from "@/graphql/blocks/unitFragment.graphql";


export function useUnitsLazyQuery() {

    const {
        items: units,
        loadItems: loadUnits,
        itemsLoading: unitsLoading,
        itemsError: unitsError,
        loadChildren: loadChildUnits
    } = useItemsLazyQuery({
        itemsQueryGraphql: UNITS_QUERY,
        itemQueryFragment: UNIT_FRAGMENT,
        queryName: 'blocksUnits',
        variableName: 'unitIds',
        typeName: 'Unit'
    })

    return {
        units,
        loadUnits,
        unitsLoading,
        unitsError,
        loadChildUnits
    }
}