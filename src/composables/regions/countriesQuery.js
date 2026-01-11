import { ref, computed } from 'vue'
import { useQuery } from "@vue/apollo-composable";
import COUNTRIES_QUERY from "@/graphql/regions/countries.graphql";

export function useCountriesQuery(enableCountries = ref(false)) {
    const {
        result: countriesResult,
        loading: countriesLoading,
        error: countriesError
    } = useQuery(COUNTRIES_QUERY, {}, {enabled: enableCountries})

    const countries = computed(() => {
        if (!countriesResult.value) {
            return []
        }
        const countries = [...countriesResult.value.regionsCountries.result]  // make shallow copy to sort
        countries.sort((a, b) => a.name.localeCompare(b.name))
        return countries
    })

    return {
        countries,
        countriesLoading,
        countriesError
    }
}