import { periodStart, periodEnd } from '@/composables/parsers/partialDatetime'
import { nearestOnEachLineage } from '@/composables/units/lineages'

/*
 * Which records of a factor describe a variable row, as an analysis attaches them (breedgraph docs/analysis.md §2):
 * those of the row's unit, else of the nearest units with any on each lineage up its parents, which must agree.
 * The table has no time bins or record group dimensions, so a record is left out only where the row says otherwise:
 * - a dated record describes a timed row when their periods overlap (an analysis instead takes the one time bin the
 *   record falls in); an undated record, or an untimed row, any time;
 * - a record with a code of a grouping describes a row with the same code (compared within the grouping's dataset
 *   scope, and unit for WITHIN_UNIT groupings), or with none; a record without a code, every level.
 */

/** A time span as [start, end) numbers, each time standing for its period and in for a missing other; null untimed */
export const timeSpan = (start, end) => {
  const from = periodStart(start || end)
  const to = periodEnd(end || start)
  return from == null || to == null ? null : [from, to]
}

const overlaps = (a, b) => !a || !b || (a[0] < b[1] && b[0] < a[1])

/**
 * The key within which a grouping's code is comparable (breedgraph RecordGroupingStored.scope_key and record group
 * level keys): the dataset scope of DATASET_SCOPED groupings, and the unit of WITHIN_UNIT ones.
 * column: { scope, extent, datasetScopes: [[datasetId]] }
 */
export const codeKey = (column, code, datasetId, unitId) => {
  const scope = column.scope === 'DATASET_SCOPED'
    ? (column.datasetScopes?.find((ids) => ids.includes(String(datasetId))) ?? [String(datasetId)]).join(',')
    : ''
  return [scope, column.extent === 'WITHIN_UNIT' ? String(unitId) : '', code].join('|')
}

const describes = (record, row) =>
  overlaps(record.span, row.span)
  && Object.entries(record.codeKeys).every(([groupingId, key]) => !row.codeKeys[groupingId] || row.codeKeys[groupingId].has(key))

/**
 * The records of one factor describing a row: those of its unit, else of the nearest units with any on each path up
 * its parents. Where those of separate lineages differ, none describes it: { conflict: [unitId] }.
 * row: { span, codeKeys: { [groupingId]: Set<key> } } (groupings the row has a code for)
 * recordsByUnit: { [unitId]: [{ span, codeKeys: { [groupingId]: key }, value, ... }] }
 * parentsOf(unitId): the unit's parent ids, as the page's units were read
 * Returns { unitId, records }, { conflict }, or null.
 */
export const describingRecords = (row, recordsByUnit, unitId, parentsOf) => {
  const describing = (id) => (recordsByUnit[id] ?? []).filter((record) => describes(record, row))
  const own = describing(String(unitId))
  if (own.length > 0) return { unitId: String(unitId), records: own }
  const sources = nearestOnEachLineage(unitId, parentsOf, (id) => describing(id).length > 0)
  if (sources.length === 0) return null
  const values = (id) => [...new Set(describing(id).map((record) => String(record.value)))].sort().join('\u0000')
  if (new Set(sources.map(values)).size > 1) {
    return { conflict: sources.map((id) => ({ unitId: id, records: describing(id) })) }
  }
  return { unitId: sources[0], records: describing(sources[0]) }
}
