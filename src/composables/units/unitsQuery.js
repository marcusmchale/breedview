import { useItemsQuery } from "@/composables/queryBase/itemsBase";

import UNITS_QUERY from "@/graphql/units/units.graphql";

export function useUnitsQuery({unitIds}) {

    const {
        items: units,
        itemsLoading: unitsLoading,
        itemsError: unitsError
    } = useItemsQuery({
        itemIds: unitIds,
        itemsQueryGraphql: UNITS_QUERY,
        queryName: 'unitsUnits',
        variableName: 'unitIds'
    })

    return {
        units,
        unitsLoading,
        unitsError
    }
}