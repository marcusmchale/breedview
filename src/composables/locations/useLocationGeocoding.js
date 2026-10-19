import { ref } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'

import SEARCH_PLACES_QUERY from '@/graphql/locations/searchPlaces.graphql'
import GEOCODE_COUNTRY_QUERY from '@/graphql/locations/geocodeCountry.graphql'

/**
 * Finding places by name for the location map. The API asks OpenStreetMap's Nominatim, so the browser contacts no
 * third party (breedgraph docs/front-end-changes.md §19). Both queries need an account, and are limited per user.
 */
export function useLocationGeocoding() {
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
   * Geocode a country name
   * Returns { latitude, longitude, bounds } (bounds [[south, west], [north, east]] when known), or null if not found
   */
  const geocodeCountry = async (countryName) => {
    if (!countryName) return null
    const place = await run(GEOCODE_COUNTRY_QUERY, { name: countryName }, 'locationsGeocodeCountry')
    return place ? { latitude: place.latitude, longitude: place.longitude, bounds: place.bounds ?? null } : null
  }

  /**
   * Search for places by free text
   * viewbox: [west, south, east, north] to prefer (or, when bounded, only return) results in that area
   * countryCode: ISO alpha-2 code to only return results in that country
   * Returns a list of { name, latitude, longitude, bounds } where bounds is [[south, west], [north, east]]
   */
  const searchPlaces = async (query, { viewbox = null, bounded = false, countryCode = null, limit = 5 } = {}) => {
    if (!query?.trim()) return []
    const places = await run(
      SEARCH_PLACES_QUERY,
      { query: query.trim(), viewbox, bounded, countryCode, limit },
      'locationsSearchPlaces'
    )
    return places ?? []
  }

  return {
    loading,
    error,
    geocodeCountry,
    searchPlaces
  }
}
