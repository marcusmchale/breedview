import { ref } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

import { useLocationRootsQuery } from './locationRootsQuery'
import { useLocationTypesQuery } from './locationTypesQuery'
import { useCountriesQuery } from "@/composables/locations/countriesQuery";

import LOCATIONS_QUERY from '@/graphql/locations/locations.graphql'

const LOCATION_CHILD_IDS = gql`
  fragment LocationTreeChildIds on Location {
    children { id }
  }
`

export function useLocationTreeQueries(enableCountries = ref(false)) {

    const { resolveClient } = useApolloClient()
    const client = resolveClient()

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

    // A location's children in one request, to be awaited before they are shown (none once they are in the cache)
    const loadChildLocations = async (locationId) => {
        const location = client.cache.readFragment({
            id: client.cache.identify({ __typename: 'Location', id: locationId }),
            fragment: LOCATION_CHILD_IDS
        })
        const childIds = (location?.children ?? []).map((child) => child.id)
        if (childIds.length) {
            await client.query({ query: LOCATIONS_QUERY, variables: { locationIds: childIds } })
        }
    }

    // The id of a location's parent, null for a root, read through the cache
    const loadParentId = async (locationId) => {
        const { data } = await client.query({ query: LOCATIONS_QUERY, variables: { locationIds: [locationId] } })
        return data?.locationsLocations?.result?.[0]?.parent?.id ?? null
    }

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

    // Children loading and the way up
    loadChildLocations,
    loadParentId
  }
}
