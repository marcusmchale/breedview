import { useBlocksQuery } from "@/composables/blocks/blocksQuery"
import { useUnitsQuery } from "@/composables/blocks/unitsQuery"
import { useUnitsLazyQuery } from "@/composables/blocks/unitsLazyQuery";

export function useSelectUnitsQuery({locationIds, unitIds}) {
    const {
        blocks,
        blocksLoading,
        blocksError
    } = useBlocksQuery({locationIds: locationIds});

    const {
        units: selectedUnits,
        unitsLoading: selectedUnitsLoading,
        unitsError: selectedUnitsError
    } = useUnitsQuery({unitIds: unitIds})

    const {
        units: displayedUnits,
        loadUnits: loadDisplayedUnits,
        loadChildUnits: loadDisplayedChildUnits,
        unitsLoading: displayedUnitsLoading
    } = useUnitsLazyQuery()

    return {
        blocks,
        blocksLoading,
        blocksError,

        selectedUnits,
        selectedUnitsLoading,
        selectedUnitsError,

        displayedUnits,
        displayedUnitsLoading,
        loadDisplayedUnits,
        loadDisplayedChildUnits
    }
}