import { useItemsQuery } from "@/composables/queryBase/itemsBase";

import UNITS_QUERY from "@/graphql/blocks/units.graphql";

export function useUnitsQuery({unitIds}) {

    const {
        items: units,
        itemsLoading: unitsLoading,
        itemsError: unitsError
    } = useItemsQuery({
        itemIds: unitIds,
        itemsQueryGraphql: UNITS_QUERY,
        queryName: 'blocksUnits',
        variableName: 'unitIds'
    })

    return {
        units,
        unitsLoading,
        unitsError
    }
}