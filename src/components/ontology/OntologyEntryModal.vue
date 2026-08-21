<script setup>
import { ref, computed, watch } from 'vue'

import ReferencesModal from "@/components/references/ReferencesModal.vue";
import { REFERENCE_TYPE_GROUPS } from "@/composables/references/referenceTypes";

const props = defineProps({
  config: {
    type: Object,
    required: true
  },
  ontologyEntries: {
    type: Array,
    default: () => []
  },
  entry: {
    type: Object,
    default: null
  },
  controlTeamId: {
    type: String,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'deprecate', 'cancelDeprecate', 'close'])

const isUpdateMode = computed(() => props.entry !== null)
const title = computed(() =>
  isUpdateMode.value ? props.config.updateTitle : props.config.createTitle
)

// ── Form data ─────────────────────────────────────────────────────────────────
const formData = ref({})
const controlTeamId = ref(props.controlTeamId)
const controlTeamError = ref(null)

// Tracks selection order for `ordered` multiselect fields: { [fieldName]: string[] }
const selectionOrders = ref({})

const initFormData = () => {
  const data = {}
  const orders = {}
  for (const field of props.config.fields) {
    if (field.type === 'axesBuilder') {
      data[field.name] = isUpdateMode.value
        ? [...(props.entry?.[field.name] ?? [])]
        : []
      continue
    }
    if (isUpdateMode.value && props.entry) {
      const entry = props.entry
      if (field.type === 'multiselect') {
        const rel = entry[field.name]
        let ids
        if (Array.isArray(rel)) {
          ids = [...rel]
        } else {
          const relArr = entry[field.entryKey] ?? []
          ids = Array.isArray(relArr) ? relArr.map(r => r.id) : []
        }
        data[field.name] = ids
        if (field.ordered) {
          orders[field.name] = [...ids]
        }
      } else if (field.type === 'singleselect') {
        const relKey = field.name.replace(/Id$/, '')
        data[field.name] = entry[relKey]?.id ?? entry[field.name] ?? null
      } else {
        data[field.name] = entry[field.name] ?? ''
      }
    } else {
      data[field.name] = field.type === 'multiselect' ? [] : ''
      if (field.ordered) {
        orders[field.name] = []
      }
    }
  }
  formData.value = data
  selectionOrders.value = orders
}

watch(() => [props.config, props.entry], initFormData, { immediate: true })

// ── Ordered multiselect change handler ───────────────────────────────────────
const handleMultiselectChange = (field, newSelectedIds) => {
  const ids = Array.isArray(newSelectedIds) ? newSelectedIds : []
  const prev = selectionOrders.value[field.name] ?? []
  // Keep existing order, remove deselected
  const filtered = prev.filter(id => ids.includes(id))
  // Append newly selected in the order they appear
  for (const id of ids) {
    if (!filtered.includes(id)) filtered.push(id)
  }
  selectionOrders.value[field.name] = filtered
  // Rewrite formData to match the preserved order
  formData.value[field.name] = [...filtered]
}

// ── Axes builder ──────────────────────────────────────────────────────────────
const addAxis = (fieldName, value) => {
  if (!Array.isArray(formData.value[fieldName])) {
    formData.value[fieldName] = []
  }
  formData.value[fieldName].push(value)
}

const removeAxis = (fieldName, index) => {
  formData.value[fieldName].splice(index, 1)
}

const getAxisLabel = (options, value) => {
  return options.find(o => o.value === value)?.label ?? value
}

// ── References ────────────────────────────────────────────────────────────────
const showReferencesModal = ref(false)
const selectedReferenceIds = ref([])
const selectedReferences = ref([])

const initReferences = () => {
  if (isUpdateMode.value && props.entry?.references) {
    selectedReferences.value = [...props.entry.references]
    selectedReferenceIds.value = props.entry.references.map(r => r.id)
  } else {
    selectedReferences.value = []
    selectedReferenceIds.value = []
  }
}

watch(() => [props.config, props.entry], initReferences, { immediate: true })

const handleReferencesSave = ({ referenceIds, references }) => {
  selectedReferenceIds.value = referenceIds
  selectedReferences.value = references
}

const removeReference = (id) => {
  selectedReferenceIds.value = selectedReferenceIds.value.filter(r => r !== id)
  selectedReferences.value = selectedReferences.value.filter(r => r.id !== id)
}

// ── Select options ────────────────────────────────────────────────────────────
const getMultiselectOptions = (field) => {
  const currentEntryId = props.entry?.id
  const options = props.ontologyEntries
    .filter(e => {
      if (e.__typename !== field.sourceType) return false
      if (field.excludeSelf && e.id === currentEntryId) return false
      return true
    })
    .map(e => ({ label: e.name, value: e.id }))

  if (field.ordered) {
    const order = selectionOrders.value[field.name] ?? []
    return options.sort((a, b) => {
      const aIdx = order.indexOf(a.value)
      const bIdx = order.indexOf(b.value)
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx   // both selected: by selection order
      if (aIdx !== -1) return -1                            // only a selected: a first
      if (bIdx !== -1) return 1                             // only b selected: b first
      return a.label.localeCompare(b.label)                 // neither: alphabetical
    })
  }

  return options.sort((a, b) => {
    const aSelected = formData.value[field.name]?.includes(a.value) ? -1 : 1
    const bSelected = formData.value[field.name]?.includes(b.value) ? -1 : 1
    return aSelected - bSelected
  })
}

const getSingleselectOptions = (field) => {
  const options = props.ontologyEntries
    .filter(e => e.__typename === field.sourceType)
    .map(e => ({ label: e.name, value: e.id }))
  return [{label:"", value: null}, ...options]
}

// ── Dynamic field label ───────────────────────────────────────────────────────
const getFieldLabel = (field) => {
  if (typeof field.labelFn === 'function') {
    return field.labelFn(formData.value)
  }
  return field.label
}

// ── Submit ────────────────────────────────────────────────────────────────────
const handleSubmit = () => {
  // For ordered fields, ensure submitted array respects selection order
  const data = { ...formData.value }
  for (const field of props.config.fields) {
    if (field.type === 'multiselect' && field.ordered) {
      const order = selectionOrders.value[field.name] ?? []
      const selected = new Set(data[field.name] ?? [])
      data[field.name] = order.filter(id => selected.has(id))
    }
  }
  emit('submit', {
    formData: data,
    referenceIds: selectedReferenceIds.value,
    controlTeamId: controlTeamId.value
  })
}

// ── Deprecate / Cancel ────────────────────────────────────────────────────────
const phase = computed(() => props.entry?.phase ?? null)
const canDeprecate = computed(() => isUpdateMode.value && ['DRAFT', 'ACTIVE'].includes(phase.value))
const canCancelDeprecate = computed(() => isUpdateMode.value && phase.value === 'DEPRECATED')
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal-container">

        <!-- Header -->
        <div class="modal-header">
          <h2>{{ title }}</h2>
          <button class="close-btn" @click="emit('close')">&times;</button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <FormKit
            type="form"
            :actions="false"
            v-model="formData"
            @submit="handleSubmit"
          >
            <!-- Rendered fields -->
            <template v-for="field in config.fields" :key="field.name">

              <!-- Axes builder -->
              <div v-if="field.type === 'axesBuilder'" class="axes-builder-field">
                <label class="field-label">{{ field.label }}</label>
                <div class="add-buttons">
                  <button
                    v-for="option in field.options"
                    :key="option.value"
                    type="button"
                    class="add-axis-btn"
                    @click="addAxis(field.name, option.value)"
                  >
                    + {{ option.label }}
                  </button>
                </div>
                <div v-if="formData[field.name]?.length" class="axes-list">
                  <div
                    v-for="(axis, idx) in formData[field.name]"
                    :key="`${axis}-${idx}`"
                    class="axis-item"
                    @click="removeAxis(field.name, idx)"
                    title="Click to remove"
                  >
                    <span class="axis-index">{{ idx + 1 }}.</span>
                    <span class="axis-label">{{ getAxisLabel(field.options, axis) }}</span>
                    <span class="axis-remove">×</span>
                  </div>
                </div>
                <div v-else class="empty-axes">
                  Click buttons above to add axes in order
                </div>
                <!-- Hidden FormKit node so v-model captures the value -->
                <FormKit type="hidden" :name="field.name" />
              </div>

              <!-- Enum select -->
              <FormKit
                v-else-if="field.type === 'enumselect'"
                type="select"
                :name="field.name"
                :label="field.label"
                :validation="field.validation"
                :options="field.options"
              />

              <!-- Ordered multiselect (selection-order preserved) -->
              <FormKit
                v-else-if="field.type === 'multiselect' && field.ordered"
                type="select"
                :name="field.name"
                :label="getFieldLabel(field)"
                multiple
                :options="getMultiselectOptions(field)"
                @input="(val) => handleMultiselectChange(field, val)"
              />

              <!-- Standard multiselect -->
              <FormKit
                v-else-if="field.type === 'multiselect'"
                type="select"
                :name="field.name"
                :label="field.label"
                multiple
                :options="getMultiselectOptions(field)"
              />

              <!-- Singleselect -->
              <FormKit
                v-else-if="field.type === 'singleselect'"
                type="select"
                :name="field.name"
                :label="field.label"
                :validation="field.validation"
                :options="getSingleselectOptions(field)"
              />

              <!-- Text / textarea -->
              <FormKit
                v-else
                :type="field.type"
                :name="field.name"
                :label="field.label"
                :validation="field.validation"
                :placeholder="field.placeholder"
              />
            </template>

            <!-- References section -->
            <div class="references-section">
              <div class="references-header">
                <h3>External References</h3>
                <button type="button" class="btn btn-secondary btn-sm" @click="showReferencesModal = true">
                  Manage References
                </button>
              </div>
              <div v-if="selectedReferences.length" class="reference-list">
                <div
                  v-for="ref in selectedReferences"
                  :key="ref.id"
                  class="reference-chip"
                >
                  <a :href="ref?.url" target="_blank" class="reference-url">{{ ref.url }}</a>
                  <span v-if="ref.externalId" class="reference-externalId">: {{ ref.externalId }}</span>
                  <button
                    type="button"
                    class="remove-ref-btn"
                    @click="removeReference(ref.id)"
                    title="Remove"
                  >×</button>
                </div>
              </div>
              <p v-else class="no-references">No references selected.</p>
            </div>

            <!-- Footer actions -->
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" :disabled="loading">
                {{ loading ? 'Saving…' : isUpdateMode ? 'Update' : 'Create' }}
              </button>
              <button type="button" class="btn btn-secondary" @click="emit('close')" :disabled="loading">
                Cancel
              </button>
              <button
                v-if="canDeprecate"
                type="button"
                class="btn btn-danger"
                :disabled="loading"
                @click="emit('deprecate', entry.id)"
              >
                Deprecate
              </button>
              <button
                v-if="canCancelDeprecate"
                type="button"
                class="btn btn-primary"
                :disabled="loading"
                @click="emit('cancelDeprecate', entry.id)"
              >
                Cancel Deprecation
              </button>
            </div>
          </FormKit>
        </div>
      </div>
    </div>

    <ReferencesModal
      :visible="showReferencesModal"
      :selected-reference-ids="selectedReferenceIds"
      :initial-references="selectedReferences"
      :reference-types="REFERENCE_TYPE_GROUPS.EXTERNAL"
      @save="handleReferencesSave"
      @close="showReferencesModal = false"
    />
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 8px;
  width: 90vw;
  max-width: 640px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 4px 8px;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.form-group {
  margin-bottom: 1rem;
}

.field-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: #374151;
  font-size: 0.875rem;
}

.field-error {
  color: #dc2626;
  font-size: 0.8rem;
  margin-top: 0.25rem;
}

/* Axes builder */
.axes-builder-field {
  margin-bottom: 1.25rem;
}

.add-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.add-axis-btn {
  padding: 0.4rem 0.8rem;
  border: 2px solid #4caf50;
  background: white;
  color: #4caf50;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.add-axis-btn:hover {
  background: #4caf50;
  color: white;
}

.axes-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.75rem;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.axis-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.axis-item:hover {
  background: #fee;
  border-color: #f44336;
}

.axis-index {
  font-weight: bold;
  color: #666;
  min-width: 1.5rem;
}

.axis-label {
  flex: 1;
}

.axis-remove {
  font-size: 1.25rem;
  color: #f44336;
  opacity: 0.5;
}

.axis-item:hover .axis-remove {
  opacity: 1;
}

.empty-axes {
  padding: 1.5rem;
  text-align: center;
  color: #999;
  font-style: italic;
  background: #f9f9f9;
  border: 2px dashed #ddd;
  border-radius: 4px;
}

/* References */
.references-section {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fafafa;
}

.references-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.references-header h3 {
  margin: 0;
  font-size: 0.95rem;
  color: #374151;
}

.reference-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.reference-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.reference-url {
  font-weight: 500;
  color: #2563eb;
  word-break: break-all;
}

.reference-externalId {
  color: #6b7280;
  font-size: 0.8rem;
}

.remove-ref-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #9ca3af;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.remove-ref-btn:hover {
  color: #ef4444;
}

.no-references {
  color: #9ca3af;
  font-style: italic;
  font-size: 0.875rem;
  margin: 0;
}

/* Form actions */
.form-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #4caf50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #45a049;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) {
  background: #eee;
}

.btn-danger {
  background: #ff6b6b;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #ee5252;
}

.btn-sm {
  padding: 0.35rem 0.7rem;
  font-size: 0.8rem;
}
</style>