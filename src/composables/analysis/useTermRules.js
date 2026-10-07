/**
 * Client-side rules for analysis terms, used to restrict choices in the editor.
 *
 * These mirror the server rules only as far as needed to guide the user;
 * the server remains the authority and reports CONFIG_INVALID errors.
 */
import { sameTerm } from '@/composables/analysis/useAnalysisForm'

export const REPRESENTATIONS = ['CONTINUOUS', 'CATEGORICAL', 'ORDINAL']
export const AGGREGATIONS = ['NONE', 'MEAN', 'MEDIAN', 'MIN', 'MAX', 'SUM', 'COUNT', 'MODE']
export const TRANSFORMATIONS = ['CENTER', 'STANDARDIZE', 'LOG', 'LOG1P', 'SQRT', 'RECIPROCAL']

export const TRANSFORMATION_HINTS = {
  CENTER: 'Subtract the mean',
  STANDARDIZE: 'Subtract the mean and divide by SD (needs ≥ 2 distinct values)',
  LOG: 'Natural log (values must be > 0)',
  LOG1P: 'log(1 + x) (values must be > −1)',
  SQRT: 'Square root (values must be ≥ 0)',
  RECIPROCAL: '1 / x (values must be ≠ 0)'
}

const BINNABLE_SCALES = new Set(['NUMERICAL', 'DATE'])

export const isConceptTerm = (term) => term?.reference?.type === 'CONCEPT'

export const isAnalysableScale = (scaleType) => scaleType !== 'COMPLEX'

export function defaultRepresentation(term, scaleType) {
  if (!isConceptTerm(term)) return 'CATEGORICAL'
  if (term.aggregation === 'COUNT') return 'CONTINUOUS'
  if (term.binning) return 'ORDINAL'
  if (scaleType === 'NUMERICAL') return 'CONTINUOUS'
  if (scaleType === 'ORDINAL') return 'ORDINAL'
  return 'CATEGORICAL'
}

/** The representation the server will use for the term. */
export function effectiveRepresentation(term, scaleType) {
  if (isConceptTerm(term) && term.aggregation === 'COUNT') return 'CONTINUOUS'
  return term.representation ?? defaultRepresentation(term, scaleType)
}

export function allowedRepresentations(term, scaleType) {
  if (!isConceptTerm(term)) return ['CATEGORICAL', 'ORDINAL']
  if (term.aggregation === 'COUNT') return ['CONTINUOUS']
  if (scaleType === 'NUMERICAL' && !term.binning) return REPRESENTATIONS
  return ['CATEGORICAL', 'ORDINAL']
}

export function allowedAggregations(term, scaleType) {
  if (!isConceptTerm(term)) return []
  const ordered =
    scaleType === 'NUMERICAL' || scaleType === 'DATE' || scaleType === 'ORDINAL' || term.representation === 'ORDINAL'
  return AGGREGATIONS.filter((a) => {
    if (a === 'MEAN' || a === 'MEDIAN' || a === 'SUM') return scaleType === 'NUMERICAL'
    if (a === 'MIN' || a === 'MAX') return ordered
    return true
  })
}

export const canBin = (term, scaleType) =>
  isConceptTerm(term) && BINNABLE_SCALES.has(scaleType) && term.aggregation !== 'COUNT'

export const canTransform = (term, scaleType) =>
  isConceptTerm(term) && effectiveRepresentation(term, scaleType) === 'CONTINUOUS'

export const canOrderLevels = (term, scaleType) => effectiveRepresentation(term, scaleType) !== 'CONTINUOUS'

export const showsEffect = (analysisType) => analysisType === 'ANOVA'

/** Grouping that must be configured before a domain term can be used. */
export function requiredGrouping(type) {
  return { TIME: 'time', GERMPLASM: 'germplasm', POSITION: 'position', RECORD_GROUP: 'recordGroups' }[type] ?? null
}

export function isGroupingConfigured(grouping, type) {
  const key = requiredGrouping(type)
  if (!key) return true
  if (key === 'recordGroups') return (grouping.recordGroups ?? []).length > 0
  return !!grouping[key]
}

/** Candidate levels for ordering a term, where they can be known in advance. */
export function knownLevels(term, concept, grouping) {
  if (term.binning) return term.binning.labels.filter(Boolean)
  if (isConceptTerm(term)) return (concept?.categories ?? []).map((c) => c.name)
  if (term.reference.type === 'TIME') return (grouping.time?.binning?.labels ?? []).filter(Boolean)
  if (term.reference.type === 'RECORD_GROUP') {
    const dim = grouping.recordGroups.find((d) => d.name === term.reference.recordGroupDimension)
    return (dim?.levels ?? []).map((l) => l.label)
  }
  return []
}

export function responseCandidates(form, conceptsById) {
  return form.terms.filter((t) => {
    if (!isConceptTerm(t) || t.binning || t.effect) return false
    return effectiveRepresentation(t, conceptsById[t.reference.conceptId]?.scaleType) === 'CONTINUOUS'
  })
}

/** Categorical model terms, e.g. for interactions and estimated means. */
export function categoricalTerms(form, conceptsById) {
  return form.terms.filter((t) => {
    if (form.analysisType === 'ANOVA') {
      if (sameTerm(t.reference, form.response) || t.effect === 'RANDOM') return false
    }
    return effectiveRepresentation(t, conceptsById[t.reference.conceptId]?.scaleType) !== 'CONTINUOUS'
  })
}

/**
 * Non-blocking hints about requirements of the selected analysis type.
 * Returns a list of strings.
 */
export function analysisHints(form, conceptsById) {
  const hints = []
  const conceptTerms = form.terms.filter(isConceptTerm)
  const repr = (t) => effectiveRepresentation(t, conceptsById[t.reference.conceptId]?.scaleType)

  if (form.datasetIds.length === 0) hints.push('Select at least one dataset.')

  switch (form.analysisType) {
    case 'ANOVA':
      if (!form.response) hints.push('Choose a continuous concept term as the response.')
      if (form.terms.length < 2) hints.push('ANOVA needs at least one term besides the response.')
      if (form.terms.some((t) => t.effect === 'RANDOM' && repr(t) === 'CONTINUOUS')) {
        hints.push('Random terms must be categorical.')
      }
      break
    case 'DESCRIPTIVE_STATISTICS':
      if (conceptTerms.length === 0) hints.push('Add at least one concept term.')
      break
    case 'CORRELATION':
      if (conceptTerms.length < 2) hints.push('Correlation needs at least two concept terms.')
      if (conceptTerms.some((t) => repr(t) === 'CATEGORICAL')) {
        hints.push('Correlation concept terms must be continuous or ordinal.')
      }
      break
    case 'MDS':
    case 'OUTLIER_DETECTION':
      if (conceptTerms.length === 0) hints.push('Add at least one concept term.')
      if (conceptTerms.some((t) => repr(t) !== 'CONTINUOUS')) hints.push('Concept terms must be continuous.')
      if (form.analysisType === 'MDS' && form.options.clustering && !form.options.clustering.clusters) {
        hints.push('Clustering needs a number of clusters.')
      }
      break
  }
  return hints
}

/** Problems that prevent the input from being sent at all (e.g. required GraphQL fields). */
export function blockingProblems(form) {
  const problems = []
  if (form.datasetIds.length === 0) problems.push('Select at least one dataset.')
  if (form.terms.length === 0) problems.push('Add at least one term.')
  if (form.analysisType === 'ANOVA' && !form.response) problems.push('Choose a response term.')
  return problems
}
