import { useOntologyEntriesQuery } from "@/composables/ontology/ontologyEntriesQuery"

export function useDesignTypesQuery() {
    const {
        entries: designTypes,
        entriesLoading: designTypesLoading,
        entriesError: designTypesError,
    } = useOntologyEntriesQuery({ labels: ['DESIGN'] })

    return {
        designTypes,
        designTypesLoading,
        designTypesError
    }
}