<script setup>
import { ref, computed, watch } from 'vue'
import { FormKit } from '@formkit/vue'

import { useSelectStudyQueries } from '@/composables/datasets/selectStudyQueries'
import { useDatasetSummariesMultiQuery } from '@/composables/datasets/datasetSummariesMultiQuery'
import { useDatasetsUnitsTree } from '@/composables/datasets/useDatasetsUnitsTree'
import { useCachedName } from '@/composables/queryBase/cachedName'
import { isPartialDatetime } from '@/plugins/formkitRules'
import { useProgramsTree } from '@/composables/programs/programsTreeQuery'
import { DEFAULT_UNITS_PAGE_SIZE } from '@/composables/datasets/useDatasetRecordPages'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  // studies chosen to start with, e.g. the study whose Curate button opened the selection
  initialStudyIds: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['load-table'])

const PAGE_SIZE_OPTIONS = [100, 250, 500, 1000, 2500, 5000].map((n) => ({ label: n.toLocaleString(), value: n }))
const DEFAULT_PAGE_SIZE = DEFAULT_UNITS_PAGE_SIZE

// Selection state
const selectedProgram = ref(null)
const selectedTrial = ref(null)
const emptySelection = () => ({
  studyIds: [...props.initialStudyIds],
  conceptIds: [],
  // narrowing of the records: units (with everything below them) and a time window
  unitIds: [],
  start: '',
  end: '',
  pageSize: DEFAULT_PAGE_SIZE
})
const selectionData = ref(emptySelection())

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
  summaries,
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

// Concept options for multiselect
const conceptOptions = computed(() => {
  return availableConcepts.value.map(concept => ({
    label: concept.name || `Concept ${concept.id}`,
    value: concept.id
  }))
})

// Summaries of the datasets the selection will load
const selectedSummaries = computed(() =>
  summaries.value.filter((s) => selectionData.value.conceptIds.includes(s.concept?.id))
)

// What the selected datasets hold, so the user can judge whether to narrow them
const datasetsHint = computed(() => {
  const list = selectedSummaries.value
  if (list.length === 0) return ''
  const records = list.reduce((n, s) => n + (s.record_count ?? 0), 0)
  const starts = list.map((s) => s.start).filter(Boolean).map(String).sort()
  const ends = list.map((s) => s.end).filter(Boolean).map(String).sort()
  const span = starts.length ? ` between ${starts[0]} and ${ends[ends.length - 1] ?? starts[starts.length - 1]}` : ''
  return `${list.length} dataset${list.length === 1 ? '' : 's'} with ${records.toLocaleString()} records${span}.`
})

// Units filter: only the units the selected datasets have records for, as a tree from their blocks down, under
// the time window once it is well formed (a half-typed date narrows nothing)
const selectedDatasetIds = computed(() => selectedSummaries.value.map((s) => s.id))
const windowFor = (value) => {
  const text = (value || '').trim()
  return isPartialDatetime(text) ? text : ''
}
const {
  rootNodes: unitRoots,
  rootsLoading: unitRootsLoading,
  children: displayedUnits,
  childrenLoading: displayedUnitsLoading,
  loadChildren: loadDisplayedChildUnits,
  hasChildren: unitHasChildren,
  loadTypeGroups: loadUnitTypeGroups,
  nodeLabel: unitLabel
} = useDatasetsUnitsTree({
  datasetIds: selectedDatasetIds,
  start: () => windowFor(selectionData.value.start),
  end: () => windowFor(selectionData.value.end)
})

// With no datasets selected there are no units to narrow to
watch(selectedDatasetIds, (ids) => {
  if (selectionData.value.unitIds.length > 0 && ids.length === 0) selectionData.value.unitIds = []
})

const unitNameOf = useCachedName('Unit')

// Everything below a program or a trial, or every trial and study, for selecting all studies at once
const { loadStudyGroups } = useProgramsTree()
const studyNameOf = useCachedName('Study')

// Can proceed to table
const canLoadTable = computed(() => {
  return selectionData.value.studyIds.length > 0 &&
         selectionData.value.conceptIds.length > 0
})

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

const childrenLoading = computed(() => !!(studiesLoading.value || trialsLoading.value || programsLoading.value))

const currentChildren = computed(() => {
  if (selectedProgram.value) {
    return (selectedTrial.value ? studies.value : trials.value) ?? []
  }
  return []
})

const hasChildren = (node) => {
  if (node.__typename === 'Study') {
    return false
  } else if (node.__typename === 'Trial') {
    return node.studies ? node.studies?.length > 0 : true
  } else if (node.__typename === 'Program') {
    return node.trials ? node.trials?.length > 0 : true
  }
  console.error("unrecognised typename to hasChildren")
  return false
}

const isSelectable = (node) => {
  return node.__typename === 'Study'
}

// Load table
const handleLoadTable = () => {
  if (canLoadTable.value) {
    const datasetIds = getDatasetIdsForConcepts(selectionData.value.conceptIds)
    const datasetStudyIds = Object.fromEntries(
      summaries.value
        .filter((s) => datasetIds.includes(s.id))
        .map((s) => [s.id, s._studyId])
    )
    const { unitIds, start, end, pageSize } = selectionData.value
    emit('load-table', {
      datasetIds,
      datasetStudyIds,
      filters: {
        unitIds: [...unitIds],
        start: (start || '').trim(),
        end: (end || '').trim()
      },
      pageSize: Number(pageSize) || DEFAULT_PAGE_SIZE
    })
  }
}

// Reset form (exposed for parent to call)
const reset = () => {
  selectionData.value = emptySelection()
  selectedProgram.value = null
  selectedTrial.value = null
}

defineExpose({ reset })
</script>

<template>
  <div class="selection-form">
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
        :label-fn="studyNameOf"
        :rootNodes="programs"
        :loadChildrenFn="loadChildren"
        :childrenLoading="childrenLoading"
        :currentChildren="currentChildren"
        :hasChildrenFn="hasChildren"
        :isSelectableFn="isSelectable"
        :load-type-groups-fn="loadStudyGroups"
        :get-node-label-fn="(node) => node.name || `${node.id}`"
        :max-selections="10"
        validation="required"
      />

      <!-- Concept Multi-Select -->
      <FormKit
        type="select"
        name="conceptIds"
        label="Concepts:"
        help="Select concepts to display (based on available datasets)"
        :options="conceptOptions"
        :disabled="summariesLoading || conceptOptions.length === 0"
        multiple
        validation="required"
      />

      <p v-if="selectionData.studyIds.length > 0 && conceptOptions.length === 0 && !summariesLoading" class="no-concepts-msg">
        No datasets found for the selected studies.
      </p>

      <!-- Narrowing of the records, shown once datasets are selected -->
      <fieldset v-if="selectedSummaries.length > 0" class="record-filters">
        <legend>Records</legend>
        <p class="datasets-hint">{{ datasetsHint }}</p>

        <div class="window-inputs">
          <FormKit
            type="text"
            name="start"
            label="From:"
            placeholder="e.g. 2015 or 2015-03-01"
            help="Records whose period ends on or after this time"
            validation="partialDatetime"
            :validation-messages="{ partialDatetime: 'Use YYYY, YYYY-MM, YYYY-MM-DD or YYYY-MM-DDTHH:MM' }"
          />
          <FormKit
            type="text"
            name="end"
            label="To:"
            placeholder="e.g. 2015-12-31"
            help="Records whose period starts on or before this time"
            validation="partialDatetime"
            :validation-messages="{ partialDatetime: 'Use YYYY, YYYY-MM, YYYY-MM-DD or YYYY-MM-DDTHH:MM' }"
          />
        </div>

        <FormKit
          type="hierarchical-multiselect"
          name="unitIds"
          label="Units:"
          :help="unitRootsLoading ? 'Loading the units of these datasets…' : 'Optional: only records of these units and of everything below them (a block or a plot selects what it contains); only units with records in these datasets are listed'"
          :value="selectionData.unitIds"
          :label-fn="unitNameOf"
          :rootNodes="unitRoots"
          :loadChildrenFn="loadDisplayedChildUnits"
          :childrenLoading="displayedUnitsLoading"
          :currentChildren="displayedUnits"
          :hasChildrenFn="unitHasChildren"
          :get-node-label-fn="unitLabel"
          :load-type-groups-fn="loadUnitTypeGroups"
        />

        <FormKit
          type="select"
          name="pageSize"
          label="Units per page:"
          help="Each page holds every record of its units, from every dataset; larger pages take longer to load"
          :options="PAGE_SIZE_OPTIONS"
        />
      </fieldset>
    </FormKit>

    <div class="selection-actions">
      <button
        class="btn btn-primary"
        :disabled="!canLoadTable || loading"
        @click="handleLoadTable"
      >
        {{ loading ? 'Loading...' : 'Load Table' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.selection-form {
  max-width: 600px;
  margin: 0 auto;
}

.selection-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

.no-concepts-msg {
  color: #666;
  font-style: italic;
  margin-top: 12px;
}

.record-filters {
  margin-top: 16px;
  padding: 12px 16px 4px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}

.record-filters legend {
  padding: 0 6px;
  font-weight: 600;
  color: #333;
}

.datasets-hint {
  margin: 0 0 12px;
  color: #555;
  font-size: 13px;
}

.window-inputs {
  display: flex;
  gap: 16px;
}

.window-inputs > * {
  flex: 1;
}

.btn {
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
}
</style>
