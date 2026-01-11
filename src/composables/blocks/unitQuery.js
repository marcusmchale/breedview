import { useItemQuery } from "@/composables/queryBase/itemBase";
import UNITS_QUERY from "@/graphql/blocks/units.graphql";

export function useUnitQuery(unitId) {
    const {
        item: unit,
        itemLoading: unitLoading,
        itemError: unitError,
        refetchItem: refetchUnit,
    } = useItemQuery( {
        itemId: unitId,
        itemsQueryGraphql: UNITS_QUERY,
        queryName: 'blocksUnits',
        variableName: 'unitIds'
    })

    return {
        unit,
        unitLoading,
        unitError,
        refetchUnit
    }
}