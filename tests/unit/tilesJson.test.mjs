// tiles.json read again while the page is open (src/composables/locations/tilesJson.js), as the server adds countries'
// extents and regions in the background: no more than once in rereadMs, and keeping the last read when one fails
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTilesReader, countryExtent, hasRegion, regionLayers } from '../../src/composables/locations/tilesJson.js'

const WORLD = { url: 'world.pmtiles', maxZoom: 8 }
const IRELAND = { url: 'regions/IRL.pmtiles', name: 'Ireland', minZoom: 9, maxZoom: 15, bounds: [[51.4, -10.6], [55.4, -6]] }
const FRANCE = { name: 'France', bounds: [[41.3, -5.2], [51.1, 9.6]] }

/** A server whose tiles.json is each of answers in turn (an Error fails the request), and the clock it is read by */
function server(...answers) {
  const clock = { now: 0 }
  const requests = []
  const fetch = async (url, options) => {
    requests.push({ url, options })
    const answer = answers.length > 1 ? answers.shift() : answers[0]
    if (answer instanceof Error) throw answer
    return { ok: answer !== null, json: async () => answer }
  }
  return { reader: createTilesReader('/tiles/tiles.json', { fetch, now: () => clock.now, rereadMs: 10000 }), clock, requests }
}

test('tiles.json is read once until refreshed, and revalidated each time', async () => {
  const { reader, requests } = server({ layers: [WORLD] })
  assert.deepEqual(await reader.load(), { layers: [WORLD] })
  await reader.load()
  assert.equal(requests.length, 1)
  assert.deepEqual(requests[0], { url: '/tiles/tiles.json', options: { cache: 'no-cache' } })
})

test('a refresh reads what the server added since, but not twice within rereadMs', async () => {
  const before = { layers: [WORLD], countries: {} }
  const after = { layers: [WORLD, IRELAND], countries: { FRA: FRANCE } }
  const { reader, clock, requests } = server(before, after)
  await reader.load()
  clock.now = 10000
  assert.deepEqual(await reader.refresh(), after)
  clock.now = 15000
  assert.deepEqual(await reader.refresh(), after)
  assert.deepEqual(await reader.load(), after)
  assert.equal(requests.length, 2)
})

test('a refresh that fails keeps the last read', async () => {
  const tiles = { layers: [WORLD, IRELAND] }
  for (const failure of [new TypeError('Failed to fetch'), null]) {
    const { reader, clock } = server(tiles, failure)
    await reader.load()
    clock.now = 20000
    assert.deepEqual(await reader.refresh(), tiles)
  }
  const { reader } = server(null)
  assert.equal(await reader.load(), null, 'nothing to keep from the first')
})

test('a country\'s extent and detailed regions are read from tiles.json', () => {
  const sections = { url: 'regions/USA-ADM1-123ABC.pmtiles', name: 'Texas', minZoom: 9, maxZoom: 15 }
  const tiles = { layers: [WORLD, IRELAND, sections], countries: { FRA: FRANCE } }
  assert.deepEqual(countryExtent(tiles, 'FRA'), FRANCE.bounds)
  assert.equal(countryExtent(tiles, 'IRL'), null)
  assert.equal(countryExtent(null, 'FRA'), null)
  assert.deepEqual(regionLayers(tiles), [IRELAND, sections])
  assert.equal(hasRegion(tiles, 'IRL'), true)
  assert.equal(hasRegion(tiles, 'USA'), true, 'a section of it')
  assert.equal(hasRegion(tiles, 'FRA'), false, 'its extent only')
  assert.equal(hasRegion(tiles, 'IR'), false)
  assert.equal(hasRegion(null, 'IRL'), false)
})
