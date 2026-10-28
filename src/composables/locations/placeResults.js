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

/** Whether the place is a country itself, as the server gives one: with no country of its own */
export const isCountry = (place) => Boolean(place.countryCode) && !place.country

/**
 * A new location's starting values from a place found (Add as a location): its name, its point, which the map's
 * drawing tools can make a boundary of, its region and country as its address, and the site's location type named as
 * its kind ("farm"), when there is one. Nothing of GeoNames' own, such as its id, is kept.
 */
export function placeLocationInput(place, locationTypes = []) {
  const kind = place.description?.toLowerCase()
  const type = kind && locationTypes.find((locationType) =>
    [locationType.name, ...(locationType.synonyms ?? [])].some((name) => name?.toLowerCase() === kind))
  return {
    name: place.name,
    typeId: type?.id ?? null,
    address: [place.region, place.country].filter(Boolean).join(', '),
    coordinates: [{ latitude: place.latitude, longitude: place.longitude }]
  }
}

/**
 * Where a location made from the place goes: { parent } under the selected location when it is in the place's country
 * (selectedCountryCode), else under that country, among the location trees' roots; or { register } the place's
 * country first, when it is not one of them. Null for a country already registered, or a place of no known country.
 */
export function placeTarget(place, selected, selectedCountryCode, roots = []) {
  if (!place.countryCode) return null
  const root = roots.find((location) => location.code === place.countryCode)
  if (!root) return { register: place.countryCode }
  if (isCountry(place)) return null
  if (selected && selectedCountryCode === place.countryCode) return { parent: selected }
  return { parent: root }
}
