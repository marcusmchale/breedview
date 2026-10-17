import { ref } from 'vue'

/**
 * Composable for geocoding location names to coordinates
 * Uses OpenStreetMap's Nominatim service for country lookups
 */
export function useLocationGeocoding() {
  const loading = ref(false)
  const error = ref(null)

  /**
   * Geocode a country name to coordinates using Nominatim
   * Returns { latitude, longitude } or null if not found
   */
  const geocodeCountry = async (countryName) => {
    if (!countryName) return null

    loading.value = true
    error.value = null

    try {
      // Use Nominatim API (OSM's geocoding service)
      // Note: Be respectful with rate limits (1 request per second)
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('country', countryName)
      url.searchParams.set('format', 'json')
      url.searchParams.set('limit', '1')

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'BreedView Application' // Nominatim requires User-Agent
        }
      })
      if (!response.ok) {
        throw new Error('Geocoding request failed')
      }

      const data = await response.json()
      if (data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        }
      }

      return null
    } catch (err) {
      console.error('Geocoding error:', err)
      error.value = err.message
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Search for places by free-text name using Nominatim
   * viewbox: [west, south, east, north] to prefer results in that area
   * bounded: only return results inside the viewbox
   * countryCode: ISO alpha-2 code to only return results in that country
   * Returns a list of { name, latitude, longitude, bounds } where bounds is [[south, west], [north, east]]
   */
  const searchPlaces = async (query, { viewbox = null, bounded = false, countryCode = null, limit = 5 } = {}) => {
    if (!query?.trim()) return []

    loading.value = true
    error.value = null

    try {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.searchParams.set('q', query.trim())
      url.searchParams.set('format', 'json')
      url.searchParams.set('limit', String(limit))
      if (viewbox) {
        url.searchParams.set('viewbox', viewbox.join(','))
        if (bounded) {
          url.searchParams.set('bounded', '1')
        }
      }
      if (countryCode) {
        url.searchParams.set('countrycodes', countryCode.toLowerCase())
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'BreedView Application'
        }
      })
      if (!response.ok) {
        throw new Error('Place search request failed')
      }

      const data = await response.json()
      return data.map(place => {
        const [south, north, west, east] = (place.boundingbox ?? []).map(parseFloat)
        return {
          name: place.display_name,
          latitude: parseFloat(place.lat),
          longitude: parseFloat(place.lon),
          bounds: [south, north, west, east].every(Number.isFinite)
            ? [[south, west], [north, east]]
            : null
        }
      })
    } catch (err) {
      console.error('Place search error:', err)
      error.value = err.message
      return []
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    geocodeCountry,
    searchPlaces
  }
}