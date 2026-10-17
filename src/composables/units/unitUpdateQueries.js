import { useUnitQuery } from "@/composables/units/unitQuery"
import { useUnitsQuery } from "@/composables/units/unitsQuery"
import { useUnitsLazyQuery } from "@/composables/units/unitsLazyQuery"
import { useUnitRootsQuery } from "@/composables/units/unitRootsQuery";

export function useUnitUpdateQueries({locationId, blockId, parentIds}) {
    const {
        blocks,
        blocksLoading,
        blocksError
    } = useUnitRootsQuery({locationIds:[locationId]})

    const {
        unit: blockUnit,
        unitLoading: blockLoading,
        unitError: blockError
    } = useUnitQuery(blockId)

    const {
        units: parents,
        unitsLoading: parentsLoading,
        unitsError: parentsError
    } = useUnitsQuery({unitIds:  parentIds})

    const {
        units: currentChildUnits,
        unitsLoading: childUnitsLoading,
        loadChildUnits
    } = useUnitsLazyQuery()

    return {
        blocks,
        blocksLoading,
        blocksError,

        blockUnit,
        blockLoading,
        blockError,

        parents,
        parentsLoading,
        parentsError,

        currentChildUnits,
        childUnitsLoading,
        loadChildUnits
    }
}