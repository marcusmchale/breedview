
import { useArrangementsQuery } from "@/composables/arrangements/arrangementsQuery";
import { useLayoutTypesQuery } from "@/composables/arrangements/layoutTypesQuery";

export function useArrangementsBoxQueries(locationId) {

    const {
        arrangements,
        arrangementsLoading,
        arrangementsError,
        refetchArrangements
    } = useArrangementsQuery(locationId)

    const {
        layoutTypes
    } = useLayoutTypesQuery()

    return {
        arrangements,
        arrangementsLoading,
        arrangementsError,
        refetchArrangements,

        layoutTypes
    }
}