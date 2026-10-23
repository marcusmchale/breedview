import { reactive } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'

import ENTRIES_NAVIGATION_QUERY from '@/graphql/germplasm/entriesNavigation.graphql'
import UNITS_QUERY from '@/graphql/units/units.graphql'
import LOCATIONS_QUERY from '@/graphql/locations/locations.graphql'
import LAYOUTS_QUERY from '@/graphql/layouts/layouts.graphql'
import STUDY_QUERY from '@/graphql/programs/study.graphql'
import ANALYSIS_DATASETS_QUERY from '@/graphql/analysis/analysisDatasets.graphql'
import { TERM_TYPE_LABELS } from '@/composables/analysis/useAnalysisForm'

/**
 * Names of entities referenced by analyses, shared by all analysis components.
 * Analysis results carry IDs only, so names are resolved here and cached.
 */
const store = reactive({
  germplasm: {},
  unit: {},
  location: {},
  layout: {},
  study: {},
  grouping: {},
  concept: {},
  dataset: {}
})

const requested = {
  germplasm: new Set(),
  unit: new Set(),
  location: new Set(),
  layout: new Set(),
  study: new Set(),
  dataset: new Set()
}

export function registerNames(kind, entries) {
  for (const entry of entries ?? []) {
    // A placeholder for a hidden entry is named REDACTED: leave it unnamed, so labels show its id
    if (entry?.id != null && entry.name != null && entry.name !== 'REDACTED') store[kind][entry.id] = entry.name
  }
}

/** Datasets as {id, studyId, conceptId, conceptName, scaleType}, from the dataset query. */
export const datasetConcepts = reactive({})

const registerDatasets = (datasets) => {
  for (const d of datasets ?? []) {
    const scale = d.concept?.scale
    datasetConcepts[d.id] = {
      id: d.id,
      studyId: d.studyId,
      conceptId: d.concept?.id,
      conceptName: d.concept?.name,
      scaleType: scale?.scaleType ?? null
    }
    if (d.concept) store.concept[d.concept.id] = d.concept.name
  }
}

export function useAnalysisNames() {
  const { resolveClient } = useApolloClient()

  const fetchMissing = async (kind, ids, run) => {
    const missing = [...new Set((ids ?? []).filter((id) => id != null))].filter(
      (id) => store[kind][id] == null && !requested[kind].has(id)
    )
    if (missing.length === 0) return
    missing.forEach((id) => requested[kind].add(id))
    try {
      await run(resolveClient(), missing)
    } catch (err) {
      console.error(`Error resolving ${kind} names:`, err)
      missing.forEach((id) => requested[kind].delete(id))
    }
  }

  const ensureGermplasm = (ids) =>
    fetchMissing('germplasm', ids, async (client, missing) => {
      const { data } = await client.query({ query: ENTRIES_NAVIGATION_QUERY, variables: { entryIds: missing } })
      registerNames('germplasm', data?.germplasmEntries?.result)
    })

  const ensureUnits = (ids) =>
    fetchMissing('unit', ids, async (client, missing) => {
      const { data } = await client.query({ query: UNITS_QUERY, variables: { unitIds: missing } })
      registerNames('unit', data?.unitsUnits?.result)
    })

  const ensureLocations = (ids) =>
    fetchMissing('location', ids, async (client, missing) => {
      const { data } = await client.query({ query: LOCATIONS_QUERY, variables: { locationIds: missing } })
      registerNames('location', data?.locationsLocations?.result)
    })

  const ensureLayouts = (ids) =>
    fetchMissing('layout', ids, async (client, missing) => {
      const { data } = await client.query({ query: LAYOUTS_QUERY, variables: { layoutIds: missing } })
      registerNames('layout', data?.layoutsLayouts?.result)
    })

  const ensureStudies = (ids) =>
    fetchMissing('study', ids, async (client, missing) => {
      const results = await Promise.all(
        missing.map((studyId) => client.query({ query: STUDY_QUERY, variables: { studyId } }))
      )
      for (const r of results) {
        const study = r?.data?.programsStudy?.result
        if (!study) continue
        store.study[study.id] = study.name
        registerNames('grouping', study.groupings)
      }
    })

  const ensureDatasets = (ids) =>
    fetchMissing('dataset', ids, async (client, missing) => {
      const { data } = await client.query({ query: ANALYSIS_DATASETS_QUERY, variables: { datasetIds: missing } })
      const datasets = data?.datasets?.result ?? []
      registerDatasets(datasets)
      datasets.forEach((d) => (store.dataset[d.id] = d.concept?.name ?? `Dataset ${d.id}`))
    })

  return {
    names: store,
    ensureGermplasm,
    ensureUnits,
    ensureLocations,
    ensureLayouts,
    ensureStudies,
    ensureDatasets,
    registerDatasets
  }
}

/* ---------- labels ---------- */

const named = (kind, id, fallback) => (id == null ? '' : store[kind][id] ?? `${fallback} ${id}`)

export const germplasmName = (id) => named('germplasm', id, 'Germplasm')
export const unitName = (id) => named('unit', id, 'Unit')
export const studyName = (id) => named('study', id, 'Study')
export const groupingName = (id) => named('grouping', id, 'Grouping')
export const conceptName = (id) => named('concept', id, 'Concept')
export const locationName = (id) => named('location', id, 'Location')
export const layoutName = (id) => named('layout', id, 'Layout')

export function datasetName(id) {
  if (id == null) return ''
  const concept = datasetConcepts[id]?.conceptName ?? store.dataset[id]
  return concept ? `${concept} (#${id})` : `Dataset ${id}`
}

const dimensionName = (ref) =>
  typeof ref?.recordGroupDimension === 'object' ? ref?.recordGroupDimension?.name : ref?.recordGroupDimension

export function termLabel(ref) {
  if (!ref) return ''
  if (ref.type === 'CONCEPT') return conceptName(ref.conceptId)
  if (ref.type === 'RECORD_GROUP') return dimensionName(ref) ?? 'Record group'
  if (ref.type === 'LAYOUT_AXIS') return ref.layoutAxis ?? TERM_TYPE_LABELS.LAYOUT_AXIS
  return TERM_TYPE_LABELS[ref.type] ?? ref.type
}

/** A layout axis value, nested in the layout that has the axis: "Row 3 · North Rows" */
export const layoutAxisLabel = ({ axis, layoutId, value }) => `${axis} ${value} · ${layoutName(layoutId)}`

/** shownUnitId: a unit the label already names, e.g. the observation's own, so it isn't repeated */
export function recordGroupAssignmentLabel(a, shownUnitId = null) {
  if (!a) return ''
  if (a.shared) return a.level
  // A unit level (the nearest unit of one of the dimension's subjects) has a unit and no grouping
  if (a.groupingId == null) return unitName(a.unitId)
  const scope = (a.scopeDatasetIds ?? []).map(datasetName).join(', ')
  // unitId is set for WITHIN_UNIT groupings, whose codes (e.g. replicates) only mean something within a unit, and for
  // WITHIN_GRAPH groupings, where it is the unit graph's root: "Block 1 of ED1"
  const unit = a.unitId != null && String(a.unitId) !== String(shownUnitId) ? ` of ${unitName(a.unitId)}` : ''
  return `${groupingName(a.groupingId)}: ${a.code}${unit}${scope ? ` (${scope})` : ''}`
}

// Level keys are composite only when no structured group is available; split for display
function keyLabel(type, level) {
  const parts = String(level).split('|')
  if (type === 'RECORD_GROUP' && parts.length === 2 && parts[0] === 'unit') return unitName(parts[1])
  if (type === 'RECORD_GROUP' && parts.length === 3) {
    const [groupingId, , code] = parts
    return `${groupingName(groupingId)}: ${code}`
  }
  return level
}

/** Display label of a term level, using the structured group when available. */
export function levelLabel(termLevel, group = null) {
  const { term, level } = termLevel
  switch (term.type) {
    case 'GERMPLASM':
      return germplasmName(level)
    case 'UNIT':
      return unitName(level)
    case 'STUDY':
      return studyName(level)
    case 'LOCATION':
      return locationName(level)
    case 'LAYOUT_AXIS': {
      // the level is layoutId|value
      const [layoutId, ...value] = String(level).split('|')
      return layoutAxisLabel({ axis: term.layoutAxis, layoutId, value: value.join('|') })
    }
    case 'RECORD_GROUP': {
      const assignment = group?.recordGroups?.find((r) => r.dimension === dimensionName(term) && r.level === level)
      return assignment ? recordGroupAssignmentLabel(assignment) : keyLabel('RECORD_GROUP', level)
    }
    default:
      return level
  }
}

export const levelsLabel = (levels, group = null) =>
  (levels ?? []).map((l) => levelLabel(l, group)).join(' × ')

/** Label of an analytical group, from its configured dimensions. */
export function groupLabel(group) {
  if (!group) return ''
  const parts = []
  if (group.unitId != null) parts.push(unitName(group.unitId))
  if (group.germplasmId != null) parts.push(germplasmName(group.germplasmId))
  if (group.time) parts.push(group.time)
  if (group.locationId != null) parts.push(locationName(group.locationId))
  for (const a of group.layoutAxes ?? []) parts.push(layoutAxisLabel(a))
  if (group.studyId != null) parts.push(studyName(group.studyId))
  for (const r of group.recordGroups ?? []) parts.push(`${r.dimension}: ${recordGroupAssignmentLabel(r, group.unitId)}`)
  return parts.join(' · ')
}

/** IDs referenced by groups and levels, for name resolution. */
export function collectIds({ groups = [], levels = [] }) {
  const ids = { germplasm: new Set(), unit: new Set(), study: new Set(), location: new Set(), layout: new Set() }
  for (const g of groups) {
    if (!g) continue
    if (g.germplasmId != null) ids.germplasm.add(g.germplasmId)
    if (g.unitId != null) ids.unit.add(g.unitId)
    if (g.studyId != null) ids.study.add(g.studyId)
    if (g.locationId != null) ids.location.add(g.locationId)
    for (const a of g.layoutAxes ?? []) ids.layout.add(a.layoutId)
    for (const r of g.recordGroups ?? []) if (r.unitId != null) ids.unit.add(r.unitId)
  }
  for (const l of levels) {
    if (l.term.type === 'GERMPLASM') ids.germplasm.add(l.level)
    if (l.term.type === 'UNIT') ids.unit.add(l.level)
    if (l.term.type === 'STUDY') ids.study.add(l.level)
    if (l.term.type === 'LOCATION') ids.location.add(l.level)
    if (l.term.type === 'LAYOUT_AXIS') ids.layout.add(String(l.level).split('|')[0])
    if (l.term.type === 'RECORD_GROUP') {
      const parts = String(l.level).split('|')
      if (parts.length === 2 && parts[0] === 'unit') ids.unit.add(parts[1])
    }
  }
  return Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, [...v]]))
}
