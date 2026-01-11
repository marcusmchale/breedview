import { ref } from 'vue'

import { useRegionsQuery } from './regionsQuery'
import { useLocationTypesQuery } from './locationTypesQuery'
import { useCountriesQuery } from "@/composables/regions/countriesQuery";
import { useLocationsLazyQuery } from "@/composables/regions/locationsLazyQuery";

export function useLocationTreeQueries(enableCountries = ref(false)) {

    const {
        locationTypes,
        locationTypesLoading,
        locationTypesError
    } = useLocationTypesQuery()

  // Fetch regions
    const {
        regions,
        regionsLoading,
        regionsError,
        refetchRegions
    } = useRegionsQuery()

    const {
        countries,
        countriesLoading,
        countriesError
    } = useCountriesQuery(enableCountries)

    const {
        loadChildLocations
    } = useLocationsLazyQuery()

  return {
    //location types
    locationTypes,
    locationTypesLoading,
    locationTypesError,

    //countries for new region creation
    countries,
    countriesLoading,
    countriesError,

    // Regions data
    regions,
    regionsLoading,
    regionsError,
    refetchRegions,

    // Children loading
    loadChildLocations
  }
}