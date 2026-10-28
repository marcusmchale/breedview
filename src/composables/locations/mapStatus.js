// Where a country's detailed maps stand (breedgraph locationsMapStatus, README.md, Maps), said under the location map:
// fetched in the background once the country is added, or for a country too large to fetch whole, by its sections as
// locations in them are placed. Apart from the map, so that it can be tested without a browser.

const UNDER_WAY = ['PENDING', 'FETCHING']

/** Sizes as the server gives them in its messages, e.g. 2.5 GB */
export const gigabytes = (bytes) => `${(bytes / 10 ** 9).toFixed(1)} GB`

/** Whether the country's maps, or a section's, are still being fetched, so that their status is asked for again */
export const mapsUnderWay = (status) => Boolean(status) && (
  UNDER_WAY.includes(status.state) || (status.sections ?? []).some((section) => UNDER_WAY.includes(section.state))
)

function regionLines(name, { state, size, error }) {
  const sized = size ? `${name} (${gigabytes(size)})` : name
  switch (state) {
    case 'PENDING':
      return [`Detailed maps of ${name} are being prepared, and appear on the map once fetched, which can take a while.`]
    case 'FETCHING':
      return [`Detailed maps of ${sized} are being fetched, and appear on the map when they are ready.`]
    case 'FAILED':
      return [`Detailed maps of ${name} could not be fetched: ${error}.`]
    default:
      return []
  }
}

/**
 * What to say of the country's detailed maps, named name: nothing when they are shown or never asked for, or where
 * the site fetches none
 */
export function mapStatusLines(status, name) {
  if (!status?.enabled) return []
  if (status.state !== 'DIVIDED') return regionLines(name, status)
  const sections = status.sections ?? []
  const ready = sections.filter((section) => section.state === 'READY').length
  return [
    `${name}'s detailed maps would take ${gigabytes(status.size)}, more than this site's limit of ` +
      `${gigabytes(status.limit)} for one country, so each of its regions, such as a state or province, is fetched ` +
      'when a location in it is placed on the map.' +
      (ready ? ` They are shown for ${ready === 1 ? 'one region' : `${ready} regions`} so far.` : ''),
    ...sections.flatMap((section) => regionLines(section.name, section))
  ]
}
