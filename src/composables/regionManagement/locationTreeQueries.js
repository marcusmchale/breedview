
import { ref, computed } from 'vue'
import {
  useApolloClient,
  useQuery,
  useLazyQuery
} from '@vue/apollo-composable'

import REGIONS_QUERY from '@/graphql/regions/regions.graphql'
import LOCATIONS_QUERY from '@/graphql/regions/locations.graphql'
import LOCATION_FRAGMENT from '@/graphql/regions/locationFragment.graphql'

/**
 * Composable for querying regions and location children
 * Handles all data fetching for the location tree
 * @returns {Object} - Query methods and state
 */
export function useLocationTreeQueries() {
  const { client } = useApolloClient()

  // Fetch regions
  const {
    result: regionsResult,
    loading: regionsLoading,
    onResult: onRegionsResult,
    error: regionsError,
    refetch: refetchRegions
  } = useQuery(REGIONS_QUERY)

  const regions = computed(() => {
    if (!regionsResult.value) {
      return []
    }
    const regions = regionsResult.value.regions.result
    regions.sort((a, b) => a?.name.localeCompare(b?.name))
    return regions
  })

  // Cache regions as locations when they're loaded
  onRegionsResult((result) => {
    if (result?.data?.regions?.status !== "SUCCESS") return

    if (result?.data?.regions?.result) {
      client.cache.writeQuery({
        query: LOCATIONS_QUERY,
        variables: { locationIds: result.data.regions.result.map(location => location.id) },
        data: {
          regionsLocations: {
            __typename: "LocationsPayload",
            status: result.data.regions.status,
            result: result.data.regions.result,
            errors: result.data.regions.errors
          }
        }
      })
    }
  })

  // Fetch locations by ID (for loading children)
  const locationsByIdQueryVariables = ref({
    locationIds: []
  })

  const {
    load: loadLocationsByIds
  } = useLazyQuery(
    LOCATIONS_QUERY,
    locationsByIdQueryVariables
  )

  /**
   * Load children for a given location ID
   * Reads the location from cache and fetches its children
   */
  const loadChildren = (locationId) => {
    const cachedLocation = client.cache.readFragment({
      id: `Location:${locationId}`,
      fragment: LOCATION_FRAGMENT
    })

    if (cachedLocation?.children && cachedLocation.children.length > 0) {
      locationsByIdQueryVariables.value = {
        locationIds: cachedLocation.children.map(child => child.id)
      }
      loadLocationsByIds()
    }
  }

  /**
   * Get cached children for a location without triggering a query
   */
  const getCachedChildren = (locationId) => {
    const cachedLocation = client.cache.readFragment({
      id: `Location:${locationId}`,
      fragment: LOCATION_FRAGMENT
    })

    if (cachedLocation?.children) {
      const cachedChildren = cachedLocation.children.map(child =>
        client.cache.readFragment({
          id: `Location:${child.id}`,
          fragment: LOCATION_FRAGMENT
        })
      )
      return cachedChildren.filter(Boolean)
    }

    return []
  }

  return {
    // Regions data
    regions,
    regionsLoading,
    regionsError,
    refetchRegions,

    // Children loading
    loadChildren,
    getCachedChildren
  }
}