<script setup>
import { ref, watch, computed } from 'vue'
import DatasetScopeManager from './DatasetScopeManager.vue'

const props = defineProps({
  grouping: {
    type: Object,
    default: null
  },
  recordGroupTypes: {
    type: Array,
    required: true
  },
  studyId: {
    type: [String, Number],
    required: true
  }
})

const emit = defineEmits(['save', 'cancel'])

// Form state
const formData = ref({
  name: '',
  typeId: '',
  scope: 'STUDY_WIDE',
  dataset_scopes: []
})

const errors = ref({})

// Initialize from props
watch(
  () => props.grouping,
  (grouping) => {
    if (grouping) {
      // Extract typeId from type object if present, otherwise use typeId directly
      const { type, __typename, ...groupingData } = grouping
      const typeId = grouping.typeId || (grouping.type?.id)
      formData.value = {
        ...groupingData,
        typeId: typeId
      }
    } else {
      formData.value = {
        name: '',
        typeId: '',
        scope: 'STUDY_WIDE',
        dataset_scopes: []
      }
    }
    errors.value = {}
  },
  { immediate: true }
)

const isDatasetScoped = computed(() => formData.value.scope === 'DATASET_SCOPED')

const validateForm = () => {
  errors.value = {}

  if (!formData.value.name.trim()) {
    errors.value.name = 'Name is required'
  }

  if (!formData.value.typeId) {
    errors.value.typeId = 'Type is required'
  }

  return Object.keys(errors.value).length === 0
}

const handleSave = () => {
  if (validateForm()) {
    const isScoped = formData.value.scope === 'DATASET_SCOPED'
    emit('save', {
      ...formData.value,
      // Strip Apollo __typename and only send scopes for DATASET_SCOPED groupings
      dataset_scopes: isScoped
        ? (formData.value.dataset_scopes || [])
            .map(({ datasetIds }) => ({ datasetIds: [...(datasetIds || [])] }))
            .filter((s) => s.datasetIds.length > 0)
        : []
    })
  }
}

const handleCancel = () => {
  emit('cancel')
}

const handleScopesUpdate = (scopes) => {
  formData.value.dataset_scopes = scopes
}
</script>

<template>
  <form class="grouping-form" @submit.prevent="handleSave">
    <div class="form-section">
      <div class="form-group">
        <label for="name">Name *</label>
        <input
          id="name"
          v-model="formData.name"
          type="text"
          placeholder="e.g., Replicates, Batches, Plates"
          :class="{ error: errors.name }"
        />
        <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
      </div>

      <div class="form-group">
        <label for="typeId">Record Group Type *</label>
        <select
          id="typeId"
          v-model="formData.typeId"
          :class="{ error: errors.typeId }"
        >
          <option value="">-- Select Type --</option>
          <option
            v-for="type in recordGroupTypes"
            :key="type.id"
            :value="type.id"
          >
            {{ type.name }}
          </option>
        </select>
        <span v-if="errors.typeId" class="error-text">{{ errors.typeId }}</span>
      </div>

      <div class="form-group">
        <label>Scope *</label>
        <div class="scope-options">
          <label class="radio-label">
            <input
              v-model="formData.scope"
              type="radio"
              value="STUDY_WIDE"
            />
            <span>Study-wide</span>
            <span class="help-text">All records in the study share this grouping</span>
          </label>
          <label class="radio-label">
            <input
              v-model="formData.scope"
              type="radio"
              value="DATASET_SCOPED"
            />
            <span>Dataset-scoped</span>
            <span class="help-text">Each dataset can have separate grouping values</span>
          </label>
        </div>
      </div>
    </div>

    <div v-if="isDatasetScoped" class="form-section">
      <h4>Configure Dataset Scopes (Optional)</h4>
      <p class="section-help">Optionally predefine which datasets belong to specific scopes. You can also configure this later.</p>
      <DatasetScopeManager
        :scopes="formData.dataset_scopes"
        :study-id="studyId"
        @update="handleScopesUpdate"
      />
    </div>

    <div class="form-actions">
      <button type="button" class="btn-secondary" @click="handleCancel">
        Cancel
      </button>
      <button type="submit" class="btn-primary">
        {{ grouping ? 'Update' : 'Create' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.grouping-form {
  padding: 24px;
}

.form-section {
  margin-bottom: 24px;
}

.form-section h4 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: #333;
}

.section-help {
  margin: 0 0 16px 0;
  font-size: 0.9rem;
  color: #666;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
  font-size: 0.95rem;
}

.form-group input[type="text"],
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.form-group input[type="text"]:focus,
.form-group select:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
}

.form-group input.error,
.form-group select.error {
  border-color: #f44336;
  background: #ffebee;
}

.error-text {
  display: block;
  margin-top: 4px;
  color: #f44336;
  font-size: 0.85rem;
}

.scope-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.radio-label:hover {
  background: #f5f5f5;
}

.radio-label input[type="radio"] {
  margin-right: 8px;
  cursor: pointer;
}

.radio-label span:first-of-type {
  font-weight: 500;
  color: #333;
}

.help-text {
  font-size: 0.85rem;
  color: #666;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:hover {
  background: #1976d2;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background: #eee;
}
</style>