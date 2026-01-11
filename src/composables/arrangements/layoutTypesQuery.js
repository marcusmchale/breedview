import { useOntologyEntriesQuery } from "@/composables/ontology/ontologyEntriesQuery"

export function useLayoutTypesQuery(){

    const {
        entries: layoutTypes,
        entriesLoading: layoutTypesLoading,
        entriesError: layoutTypesError,
    } = useOntologyEntriesQuery({labels: ['LAYOUT_TYPE']})

    return {
        layoutTypes,
        layoutTypesLoading,
        layoutTypesError
    }
}