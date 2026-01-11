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

  return {
    loading,
    error,
    geocodeCountry
  }
}