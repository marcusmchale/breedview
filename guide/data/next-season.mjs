// The next-season chain (chapters describing, places, plant-material and planting, in that order, on one load of the
// demonstration database): what the manifest plans for the 2027 trial in Hill Field (chains.next_season), as each
// chapter finds it. Each storyboard's check refuses a stack that is not at its point in the chain.
const VARIABLES = 'query { ontologyEntries(view: EDITORIAL, labels: [VARIABLE]) { result { id name } } }'
const LOCATIONS = 'query ($name: String!) { locationsSearch(name: $name) { result { id name } } }'
const LAYOUTS = 'query ($location: ID!) { layoutsRoots(locationId: $location) { result { id name children { id name } } } }'
const GERMPLASM = 'query { germplasmEntries { result { id name } } }'
const UNITS = 'query ($locations: [ID!]) { unitsRoots(locationIds: $locations) { result { id name children { id name } } } }'

/**
 * The next season as far as it exists, each null until made: { variable, field, layout, cross, area }; layout and area
 * with their children (Hill Field's blocks, and the trial area's plots)
 */
export async function nextSeason ({ page, session, manifest }) {
  const plan = manifest.chains.next_season
  const query = async (text, variables) => (await session.graphql(page, text, variables)).result ?? []
  const variable = (await query(VARIABLES)).find((v) => v.name === plan.ontology.variable) ?? null
  const field = (await query(LOCATIONS, { name: plan.field.name })).find((l) => l.name === plan.field.name) ?? null
  const layout = field ? (await query(LAYOUTS, { location: field.id })).find((l) => l.name === plan.layout) ?? null : null
  const cross = (await query(GERMPLASM)).find((g) => g.name === plan.cross.name) ?? null
  const area = field ? (await query(UNITS, { locations: [field.id] })).find((u) => u.name === plan.area) ?? null : null
  return { variable, field, layout, cross, area }
}

// Hill Field's 2027 plots: the 2026 trial's six entries in each of three blocks of two rows of three, in an order
// rotated from block to block, sown in October 2026, as the 2026 trial was a year before
export const SOWN = '2026-10-15'
const BLOCKS = 3
const COLUMNS = 3

/** The plots as the planting chapter makes and places them: [{ name, block, row, column, germplasm }], by manifest key */
export function hillFieldPlots (manifest) {
  // by name, so that the first plot, the one the chapter sets on camera, is of a variety near the top of the germplasm
  const entries = [...new Set(manifest.chains.this_season.plots.map((plot) => plot.germplasm))]
    .sort((a, b) => manifest.entities[a].name.localeCompare(manifest.entities[b].name))
  return Array.from({ length: BLOCKS }, (_, b) => entries.map((_, i) => ({
    name: `${manifest.chains.next_season.field.code}27-${b * entries.length + i + 1}`,
    block: b + 1,
    row: Math.floor(i / COLUMNS) + 1,
    column: (i % COLUMNS) + 1,
    germplasm: entries[(i + 2 * b) % entries.length]
  }))).flat()
}
