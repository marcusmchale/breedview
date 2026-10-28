// What the location map says of a country's detailed maps (src/composables/locations/mapStatus.js), from where the
// server says they stand (breedgraph locationsMapStatus), and whether to ask again
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gigabytes, mapsUnderWay, mapStatusLines } from '../../src/composables/locations/mapStatus.js'

const status = (state, extra = {}) => ({ code: 'FRA', state, size: null, limit: 2e9, enabled: true, error: null, sections: [], ...extra })

test('sizes are given in gigabytes, as the server gives them', () => {
  assert.equal(gigabytes(5.5e9), '5.5 GB')
  assert.equal(gigabytes(4.54e8), '0.5 GB')
})

test('a country whose maps are shown, never asked for, or on a site fetching none, is not spoken of', () => {
  assert.deepEqual(mapStatusLines(status('READY'), 'France'), [])
  assert.deepEqual(mapStatusLines(status('NONE'), 'France'), [])
  assert.deepEqual(mapStatusLines(status('PENDING', { enabled: false }), 'France'), [])
  assert.deepEqual(mapStatusLines(null, 'France'), [])
})

test('maps under way, and those that failed, are said to be', () => {
  assert.deepEqual(mapStatusLines(status('PENDING'), 'Ireland'), [
    'Detailed maps of Ireland are being prepared, and appear on the map once fetched, which can take a while.'
  ])
  assert.deepEqual(mapStatusLines(status('FETCHING', { size: 4.54e8 }), 'Ireland'), [
    'Detailed maps of Ireland (0.5 GB) are being fetched, and appear on the map when they are ready.'
  ])
  assert.deepEqual(mapStatusLines(status('FAILED', { error: "this site's storage for detailed maps is full" }), 'Ireland'), [
    "Detailed maps of Ireland could not be fetched: this site's storage for detailed maps is full."
  ])
})

test('a country too large to fetch whole is said to be, with its size and the limit, and its regions', () => {
  const divided = status('DIVIDED', { size: 5.5e9 })
  const why = "France's detailed maps would take 5.5 GB, more than this site's limit of 2.0 GB for one country, so " +
    'each of its regions, such as a state or province, is fetched when a location in it is placed on the map.'
  assert.deepEqual(mapStatusLines(divided, 'France'), [why])
  const sections = [
    { name: 'Bretagne', state: 'READY', size: 6e8, error: null },
    { name: 'Corse', state: 'READY', size: 1e8, error: null },
    { name: 'Île-de-France', state: 'FETCHING', size: 9e8, error: null },
    { name: 'Occitanie', state: 'FAILED', size: null, error: 'they would take 2.5 GB, more than ...' }
  ]
  assert.deepEqual(mapStatusLines({ ...divided, sections }, 'France'), [
    `${why} They are shown for 2 regions so far.`,
    'Detailed maps of Île-de-France (0.9 GB) are being fetched, and appear on the map when they are ready.',
    'Detailed maps of Occitanie could not be fetched: they would take 2.5 GB, more than ....'
  ])
  assert.match(mapStatusLines({ ...divided, sections: sections.slice(0, 1) }, 'France')[0], /shown for one region so far\.$/)
})

test('the status is asked for again while the country\'s maps, or a region\'s, are under way', () => {
  assert.equal(mapsUnderWay(status('PENDING')), true)
  assert.equal(mapsUnderWay(status('FETCHING')), true)
  assert.equal(mapsUnderWay(status('READY')), false)
  assert.equal(mapsUnderWay(status('FAILED')), false)
  assert.equal(mapsUnderWay(status('DIVIDED', { sections: [{ name: 'Corse', state: 'PENDING' }] })), true)
  assert.equal(mapsUnderWay(status('DIVIDED', { sections: [{ name: 'Corse', state: 'READY' }] })), false)
  assert.equal(mapsUnderWay(null), false)
})

test("a country's places for the place search are spoken of while they are fetched, or when they failed", () => {
  const places = (state, extra = {}) => status('READY', { places: { state, enabled: true, towns: true, error: null, ...extra } })
  assert.deepEqual(mapStatusLines(places('READY'), 'Iran'), [])
  assert.deepEqual(mapStatusLines(places('NONE'), 'Iran'), [])
  assert.deepEqual(mapStatusLines(places('PENDING', { enabled: false }), 'Iran'), [])
  assert.deepEqual(mapStatusLines(places('PENDING'), 'Iran'), [
    'The place search finds every place in Iran once its places are fetched, and until then only its towns of 1,000 people or more.'
  ])
  assert.deepEqual(mapStatusLines(places('PENDING', { towns: false }), 'Iran'), [
    'The place search finds every place in Iran once its places are fetched.'
  ])
  assert.deepEqual(mapStatusLines(places('FAILED', { error: "an error occurred, and the details are in the server's log" }), 'Iran'), [
    "Iran's places for the place search could not be fetched: an error occurred, and the details are in the server's log."
  ])
  assert.deepEqual(mapStatusLines(status('PENDING', { places: { state: 'PENDING', enabled: true, towns: true } }), 'Iran').length, 2,
    'after its maps')
  assert.equal(mapsUnderWay(places('PENDING')), true, 'asked for again until they are there')
  assert.equal(mapsUnderWay(places('READY')), false)
  assert.deepEqual(mapStatusLines(status('READY', { enabled: false, places: { state: 'PENDING', enabled: true, towns: true } }), 'Iran').length, 1,
    'where the site fetches places but no maps')
})
