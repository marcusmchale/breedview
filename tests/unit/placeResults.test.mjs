// How the location map lists and shows the places its search finds (src/composables/locations/placeResults.js), from
// what the server answers (breedgraph locationsSearchPlaces)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { placeDetail, placeView, scopeHint } from '../../src/composables/locations/placeResults.js'

const ballyduff = {
  name: 'Ballyduff', latitude: 52.45593, longitude: -9.66399, bounds: null, description: 'village',
  region: 'Kerry, Munster', country: 'Ireland', zoom: 14
}
const ireland = {
  name: 'Ireland', latitude: 53.4, longitude: -8.25, bounds: [[51.4, -10.5], [55.4, -6]], description: 'country',
  region: null, country: null, zoom: null
}

test('a place is listed with its kind, its region and its country, as far as they are known', () => {
  assert.equal(placeDetail(ballyduff), 'village · Kerry, Munster, Ireland')
  assert.equal(placeDetail({ ...ballyduff, region: null }), 'village · Ireland')
  assert.equal(placeDetail({ ...ballyduff, description: null }), 'Kerry, Munster, Ireland')
  assert.equal(placeDetail(ireland), 'country')
  assert.equal(placeDetail({ name: 'Somewhere' }), '')
})

test('a country is shown by its bounds, anything else at its point and the zoom for its kind', () => {
  assert.deepEqual(placeView(ireland), { bounds: [[51.4, -10.5], [55.4, -6]] })
  assert.deepEqual(placeView(ballyduff), { center: [52.45593, -9.66399], zoom: 14 })
  assert.deepEqual(placeView({ ...ballyduff, zoom: 16 }), { center: [52.45593, -9.66399], zoom: 16 })
  assert.deepEqual(placeView({ ...ballyduff, zoom: null }, 12), { center: [52.45593, -9.66399], zoom: 12 })
})

test("a search of a country whose own places aren't there says what was searched", () => {
  const places = (state, extra = {}) => ({ state, enabled: true, towns: true, error: null, ...extra })
  assert.equal(scopeHint(places('READY'), 'Iran'), null)
  assert.equal(scopeHint(places('NONE'), 'Iran'), null)
  assert.equal(scopeHint(places('PENDING', { enabled: false }), 'Iran'), null)
  assert.equal(scopeHint(null, 'Iran'), null)
  assert.equal(scopeHint(places('PENDING'), 'Iran'),
    "Iran's places are still being fetched, and until they are, only its towns of 1,000 people or more are searched.")
  assert.equal(scopeHint(places('FAILED', { towns: false }), 'Iran'),
    "Iran's places could not be fetched, so none of its places are searched.")
})
