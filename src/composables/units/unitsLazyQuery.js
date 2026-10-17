import { useItemsLazyQuery } from "@/composables/queryBase/itemsLazyBase";

import UNITS_QUERY from "@/graphql/units/units.graphql";
import UNIT_FRAGMENT from "@/graphql/units/unitFragment.graphql";


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
        queryName: 'unitsUnits',
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