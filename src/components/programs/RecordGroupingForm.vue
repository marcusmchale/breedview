<script setup>
import { ref, watch, computed } from 'vue'
import DatasetScopeManager from './DatasetScopeManager.vue'
import { RECORD_GROUP_EXTENT_DESCRIPTIONS, RECORD_GROUP_EXTENT_LABELS, extentLabel } from '@/composables/ontology/recordGroupExtent'
import { optionLabel, withCurrent } from '@/composables/ontology/ontologyLifecycles'

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
  extent: '',
  dataset_scopes: []
})

const errors = ref({})

// The extent the grouping was saved with, and whether the user has picked one (so the type's default doesn't replace it)
const savedExtent = ref(null)
const extentChosen = ref(false)

// Initialize from props
watch(
  () => props.grouping,
  (grouping) => {
    if (grouping) {
      // Extract typeId from type object if present, otherwise use typeId directly
      const groupingData = { ...grouping }
      delete groupingData.type
      delete groupingData.__typename
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
        extent: '',
        dataset_scopes: []
      }
    }
    savedExtent.value = grouping?.extent ?? null
    extentChosen.value = !!grouping?.extent
    errors.value = {}
  },
  { immediate: true }
)

const selectedType = computed(() =>
  props.recordGroupTypes.find((t) => t.id === formData.value.typeId) ?? null
)

// A new grouping starts with its type's default extent, until the user picks one
watch(selectedType, (type) => {
  if (!extentChosen.value && type?.defaultExtent) formData.value.extent = type.defaultExtent
})

const chooseExtent = () => {
  extentChosen.value = true
}

const extentChanged = computed(() => !!savedExtent.value && formData.value.extent !== savedExtent.value)

const isDatasetScoped = computed(() => formData.value.scope === 'DATASET_SCOPED')

const validateForm = () => {
  errors.value = {}

  if (!formData.value.name.trim()) {
    errors.value.name = 'Name is required'
  }

  if (!formData.value.typeId) {
    errors.value.typeId = 'Type is required'
  }

  if (!formData.value.extent) {
    errors.value.extent = 'Extent is required'
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
            v-for="type in withCurrent(recordGroupTypes, grouping?.type)"
            :key="type.id"
            :value="type.id"
          >
            {{ optionLabel(type) }}
          </option>
        </select>
        <span v-if="errors.typeId" class="error-text">{{ errors.typeId }}</span>
      </div>

      <div class="form-group">
        <label>Extent *</label>
        <div class="scope-options">
          <label v-for="(label, value) in RECORD_GROUP_EXTENT_LABELS" :key="value" class="radio-label">
            <input
              v-model="formData.extent"
              type="radio"
              :value="value"
              @change="chooseExtent"
            />
            <span>{{ label }}<template v-if="selectedType?.defaultExtent === value"> (the type's default)</template></span>
            <span class="help-text">{{ RECORD_GROUP_EXTENT_DESCRIPTIONS[value] }}</span>
          </label>
        </div>
        <span v-if="errors.extent" class="error-text">{{ errors.extent }}</span>
        <p v-if="formData.extent === 'WITHIN_UNIT'" class="extent-info">
          In analysis, combine them with a term's replicate aggregation, or keep each as an observation with a record group dimension.
        </p>
        <p v-if="extentChanged" class="extent-info">
          Changing from {{ extentLabel(savedExtent).toLowerCase() }} changes how analysis groups the codes of this grouping's records, not the records themselves.
        </p>
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
  border-color: var(--brand-accent);
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

/* .form-group label would make it a block with a bottom margin */
.form-group .radio-label {
  margin-bottom: 0;
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

.extent-info {
  margin: 8px 0 0;
  font-size: 0.85rem;
  color: #666;
}

.help-text {
  font-size: 0.85rem;
  color: #666;
}

.radio-label .help-text {
  display: block;
  margin: 4px 0 0 21px;
  font-weight: normal;
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
  background: var(--brand-accent);
  color: white;
}

.btn-primary:hover {
  background: var(--brand-accent-dark);
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