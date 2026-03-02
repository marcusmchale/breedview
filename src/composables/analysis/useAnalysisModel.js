import { ref, computed } from 'vue'
import { useDatetimeUtils } from '@/composables/parsers/partialDatetime'

/**
 * Scale types that can be used as dependent variables (Y)
 */
const DEPENDENT_SCALE_TYPES = ['NUMERICAL']

/**
 * Scale types that can be used as independent variables (X)
 */
const INDEPENDENT_SCALE_TYPES = ['NUMERICAL', 'NOMINAL', 'ORDINAL']

/**
 * Composable for building statistical analysis models from dataset records
 */
export function useAnalysisModel() {
  const { assignToTimepoint, suggestBoundaries, generateBinLabel } = useDatetimeUtils()

  // Model state
  const dependentVariable = ref(null) // { conceptId, concept, label }
  const independentVariables = ref([]) // [{ type: 'CONCEPT'|'GERMPLASM'|'TIMEPOINT', conceptId?, label }]
  const interactionTerms = ref([]) // [{ var1Index, var2Index }]
  const timepointBoundaries = ref([]) // ['2010', '2010-06', '2011']

  // Warnings and validation
  const modelWarnings = ref([])
  const timepointWarnings = ref([])

  // Records excluded from analysis
  const excludedRecords = ref([])

  /**
   * Check if a concept can be a dependent variable
   */
  const canBeDependentVariable = (concept) => {
    const scaleType = concept?.scale?.scaleType
    return DEPENDENT_SCALE_TYPES.includes(scaleType)
  }

  /**
   * Check if a concept can be an independent variable
   */
  const canBeIndependentVariable = (concept) => {
    const scaleType = concept?.scale?.scaleType
    return INDEPENDENT_SCALE_TYPES.includes(scaleType)
  }

  /**
   * Get the variable type treatment for a concept
   */
  const getVariableTreatment = (concept) => {
    const scaleType = concept?.scale?.scaleType
    if (scaleType === 'NUMERICAL') return 'CONTINUOUS'
    if (scaleType === 'NOMINAL' || scaleType === 'ORDINAL') return 'CATEGORICAL'
    return 'unknown'
  }

  /**
   * Set the dependent variable
   */
  const setDependentVariable = (concept) => {
    if (!concept) {
      dependentVariable.value = null
      return
    }

    if (!canBeDependentVariable(concept)) {
      modelWarnings.value.push(`Concept "${concept.name}" cannot be used as dependent variable (scale type: ${concept.scale?.scaleType})`)
      return
    }

    dependentVariable.value = {
      conceptId: concept.id,
      concept,
      label: concept.name || `Concept ${concept.id}`,
      treatment: 'CONTINUOUS'
    }
  }

  /**
   * Add an independent variable (concept-based)
   */
  const addIndependentConcept = (concept) => {
    if (!concept) return

    if (!canBeIndependentVariable(concept)) {
      modelWarnings.value.push(`Concept "${concept.name}" cannot be used as independent variable`)
      return
    }

    // Check if already added
    const exists = independentVariables.value.some(
      v => v.type === 'CONCEPT' && v.conceptId === concept.id
    )
    if (exists) return

    independentVariables.value.push({
      type: 'CONCEPT',
      conceptId: concept.id,
      concept,
      label: concept.name || `Concept ${concept.id}`,
      treatment: getVariableTreatment(concept)
    })
  }

  /**
   * Add germplasm as an independent variable
   */
  const addGermplasmVariable = () => {
    const exists = independentVariables.value.some(v => v.type === 'GERMPLASM')
    if (exists) return

    independentVariables.value.push({
      type: 'GERMPLASM',
      label: 'Germplasm',
      treatment: 'categorical'
    })
  }

  /**
   * Add timepoint as an independent variable
   */
  const addTimepointVariable = () => {
    const exists = independentVariables.value.some(v => v.type === 'TIMEPOINT')
    if (exists) return

    independentVariables.value.push({
      type: 'TIMEPOINT',
      label: 'Timepoint',
      treatment: 'categorical'
    })
  }

  /**
   * Remove an independent variable by index
   */
  const removeIndependentVariable = (index) => {
    const removed = independentVariables.value[index]
    independentVariables.value.splice(index, 1)

    // Remove any interaction terms involving this variable
    interactionTerms.value = interactionTerms.value.filter(
      term => term.var1Index !== index && term.var2Index !== index
    )

    // Adjust indices in remaining interaction terms
    interactionTerms.value = interactionTerms.value.map(term => ({
      var1Index: term.var1Index > index ? term.var1Index - 1 : term.var1Index,
      var2Index: term.var2Index > index ? term.var2Index - 1 : term.var2Index
    }))

    return removed
  }

  /**
   * Add an interaction term between two independent variables
   */
  const addInteractionTerm = (var1Index, var2Index) => {
    if (var1Index === var2Index) return
    if (var1Index >= independentVariables.value.length || var2Index >= independentVariables.value.length) return

    // Normalize order (smaller index first)
    const [idx1, idx2] = var1Index < var2Index ? [var1Index, var2Index] : [var2Index, var1Index]

    // Check if already exists
    const exists = interactionTerms.value.some(
      term => term.var1Index === idx1 && term.var2Index === idx2
    )
    if (exists) return

    interactionTerms.value.push({ var1Index: idx1, var2Index: idx2 })
  }

  /**
   * Remove an interaction term
   */
  const removeInteractionTerm = (termIndex) => {
    interactionTerms.value.splice(termIndex, 1)
  }

  /**
   * Set timepoint boundaries for binning
   */
  const setTimepointBoundaries = (boundaries) => {
    timepointBoundaries.value = boundaries || []
    timepointWarnings.value = []
  }

  /**
   * Auto-suggest timepoint boundaries based on records
   */
  const autoSuggestBoundaries = (records, strategy = 'year', numBins = 4) => {
    const suggestions = suggestBoundaries(records, strategy, numBins)
    setTimepointBoundaries(suggestions)
    return suggestions
  }

  /**
   * Process records and assign timepoint bins, collecting warnings
   */
  const processTimepointAssignments = (records) => {
    timepointWarnings.value = []
    excludedRecords.value = []

    const hasTimepointVar = independentVariables.value.some(v => v.type === 'TIMEPOINT')
    if (!hasTimepointVar) return records

    const processedRecords = []
    const warningsByType = {
      noTime: [],
      spansBoundary: []
    }

    records.forEach((record, index) => {
      const assignment = assignToTimepoint(record, timepointBoundaries.value)

      if (assignment.binIndex === -1) {
        // Record excluded
        excludedRecords.value.push({ record, index, reason: assignment.warnings.join('; ') })
        warningsByType.noTime.push(index)
      } else {
        processedRecords.push({
          ...record,
          _timepointBin: assignment.binIndex,
          _timepointLabel: assignment.binLabel
        })

        if (assignment.warnings.length > 0) {
          warningsByType.spansBoundary.push({ index, warnings: assignment.warnings })
        }
      }
    })

    // Generate summary warnings
    if (warningsByType.noTime.length > 0) {
      timepointWarnings.value.push(
        `${warningsByType.noTime.length} record(s) excluded from analysis due to missing time data`
      )
    }

    if (warningsByType.spansBoundary.length > 0) {
      timepointWarnings.value.push(
        `${warningsByType.spansBoundary.length} record(s) span timepoint boundaries (midpoint used for assignment)`
      )
    }

    return processedRecords
  }

  /**
   * Get available timepoint bin labels based on current boundaries
   */
  const timepointBinLabels = computed(() => {
    if (timepointBoundaries.value.length === 0) {
      return ['All Data']
    }

    const labels = []
    for (let i = 0; i <= timepointBoundaries.value.length; i++) {
      labels.push(generateBinLabel(i, timepointBoundaries.value))
    }
    return labels
  })

  /**
   * Generate human-readable model formula
   */
  const modelFormula = computed(() => {
    if (!dependentVariable.value) return ''

    const parts = []
    const depLabel = dependentVariable.value.label

    // Add independent variables
    independentVariables.value.forEach(v => {
      parts.push(v.label)
    })

    // Add interaction terms
    interactionTerms.value.forEach(term => {
      const var1 = independentVariables.value[term.var1Index]
      const var2 = independentVariables.value[term.var2Index]
      if (var1 && var2) {
        parts.push(`${var1.label}:${var2.label}`)
      }
    })

    if (parts.length === 0) {
      return `${depLabel} ~ 1` // Intercept-only model
    }

    return `${depLabel} ~ ${parts.join(' + ')}`
  })

  /**
   * Check if model is valid for submission
   */
  const isModelValid = computed(() => {
    return dependentVariable.value !== null && independentVariables.value.length > 0
  })

  /**
   * Clear the model
   */
  const clearModel = () => {
    dependentVariable.value = null
    independentVariables.value = []
    interactionTerms.value = []
    timepointBoundaries.value = []
    modelWarnings.value = []
    timepointWarnings.value = []
    excludedRecords.value = []
  }

  /**
   * Export model configuration for GraphQL submission
   */
  const exportModelConfig = () => {
    return {
      dependentVariable: dependentVariable.value ? {
        type: 'CONCEPT',
        conceptId: dependentVariable.value.conceptId,
        label: dependentVariable.value.label
      } : null,
      independentVariables: independentVariables.value.map(v => ({
        type: v.type,
        conceptId: v.conceptId || null,
        label: v.label
      })),
      interactionTerms: interactionTerms.value.map(term => ({
        var1Index: term.var1Index,
        var2Index: term.var2Index
      })),
      timepointBoundaries: timepointBoundaries.value
    }
  }

  return {
    // State
    dependentVariable,
    independentVariables,
    interactionTerms,
    timepointBoundaries,
    modelWarnings,
    timepointWarnings,
    excludedRecords,

    // Computed
    modelFormula,
    isModelValid,
    timepointBinLabels,

    // Methods - Variable eligibility
    canBeDependentVariable,
    canBeIndependentVariable,
    getVariableTreatment,

    // Methods - Model building
    setDependentVariable,
    addIndependentConcept,
    addGermplasmVariable,
    addTimepointVariable,
    removeIndependentVariable,
    addInteractionTerm,
    removeInteractionTerm,

    // Methods - Timepoint handling
    setTimepointBoundaries,
    autoSuggestBoundaries,
    processTimepointAssignments,

    // Methods - Utilities
    clearModel,
    exportModelConfig
  }
}