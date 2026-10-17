
import { useLayoutRootsQuery } from "@/composables/layouts/layoutRootsQuery";
import { useLayoutTypesQuery } from "@/composables/layouts/layoutTypesQuery";

export function useLayoutsBoxQueries(locationId) {

    const {
        arrangements,
        arrangementsLoading,
        arrangementsError,
        refetchArrangements
    } = useLayoutRootsQuery(locationId)

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