// Which ontology entries go together when entries are deprecated or their deprecation is cancelled (breedgraph README,
// Ontology; domain/services/ontology_lifecycles.py). Every kind of relationship but links to parents and terms defines
// its source, e.g. a variable is defined by its scale: an entry can't be deprecated while a current entry is defined
// by it, unless they are deprecated together, and a deprecation can't be cancelled for an entry while one it is
// defined by stays deprecated. Worked out from an ontology's entries and relationships (the editorial view); the API
// checks again, and its refusal says what is missing.

const NOT_DEFINING = new Set(['PARENT_OF', 'HAS_TERM'])

export const definesSource = (label) => !NOT_DEFINING.has(label)
export const isCurrent = (phase) => phase === 'DRAFT' || phase === 'ACTIVE'

// The entries reached from the given ones through defining relationships that pass `through`, followed to their
// sources (the entries defined by them) or targets (those defining them), keeping those that pass `include`, and on
// from each of those in turn
function reachable(ids, relationships, { towards, through, include }) {
  const reached = new Set(ids.map(String))
  const found = []
  let frontier = new Set(reached)
  while (frontier.size) {
    const next = new Set()
    for (const r of relationships) {
      if (!definesSource(r.label) || !through(r)) continue
      const [from, to] = towards === 'sources'
        ? [String(r.targetId), String(r.sourceId)]
        : [String(r.sourceId), String(r.targetId)]
      if (frontier.has(from) && !reached.has(to) && include(to)) {
        reached.add(to)
        found.push(to)
        next.add(to)
      }
    }
    frontier = next
  }
  return found
}

const phases = (entries) => new Map(entries.map((entry) => [String(entry.id), entry.phase]))

// The current entries defined by these, and those defined by them in turn: deprecated with them, or not at all
export function deprecatedWith(ids, { entries = [], relationships = [] }) {
  const phaseOf = phases(entries)
  return reachable(ids, relationships, {
    towards: 'sources',
    through: (r) => isCurrent(r.phase),
    include: (id) => isCurrent(phaseOf.get(id))
  })
}

// The current entries that define these directly, which may be deprecated with them
export function definingEntries(ids, { entries = [], relationships = [] }) {
  const phaseOf = phases(entries)
  const given = new Set(ids.map(String))
  const found = new Set()
  for (const r of relationships) {
    const target = String(r.targetId)
    if (definesSource(r.label) && isCurrent(r.phase) && given.has(String(r.sourceId)) && !given.has(target) &&
      isCurrent(phaseOf.get(target))) {
      found.add(target)
    }
  }
  return [...found]
}

// The deprecated entries these are defined by, and those defining them in turn: cancelled with them, or not at all
export function cancelledWith(ids, { entries = [], relationships = [] }) {
  const phaseOf = phases(entries)
  return reachable(ids, relationships, {
    towards: 'targets',
    through: (r) => r.phase === 'DEPRECATED',
    include: (id) => phaseOf.get(id) === 'DEPRECATED'
  })
}

// The fields of an entry (OntologyEntryFields) holding the entries that define it
const DEFINITION_FIELDS = {
  Variable: ['trait', 'observationMethod', 'scale'],
  Factor: ['condition', 'controlMethod', 'scale'],
  Scale: ['categories'],
  Trait: ['subjects'],
  Condition: ['subjects'],
  Event: ['variables', 'factors']
}

// The ids of the entries that define an entry, as it reads
export const definitionIds = (entry) => (DEFINITION_FIELDS[entry?.__typename] ?? [])
  .flatMap((field) => [entry[field]].flat())
  .filter(Boolean)
  .map((defining) => String(defining.id))

// The entries offered for a link (the published ones) with the one a record has, should it be no longer among them,
// e.g. retired: an update keeps it as it is
export const withCurrent = (entries, current) =>
  current && !entries.some((entry) => String(entry.id) === String(current.id)) ? [...entries, current] : entries

// An entry's name among choices, marked when it is retired
export const optionLabel = (entry) => entry.phase === 'REMOVED' ? `${entry.name} (retired)` : entry.name

// "Variable: Tree height", for lists of entries of several types
export const entryLabel = (entry) => {
  const type = (entry?.__typename ?? 'Entry').replace(/([a-z])([A-Z])/g, '$1 $2')
  return `${type}: ${entry?.name ?? entry?.id}`
}
