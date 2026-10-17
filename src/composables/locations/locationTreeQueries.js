import { ref } from 'vue'

import { useLocationRootsQuery } from './locationRootsQuery'
import { useLocationTypesQuery } from './locationTypesQuery'
import { useCountriesQuery } from "@/composables/locations/countriesQuery";
import { useLocationsLazyQuery } from "@/composables/locations/locationsLazyQuery";

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
    } = useLocationRootsQuery()

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