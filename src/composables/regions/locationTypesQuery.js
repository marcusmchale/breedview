import { useOntologyEntriesQuery } from "@/composables/ontology/ontologyEntriesQuery"

export function useLocationTypesQuery(){

    const {
        entries: locationTypes,
        entriesLoading: locationTypesLoading,
        entriesError: locationTypesError,
    } = useOntologyEntriesQuery({labels: ['LOCATION_TYPE']})

    return {
        locationTypes,
        locationTypesLoading,
        locationTypesError
    }
}