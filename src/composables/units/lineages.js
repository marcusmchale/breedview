/*
 * What comes down a unit graph (breedgraph README, Unit graph): factor records and germplasm apply to the units below
 * the one they are on. Walking up every path of a unit's parents, each path stops at the first unit with what is sought,
 * so a unit nearer the root doesn't count past a nearer one on the same lineage; the units found on separate lineages
 * must agree, else none applies (a sample pooled from trees of two treatments takes neither).
 */

import { gql } from '@apollo/client/core'

import UNITS_INHERITED_QUERY from '@/graphql/units/unitsInherited.graphql'

const byNumericId = (a, b) => (Number(a) - Number(b)) || String(a).localeCompare(String(b))

/**
 * The units nearest above unitId for which has(id) holds, the first on each path up its parents, by distance and then
 * id (unitId itself is not among them). parentsOf(id) gives a unit's parent ids.
 */
export const nearestOnEachLineage = (unitId, parentsOf, has) => {
  const found = []
  const seen = new Set([String(unitId)])
  let frontier = [String(unitId)]
  while (frontier.length) {
    const next = []
    const level = []
    for (const id of frontier) {
      for (const parent of parentsOf(id).map(String)) {
        if (seen.has(parent)) continue
        seen.add(parent)
        if (has(parent)) level.push(parent)
        else next.push(parent)
      }
    }
    found.push(...level.sort(byNumericId))
    frontier = next
  }
  return found
}

const UNIT_CHILD_IDS = gql`
  fragment UnitLineageChildIds on Unit {
    children { id }
  }
`

/** These units and the units below them that the cache holds, as ids */
const withCachedDescendants = (cache, unitIds) => {
  const seen = new Set()
  const stack = [...unitIds].filter((id) => id !== null && id !== undefined).map(String)
  while (stack.length) {
    const id = stack.pop()
    if (seen.has(id)) continue
    seen.add(id)
    const children = cache.readFragment({ id: cache.identify({ __typename: 'Unit', id }), fragment: UNIT_CHILD_IDS })?.children ?? []
    stack.push(...children.map((child) => String(child.id)))
  }
  return [...seen]
}

/**
 * What a unit inherits changes with the germplasm of a unit above it, or with what is above it: read it again for these
 * units and the units below them that the cache holds. It is read in place rather than evicted, so the trees showing
 * these units keep what they have open meanwhile.
 */
export const refreshInheritedGermplasm = (client, unitIds) => {
  const ids = withCachedDescendants(client.cache, unitIds)
  if (ids.length === 0) return Promise.resolve()
  return client.query({ query: UNITS_INHERITED_QUERY, variables: { unitIds: ids }, fetchPolicy: 'network-only' })
    .catch((error) => console.warn('Could not read again what these units inherit', error))
}
