import { useOntologyEntriesQuery } from "@/composables/ontology/ontologyEntriesQuery";

export function useFactorsQuery() {
  const {
      entries: factors,
      entriesLoading: factorsLoading,
      entriesError: factorsError
  } = useOntologyEntriesQuery({labels:'FACTOR'});

  return {
      factors,
      factorsLoading,
      factorsError
  }
}