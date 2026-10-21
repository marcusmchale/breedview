import { useApolloClient } from '@vue/apollo-composable'

import UNITS_WITH_ANCESTORS_QUERY from '@/graphql/units/unitsWithAncestors.graphql'
import { placeAt, today } from '@/composables/units/unitPositions'

/** An arrival's start in the page's address: as entered, or "undated" for the units there without one */
export const arrivalParam = (start) => start ?? 'undated'
export const arrivalStart = (param) => (param === 'undated' ? null : param)

/** The lists of units by location go stale when units are added, moved or changed: drop them, to be read again */
export const evictUnitsByLocation = (cache) => {
  for (const fieldName of ['unitsRoots', 'unitsArrivals', 'unitsArrivalUnits']) {
    cache.evict({ id: 'ROOT_QUERY', fieldName })
  }
  cache.gc()
}

/**
 * A path down to a unit from one of tops, as ids: up its parents, nearest first, until one of tops is reached; null if
 * none is. parentsOf(id) gives a unit's parent ids.
 */
export const pathFrom = (tops, unitId, parentsOf) => {
  const topIds = new Set(tops.map(String))
  const queue = [[String(unitId)]]
  const seen = new Set(queue[0])
  while (queue.length) {
    const path = queue.shift()
    if (topIds.has(path[0])) return path
    for (const parentId of parentsOf(path[0]).map(String)) {
      if (!seen.has(parentId)) {
        seen.add(parentId)
        queue.push([parentId, ...path])
      }
    }
  }
  return null
}

/** Where a unit is now: its own position now, else that of the nearest unit above it with one (a unit with ancestors) */
export const placeNow = (unit) => placeAt([unit, ...(unit?.ancestors ?? [])], today())

/** A unit with the units above it, closest first, each with its parents and positions (through the cache) */
export function useUnitWithAncestors() {
  const { resolveClient } = useApolloClient()
  const client = resolveClient()

  const loadUnitWithAncestors = async (unitId) => {
    const { data } = await client.query({ query: UNITS_WITH_ANCESTORS_QUERY, variables: { unitIds: [unitId] } })
    return data?.unitsUnits?.result?.[0] ?? null
  }

  /** A unit's parent ids by id, for pathFrom: the unit's and its ancestors' */
  const parentsOf = (unit) => {
    const parents = new Map([[String(unit.id), (unit.parents ?? []).map((p) => p.id)]])
    for (const ancestor of unit.ancestors ?? []) parents.set(String(ancestor.id), (ancestor.parents ?? []).map((p) => p.id))
    return (id) => parents.get(String(id)) ?? []
  }

  return { loadUnitWithAncestors, parentsOf }
}
