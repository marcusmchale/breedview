<script setup>
import { ref, computed, watch } from 'vue'
import { FormKit } from '@formkit/vue'

import { useSelectStudyQueries } from '@/composables/datasets/selectStudyQueries'
import { useDatasetSummariesMultiQuery } from '@/composables/datasets/datasetSummariesMultiQuery'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['load-table'])

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

// Concept options for multiselect
const conceptOptions = computed(() => {
  return availableConcepts.value.map(concept => ({
    label: concept.name || `Concept ${concept.id}`,
    value: concept.id
  }))
})

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

const childrenLoading = computed(() => studiesLoading || trialsLoading || programsLoading)

const currentChildren = computed(() => {
  if (selectedProgram.value) {
    return selectedTrial.value ? studies : trials
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
    emit('load-table', {
      studyIds: selectionData.value.studyIds,
      conceptIds: selectionData.value.conceptIds,
      datasetIds
    })
  }
}

// Reset form (exposed for parent to call)
const reset = () => {
  selectionData.value = { studyIds: [], conceptIds: [] }
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
        help="Select concepts to display (based on available datasets)"
        :options="conceptOptions"
        :disabled="summariesLoading || conceptOptions.length === 0"
        multiple
        validation="required"
      />

      <p v-if="selectionData.studyIds.length > 0 && conceptOptions.length === 0 && !summariesLoading" class="no-concepts-msg">
        No datasets found for the selected studies.
      </p>
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