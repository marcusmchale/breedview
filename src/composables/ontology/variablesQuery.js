import { useOntologyEntriesQuery } from "@/composables/ontology/ontologyEntriesQuery";

export function useVariablesQuery() {
  const {
      entries: variables,
      entriesLoading: variablesLoading,
      entriesError: variablesError
  } = useOntologyEntriesQuery({labels:'VARIABLE'});

  return {
      variables,
      variablesLoading,
      variablesError
  }
}