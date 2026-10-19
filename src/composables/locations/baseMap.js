import L from 'leaflet'
import { leafletLayer, paintRules, labelRules } from 'protomaps-leaflet'
import { namedFlavor } from '@protomaps/basemaps'

// The base map, from tiles served by the API (breedgraph scripts/map_tiles.py, docs/front-end-changes.md §19), so the
// browser contacts no third party: tiles.json lists a low-detail world file and, where there are locations, a
// full-detail regions file, both PMTiles read in byte ranges. The regions layer is drawn over the world layer without
// a background, so the world shows through outside the regions; the world draws no labels past its own detail, so
// labels are not drawn twice inside them.
const TILES_URL = `${import.meta.env.VITE_API_HOST}/tiles/`
const FLAVOR = 'light'

let tilesJson = null  // loaded once

async function loadTiles() {
  tilesJson ??= fetch(`${TILES_URL}tiles.json`)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
  return tilesJson
}

/** Adds the base map layers to a Leaflet map; resolves to false when no tiles are served */
export async function addBaseMap(map) {
  const tiles = await loadTiles()
  if (!tiles?.layers?.length) {
    console.warn('No map tiles are served (breedgraph scripts/map_tiles.py)')
    return false
  }
  const flavor = namedFlavor(FLAVOR)
  const [world, ...details] = tiles.layers
  leafletLayer({
    url: new URL(world.url, TILES_URL).href,
    maxDataZoom: world.maxZoom,
    paintRules: paintRules(flavor),
    labelRules: labelRules(flavor, 'en').map((rule) => ({ ...rule, maxzoom: Math.min(rule.maxzoom ?? world.maxZoom, world.maxZoom) })),
    backgroundColor: flavor.background,
    attribution: tiles.attribution,
    maxZoom: 19
  }).addTo(map)
  for (const detail of details) {
    leafletLayer({
      url: new URL(detail.url, TILES_URL).href,
      maxDataZoom: detail.maxZoom,
      minZoom: detail.minZoom,
      maxZoom: 19,
      bounds: detail.bounds ? L.latLngBounds(detail.bounds) : undefined,
      paintRules: paintRules(flavor),
      labelRules: labelRules(flavor, 'en'),
      attribution: ''
    }).addTo(map)
  }
  return true
}
