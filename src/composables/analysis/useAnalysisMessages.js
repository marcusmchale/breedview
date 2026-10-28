import { computed, toValue } from 'vue'
import { anchoredFormPath, inputPathToFormPath } from '@/composables/analysis/useAnalysisForm'

/** Suggested actions for analysis message codes. */
export const MESSAGE_CODES = {
  CONFIG_INVALID: { hint: 'Fix the highlighted field.' },
  DATASET_NOT_FOUND: { hint: 'Remove the dataset from the analysis.', removeDataset: true },
  DATASET_NOT_READABLE: { hint: 'Remove the dataset, or request access to it.', removeDataset: true },
  CONCEPT_NOT_IN_DATASETS: { hint: 'Add a dataset for the concept, or remove the term.' },
  INCOMPATIBLE_SCALE: { hint: 'Change the representation, aggregation or binning of the term.' },
  UNIT_NOT_FOUND: { hint: 'Fix the unit selection.' },
  GROUPING_NOT_FOUND: { hint: 'Fix the record grouping selection.' },
  DUPLICATE_OBSERVATION: {
    hint: 'Several values fall in one observation. Set an aggregation, or add a dimension (e.g. time bins or a record group) that separates them.',
    excludeRecords: true,
    suggestAggregation: true
  },
  INVALID_TRANSFORMATION: { hint: 'Remove the transformation, or exclude the affected records.', excludeRecords: true },
  INSUFFICIENT_DATA: { hint: 'Too few observations: relax exclusions or dimensions.' },
  SINGLE_LEVEL_TERM: { hint: 'The term has only one level in the analysed data; remove it.' },
  MODEL_FAILED: { hint: 'The model could not be fitted. Try simplifying it.' },
  INTERNAL_ERROR: { hint: 'Something went wrong on the server. Retry, or report the problem.' },
  EMPTY_DATASET: { hint: 'The dataset contributed nothing.', removeDataset: true },
  UNUSED_DATASET: { hint: 'The dataset contributed nothing.', removeDataset: true },
  EXCLUDED_BY_CONFIG: { hint: 'Records matched by an exclusion rule.' },
  UNASSIGNED_TIME: { hint: 'Exclude these records, or adjust the time bins.', excludeRecords: true },
  UNASSIGNED_GERMPLASM: {
    hint: 'Exclude these records, or adjust the selected germplasm or give their units germplasm.',
    excludeRecords: true
  },
  UNASSIGNED_UNIT: { hint: 'Exclude these records, or adjust the selected parent units.', excludeRecords: true },
  UNASSIGNED_POSITION: {
    hint: 'Exclude these records, or adjust the position grouping: other location types, place by a subject, or fewer axes.',
    excludeRecords: true
  },
  UNASSIGNED_RECORD_GROUP: { hint: 'Exclude these records, or adjust the record group dimension.', excludeRecords: true },
  MISSING_VALUES: { hint: 'Some observations lack a value for the term.' },
  DATASET_FULLY_EXCLUDED: { hint: 'The dataset contributed no observations.' },
  RECORD_GROUP_LEVEL_UNMATCHED: { hint: 'A shared level member matched no records.' },
  REPLICATES_POOLED: {
    hint: 'Replicates were pooled by the term\'s aggregation, so units and dates with more replicates weigh more. ' +
      'Set a replicate aggregation to combine each reading first.'
  },
  MODEL_NOT_CONVERGED: { hint: 'The model did not converge; interpret the result with caution.' },
  FACTOR_LINEAGES_DIFFER: {
    hint: 'These factor records, on separate lineages above some units, differ (e.g. a sample pooled from trees given ' +
      'different treatments), so none describes those units. Record the factor on the units themselves to say which applies.'
  }
}

// Variants of a code, told apart by the message path
const MESSAGE_VARIANTS = {
  'DUPLICATE_OBSERVATION:replicates': {
    hint: 'These values are replicates of the same reading. Set a replicate aggregation on the term, or add a record ' +
      'group dimension to analyse each replicate.',
    excludeRecords: true
  }
}

const lastPathPart = (message) => {
  const path = message?.path ?? []
  return path.length ? String(path[path.length - 1]) : null
}

/** Variant of a message's code, e.g. 'replicates' for duplicates that are only replicates, or ''. */
export function messageVariant(message) {
  if (message?.code === 'DUPLICATE_OBSERVATION' && lastPathPart(message) === 'replicateAggregation') return 'replicates'
  return ''
}

/** Suggested actions for a message code; pass the message to tell apart variants of the code. */
export const messageInfo = (code, message = null) => {
  const variant = message ? messageVariant({ ...message, code }) : ''
  return (variant && MESSAGE_VARIANTS[`${code}:${variant}`]) || MESSAGE_CODES[code] || {}
}

/** Dataset ID a message refers to, from its path (e.g. ["datasetIds", "1"]). */
export function messageDatasetIndex(message) {
  const path = message.path ?? []
  return path[0] === 'datasetIds' && path.length > 1 ? Number(path[1]) : null
}

/** Count of records matched by an EXCLUDED_BY_CONFIG warning, e.g. 6 from "Exclusion rule 2 matched 6 records". */
export function exclusionMatchCount(message) {
  if (Array.isArray(message.recordIds)) return message.recordIds.length
  const match = message.message?.match(/matched (\d+)/)
  return match ? Number(match[1]) : null
}

/**
 * Index analysis messages by form path. Anchored messages (anchorMessages) are indexed where their items are in the
 * form now, and left out once their items are removed.
 *
 * @param messages ref/getter of a list of {code, message, path, recordIds, severity}, anchored or not
 * @param analysisType ref/getter of the analysis type the paths refer to
 * @param form ref/getter of the form that anchored messages are pinned to
 */
export function useAnalysisMessages(messages, analysisType, form) {
  const indexed = computed(() => {
    const byPath = new Map()
    const unpathed = []
    for (const m of toValue(messages) ?? []) {
      const key = m.anchor ? anchoredFormPath(m, toValue(form)) : inputPathToFormPath(m.path, toValue(analysisType))
      // about an item or section that has been removed since
      if (key === null) continue
      if (!key) {
        unpathed.push(m)
        continue
      }
      if (!byPath.has(key)) byPath.set(key, [])
      byPath.get(key).push(m)
    }
    return { byPath, unpathed }
  })

  /** Messages at a form path; with prefix, also those nested below it. */
  const messagesAt = (path, { prefix = false } = {}) => {
    const key = Array.isArray(path) ? path.join('.') : String(path)
    const { byPath } = indexed.value
    if (!prefix) return byPath.get(key) ?? []
    const out = []
    for (const [k, list] of byPath) {
      if (k === key || k.startsWith(`${key}.`)) out.push(...list)
    }
    return out
  }

  const unpathed = computed(() => indexed.value.unpathed)

  /** EXCLUDED_BY_CONFIG warnings by the index of their exclusion rule in the form. */
  const exclusionFeedback = computed(() => {
    const out = {}
    for (const [key, list] of indexed.value.byPath) {
      const rule = key.match(/^exclusions\.(\d+)$/)
      const warning = rule && list.find((m) => m.code === 'EXCLUDED_BY_CONFIG')
      if (warning) out[Number(rule[1])] = { message: warning.message, count: exclusionMatchCount(warning) }
    }
    return out
  })

  return { messagesAt, unpathed, exclusionFeedback }
}
