import { useUnitQuery } from "@/composables/blocks/unitQuery"
import { useUnitsQuery } from "@/composables/blocks/unitsQuery"
import { useUnitsLazyQuery } from "@/composables/blocks/unitsLazyQuery"
import { useBlocksQuery } from "@/composables/blocks/blocksQuery";

export function useUnitUpdateQueries({locationId, blockId, parentIds}) {
    const {
        blocks,
        blocksLoading,
        blocksError
    } = useBlocksQuery(locationId)

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