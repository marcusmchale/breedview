import { useUnitQuery } from "@/composables/units/unitQuery";
import { useUnitsLazyQuery} from "@/composables/units/unitsLazyQuery";


export function useUnitNodeQueries({unitId}) {

    const {
        unit,
        unitLoading,
        unitError,
        refetchUnit
    } = useUnitQuery(unitId)

    const {
        units: childUnits,
        loadChildUnits,
        unitsLoading: childUnitsLoading,
        unitsError: childUnitsError
    } = useUnitsLazyQuery()

    return {
        unit,
        unitLoading,
        unitError,
        refetchUnit,

        childUnits,
        loadChildUnits,
        childUnitsLoading,
        childUnitsError
    }
}