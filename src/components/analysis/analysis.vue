<script setup>
import { ref, computed, watch } from 'vue'
import { FormKit } from '@formkit/vue'

import { useSelectStudyQueries } from '@/composables/datasets/selectStudyQueries'
import { useDatasetSummariesMultiQuery } from '@/composables/datasets/datasetSummariesMultiQuery'
import { useDatasetsQuery } from '@/composables/datasets/datasetsQuery'
import { useAnalysisModel } from '@/composables/analysis/useAnalysisModel'
import { useSubmitAnalysis} from "@/composables/analysis/submitAnalysis";
import { useAnalysisQuery } from "@/composables/analysis/analysisQuery";
import { useGermplasmLazyQuery } from "@/composables/germplasm/germplasmLazyQuery";

// Phase management: 'selection' | 'model' | 'results'
const phase = ref('selection')

// Selection state
const selectedProgram = ref(null)
const selectedTrial = ref(null)
const selectionData = ref({
  studyIds: [],
  conceptIds: []
})

// Study selection queries
const {
  programs,
  programsLoading,
  trials,
  trialsLoading,
  studies,
  studiesLoading,
} = useSelectStudyQueries({
  programId: selectedProgram,
  trialId: selectedTrial,
  studyId: () => null
})

// Multi-study summaries
const {
  loading: summariesLoading,
  fetchSummaries,
  availableConcepts,
  getDatasetIdsForConcepts
} = useDatasetSummariesMultiQuery()

// Watch study selection and fetch summaries
watch(() => selectionData.value.studyIds, async (newStudyIds) => {
  if (newStudyIds && newStudyIds.length > 0) {
    await fetchSummaries(newStudyIds)
  }
}, { immediate: true })

// Datasets query (for model phase)
const selectedDatasetIds = computed(() => {
  return getDatasetIdsForConcepts(selectionData.value.conceptIds)
})

const {
  datasets,
  datasetsLoading,
  datasetsError
} = useDatasetsQuery({
  studyIds: () => null,
  conceptIds: () => null,
  datasetIds: () => phase.value !== 'selection' ? selectedDatasetIds.value : null
})

// Analysis model composable
const {
  dependentVariable,
  independentVariables,
  interactionTerms,
  timepointBoundaries,
  modelWarnings,
  timepointWarnings,
  excludedRecords,
  modelFormula,
  isModelValid,
  timepointBinLabels,
  canBeDependentVariable,
  canBeIndependentVariable,
  getVariableTreatment,
  setDependentVariable,
  addIndependentConcept,
  addGermplasmVariable,
  addTimepointVariable,
  removeIndependentVariable,
  addInteractionTerm,
  removeInteractionTerm,
  setTimepointBoundaries,
  autoSuggestBoundaries,
  processTimepointAssignments,
  clearModel,
  exportModelConfig
} = useAnalysisModel()

const { submitAnalysis, submitLoading, submitError } = useSubmitAnalysis()

// Results state
const currentAnalysisId = ref(null)
const analysisResults = ref(null)
const showSD = ref(true) // Toggle between SD and SE
const barWidth = ref(60)

// Computed spacing that scales with bar width
const barSpacing = computed(() => Math.max(20, barWidth.value * 0.5))
const totalBarWidth = computed(() => barWidth.value + barSpacing.value)

// Chart dimensions
const leftMargin = 60 // Increased margin for rotated labels
const chartWidth = computed(() => Math.max(800, groupData.value.length * totalBarWidth.value + leftMargin + 40))
const chartHeight = 450
const baselineY = 350

// Helper function to calculate bar positions
const getBarX = (index) => (index * totalBarWidth.value) + leftMargin
const getBarCenterX = (index) => getBarX(index) + (barWidth.value / 2)
const getBarY = (value) => baselineY - (value * chartScale.value.scale)


// Y-axis ticks
const yAxisTicks = computed(() => {
  if (groupData.value.length === 0) return []

  const max = chartScale.value.max
  const tickCount = 5
  const step = max / tickCount

  const ticks = []
  for (let i = 0; i <= tickCount; i++) {
    const value = i * step
    ticks.push({
      value: value,
      y: baselineY - (value * chartScale.value.scale),
      label: value.toFixed(1)
    })
  }
  return ticks
})

// Y-axis label with unit
const yAxisLabel = computed(() => {
  if (!dependentVariable.value) return ''
  console.log('dv', dependentVariable.value)
  const label = dependentVariable.value.concept?.name || 'Value'
  return label
  //const scale = dependentVariable.value.concept?.scale
  //return scale ? `${label} (${scale.name})` : label
})

// Chart title - based on actual grouping in the results
const chartTitle = computed(() => {
  if (!dependentVariable.value || !analysisResults.value?.group || analysisResults.value.group.length === 0) {
    return 'Analysis Results'
  }
  const depVar = dependentVariable.value.label
  // Extract the grouping variables from the actual results
  const firstGroup = analysisResults.value.group[0].group
  if (!firstGroup || firstGroup.length === 0) {
    return depVar
  }
  const groupVars = firstGroup.map(g => g.label).join(', ')
  return `${depVar} grouped by ${groupVars}`
})

// Set up germplasm query for name lookups
const {
  germplasm: germplasmEntries,
  germplasmLoading: germplasmNamesLoading,
  loadGermplasmByIds
} = useGermplasmLazyQuery()

// Build germplasm ID -> name map
const germplasmMap = computed(() => {
  const map = new Map()
  germplasmEntries.value.forEach(entry => {
    map.set(entry.id.toString(), entry.name)
  })
  return map
})

// Helper to get germplasm name by ID
const getGermplasmName = (id) => {
  return germplasmMap.value.get(id.toString()) || id
}


// Watch for analysis results and load germplasm names
watch(analysisResults, (newResults) => {
  if (!newResults?.group) return

  const ids = new Set()
  newResults.group.forEach(g => {
    g.group.forEach(factorLevel => {
      if (factorLevel.label === 'Germplasm') {
        const id = parseInt(factorLevel.level)
        if (!isNaN(id)) {
          ids.add(id)
        }
      }
    })
  })

  if (ids.size > 0) {
    loadGermplasmByIds(Array.from(ids))
  }
}, { immediate: true, deep: true })


// Set up analysis query with polling
const {
  status: analysisStatus,
  result,
  errors: analysisErrors,
  isComplete,
  analysisLoading
} = useAnalysisQuery(currentAnalysisId, {
  pollInterval: 2000,
  onComplete: ({ status, errors }) => {
    console.log('Analysis complete:', status)
    currentAnalysisId.value = null  // stop the query
    if (status === 'COMPLETED') {
      analysisResults.value = result.value
      console.log('Analysis results received:', analysisResults.value)
      phase.value = 'results'
      isSubmitting.value = false
    } else if (status === 'FAILED') {
      submissionError.value = errors?.map(e => e.message || e).join(', ') || 'Analysis failed'
      isSubmitting.value = false
    }
  }
})



// Concept options for multiselect
const conceptOptions = computed(() => {
  return availableConcepts.value.map(concept => ({
    label: concept.name || `Concept ${concept.id}`,
    value: concept.id
  }))
})

// Can proceed to model builder
const canLoadModel = computed(() => {
  return selectionData.value.studyIds.length > 0 &&
         selectionData.value.conceptIds.length > 0
})

// Extract concepts from loaded datasets
const loadedConcepts = computed(() => {
  if (!datasets.value) return []

  const conceptMap = new Map()
  datasets.value.forEach(dataset => {
    if (dataset.concept) {
      conceptMap.set(dataset.concept.id, dataset.concept)
    }
  })
  return Array.from(conceptMap.values())
})

// Filter concepts for dependent variable selection (NUMERICAL only)
const dependentVariableOptions = computed(() => {
  return loadedConcepts.value
    .filter(c => canBeDependentVariable(c))
    .map(c => ({
      label: c.name || `Concept ${c.id}`,
      value: c.id,
      concept: c
    }))
})

// Filter concepts for independent variable selection
const independentConceptOptions = computed(() => {
  return loadedConcepts.value
    .filter(c => canBeIndependentVariable(c))
    .filter(c => c.id !== dependentVariable.value?.conceptId) // Exclude dependent var
    .filter(c => !independentVariables.value.some(v => v.type === 'CONCEPT' && v.conceptId === c.id)) // Exclude already added
    .map(c => ({
      label: `${c.name || `Concept ${c.id}`} (${getVariableTreatment(c)})`,
      value: c.id,
      concept: c
    }))
})

// Check if germplasm/timepoint can still be added
const canAddGermplasm = computed(() => {
  return !independentVariables.value.some(v => v.type === 'GERMPLASM')
})

const canAddTimepoint = computed(() => {
  return !independentVariables.value.some(v => v.type === 'TIMEPOINT')
})

// Interaction term options (pairs of independent variables)
const interactionOptions = computed(() => {
  const options = []
  for (let i = 0; i < independentVariables.value.length; i++) {
    for (let j = i + 1; j < independentVariables.value.length; j++) {
      const exists = interactionTerms.value.some(
        t => t.var1Index === i && t.var2Index === j
      )
      if (!exists) {
        options.push({
          label: `${independentVariables.value[i].label} × ${independentVariables.value[j].label}`,
          value: `${i}-${j}`,
          var1Index: i,
          var2Index: j
        })
      }
    }
  }
  return options
})

// All records flattened from datasets
const allRecords = computed(() => {
  if (!datasets.value) return []

  const records = []
  datasets.value.forEach(dataset => {
    (dataset.records || []).forEach(record => {
      records.push({
        ...record,
        _datasetId: dataset.id,
        _conceptId: dataset.concept?.id,
        _conceptName: dataset.concept?.name
      })
    })
  })
  return records
})

// Timepoint boundary input
const boundaryInput = ref('')
const boundaryStrategy = ref('year')

const addBoundary = () => {
  if (!boundaryInput.value.trim()) return

  const newBoundaries = [...timepointBoundaries.value, boundaryInput.value.trim()]
    .sort()
  setTimepointBoundaries([...new Set(newBoundaries)])
  boundaryInput.value = ''
}

const removeBoundary = (index) => {
  const newBoundaries = [...timepointBoundaries.value]
  newBoundaries.splice(index, 1)
  setTimepointBoundaries(newBoundaries)
}

const handleAutoSuggest = () => {
  autoSuggestBoundaries(allRecords.value, boundaryStrategy.value)
}

// Selected values for dropdowns
const selectedDependentId = ref(null)
const selectedIndependentId = ref(null)
const selectedInteractionPair = ref(null)

// Handle dependent variable selection
watch(selectedDependentId, (newId) => {
  if (newId) {
    const concept = loadedConcepts.value.find(c => c.id === newId)
    setDependentVariable(concept)
  } else {
    setDependentVariable(null)
  }
})

// Handle adding independent concept
const handleAddIndependentConcept = () => {
  if (selectedIndependentId.value) {
    const concept = loadedConcepts.value.find(c => c.id === selectedIndependentId.value)
    addIndependentConcept(concept)
    selectedIndependentId.value = null
  }
}

// Handle adding interaction term
const handleAddInteraction = () => {
  if (selectedInteractionPair.value) {
    const [i, j] = selectedInteractionPair.value.split('-').map(Number)
    addInteractionTerm(i, j)
    selectedInteractionPair.value = null
  }
}

// Study hierarchy navigation
const loadChildren = (nodeId, node) => {
  const typeName = node?.__typename
  if (typeName === 'Program') {
    selectedProgram.value = nodeId
    selectedTrial.value = null
  } else if (typeName === 'Trial') {
    selectedTrial.value = nodeId
  }
}

const childrenLoading = computed(() => studiesLoading || trialsLoading || programsLoading)

const currentChildren = computed(() => {
  if (selectedProgram.value) {
    return selectedTrial.value ? studies : trials
  }
  return []
})

const hasChildren = (node) => {
  if (node.__typename === 'Study') return false
  if (node.__typename === 'Trial') return node.studies ? node.studies?.length > 0 : true
  if (node.__typename === 'Program') return node.trials ? node.trials?.length > 0 : true
  return false
}

const isSelectable = (node) => node.__typename === 'Study'

// Phase navigation
const goToModel = () => {
  if (canLoadModel.value) {
    phase.value = 'model'
  }
}

const backToSelection = () => {
  clearModel()
  selectedDependentId.value = null
  phase.value = 'selection'
}

const backToModel = () => {
  phase.value = 'model'
  analysisResults.value = null
  currentAnalysisId.value = null
}

// Submission state
const isSubmitting = ref(false)
const submissionError = ref(null)

const handleSubmit = async () => {
  if (!isModelValid.value) return

  isSubmitting.value = true
  submissionError.value = null
  analysisResults.value = null

  try {
    const config = exportModelConfig()
    console.log('Model config for submission:', config)
    const dataset_input = {
      datasetIds: datasets?.value.map(dataset => dataset.id),
      ...config
    }
    const analysisSubmission = await submitAnalysis(dataset_input)
    console.log('Analysis submitted with ID:', analysisSubmission.result)
    // Now poll for the result
    // Set the analysis ID to start polling via useQuery
    if (analysisSubmission.result) {
      currentAnalysisId.value = analysisSubmission.result
    } else {
      submissionError.value = analysisSubmission.errors
    }

  } catch (error) {
    console.error('Submission error:', error)
    submissionError.value = error.message || 'Failed to submit analysis'
    isSubmitting.value = false
  }
}


// Record count summary
const recordSummary = computed(() => {
  const total = allRecords.value.length
  const excluded = excludedRecords.value.length
  return {
    total,
    excluded,
    included: total - excluded
  }
})


// Results computed properties
const groupData = computed(() => {
  if (!analysisResults.value?.group) return []

  return analysisResults.value.group.map(g => ({
    label: g.group.map(gl => {
      const displayValue = gl.label === 'Germplasm' ? getGermplasmName(gl.level) : gl.level
      return `${gl.label}: ${displayValue}`
    }).join(', '),
    mean: g.mean,
    sd: g.sd,
    se: g.se,
    n: g.n,
    error: showSD.value ? g.sd : g.se
  }))
})

const groupingStructure = computed(() => {
  if (!analysisResults.value?.group) return { levels: [], colors: [] }

  // Extract unique levels for first and second grouping variables
  const firstVarLevels = new Set()
  const secondVarLevels = new Set()

  analysisResults.value.group.forEach(g => {
    if (g.group.length > 0) firstVarLevels.add(g.group[0].level)
    if (g.group.length > 1) secondVarLevels.add(g.group[1].level)
  })


  // Colorblind-friendly palette (works for deuteranopia, protanopia, and tritanopia)
  // Based on Paul Tol's colorblind-safe palette
  const colors = [
    '#0077BB', // blue
    '#EE7733', // orange
    '#009988', // teal/cyan
    '#CC3311', // red
    '#EE3377', // magenta
    '#BBBBBB', // gray
    '#33BBEE', // light blue
    '#AA3377', // purple
  ]

  return {
    firstVarLevels: Array.from(firstVarLevels),
    secondVarLevels: Array.from(secondVarLevels),
    colors
  }
})

const getBarColor = (index) => {
  if (!analysisResults.value?.group || !analysisResults.value.group[index]) return '#3b82f6'

  const group = analysisResults.value.group[index]

  if (!group || group.group.length === 0) return '#3b82f6'

  const firstLevel = group.group[0].level
  const levelIndex = groupingStructure.value.firstVarLevels.indexOf(firstLevel)
  return groupingStructure.value.colors[levelIndex % groupingStructure.value.colors.length]
}

const getBarPattern = (index) => {
  if (!analysisResults.value?.group || !analysisResults.value.group[index]) return null

  const group = analysisResults.value.group[index]

  if (!group || group.group.length < 2) return null

  const secondLevel = group.group[1].level
  const levelIndex = groupingStructure.value.secondVarLevels.indexOf(secondLevel)

  // Return pattern ID based on index
  const patterns = ['stripes', 'dots', 'grid', 'diagonal']
  return patterns[levelIndex % patterns.length]
}


const chartScale = computed(() => {
  if (groupData.value.length === 0) return { min: 0, max: 100, scale: 1 }

  // Find the maximum value including error bars
  const maxValue = Math.max(...groupData.value.map(item => item.mean + item.error))
  const minValue = 0 // Could also use Math.min(...groupData.value.map(item => Math.max(0, item.mean - item.error)))

  // Add 10% padding to the top
  const paddedMax = maxValue * 1.1

  const chartHeight = 300 // Leave room for labels
  const scale = chartHeight / paddedMax

  return { min: minValue, max: paddedMax, scale, chartHeight }
})


const anovaData = computed(() => {
  return analysisResults.value?.anova || []
})

const tukeyData = computed(() => {
  return analysisResults.value?.tukey || []
})

const formatGroupLabel = (group) => {
  return group.map(g => {
    const displayValue = g.label === 'Germplasm' ? getGermplasmName(g.level) : g.level
    return `${g.label}: ${displayValue}`
  }).join(', ')
}


</script>

<template>
  <div class="analysis-page">
    <div class="header">
      <h2>Analysis</h2>
      <div class="phase-indicator">
        <span :class="{ active: phase === 'selection' }">1. Select Data</span>
        <span class="separator">→</span>
        <span :class="{ active: phase === 'model' }">2. Build Model</span>
        <span class="separator">→</span>
        <span :class="{ active: phase === 'results' }">3. Results</span>
      </div>
    </div>

    <!-- Phase 1: Dataset Selection -->
    <div v-if="phase === 'selection'" class="phase-content selection-phase">
      <div class="section">
        <h3>Select Studies and Concepts</h3>
        <p class="help-text">
          Choose studies and concepts to include in your analysis. You can select multiple studies
          to combine data across experiments.
        </p>

        <FormKit
          v-model="selectionData"
          type="form"
          :actions="false"
        >
          <!-- Study Multi-Select -->
          <FormKit
            type="hierarchical-multiselect"
            name="studyIds"
            label="Studies:"
            help="Select one or more studies"
            :value="selectionData.studyIds"
            :selected-nodes="[]"
            :rootNodes="programs"
            :loadChildrenFn="loadChildren"
            :childrenLoading="childrenLoading"
            :currentChildren="currentChildren"
            :hasChildrenFn="hasChildren"
            :isSelectableFn="isSelectable"
            :get-node-label-fn="(node) => node.name || `${node.id}`"
            :max-selections="10"
            validation="required"
          />

          <!-- Concept Multi-Select -->
          <FormKit
            type="select"
            name="conceptIds"
            label="Concepts:"
            help="Select concepts (variables/factors) to include in analysis"
            :options="conceptOptions"
            :disabled="summariesLoading || conceptOptions.length === 0"
            multiple
            validation="required"
          />

          <p v-if="selectionData.studyIds.length > 0 && conceptOptions.length === 0 && !summariesLoading" class="no-data-msg">
            No datasets found for the selected studies.
          </p>
        </FormKit>
      </div>

      <div class="actions">
        <button
          class="btn btn-primary"
          :disabled="!canLoadModel || datasetsLoading"
          @click="goToModel"
        >
          {{ datasetsLoading ? 'Loading...' : 'Continue to Model Builder →' }}
        </button>
      </div>
    </div>

    <!-- Phase 2: Model Builder -->
    <div v-else-if="phase === 'model'" class="phase-content model-phase">
      <div class="model-layout">
        <!-- Left: Variable Selection -->
        <div class="model-section variables-section">
          <h3>Variable Selection</h3>

          <!-- Dependent Variable -->
          <div class="variable-group">
            <label class="group-label">Dependent Variable (Y)</label>
            <p class="help-text">Select the outcome variable to analyze (must be numerical)</p>

            <select v-model="selectedDependentId" class="form-select">
              <option :value="null">-- Select dependent variable --</option>
              <option v-for="opt in dependentVariableOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>

            <div v-if="dependentVariable" class="selected-item">
              <span class="badge badge-primary">{{ dependentVariable.label }}</span>
              <span class="treatment-tag">continuous</span>
            </div>
          </div>

          <!-- Independent Variables -->
          <div class="variable-group">
            <label class="group-label">Independent Variables (X)</label>
            <p class="help-text">Add factors that may influence the dependent variable</p>

            <!-- Add concept -->
            <div class="add-variable-row">
              <select v-model="selectedIndependentId" class="form-select">
                <option :value="null">-- Add concept --</option>
                <option v-for="opt in independentConceptOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <button
                class="btn btn-sm btn-secondary"
                :disabled="!selectedIndependentId"
                @click="handleAddIndependentConcept"
              >
                Add
              </button>
            </div>

            <!-- Built-in variables -->
            <div class="builtin-variables">
              <button
                class="btn btn-sm btn-outline"
                :disabled="!canAddGermplasm"
                @click="addGermplasmVariable"
              >
                + Germplasm
              </button>
              <button
                class="btn btn-sm btn-outline"
                :disabled="!canAddTimepoint"
                @click="addTimepointVariable"
              >
                + Timepoint
              </button>
            </div>

            <!-- Selected independent variables -->
            <div class="selected-variables">
              <div
                v-for="(variable, index) in independentVariables"
                :key="index"
                class="selected-item"
              >
                <span class="badge" :class="variable.type === 'concept' ? 'badge-info' : 'badge-secondary'">
                  {{ variable.label }}
                </span>
                <span class="treatment-tag">{{ variable.treatment }}</span>
                <button class="btn-remove" @click="removeIndependentVariable(index)">×</button>
              </div>
            </div>
          </div>

          <!-- Interaction Terms -->
          <div class="variable-group" v-if="independentVariables.length >= 2">
            <label class="group-label">Interaction Terms</label>
            <p class="help-text">Add interactions between independent variables</p>

            <div class="add-variable-row">
              <select v-model="selectedInteractionPair" class="form-select">
                <option :value="null">-- Select interaction --</option>
                <option v-for="opt in interactionOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <button
                class="btn btn-sm btn-secondary"
                :disabled="!selectedInteractionPair"
                @click="handleAddInteraction"
              >
                Add
              </button>
            </div>

            <div class="selected-variables">
              <div
                v-for="(term, index) in interactionTerms"
                :key="index"
                class="selected-item"
              >
                <span class="badge badge-warning">
                  {{ independentVariables[term.var1Index]?.label }} × {{ independentVariables[term.var2Index]?.label }}
                </span>
                <button class="btn-remove" @click="removeInteractionTerm(index)">×</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Timepoint Configuration & Formula -->
        <div class="model-section config-section">
          <!-- Timepoint Configuration (only if timepoint is selected) -->
          <div v-if="independentVariables.some(v => v.type === 'TIMEPOINT')" class="timepoint-config">
            <h3>Timepoint Configuration</h3>
            <p class="help-text">
              Define time boundaries to group records into timepoint bins.
              Format: YYYY, YYYY-MM, or YYYY-MM-DD
            </p>

            <!-- Auto-suggest -->
            <div class="auto-suggest-row">
              <select v-model="boundaryStrategy" class="form-select form-select-sm">
                <option value="year">By Year</option>
                <option value="month">By Month</option>
                <option value="quartile">By Quartile</option>
              </select>
              <button class="btn btn-sm btn-outline" @click="handleAutoSuggest">
                Auto-suggest Boundaries
              </button>
            </div>

            <!-- Manual boundary input -->
            <div class="boundary-input-row">
              <input
                v-model="boundaryInput"
                type="text"
                class="form-input"
                placeholder="e.g., 2010-06"
                @keyup.enter="addBoundary"
              />
              <button class="btn btn-sm btn-secondary" @click="addBoundary">
                Add Boundary
              </button>
            </div>

            <!-- Current boundaries -->
            <div v-if="timepointBoundaries.length > 0" class="boundaries-list">
              <label>Current Boundaries:</label>
              <div class="boundary-tags">
                <span
                  v-for="(boundary, index) in timepointBoundaries"
                  :key="index"
                  class="boundary-tag"
                >
                  {{ boundary }}
                  <button class="btn-remove-sm" @click="removeBoundary(index)">×</button>
                </span>
              </div>
            </div>

            <!-- Resulting bins preview -->
            <div class="bins-preview">
              <label>Resulting Bins:</label>
              <div class="bin-labels">
                <span v-for="(label, index) in timepointBinLabels" :key="index" class="bin-label">
                  {{ label }}
                </span>
              </div>
            </div>

            <!-- Warnings -->
            <div v-if="timepointWarnings.length > 0" class="warnings">
              <div v-for="(warning, index) in timepointWarnings" :key="index" class="warning-item">
                ⚠️ {{ warning }}
              </div>
            </div>
          </div>

          <!-- Model Formula Display -->
          <div class="formula-section">
            <h3>Model Formula</h3>
            <div class="formula-display" :class="{ valid: isModelValid }">
              <code>{{ modelFormula || 'Select variables to build model' }}</code>
            </div>
          </div>

          <!-- Data Summary -->
          <div class="data-summary">
            <h4>Data Summary</h4>
            <div class="summary-stats">
              <div class="stat">
                <span class="stat-value">{{ recordSummary.total }}</span>
                <span class="stat-label">Total Records</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ recordSummary.included }}</span>
                <span class="stat-label">Included</span>
              </div>
              <div v-if="recordSummary.excluded > 0" class="stat warning">
                <span class="stat-value">{{ recordSummary.excluded }}</span>
                <span class="stat-label">Excluded</span>
              </div>
            </div>
          </div>

          <!-- Model Warnings -->
          <div v-if="modelWarnings.length > 0" class="warnings">
            <h4>Warnings</h4>
            <div v-for="(warning, index) in modelWarnings" :key="index" class="warning-item">
              ⚠️ {{ warning }}
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions">
        <button class="btn btn-secondary" @click="backToSelection">
          ← Back to Selection
        </button>
        <button class="btn btn-outline" @click="clearModel">
          Clear Model
        </button>
        <button
          class="btn btn-primary"
          :disabled="!isModelValid || isSubmitting"
          @click="handleSubmit"
        >
          <span v-if="!currentAnalysisId">Submit Analysis →</span>
          <span v-else-if="analysisStatus === 'PENDING'">Submitting...</span>
          <span v-else-if="analysisStatus === 'PROCESSING'">Processing...</span>
          <span v-else>Submit Analysis →</span>
        </button>
      </div>

      <!-- Submission Error -->
      <div v-if="submissionError" class="error-message">
        {{ submissionError }}
      </div>
            <!-- Analysis Errors -->
      <div v-if="analysisErrors && analysisErrors.length > 0" class="error-message">
        <div v-for="(error, index) in analysisErrors" :key="index">
          {{ error.message || error }}
        </div>
      </div>

    </div>

    <!-- Phase 3: Results -->
    <div v-else-if="phase === 'results'" class="phase-content results-phase">
      <div class="results-header">
        <h3>Analysis Results</h3>
        <button class="btn btn-secondary" @click="backToModel">
          ← Back to Model
        </button>
      </div>

      <div v-if="analysisResults" class="results-content">
        <!-- Group Means Visualization -->
        <div class="results-section">
          <div class="section-header">
            <h4>Group Means</h4>
            <div class="toggle-group">
              <label>
                <input type="radio" :value="true" v-model="showSD" />
                Standard Deviation (SD)
              </label>
              <label>
                <input type="radio" :value="false" v-model="showSD" />
                Standard Error (SE)
              </label>
            </div>
          </div>

          <!-- Bar chart using SVG -->
          <div class="chart-container">
            <div class="chart-controls">
                <label for="bar-width-slider">Bar Width:</label>
                <input
                  id="bar-width-slider"
                  type="range"
                  v-model.number="barWidth"
                  min="20"
                  max="100"
                  step="5"
                  class="bar-width-slider"
                />
                <span class="slider-value">{{ barWidth }}px</span>
              </div>
            <div class="chart-scroll-wrapper">
              <svg
                  :width="chartWidth"
                  :height="chartHeight"
                  class="bar-chart"
                  :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
              >
                <!-- Define patterns for second grouping variable -->
                <defs>
                  <pattern id="stripes" patternUnits="userSpaceOnUse" width="8" height="8">
                    <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2"
                          stroke="white" stroke-width="2" opacity="0.5"/>
                  </pattern>
                  <pattern id="dots" patternUnits="userSpaceOnUse" width="8" height="8">
                    <circle cx="4" cy="4" r="2" fill="white" opacity="0.5"/>
                  </pattern>
                  <pattern id="grid" patternUnits="userSpaceOnUse" width="8" height="8">
                    <path d="M 0 0 L 8 0 M 0 0 L 0 8"
                          stroke="white" stroke-width="1" opacity="0.5"/>
                  </pattern>
                  <pattern id="diagonal" patternUnits="userSpaceOnUse" width="8" height="8">
                    <path d="M0,8 l8,-8 M-2,2 l4,-4 M6,10 l4,-4"
                          stroke="white" stroke-width="2" opacity="0.5"/>
                  </pattern>
                </defs>
                <!-- Chart title -->
                <text
                  :x="chartWidth / 2"
                  y="25"
                  text-anchor="middle"
                  font-size="16"
                  font-weight="600"
                  fill="#1e293b"
                >
                  {{ chartTitle }}
                </text>
                <!-- Y-axis gridlines and labels -->
                <g class="y-axis">
                  <line
                    :x1="leftMargin - 5"
                    :y1="baselineY"
                    :x2="leftMargin - 5"
                    y2="50"
                    stroke="#374151"
                    stroke-width="2"
                  />
                  <g v-for="tick in yAxisTicks" :key="tick.value">
                    <!-- Gridline -->
                    <line
                      :x1="leftMargin"
                      :y1="tick.y"
                      :x2="chartWidth - 20"
                      :y2="tick.y"
                      stroke="#e5e7eb"
                      stroke-width="1"
                      stroke-dasharray="4,4"
                    />
                    <!-- Tick mark -->
                    <line
                      :x1="leftMargin - 5"
                      :y1="tick.y"
                      :x2="leftMargin"
                      :y2="tick.y"
                      stroke="#374151"
                      stroke-width="2"
                    />
                    <!-- Label -->
                    <text
                      :x="leftMargin - 10"
                      :y="tick.y"
                      text-anchor="end"
                      alignment-baseline="middle"
                      font-size="11"
                      fill="#374151"
                    >
                      {{ tick.label }}
                    </text>
                  </g>
                </g>
                <!-- Y-axis label (rotated) -->
                <text
                  :x="15"
                  :y="(baselineY + 50) / 2"
                  text-anchor="middle"
                  font-size="12"
                  font-weight="600"
                  fill="#374151"
                  :transform="`rotate(-90, 15, ${(baselineY + 50) / 2})`"
                >
                  {{ yAxisLabel }}
                </text>

                <g v-for="(item, index) in groupData" :key="index">
                  <rect
                    :x="getBarX(index)"
                    :y="getBarY(item.mean)"
                    :width="barWidth"
                    :height="item.mean * chartScale.scale"
                    :fill="getBarColor(index)"
                    :style="{ fill: getBarColor(index) }"
                    opacity="0.9"
                  />
                  <!-- Add pattern overlay if second grouping exists -->
                  <rect
                    v-if="getBarPattern(index)"
                    :x="getBarX(index)"
                    :y="getBarY(item.mean)"
                    :width="barWidth"
                    :height="item.mean * chartScale.scale"
                    :fill="`url(#${getBarPattern(index)})`"
                  />
                  <!-- Error bars -->
                  <line
                    :x1="getBarCenterX(index)"
                    :y1="getBarY(item.mean + item.error)"
                    :x2="getBarCenterX(index)"
                    :y2="getBarY(item.mean - item.error)"
                    stroke="#1e293b"
                    stroke-width="2"
                  />
                  <!-- Top cap -->
                  <line
                    :x1="getBarCenterX(index) - 10"
                    :y1="getBarY(item.mean + item.error)"
                    :x2="getBarCenterX(index) + 10"
                    :y2="getBarY(item.mean + item.error)"
                    stroke="#1e293b"
                    stroke-width="2"
                  />
                  <!-- Bottom cap -->
                  <line
                    :x1="getBarCenterX(index) - 10"
                    :y1="getBarY(item.mean - item.error)"
                    :x2="getBarCenterX(index) + 10"
                    :y2="getBarY(item.mean - item.error)"
                    stroke="#1e293b"
                    stroke-width="2"
                  />
                  <!-- Label with line breaks and -45-degree rotation -->
                  <text
                    :x="getBarCenterX(index)"
                    y="365"
                    text-anchor="end"
                    font-size="10"
                    fill="#666"
                    :transform="`rotate(-45, ${getBarCenterX(index)}, 365)`"
                  >
                    <tspan
                      v-for="(part, partIndex) in item.label.split(', ')"
                      :key="partIndex"
                      :x="getBarCenterX(index)"
                      :dy="partIndex === 0 ? 0 : 12"
                    >
                      {{ part }}
                    </tspan>
                  </text>

                </g>
              </svg>
            </div>
            <!-- Legend -->
            <div class="chart-legend">
              <div v-if="groupingStructure.firstVarLevels.length > 0" class="legend-section">
                <span class="legend-title">{{ analysisResults.group[0]?.group[0]?.label || 'First Variable' }}:</span>
                <div class="legend-items">
                  <div v-for="(level, idx) in groupingStructure.firstVarLevels" :key="level" class="legend-item">
                    <div class="legend-color" :style="{ backgroundColor: groupingStructure.colors[idx % groupingStructure.colors.length] }"></div>
                    <span>{{ level }}</span>
                  </div>
                </div>
              </div>
              <div v-if="groupingStructure.secondVarLevels.length > 0" class="legend-section">
                <span class="legend-title">{{ analysisResults.group[0]?.group[1]?.label || 'Second Variable' }}:</span>
                <div class="legend-items">
                  <div v-for="(level, idx) in groupingStructure.secondVarLevels" :key="level" class="legend-item">
                    <svg width="20" height="20" class="legend-pattern">
                      <defs>
                        <pattern :id="`legend-${['stripes', 'dots', 'grid', 'diagonal'][idx % 4]}`"
                                 patternUnits="userSpaceOnUse" width="8" height="8">
                          <path v-if="idx % 4 === 0" d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2"
                                stroke="#333" stroke-width="2" opacity="0.5"/>
                          <circle v-else-if="idx % 4 === 1" cx="4" cy="4" r="2" fill="#333" opacity="0.5"/>
                          <path v-else-if="idx % 4 === 2" d="M 0 0 L 8 0 M 0 0 L 0 8"
                                stroke="#333" stroke-width="1" opacity="0.5"/>
                          <path v-else d="M0,8 l8,-8 M-2,2 l4,-4 M6,10 l4,-4"
                                stroke="#333" stroke-width="2" opacity="0.5"/>
                        </pattern>
                      </defs>
                      <rect width="20" height="20" fill="#999"/>
                      <rect width="20" height="20" :fill="`url(#legend-${['stripes', 'dots', 'grid', 'diagonal'][idx % 4]})`"/>
                    </svg>
                    <span>{{ level }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Group details table -->
          <div class="table-container">
            <table class="results-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Mean</th>
                  <th>SD</th>
                  <th>SE</th>
                  <th>n</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in analysisResults.group" :key="index">
                  <td>{{ formatGroupLabel(item.group) }}</td>
                  <td>{{ item.mean?.toFixed(3) || '-' }}</td>
                  <td>{{ item.sd?.toFixed(3) || '-' }}</td>
                  <td>{{ item.se?.toFixed(3) || '-' }}</td>
                  <td>{{ item.n }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ANOVA Results -->
        <div class="results-section">
          <h4>ANOVA Results</h4>
          <div class="table-container">
            <table class="results-table">
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Sum Sq</th>
                  <th>df</th>
                  <th>F Value</th>
                  <th>p Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in anovaData" :key="index">
                  <td><strong>{{ row.term }}</strong></td>
                  <td>{{ row.sumSq?.toFixed(4) || '-' }}</td>
                  <td>{{ row.df }}</td>
                  <td>{{ row.fValue?.toFixed(4) || '-' }}</td>
                  <td :class="{ 'significant': row.pValue < 0.05 }">
                    {{ row.pValue?.toFixed(6) || '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tukey HSD Results -->
        <div class="results-section">
          <h4>Tukey HSD Post-hoc Comparisons</h4>
          <div class="table-container">
            <table class="results-table">
              <thead>
                <tr>
                  <th>Group 1</th>
                  <th>Group 2</th>
                  <th>q Value</th>
                  <th>Lower CI</th>
                  <th>Upper CI</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in tukeyData" :key="index">
                  <td>{{ formatGroupLabel(row.group1) }}</td>
                  <td>{{ formatGroupLabel(row.group2) }}</td>
                  <td>{{ row.qval?.toFixed(4) || '-' }}</td>
                  <td>{{ row.lower?.toFixed(4) || '-' }}</td>
                  <td>{{ row.upper?.toFixed(4) || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-else class="no-results">
        <p>No results available.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analysis-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header h2 {
  margin: 0;
  color: #333;
}

.phase-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
}

.phase-indicator span.active {
  color: #2563eb;
  font-weight: 600;
}

.phase-indicator .separator {
  color: #ccc;
}

.phase-content {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section {
  margin-bottom: 24px;
}

.section h3 {
  margin: 0 0 8px;
  color: #333;
  font-size: 18px;
}

.help-text {
  color: #666;
  font-size: 14px;
  margin: 0 0 16px;
}

.no-data-msg {
  color: #666;
  font-style: italic;
  margin-top: 12px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}

/* Model Phase Layout */
.model-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}

@media (max-width: 900px) {
  .model-layout {
    grid-template-columns: 1fr;
  }
}

.model-section {
  background: #f9fafb;
  border-radius: 8px;
  padding: 20px;
}

.model-section h3 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #333;
}

.variable-group {
  margin-bottom: 24px;
}

.group-label {
  display: block;
  font-weight: 600;
  margin-bottom: 4px;
  color: #333;
}

.variable-group .help-text {
  margin-bottom: 12px;
}

.form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
}

.form-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.add-variable-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.add-variable-row .form-select {
  flex: 1;
}

.builtin-variables {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.selected-variables {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
}

.badge-primary { background: #dbeafe; color: #1d4ed8; }
.badge-secondary { background: #e5e7eb; color: #374151; }
.badge-info { background: #cffafe; color: #0891b2; }
.badge-warning { background: #fef3c7; color: #d97706; }

.treatment-tag {
  font-size: 11px;
  color: #6b7280;
  font-style: italic;
}

.btn-remove {
  background: none;
  border: none;
  font-size: 16px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0 4px;
}

.btn-remove:hover {
  color: #ef4444;
}

/* Timepoint Configuration */
.timepoint-config {
  margin-bottom: 24px;
}

.auto-suggest-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.auto-suggest-row .form-select {
  width: auto;
}

.boundary-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.boundaries-list {
  margin-bottom: 12px;
}

.boundaries-list label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.boundary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.boundary-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 4px;
  font-size: 13px;
}

.btn-remove-sm {
  background: none;
  border: none;
  font-size: 14px;
  color: #6366f1;
  cursor: pointer;
  padding: 0 2px;
}

.btn-remove-sm:hover {
  color: #ef4444;
}

.bins-preview {
  margin-top: 12px;
}

.bins-preview label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.bin-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bin-label {
  padding: 4px 10px;
  background: #ecfdf5;
  color: #047857;
  border-radius: 4px;
  font-size: 13px;
}

/* Formula Section */
.formula-section {
  margin-bottom: 24px;
}

.formula-display {
  padding: 16px;
  background: #1f2937;
  border-radius: 6px;
  overflow-x: auto;
}

.formula-display.valid {
  background: #064e3b;
}

.formula-display code {
  color: #f3f4f6;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 14px;
  white-space: nowrap;
}

/* Data Summary */
.data-summary h4 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #333;
}

.summary-stats {
  display: flex;
  gap: 24px;
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.stat-label {
  font-size: 12px;
  color: #666;
}

.stat.warning .stat-value {
  color: #d97706;
}

/* Warnings */
.warnings {
  margin-top: 16px;
}

.warnings h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #92400e;
}

.warning-item {
  padding: 8px 12px;
  background: #fef3c7;
  border-radius: 4px;
  font-size: 13px;
  color: #92400e;
  margin-bottom: 6px;
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
}

/* Results Phase */
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.results-header h3 {
  margin: 0;
}

.results-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.results-section {
  background: #f9fafb;
  border-radius: 8px;
  padding: 20px;
}

.results-section h4 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #333;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.toggle-group {
  display: flex;
  gap: 16px;
  font-size: 14px;
}

.toggle-group label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.chart-container {
  margin-bottom: 24px;
}


.chart-scroll-wrapper {
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
}


.bar-chart {
  display: block;
  min-width: 800px;
}


/* Add scrollbar styling */
.chart-scroll-wrapper::-webkit-scrollbar {
  height: 8px;
}

.chart-scroll-wrapper::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.chart-scroll-wrapper::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.chart-scroll-wrapper::-webkit-scrollbar-thumb:hover {
  background: #555;
}


.table-container {
  overflow-x: auto;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.results-table th {
  background: #f3f4f6;
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #d1d5db;
}

.results-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  color: #374151;
}

.results-table tr:hover {
  background: #f9fafb;
}

.results-table td.significant {
  color: #dc2626;
  font-weight: 600;
}

.no-results {
  text-align: center;
  padding: 48px;
  color: #666;
}

/* Buttons */
.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-outline {
  background: white;
  border: 1px solid #d1d5db;
  color: #374151;
}

.btn-outline:hover:not(:disabled) {
  background: #f9fafb;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}


.chart-legend {
  display: flex;
  gap: 32px;
  margin-top: 16px;
  padding: 16px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.legend-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-title {
  font-weight: 600;
  font-size: 13px;
  color: #374151;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #4b5563;
}

.legend-color {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: 1px solid #d1d5db;
}

.legend-pattern {
  border-radius: 3px;
  border: 1px solid #d1d5db;
}


</style>