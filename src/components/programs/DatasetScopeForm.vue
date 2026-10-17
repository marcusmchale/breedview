<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  summaries: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  // Datasets already assigned to another scope of this grouping
  excludedDatasetIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['confirm', 'cancel'])

const selectedDatasetIds = ref([])
const error = ref('')

const excluded = computed(() => new Set(props.excludedDatasetIds.map(String)))

const availableSummaries = computed(() =>
  props.summaries.filter((s) => !excluded.value.has(String(s.id)))
)

const isSelected = (id) => selectedDatasetIds.value.some((x) => String(x) === String(id))

const toggle = (id, checked) => {
  selectedDatasetIds.value = checked
    ? [...selectedDatasetIds.value, id]
    : selectedDatasetIds.value.filter((x) => String(x) !== String(id))
  error.value = ''
}

const formatNames = (items) => (items || []).map((i) => i.name).filter(Boolean).join(', ')

const handleConfirm = () => {
  if (selectedDatasetIds.value.length === 0) {
    error.value = 'Select at least one dataset'
    return
  }
  emit('confirm', [...selectedDatasetIds.value])
  selectedDatasetIds.value = []
}

const handleCancel = () => {
  selectedDatasetIds.value = []
  error.value = ''
  emit('cancel')
}
</script>

<template>
  <div class="scope-form">
    <p class="form-help">
      Select the datasets that share this scope. Records in these datasets with the same group code
      are treated as the same group.
    </p>

    <div v-if="loading" class="state">Loading datasets...</div>

    <div v-else-if="summaries.length === 0" class="state">
      This study has no datasets yet. Scopes can also be created during dataset submission.
    </div>

    <div v-else-if="availableSummaries.length === 0" class="state">
      All datasets in this study are already assigned to a scope.
    </div>

    <div v-else class="dataset-list">
      <label
        v-for="ds in availableSummaries"
        :key="ds.id"
        class="dataset-option"
        :class="{ selected: isSelected(ds.id) }"
      >
        <input
          type="checkbox"
          :checked="isSelected(ds.id)"
          @change="toggle(ds.id, $event.target.checked)"
        />
        <div class="dataset-details">
          <div class="dataset-title">
            {{ ds.concept?.name || 'Unknown concept' }}
            <span class="dataset-id">#{{ ds.id }}</span>
          </div>
          <div class="dataset-meta">
            {{ ds.unit_count ?? '—' }} units, {{ ds.record_count ?? '—' }} records
            <template v-if="ds.start || ds.end">
              · {{ ds.start || '?' }} to {{ ds.end || '?' }}
            </template>
          </div>
          <div v-if="ds.locations?.length" class="dataset-meta">
            Locations: {{ formatNames(ds.locations) }}
          </div>
          <div v-if="ds.unitRoots?.length" class="dataset-meta">
            Blocks: {{ formatNames(ds.unitRoots) }}
          </div>
        </div>
      </label>
    </div>

    <span v-if="error" class="error-text">{{ error }}</span>

    <div class="form-actions">
      <button type="button" class="btn-secondary" @click="handleCancel">Cancel</button>
      <button
        type="button"
        class="btn-primary"
        :disabled="loading || availableSummaries.length === 0"
        @click="handleConfirm"
      >
        Add Scope ({{ selectedDatasetIds.length }})
      </button>
    </div>
  </div>
</template>

<style scoped>
.scope-form {
  padding: 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-top: 12px;
}

.form-help {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  color: #666;
}

.state {
  padding: 12px;
  color: #666;
  font-size: 0.9rem;
  font-style: italic;
}

.dataset-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.dataset-option {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.dataset-option:hover { background: #f5f5f5; }
.dataset-option.selected { background: #e3f2fd; border-color: #90caf9; }

.dataset-option input { margin-top: 3px; }

.dataset-title {
  font-weight: 500;
  color: #333;
  font-size: 0.9rem;
}

.dataset-id {
  color: #999;
  font-weight: normal;
  font-size: 0.8rem;
  margin-left: 4px;
}

.dataset-meta {
  font-size: 0.8rem;
  color: #666;
}

.error-text {
  display: block;
  margin-top: 8px;
  color: #f44336;
  font-size: 0.85rem;
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

.btn-primary,
.btn-secondary {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}
</style>