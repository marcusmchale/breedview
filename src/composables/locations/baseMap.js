import L from 'leaflet'
import { leafletLayer, paintRules, labelRules } from 'protomaps-leaflet'
import { namedFlavor } from '@protomaps/basemaps'
import { PMTiles, SharedPromiseCache } from 'pmtiles'
import { createTilesReader, countryExtent, regionLayers } from './tilesJson'

// The base map, from tiles served by the API (breedgraph README.md, Maps), so the
// browser contacts no third party: tiles.json lists a low-detail world file and then the regions fetched in full
// detail, whole countries or sections of large ones, all PMTiles read in byte ranges. The regions are drawn by one
// layer over the world layer, without a background, so the world shows through outside them; the world draws no
// labels past its own detail, so labels are not drawn twice inside them.
const TILES_URL = `${import.meta.env.VITE_API_HOST}/tiles/`
const FLAVOR = 'light'

// read at the first map, and again as regions are added in the background (addBaseMap's refresh)
const tiles = createTilesReader(`${TILES_URL}tiles.json`)

/**
 * The extent to show a country by, [[south, west], [north, east]] around its main parts, from the outline the server
 * fetched its maps with (tiles.json countries); null when it has none, e.g. where no detailed maps are fetched. East
 * can be above 180 for a country across the antimeridian. A country added since tiles.json was read has its extent
 * written soon after, so tiles.json is read again for one it lacks.
 */
export async function countryBounds(code) {
  return countryExtent(await tiles.load(), code) ?? countryExtent(await tiles.refresh(), code)
}

/** [[south, west], [north, east]] of a web map tile */
function tileBounds(z, x, y) {
  const n = 2 ** z
  const longitude = (column) => (column / n) * 360 - 180
  const latitude = (row) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / n))) * 180) / Math.PI
  return [[latitude(y + 1), longitude(x)], [latitude(y), longitude(x + 1)]]
}

function overlaps(bounds, [[south, west], [north, east]]) {
  if (!bounds) return true
  const [[boundsSouth, boundsWest], [boundsNorth, boundsEast]] = bounds
  return south <= boundsNorth && north >= boundsSouth && west <= boundsEast && east >= boundsWest
}

/**
 * The regions as one archive. protomaps-leaflet only calls getZxy on it, so a layer with this as its url asks each
 * tile of the regions whose zooms and bounds hold it, in turn, and draws the first found. Neighbouring regions share
 * the tiles along their border, which are then painted and labelled once rather than once per region.
 */
class RegionArchives {
  constructor(regions) {
    const cache = new SharedPromiseCache()
    this.regions = regions.map((region) => ({
      ...region,
      archive: new PMTiles(new URL(region.url, TILES_URL).href, cache)
    }))
  }

  async getZxy(z, x, y, signal) {
    const bounds = tileBounds(z, x, y)
    for (const region of this.regions) {
      if (z < (region.minZoom ?? 0) || z > region.maxZoom || !overlaps(region.bounds, bounds)) continue
      const tile = await region.archive.getZxy(z, x, y, signal)
      if (tile) return tile
    }
    return undefined
  }
}

/** The layer drawing the detailed regions, past the world's zooms */
function regionsLayer(world, regions, flavor) {
  const bounds = regions.every((region) => region.bounds)
    ? regions.reduce((all, region) => all.extend(region.bounds), L.latLngBounds(regions[0].bounds))
    : undefined
  return leafletLayer({
    url: new RegionArchives(regions),
    maxDataZoom: Math.max(...regions.map((region) => region.maxZoom)),
    minZoom: world.maxZoom + 1,
    maxZoom: 19,
    bounds,
    paintRules: paintRules(flavor),
    labelRules: labelRules(flavor, 'en'),
    attribution: ''
  })
}

/**
 * Adds the base map layers to a Leaflet map. Resolves to a function that reads tiles.json again (at most every three
 * seconds) and redraws the detailed regions if they changed, resolving to what it read; or to null when no tiles are
 * served.
 */
export async function addBaseMap(map) {
  const served = await tiles.load()
  if (!served?.layers?.length) {
    console.warn('No map tiles are served (breedgraph scripts/map_tiles.py)')
    return null
  }
  const flavor = namedFlavor(FLAVOR)
  const [world] = served.layers
  leafletLayer({
    url: new URL(world.url, TILES_URL).href,
    maxDataZoom: world.maxZoom,
    paintRules: paintRules(flavor),
    labelRules: labelRules(flavor, 'en').map((rule) => ({ ...rule, maxzoom: Math.min(rule.maxzoom ?? world.maxZoom, world.maxZoom) })),
    backgroundColor: flavor.background,
    attribution: served.attribution,
    maxZoom: 19
  }).addTo(map)

  let layer = null
  let drawn = null // the regions drawn, as JSON
  const draw = (read) => {
    const regions = regionLayers(read)
    const json = JSON.stringify(regions)
    if (json === drawn) return
    drawn = json
    if (layer) map.removeLayer(layer)
    layer = regions.length ? regionsLayer(world, regions, flavor).addTo(map) : null
  }
  draw(served)
  return async () => {
    const read = await tiles.refresh()
    if (read?.layers?.length) draw(read)
    return read
  }
}
