import { ref } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'

import SEARCH_PLACES_QUERY from '@/graphql/locations/searchPlaces.graphql'
import COUNTRY_PLACE_QUERY from '@/graphql/locations/countryPlace.graphql'

/**
 * Finding places by name for the location map: GeoNames' places, which the API answers from its own copy, so neither
 * the browser nor the server sends a search to anyone else (breedgraph docs/maps.md, Place search). Open to everyone.
 */
export function usePlaceSearch() {
  const { resolveClient } = useApolloClient()
  const client = resolveClient()
  const loading = ref(false)
  const error = ref(null)

  const run = async (query, variables, field) => {
    loading.value = true
    error.value = null
    try {
      const { data } = await client.query({ query, variables, fetchPolicy: 'cache-first' })
      const payload = data?.[field]
      if (payload?.status !== 'SUCCESS') {
        throw new Error(payload?.errors?.map((e) => e.message).join(', ') || 'Place search failed')
      }
      return payload.result
    } catch (err) {
      error.value = err.message
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * The country with this ISO 3166 alpha-3 code: { latitude, longitude, bounds } with bounds [[south, west], [north,
   * east]] around its main parts, or null until the server has the world's places
   */
  const countryPlace = async (code) => {
    if (!code) return null
    const place = await run(COUNTRY_PLACE_QUERY, { code }, 'locationsCountryPlace')
    return place ? { latitude: place.latitude, longitude: place.longitude, bounds: place.bounds ?? null } : null
  }

  /**
   * Search for places by free text
   * viewbox: [west, south, east, north] to prefer (or, when bounded, only return) results in that area
   * country: an ISO 3166 alpha-3 code, as locations' countries have, to only return results in that country
   * Returns a list of { name, latitude, longitude, bounds, description, region, country, zoom } (placeResults.js)
   */
  const searchPlaces = async (query, { viewbox = null, bounded = false, country = null, limit = 5 } = {}) => {
    if (!query?.trim()) return []
    const places = await run(
      SEARCH_PLACES_QUERY,
      { query: query.trim(), viewbox, bounded, country, limit },
      'locationsSearchPlaces'
    )
    return places ?? []
  }

  return {
    loading,
    error,
    countryPlace,
    searchPlaces
  }
}
