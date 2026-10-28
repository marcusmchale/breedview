// Places found by the location map's place search (breedgraph locationsSearchPlaces, docs/maps.md): GeoNames' places,
// answered by the API from its own copy, so the search leaves the server for no one else. How the map lists and shows
// them, apart from the map, so that it can be tested without a browser.

/** The credit GeoNames' licence asks for, shown with the places found */
export const PLACES_CREDIT = 'Places from GeoNames, CC BY 4.0'
export const PLACES_CREDIT_URL = 'https://www.geonames.org'

/** What kind of place it is and where, after its name: "village · Kerry, Munster, Ireland" */
export function placeDetail(place) {
  const where = [place.region, place.country].filter(Boolean).join(', ')
  return [place.description, where].filter(Boolean).join(' · ')
}

/** How the map shows the place: a country by its bounds, anything else at its point and the zoom for its kind */
export function placeView(place, zoom = 14) {
  if (place.bounds) return { bounds: place.bounds }
  return { center: [place.latitude, place.longitude], zoom: place.zoom ?? zoom }
}

/**
 * What to add when a search of a country finds nothing while its own places are not there (locationsMapStatus'
 * places): only its towns were searched, or nothing, until they are
 */
export function scopeHint(places, countryName) {
  if (!places?.enabled || !['PENDING', 'FAILED'].includes(places.state)) return null
  const searched = places.towns ? 'only its towns of 1,000 people or more are searched' : 'none of its places are searched'
  return places.state === 'PENDING'
    ? `${countryName}'s places are still being fetched, and until they are, ${searched}.`
    : `${countryName}'s places could not be fetched, so ${searched}.`
}
