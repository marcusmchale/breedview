<script setup>
import { ref, computed } from 'vue'

import { useDatasetSummariesQuery } from '@/composables/datasets/datasetSummariesQuery'

import DatasetScopeCard from './DatasetScopeCard.vue'
import DatasetScopeForm from './DatasetScopeForm.vue'

const props = defineProps({
  scopes: { type: Array, required: true },
  studyId: { type: [String, Number], required: true }
})

const emit = defineEmits(['update'])

const { datasetSummaries, summariesLoading } = useDatasetSummariesQuery(() => props.studyId)

const showAddScope = ref(false)

// A dataset can only belong to one scope per grouping
const assignedDatasetIds = computed(() =>
  props.scopes.flatMap((s) => s.datasetIds || [])
)

const handleRemoveScope = (index) => {
  emit('update', props.scopes.filter((_, i) => i !== index))
}

const handleConfirmAddScope = (datasetIds) => {
  emit('update', [...props.scopes, { datasetIds }])
  showAddScope.value = false
}
</script>

<template>
  <div class="scope-manager">
    <div v-if="scopes.length === 0" class="empty-scopes">
      No dataset scopes configured yet. You can configure scopes now, or during dataset submission.
    </div>

    <div v-else class="scopes-list">
      <DatasetScopeCard
        v-for="(scope, index) in scopes"
        :key="(scope.datasetIds || []).join('-') || index"
        :scope="scope"
        :index="index"
        :summaries="datasetSummaries"
        @remove="handleRemoveScope(index)"
      />
    </div>

    <button
      v-if="!showAddScope"
      type="button"
      class="btn-add-scope"
      @click="showAddScope = true"
    >
      + Add Scope
    </button>

    <DatasetScopeForm
      v-else
      :summaries="datasetSummaries"
      :loading="summariesLoading"
      :excluded-dataset-ids="assignedDatasetIds"
      @confirm="handleConfirmAddScope"
      @cancel="showAddScope = false"
    />
  </div>
</template>

<style scoped>
.scope-manager {
  padding: 12px;
  background: #f9f9f9;
  border-radius: 4px;
}

.empty-scopes {
  padding: 12px;
  color: #666;
  font-size: 0.9rem;
}

.scopes-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.btn-add-scope {
  width: 100%;
  padding: 10px;
  background: white;
  border: 1px dashed var(--brand-accent);
  border-radius: 4px;
  color: var(--brand-accent);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-add-scope:hover {
  background: var(--brand-accent-light);
  border-style: solid;
}
</style>