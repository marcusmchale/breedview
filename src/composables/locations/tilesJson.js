// tiles.json, the base map's list of files (baseMap.js), read again while the page is open: the server adds a country's
// extent and then its detailed regions in the background after the country is added (breedgraph README.md, Maps).
// Apart from the map, so that it can be tested without a browser.

/**
 * Reads tiles.json at url once, and again when refreshed, at most once in rereadMs; a read that fails keeps the last.
 * Each resolves to the tiles.json read, or null when none could be.
 */
export function createTilesReader(url, { fetch = globalThis.fetch, now = Date.now, rereadMs = 3000 } = {}) {
  let tiles = null // the last read, a promise
  let readAt = -Infinity

  const read = () => {
    const previous = tiles
    readAt = now()
    tiles = fetch(url, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then(async (read) => read ?? (await previous))
    return tiles
  }

  return {
    load: () => tiles ?? read(),
    refresh: () => (tiles && now() - readAt < rereadMs ? tiles : read())
  }
}

/** The extent tiles.json gives a country, [[south, west], [north, east]], or null */
export const countryExtent = (tiles, code) => tiles?.countries?.[code]?.bounds ?? null

/** The detailed regions tiles.json lists, after the world: whole countries (regions/IRL.pmtiles) or their sections */
export const regionLayers = (tiles) => (tiles?.layers ?? []).slice(1)

/** Whether tiles.json lists a detailed region of the country, the whole of it or a section (regions/USA-ADM1-...) */
export const hasRegion = (tiles, code) => regionLayers(tiles)
  .some(({ url }) => url === `regions/${code}.pmtiles` || url?.startsWith(`regions/${code}-`))
