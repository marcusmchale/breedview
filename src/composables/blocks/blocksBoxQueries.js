import { useBlocksQuery } from "@/composables/blocks/blocksQuery";
import { useOntologyEntriesQuery } from "@/composables/ontology/ontologyEntriesQuery";

export function useBlocksBoxQueries({locationIds}) {

    const {
        blocks,
        blocksLoading,
        blocksError,
        refetchBlocks
    } = useBlocksQuery({locationIds: locationIds})

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