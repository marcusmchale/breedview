// The synthetic test database the e2e tests run against, as described by the manifest breedgraph writes when it
// builds it (scripts/build_test_database.py): the accounts, teams and every entity of the read-policy scenario by
// its scenario name, with its id, name, controlling team, release and who can read it. The scenario's module
// docstring (breedgraph tests/breedgraph/scenarios/read_policy_scenario.py) draws each tree.
// env: E2E_MANIFEST, the manifest's path (default: the breedgraph checkout next to this repository)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const defaultPath = fileURLToPath(new URL('../../../../breedgraph/instance/neo4j_archive/test_databases/test_database.manifest.json', import.meta.url))
export const manifestPath = process.env.E2E_MANIFEST || defaultPath

let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch (error) {
  throw new Error(`the test database manifest could not be read from ${manifestPath}: set E2E_MANIFEST to its path ` +
    `(see tests/e2e/README.md) (${error.message})`)
}
export { manifest }

// admin, writer, stranger, outsider: { username, password, email, user_id, affiliations }
export const accounts = manifest.accounts
// root (an organisation), child (below root), other (a second organisation): { id, name }
export const teams = manifest.teams
// every controlled entity by scenario name: { id, label, name, team, release, readable_by }, and for Persons
// person_views, how each viewer sees it
export const entities = manifest.entities
// record_count and unit_count by dataset name
export const datasets = manifest.datasets
// the data file references' files by reference name: { reference_id, file_id, filename, description }
export const files = manifest.files
// defaults for the perf scripts: { study, concept, field }
export const perf = manifest.perf
// the replicates study (record group extent and replicate aggregation): program, trial, study, groupings, datasets,
// units, concepts and the expected outcomes; breedgraph docs/test-databases.md, "The replicates study"
export const replicates = manifest.replicates
// units that came to locations at dated positions (arrivals), with what comes down to them: locations, units by name,
// datasets and the expected arrivals per viewer, germplasm and factor values; breedgraph docs/test-databases.md,
// "The arrivals". Null for a manifest built before them, or another database's: their tests skip.
export const arrivals = manifest.arrivals ?? null
// units at positions in layouts, for analysis position grouping: locations, layouts, units, datasets and, for each case
// of the scenario, its grouping and terms and the levels each viewer finds; breedgraph docs/test-databases.md,
// "The positions". Null for a manifest built before them: their tests skip.
export const positions = manifest.positions ?? null

// the concept of the scenario's datasets, as the app names it
export const concept = manifest.perf.concept

// The viewers of the scenario: the four accounts and anonymous
export const viewers = ['admin', 'writer', 'stranger', 'outsider', 'anonymous']

export function entity(name) {
  const found = entities[name]
  if (!found) throw new Error(`no entity ${name} in the test database manifest ${manifestPath}`)
  return found
}

export const canRead = (viewer, name) => entity(name).readable_by.includes(viewer)

// How a viewer sees a Person (breedgraph docs/person.md §3): 'FULL', 'ATTRIBUTION' or 'RESTRICTED'
export function personView(viewer, name) {
  const views = entity(name).person_views
  if (!views) {
    throw new Error(`the test database manifest ${manifestPath} has no person views: it was built before them, ` +
      'so build it again (breedgraph docs/test-databases.md)')
  }
  return views[viewer]
}
