/**
 * Form state for an analysis and its conversion to and from the API.
 *
 * The form mirrors AnalysisInput closely so that list indexes in server
 * error paths (e.g. ["anova", "terms", "2", "binning"]) map directly onto
 * the form. Builders therefore never filter list entries out, they only
 * omit unset optional fields.
 */

export const ANALYSIS_TYPES = [
  {
    value: 'DESCRIPTIVE_STATISTICS',
    key: 'descriptiveStatistics',
    label: 'Descriptive statistics',
    description: 'Summary statistics per level of categorical terms, with optional estimated means.'
  },
  {
    value: 'ANOVA',
    key: 'anova',
    label: 'ANOVA',
    description: 'Linear or mixed model of a continuous response on fixed and random terms.'
  },
  {
    value: 'CORRELATION',
    key: 'correlation',
    label: 'Correlation',
    description: 'Pairwise correlation matrix between continuous or ordinal concepts.'
  },
  {
    value: 'MDS',
    key: 'mds',
    label: 'MDS',
    description: 'Multidimensional scaling of observations, with optional clustering.'
  },
  {
    value: 'OUTLIER_DETECTION',
    key: 'outlierDetection',
    label: 'Outlier detection',
    description: 'Flag observations that may be outliers, ready to exclude from later analyses.'
  }
]

export const analysisTypeInfo = (type) => ANALYSIS_TYPES.find((t) => t.value === type)
export const analysisTypeLabel = (type) => analysisTypeInfo(type)?.label ?? type
const typeKey = (type) => analysisTypeInfo(type)?.key

// Option fields as they appear in the type-specific input, and where they live in the form
const OPTION_FIELDS = {
  ANOVA: { alpha: 'alpha', sumOfSquares: 'sumOfSquares', ddf: 'ddf' },
  MDS: { distance: 'distance', dimensions: 'dimensions', clustering: 'clustering' },
  CORRELATION: { method: 'correlationMethod' },
  DESCRIPTIVE_STATISTICS: {},
  OUTLIER_DETECTION: { method: 'outlierMethod' }
}

export const DOMAIN_TERM_TYPES = ['TIME', 'GERMPLASM', 'UNIT', 'LOCATION', 'LAYOUT_AXIS', 'RECORD_GROUP', 'STUDY']

export const TERM_TYPE_LABELS = {
  CONCEPT: 'Concept',
  TIME: 'Time',
  GERMPLASM: 'Germplasm',
  UNIT: 'Unit',
  LOCATION: 'Location',
  LAYOUT_AXIS: 'Layout axis',
  RECORD_GROUP: 'Record group',
  STUDY: 'Study'
}

/* ---------- factories ---------- */

export const createEmptyBinning = () => ({ boundaries: [], labels: [''], boundary: 'LEFT' })

export const createEmptyExclusion = () => ({
  recordIds: [],
  unitIds: [],
  germplasmIds: [],
  studyIds: [],
  positions: [],
  recordGroups: [],
  start: null,
  end: null
})

export const createTerm = (reference) => ({
  reference: {
    type: reference.type,
    conceptId: reference.conceptId ?? null,
    recordGroupDimension: reference.recordGroupDimension ?? null,
    layoutAxis: reference.layoutAxis ?? null
  },
  representation: null,
  binning: null,
  levelOrder: null,
  transformations: [],
  aggregation: null,
  replicateAggregation: null,
  effect: null,
  randomSlopeTerms: []
})

export const createEmptyGrouping = () => ({
  time: null,
  germplasm: null,
  unit: null,
  position: null,
  recordGroups: []
})

export const createEmptyForm = () => ({
  name: '',
  analysisType: 'DESCRIPTIVE_STATISTICS',
  studyIds: [],
  datasetIds: [],
  exclusions: [],
  grouping: createEmptyGrouping(),
  terms: [],
  response: null,
  interactions: [],
  estimatedMeans: [],
  options: {
    alpha: 0.05,
    sumOfSquares: 'TYPE_III',
    ddf: 'SATTERTHWAITE',
    correlationMethod: 'PEARSON',
    distance: 'EUCLIDEAN',
    dimensions: 2,
    clustering: null,
    outlierMethod: 'Z_SCORE'
  }
})

export const createEstimatedMeans = () => ({
  terms: [],
  by: [],
  contrast: 'PAIRWISE',
  control: null,
  adjustment: 'TUKEY'
})

/* ---------- term references ---------- */

const dimensionName = (ref) =>
  typeof ref?.recordGroupDimension === 'object' ? ref?.recordGroupDimension?.name : ref?.recordGroupDimension

/** Key identifying a term reference; works for both input and output references. */
export const termKey = (ref) => {
  if (!ref) return ''
  if (ref.type === 'CONCEPT') return `CONCEPT:${ref.conceptId}`
  if (ref.type === 'RECORD_GROUP') return `RECORD_GROUP:${dimensionName(ref)}`
  if (ref.type === 'LAYOUT_AXIS') return `LAYOUT_AXIS:${ref.layoutAxis}`
  return ref.type
}

export const sameTerm = (a, b) => termKey(a) === termKey(b)

export const toReference = (ref) => ({
  type: ref.type,
  conceptId: ref.type === 'CONCEPT' ? ref.conceptId : null,
  recordGroupDimension: ref.type === 'RECORD_GROUP' ? dimensionName(ref) : null,
  layoutAxis: ref.type === 'LAYOUT_AXIS' ? ref.layoutAxis : null
})

/* ---------- form -> AnalysisInput ---------- */

const isSet = (v) => v !== null && v !== undefined && v !== ''
const nonEmpty = (list) => Array.isArray(list) && list.length > 0

const assignIf = (target, key, value, condition = isSet(value)) => {
  if (condition) target[key] = value
  return target
}

const referenceInput = (ref) => {
  const out = { type: ref.type }
  if (ref.type === 'CONCEPT') out.conceptId = ref.conceptId
  if (ref.type === 'RECORD_GROUP') out.recordGroupDimension = dimensionName(ref)
  if (ref.type === 'LAYOUT_AXIS') out.layoutAxis = ref.layoutAxis
  return out
}

const binningInput = (b) => ({
  boundaries: [...(b.boundaries ?? [])],
  labels: [...(b.labels ?? [])],
  boundary: b.boundary ?? 'LEFT'
})

const termInput = (term, analysisType) => {
  const out = { reference: referenceInput(term.reference) }
  assignIf(out, 'representation', term.representation)
  if (term.binning) out.binning = binningInput(term.binning)
  assignIf(out, 'levelOrder', term.levelOrder ? [...term.levelOrder] : null, nonEmpty(term.levelOrder))
  assignIf(out, 'transformations', [...(term.transformations ?? [])], nonEmpty(term.transformations))
  assignIf(out, 'aggregation', term.aggregation)
  if (term.replicateAggregation?.aggregation) {
    const replicate = { aggregation: term.replicateAggregation.aggregation }
    assignIf(replicate, 'window', term.replicateAggregation.window)
    out.replicateAggregation = replicate
  }
  if (analysisType === 'ANOVA') {
    assignIf(out, 'effect', term.effect)
    assignIf(out, 'randomSlopeTerms', (term.randomSlopeTerms ?? []).map(referenceInput), nonEmpty(term.randomSlopeTerms))
  }
  return out
}

const memberInput = (m) => {
  const out = { groupingId: m.groupingId, code: m.code }
  assignIf(out, 'datasetId', m.datasetId)
  return out
}

const groupingInput = (g) => {
  const out = {}
  if (g.time) {
    out.time = { assignment: g.time.assignment, binning: binningInput(g.time.binning) }
  }
  if (g.germplasm) out.germplasm = { germplasmIds: [...g.germplasm.germplasmIds] }
  if (g.unit) out.unit = { unitIds: [...g.unit.unitIds] }
  if (g.position) {
    const p = g.position
    const position = { locationTypeIds: [...p.locationTypeIds] }
    assignIf(position, 'subjectIds', [...(p.subjectIds ?? [])], nonEmpty(p.subjectIds))
    assignIf(position, 'axes', [...(p.axes ?? [])], nonEmpty(p.axes))
    assignIf(position, 'time', p.time)
    out.position = position
  }
  if (nonEmpty(g.recordGroups)) {
    out.recordGroups = g.recordGroups.map((d) => {
      const dim = { name: d.name, groupingIds: [...d.groupingIds] }
      assignIf(dim, 'subjectIds', [...(d.subjectIds ?? [])], nonEmpty(d.subjectIds))
      assignIf(
        dim,
        'levels',
        (d.levels ?? []).map((l) => ({ label: l.label, members: l.members.map(memberInput) })),
        nonEmpty(d.levels)
      )
      return dim
    })
  }
  return Object.keys(out).length > 0 ? out : null
}

const exclusionInput = (e) => {
  const out = {}
  for (const key of ['recordIds', 'unitIds', 'germplasmIds', 'studyIds']) {
    assignIf(out, key, [...(e[key] ?? [])], nonEmpty(e[key]))
  }
  assignIf(
    out,
    'positions',
    (e.positions ?? []).map((p) => {
      const pos = { locationId: p.locationId }
      assignIf(pos, 'layoutId', p.layoutId)
      assignIf(pos, 'axes', (p.axes ?? []).map((a) => ({ index: a.index, value: a.value })), nonEmpty(p.axes))
      return pos
    }),
    nonEmpty(e.positions)
  )
  assignIf(out, 'recordGroups', (e.recordGroups ?? []).map(memberInput), nonEmpty(e.recordGroups))
  assignIf(out, 'start', e.start)
  assignIf(out, 'end', e.end)
  return out
}

const interactionsInput = (interactions) =>
  interactions.map((i) => ({ terms: i.terms.map(referenceInput) }))

const estimatedMeansInput = (list) =>
  list.map((em) => {
    const out = { terms: em.terms.map(referenceInput), contrast: em.contrast, adjustment: em.adjustment }
    assignIf(out, 'by', em.by.map(referenceInput), nonEmpty(em.by))
    assignIf(out, 'control', em.control, em.contrast === 'TRT_VS_CTRL' && isSet(em.control))
    return out
  })

export function buildAnalysisInput(form) {
  const type = form.analysisType
  const config = { terms: form.terms.map((t) => termInput(t, type)) }
  const grouping = groupingInput(form.grouping)
  if (grouping) config.grouping = grouping

  if (type === 'ANOVA') {
    config.response = form.response ? referenceInput(form.response) : null
  }
  if (type === 'ANOVA' || type === 'DESCRIPTIVE_STATISTICS') {
    assignIf(config, 'interactions', interactionsInput(form.interactions), nonEmpty(form.interactions))
    assignIf(config, 'estimatedMeans', estimatedMeansInput(form.estimatedMeans), nonEmpty(form.estimatedMeans))
  }
  for (const [inputField, formField] of Object.entries(OPTION_FIELDS[type])) {
    const value = form.options[formField]
    if (inputField === 'clustering') {
      if (value) {
        const clustering = { method: value.method }
        assignIf(clustering, 'clusters', value.clusters)
        config.clustering = clustering
      }
    } else {
      assignIf(config, inputField, value)
    }
  }

  const input = {
    analysisType: type,
    datasetIds: [...form.datasetIds],
    [typeKey(type)]: config
  }
  assignIf(input, 'name', form.name?.trim())
  assignIf(input, 'exclusions', form.exclusions.map(exclusionInput), nonEmpty(form.exclusions))
  return input
}

/* ---------- submission -> form ---------- */

const binningFromOutput = (b) =>
  b ? { boundaries: [...(b.boundaries ?? [])], labels: [...(b.labels ?? [])], boundary: b.boundary } : null

const memberFromOutput = (m) => ({ groupingId: m.groupingId, code: m.code, datasetId: m.datasetId ?? null })

const termFromOutput = (t) => ({
  reference: toReference(t.reference),
  representation: t.representation ?? null,
  binning: binningFromOutput(t.binning),
  levelOrder: t.levelOrder ? [...t.levelOrder] : null,
  transformations: [...(t.transformations ?? [])],
  aggregation: t.aggregation ?? null,
  replicateAggregation: t.replicateAggregation
    ? { aggregation: t.replicateAggregation.aggregation, window: t.replicateAggregation.window ?? null }
    : null,
  effect: t.effect ?? null,
  randomSlopeTerms: (t.randomSlopeTerms ?? []).map(toReference)
})

const groupingFromOutput = (g) => {
  const out = createEmptyGrouping()
  if (!g) return out
  if (g.time) out.time = { assignment: g.time.assignment, binning: binningFromOutput(g.time.binning) }
  if (g.germplasm) out.germplasm = { germplasmIds: [...g.germplasm.germplasmIds] }
  if (g.unit) out.unit = { unitIds: [...g.unit.unitIds] }
  if (g.position) {
    const p = g.position
    out.position = {
      locationTypeIds: [...(p.locationTypeIds ?? [])],
      subjectIds: [...(p.subjectIds ?? [])],
      axes: [...(p.axes ?? [])],
      time: p.time ?? null
    }
  }
  out.recordGroups = (g.recordGroups ?? []).map((d) => ({
    name: d.name,
    groupingIds: d.groupings.map((x) => x.groupingId),
    subjectIds: [...(d.subjectIds ?? [])],
    levels: (d.levels ?? []).map((l) => ({ label: l.label, members: l.members.map(memberFromOutput) }))
  }))
  return out
}

export const exclusionFromOutput = (e) => ({
  recordIds: [...(e.recordIds ?? [])],
  unitIds: [...(e.unitIds ?? [])],
  germplasmIds: [...(e.germplasmIds ?? [])],
  studyIds: [...(e.studyIds ?? [])],
  positions: (e.positions ?? []).map((p) => ({
    locationId: p.locationId,
    layoutId: p.layoutId ?? null,
    axes: (p.axes ?? []).map((a) => ({ index: a.index, value: a.value }))
  })),
  recordGroups: (e.recordGroups ?? []).map(memberFromOutput),
  start: e.start ?? null,
  end: e.end ?? null
})

const estimatedMeansFromOutput = (list) =>
  (list ?? []).map((em) => ({
    terms: em.terms.map(toReference),
    by: (em.by ?? []).map(toReference),
    contrast: em.contrast,
    control: em.control ?? null,
    adjustment: em.adjustment
  }))

/** Load a stored submission back into a form, e.g. for edit and resubmit. */
export function submissionToForm(submission) {
  const form = createEmptyForm()
  const config = submission.config ?? {}
  form.name = submission.name ?? ''
  form.analysisType = submission.analysisType
  form.datasetIds = [...submission.datasetIds]
  form.exclusions = (submission.exclusions ?? []).map(exclusionFromOutput)
  form.terms = (config.terms ?? []).map(termFromOutput)
  form.grouping = groupingFromOutput(config.grouping)
  form.response = config.response ? toReference(config.response) : null
  form.interactions = (config.interactions ?? []).map((i) => ({ terms: i.terms.map(toReference) }))
  form.estimatedMeans = estimatedMeansFromOutput(config.estimatedMeans)

  const o = form.options
  if (config.alpha != null) o.alpha = config.alpha
  if (config.sumOfSquares) o.sumOfSquares = config.sumOfSquares
  if (config.ddf) o.ddf = config.ddf
  if (config.correlationMethod) o.correlationMethod = config.correlationMethod
  if (config.distance) o.distance = config.distance
  if (config.dimensions != null) o.dimensions = config.dimensions
  if (config.clustering) o.clustering = { method: config.clustering.method, clusters: config.clustering.clusters ?? null }
  if (config.outlierMethod) o.outlierMethod = config.outlierMethod

  // studyIds are filled in from the datasets by useAnalysisDataContext
  return form
}

/* ---------- form edits ---------- */

/** Remove a term and every reference to it elsewhere in the form. */
export function removeTermReferences(form, ref) {
  const key = termKey(ref)
  const keep = (r) => termKey(r) !== key
  form.terms = form.terms.filter((t) => keep(t.reference))
  form.terms.forEach((t) => {
    t.randomSlopeTerms = (t.randomSlopeTerms ?? []).filter(keep)
  })
  if (form.response && !keep(form.response)) form.response = null
  // edited in place, so that messages about the interactions and estimated means that remain stay with them
  form.interactions.forEach((i) => {
    i.terms = i.terms.filter(keep)
  })
  form.interactions = form.interactions.filter((i) => i.terms.length > 1)
  form.estimatedMeans.forEach((em) => {
    em.terms = em.terms.filter(keep)
    em.by = em.by.filter(keep)
  })
  form.estimatedMeans = form.estimatedMeans.filter((em) => em.terms.length > 0)
}

/** Update references when a record group dimension is renamed. */
export function renameDimensionReferences(form, oldName, newName) {
  const rename = (r) => {
    if (r.type === 'RECORD_GROUP' && r.recordGroupDimension === oldName) r.recordGroupDimension = newName
  }
  form.terms.forEach((t) => {
    rename(t.reference)
    ;(t.randomSlopeTerms ?? []).forEach(rename)
  })
  if (form.response) rename(form.response)
  form.interactions.forEach((i) => i.terms.forEach(rename))
  form.estimatedMeans.forEach((em) => {
    em.terms.forEach(rename)
    em.by.forEach(rename)
  })
}

/* ---------- server paths -> form paths ---------- */

/**
 * Convert an AnalysisInput path from a server message to the matching form path,
 * e.g. ["anova", "terms", "2", "binning"] -> "terms.2.binning".
 */
export function inputPathToFormPath(path, analysisType) {
  if (!path || path.length === 0) return ''
  const [head, ...rest] = path.map(String)
  const info = ANALYSIS_TYPES.find((t) => t.key === head)
  if (!info) return [head, ...rest].join('.')
  if (rest.length === 0) return ''
  const optionField = OPTION_FIELDS[info.value ?? analysisType]?.[rest[0]]
  if (optionField) return ['options', optionField, ...rest.slice(1)].join('.')
  return rest.join('.')
}

/**
 * Pin messages to what their paths lead to in the form they were raised on, e.g. the term at terms.2, so that
 * anchoredFormPath can follow it when the items before it are removed. Pass the form itself, not a reactive proxy of
 * it, so that the items are compared as they are stored.
 */
export function anchorMessages(messages, form) {
  return messages.map((message) => {
    const path = inputPathToFormPath(message.path)
    const segments = path ? path.split('.') : []
    let value = form
    const anchors = segments.map((segment) => {
      const container = value
      value = container?.[segment]
      const anchor = {}
      // an item of a list, found again by itself: an object as itself, a value (e.g. a dataset ID) by its value
      if (Array.isArray(container) && /^\d+$/.test(segment) && value !== undefined) {
        anchor.index = Number(segment)
        anchor.item = value
      }
      // a section such as a grouping dimension, which goes when it is turned off
      if (value !== null && typeof value === 'object') anchor.object = true
      return anchor
    })
    return { ...message, anchor: { segments, anchors } }
  })
}

/**
 * Form path of an anchored message (anchorMessages) in the form as it is now, e.g. "terms.1" once the first of three
 * terms is removed from a message at "terms.2"; null when the item or section the message is about has been removed.
 */
export function anchoredFormPath(message, form) {
  const { segments, anchors } = message.anchor
  let value = form
  const path = []
  for (let i = 0; i < segments.length; i++) {
    const anchor = anchors[i]
    let segment = segments[i]
    if ('item' in anchor) {
      if (!Array.isArray(value)) return null
      // a value may be listed twice, so one still at its index stays there
      const index = value[anchor.index] === anchor.item ? anchor.index : value.indexOf(anchor.item)
      if (index < 0) return null
      segment = String(index)
    }
    value = value?.[segment]
    if (anchor.object && (value === null || value === undefined)) return null
    path.push(segment)
  }
  return path.join('.')
}
