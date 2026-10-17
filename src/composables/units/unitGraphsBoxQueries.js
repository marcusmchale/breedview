import { useUnitRootsQuery } from "@/composables/units/unitRootsQuery";
import { useOntologyEntriesQuery } from "@/composables/ontology/ontologyEntriesQuery";

export function useUnitGraphsBoxQueries({locationIds}) {

    const {
        blocks,
        blocksLoading,
        blocksError,
        refetchBlocks
    } = useUnitRootsQuery({locationIds: locationIds})

    const {
        entries: subjects
    } = useOntologyEntriesQuery({labels: ['SUBJECT']})

    return {
        blocks,
        blocksLoading,
        blocksError,
        refetchBlocks,

        subjects
    }
}