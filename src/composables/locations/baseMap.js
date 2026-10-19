import L from 'leaflet'
import { leafletLayer, paintRules, labelRules } from 'protomaps-leaflet'
import { namedFlavor } from '@protomaps/basemaps'
import { PMTiles, SharedPromiseCache } from 'pmtiles'

// The base map, from tiles served by the API (breedgraph README.md, Maps; docs/front-end-changes.md §19), so the
// browser contacts no third party: tiles.json lists a low-detail world file and then the regions fetched in full
// detail, whole countries or sections of large ones, all PMTiles read in byte ranges. The regions are drawn by one
// layer over the world layer, without a background, so the world shows through outside them; the world draws no
// labels past its own detail, so labels are not drawn twice inside them.
const TILES_URL = `${import.meta.env.VITE_API_HOST}/tiles/`
const FLAVOR = 'light'

let tilesJson = null  // loaded once

async function loadTiles() {
  // checked at each page load, as regions are added in the background
  tilesJson ??= fetch(`${TILES_URL}tiles.json`, { cache: 'no-cache' })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
  return tilesJson
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

/** Adds the base map layers to a Leaflet map; resolves to false when no tiles are served */
export async function addBaseMap(map) {
  const tiles = await loadTiles()
  if (!tiles?.layers?.length) {
    console.warn('No map tiles are served (breedgraph scripts/map_tiles.py)')
    return false
  }
  const flavor = namedFlavor(FLAVOR)
  const [world, ...regions] = tiles.layers
  leafletLayer({
    url: new URL(world.url, TILES_URL).href,
    maxDataZoom: world.maxZoom,
    paintRules: paintRules(flavor),
    labelRules: labelRules(flavor, 'en').map((rule) => ({ ...rule, maxzoom: Math.min(rule.maxzoom ?? world.maxZoom, world.maxZoom) })),
    backgroundColor: flavor.background,
    attribution: tiles.attribution,
    maxZoom: 19
  }).addTo(map)
  if (regions.length) {
    const bounds = regions.every((region) => region.bounds)
      ? regions.reduce((all, region) => all.extend(region.bounds), L.latLngBounds(regions[0].bounds))
      : undefined
    leafletLayer({
      url: new RegionArchives(regions),
      maxDataZoom: Math.max(...regions.map((region) => region.maxZoom)),
      minZoom: world.maxZoom + 1,
      maxZoom: 19,
      bounds,
      paintRules: paintRules(flavor),
      labelRules: labelRules(flavor, 'en'),
      attribution: ''
    }).addTo(map)
  }
  return true
}
