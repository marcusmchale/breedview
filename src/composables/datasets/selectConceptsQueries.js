import { useVariablesQuery } from "@/composables/ontology/variablesQuery";
import { useFactorsQuery } from "@/composables/ontology/factorsQuery"

export function useSelectConceptsQuery() {
    const {
        variables,
        variablesLoading,
        variablesError
    } = useVariablesQuery();

    const {
        factors,
        factorsLoading,
        factorsError
    } = useFactorsQuery();

    return {
        variables,
        variablesLoading,
        variablesError,

        factors,
        factorsLoading,
        factorsError
    }
}