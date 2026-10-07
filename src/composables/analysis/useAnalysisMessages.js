import { computed, toValue } from 'vue'
import { inputPathToFormPath } from '@/composables/analysis/useAnalysisForm'

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
  UNASSIGNED_GERMPLASM: { hint: 'Exclude these records, or adjust the selected germplasm.', excludeRecords: true },
  UNASSIGNED_UNIT: { hint: 'Exclude these records, or adjust the selected parent units.', excludeRecords: true },
  UNASSIGNED_POSITION: { hint: 'Exclude these records, or adjust the position grouping.', excludeRecords: true },
  UNASSIGNED_RECORD_GROUP: { hint: 'Exclude these records, or adjust the record group dimension.', excludeRecords: true },
  MISSING_VALUES: { hint: 'Some observations lack a value for the term.' },
  DATASET_FULLY_EXCLUDED: { hint: 'The dataset contributed no observations.' },
  RECORD_GROUP_LEVEL_UNMATCHED: { hint: 'A shared level member matched no records.' },
  MODEL_NOT_CONVERGED: { hint: 'The model did not converge; interpret the result with caution.' }
}

export const messageInfo = (code) => MESSAGE_CODES[code] ?? {}

/** Dataset ID a message refers to, from its path (e.g. ["datasetIds", "1"]). */
export function messageDatasetIndex(message) {
  const path = message.path ?? []
  return path[0] === 'datasetIds' && path.length > 1 ? Number(path[1]) : null
}

/** Count of records matched by an EXCLUDED_BY_CONFIG warning. */
export function exclusionMatchCount(message) {
  if (Array.isArray(message.recordIds)) return message.recordIds.length
  const match = message.message?.match(/\d+/)
  return match ? Number(match[0]) : null
}

/**
 * Index analysis messages by form path.
 *
 * @param messages ref/getter of a list of {code, message, path, recordIds, severity}
 * @param analysisType ref/getter of the analysis type the paths refer to
 */
export function useAnalysisMessages(messages, analysisType) {
  const indexed = computed(() => {
    const byPath = new Map()
    const unpathed = []
    for (const m of toValue(messages) ?? []) {
      const key = inputPathToFormPath(m.path, toValue(analysisType))
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

  /** EXCLUDED_BY_CONFIG warnings by exclusion rule index. */
  const exclusionFeedback = computed(() => {
    const out = {}
    for (const m of toValue(messages) ?? []) {
      if (m.code !== 'EXCLUDED_BY_CONFIG' || m.path?.[0] !== 'exclusions') continue
      out[Number(m.path[1])] = { message: m.message, count: exclusionMatchCount(m) }
    }
    return out
  })

  return { messagesAt, unpathed, exclusionFeedback }
}
