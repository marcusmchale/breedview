import { useItemsQuery } from "@/composables/queryBase/itemsBase";
import REFERENCES_QUERY from '@/graphql/references/references.graphql'

// References by id, in full; nothing is asked for without ids
export function useReferencesQuery(referenceIds) {

    const {
        items: references,
        itemsLoading: referencesLoading,
        itemsError: referencesError
    } = useItemsQuery({
        itemIds: referenceIds,
        itemsQueryGraphql: REFERENCES_QUERY,
        queryName: 'references',
        variableName: 'referenceIds',
    })

    return {
        references,
        referencesLoading,
        referencesError
    }
}
