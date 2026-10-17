import { useUnitRootsQuery } from "@/composables/units/unitRootsQuery"
import { useUnitsQuery } from "@/composables/units/unitsQuery"
import { useUnitsLazyQuery } from "@/composables/units/unitsLazyQuery";

export function useSelectUnitsQuery({locationIds, unitIds}) {
    const {
        blocks,
        blocksLoading,
        blocksError
    } = useUnitRootsQuery({locationIds: locationIds});

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