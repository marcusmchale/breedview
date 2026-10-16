import { reactive } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'

import ENTRIES_NAVIGATION_QUERY from '@/graphql/germplasm/entriesNavigation.graphql'
import UNITS_QUERY from '@/graphql/blocks/units.graphql'
import LOCATIONS_QUERY from '@/graphql/regions/locations.graphql'
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
  study: new Set(),
  dataset: new Set()
}

export function registerNames(kind, entries) {
  for (const entry of entries ?? []) {
    if (entry?.id != null && entry.name != null) store[kind][entry.id] = entry.name
  }
}

/** Datasets as {id, studyId, conceptId, conceptName, scaleType, categories}, from the dataset query. */
export const datasetConcepts = reactive({})

const registerDatasets = (datasets) => {
  for (const d of datasets ?? []) {
    const scale = d.concept?.scale
    datasetConcepts[d.id] = {
      id: d.id,
      studyId: d.studyId,
      conceptId: d.concept?.id,
      conceptName: d.concept?.name,
      scaleType: scale?.scaleType ?? null,
      categories: scale?.categories ?? []
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
      registerNames('unit', data?.blocksUnits?.result)
    })

  const ensureLocations = (ids) =>
    fetchMissing('location', ids, async (client, missing) => {
      const { data } = await client.query({ query: LOCATIONS_QUERY, variables: { locationIds: missing } })
      registerNames('location', data?.regionsLocations?.result)
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
  return TERM_TYPE_LABELS[ref.type] ?? ref.type
}

export function positionLabel(position) {
  if (!position) return ''
  const parts = [position.location?.name ?? locationName(position.location?.id)]
  if (position.layout) parts.push(position.layout.name ?? `Layout ${position.layout.id}`)
  const coords = position.coordinates?.filter((c) => c != null && c !== '') ?? []
  if (coords.length > 0) {
    const axes = position.layout?.axes ?? []
    parts.push(coords.map((c, i) => (axes[i] ? `${axes[i]} ${c}` : c)).join(', '))
  }
  return parts.join(' · ')
}

export function recordGroupAssignmentLabel(a) {
  if (!a) return ''
  if (a.shared) return a.level
  const scope = (a.scopeDatasetIds ?? []).map(datasetName).join(', ')
  // unitId is set for WITHIN_UNIT groupings, whose codes (e.g. replicates) only mean something within a unit
  const unit = a.unitId != null ? ` of ${unitName(a.unitId)}` : ''
  return `${groupingName(a.groupingId)}: ${a.code}${unit}${scope ? ` (${scope})` : ''}`
}

// Level keys are composite only when no structured group is available; split for display
function keyLabel(type, level) {
  const parts = String(level).split('|')
  if (type === 'POSITION' && parts.length >= 3) {
    const [locationId, layoutId, ...coords] = parts
    return [locationName(locationId), layoutId ? `Layout ${layoutId}` : null, coords.join('|') || null]
      .filter(Boolean)
      .join(' · ')
  }
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
    case 'POSITION':
      return group?.position ? positionLabel(group.position) : keyLabel('POSITION', level)
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
  if (group.position) parts.push(positionLabel(group.position))
  if (group.studyId != null) parts.push(studyName(group.studyId))
  for (const r of group.recordGroups ?? []) parts.push(`${r.dimension}: ${recordGroupAssignmentLabel(r)}`)
  return parts.join(' · ')
}

/** IDs referenced by groups and levels, for name resolution. */
export function collectIds({ groups = [], levels = [] }) {
  const ids = { germplasm: new Set(), unit: new Set(), study: new Set(), location: new Set() }
  for (const g of groups) {
    if (!g) continue
    if (g.germplasmId != null) ids.germplasm.add(g.germplasmId)
    if (g.unitId != null) ids.unit.add(g.unitId)
    if (g.studyId != null) ids.study.add(g.studyId)
    for (const r of g.recordGroups ?? []) if (r.unitId != null) ids.unit.add(r.unitId)
  }
  for (const l of levels) {
    if (l.term.type === 'GERMPLASM') ids.germplasm.add(l.level)
    if (l.term.type === 'UNIT') ids.unit.add(l.level)
    if (l.term.type === 'STUDY') ids.study.add(l.level)
    if (l.term.type === 'POSITION') ids.location.add(String(l.level).split('|')[0])
  }
  return Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, [...v]]))
}
