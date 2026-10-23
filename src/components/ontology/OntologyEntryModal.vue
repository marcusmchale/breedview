<script setup>
import { ref, computed, watch } from 'vue'

import ReferencesModal from "@/components/references/ReferencesModal.vue";
import LifecyclePanel from '@/components/ontology/LifecyclePanel.vue'
import { isLockedField } from '@/composables/ontology/ontologyEntryConfig'
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
  // the ontology's relationships, for the entries deprecated or restored with this one
  ontologyRelationships: {
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
  // ontology admins may lock and unlock entries
  canLock: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  // what the API refused, as it says
  error: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['submit', 'deprecate', 'cancelDeprecate', 'lock', 'unlock', 'close'])

const isUpdateMode = computed(() => props.entry !== null)
const title = computed(() =>
  isUpdateMode.value ? props.config.updateTitle : props.config.createTitle
)

// ── Form data ─────────────────────────────────────────────────────────────────
const formData = ref({})
const controlTeamId = ref(props.controlTeamId)

// A scale's categories, edited here rather than as FormKit inputs and added to the form data on submit:
// { [fieldName]: { name, description }[] }
const categoryRows = ref({})

const initFormData = () => {
  const data = {}
  const rows = {}
  for (const field of props.config.fields) {
    if (field.type === 'categoriesBuilder') {
      rows[field.name] = (isUpdateMode.value ? props.entry?.[field.name] ?? [] : [])
        .map(({ name, description }) => ({ name, description: description ?? '' }))
      continue
    }
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
      } else if (field.type === 'singleselect') {
        const relKey = field.name.replace(/Id$/, '')
        data[field.name] = entry[relKey]?.id ?? entry[field.name] ?? null
      } else {
        data[field.name] = entry[field.name] ?? ''
      }
    } else {
      data[field.name] = field.type === 'multiselect' ? [] : ''
    }
  }
  formData.value = data
  categoryRows.value = rows
}

watch(() => [props.config, props.entry], initFormData, { immediate: true })

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

// ── Categories builder ────────────────────────────────────────────────────────
const addCategory = (fieldName) => {
  categoryRows.value[fieldName].push({ name: '', description: '' })
}

const removeCategory = (fieldName, index) => {
  categoryRows.value[fieldName].splice(index, 1)
}

const moveCategory = (fieldName, index, step) => {
  const rows = categoryRows.value[fieldName]
  const [row] = rows.splice(index, 1)
  rows.splice(index + step, 0, row)
}

// A field shown only for some values of the others, as a scale's categories for nominal and ordinal scales
const isShown = (field) => typeof field.showFn !== 'function' || field.showFn(formData.value)

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
  const data = { ...formData.value }
  for (const field of props.config.fields) {
    if (field.type === 'categoriesBuilder') {
      data[field.name] = categoryRows.value[field.name].map(row => ({ ...row }))
    }
  }
  emit('submit', {
    formData: data,
    referenceIds: selectedReferenceIds.value,
    controlTeamId: controlTeamId.value
  })
}

// ── Deprecate / Cancel ────────────────────────────────────────────────────────
// 'deprecate' or 'cancel', confirmed in a panel listing the entries that go with it
const lifecycleAction = ref(null)
watch(() => props.entry, () => { lifecycleAction.value = null })
const phase = computed(() => props.entry?.phase ?? null)
const canDeprecate = computed(() => isUpdateMode.value && ['DRAFT', 'ACTIVE'].includes(phase.value))
const canCancelDeprecate = computed(() => isUpdateMode.value && phase.value === 'DEPRECATED')
const lifecycleOntology = computed(() => ({ entries: props.ontologyEntries, relationships: props.ontologyRelationships }))
const confirmLifecycle = (ids) => emit(lifecycleAction.value === 'deprecate' ? 'deprecate' : 'cancelDeprecate', ids)

// ── Locked entries ────────────────────────────────────────────────────────────
const isLocked = computed(() => isUpdateMode.value && !!props.entry?.locked)
const lockedOut = (field) => isLocked.value && isLockedField(props.config, field)
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
            <p v-if="isLocked" class="locked-note">
              🔒 This entry is locked: its name, description, source, defining relationships and a scale's categories
              can't change, and it can't be deprecated. Its synonyms, references, parents, children and terms stay
              editable.
            </p>

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
                    :disabled="lockedOut(field)"
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

              <!-- Categories builder: a scale's categories in order, each a name, as records hold it, and what it means -->
              <div v-else-if="field.type === 'categoriesBuilder'" v-show="isShown(field)" class="categories-builder-field">
                <label class="field-label">{{ getFieldLabel(field) }}</label>
                <div v-if="categoryRows[field.name]?.length" class="axes-list">
                  <div v-for="(category, idx) in categoryRows[field.name]" :key="idx" class="category-row">
                    <span class="axis-index">{{ idx + 1 }}.</span>
                    <input
                      v-model="category.name"
                      class="category-name"
                      placeholder="Name"
                      :aria-label="`Name of category ${idx + 1}`"
                      :disabled="lockedOut(field)"
                    />
                    <input
                      v-model="category.description"
                      class="category-description"
                      placeholder="What it means on this scale (optional)"
                      :aria-label="`Description of category ${idx + 1}`"
                      :disabled="lockedOut(field)"
                    />
                    <button
                      type="button" class="category-btn" title="Move up"
                      :disabled="lockedOut(field) || idx === 0"
                      @click="moveCategory(field.name, idx, -1)"
                    >↑</button>
                    <button
                      type="button" class="category-btn" title="Move down"
                      :disabled="lockedOut(field) || idx === categoryRows[field.name].length - 1"
                      @click="moveCategory(field.name, idx, 1)"
                    >↓</button>
                    <button
                      type="button" class="category-btn category-remove" title="Remove"
                      :disabled="lockedOut(field)"
                      @click="removeCategory(field.name, idx)"
                    >×</button>
                  </div>
                </div>
                <div v-else class="empty-axes">No categories yet</div>
                <button type="button" class="add-axis-btn" :disabled="lockedOut(field)" @click="addCategory(field.name)">
                  + Category
                </button>
                <p v-if="field.help" class="category-help">{{ field.help }}</p>
              </div>

              <!-- Enum select -->
              <FormKit
                v-else-if="field.type === 'enumselect'"
                :disabled="lockedOut(field)"
                type="select"
                :name="field.name"
                :label="field.label"
                :validation="field.validation"
                :options="field.options"
                :help="field.help"
              />

              <!-- Standard multiselect -->
              <FormKit
                v-else-if="field.type === 'multiselect'"
                :disabled="lockedOut(field)"
                type="select"
                :name="field.name"
                :label="field.label"
                multiple
                :options="getMultiselectOptions(field)"
              />

              <!-- Singleselect -->
              <FormKit
                v-else-if="field.type === 'singleselect'"
                :disabled="lockedOut(field)"
                type="select"
                :name="field.name"
                :label="field.label"
                :validation="field.validation"
                :options="getSingleselectOptions(field)"
              />

              <!-- Text / textarea -->
              <FormKit
                v-else
                :disabled="lockedOut(field)"
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
              <p class="references-help">Public references only, as the ontology is shared.</p>
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
                :disabled="loading || isLocked || !!lifecycleAction"
                :title="isLocked ? 'A locked entry cannot be deprecated' : ''"
                @click="lifecycleAction = 'deprecate'"
              >
                Deprecate
              </button>
              <button
                v-if="canCancelDeprecate"
                type="button"
                class="btn btn-primary"
                :disabled="loading || !!lifecycleAction"
                @click="lifecycleAction = 'cancel'"
              >
                Cancel Deprecation
              </button>
              <button
                v-if="isUpdateMode && canLock"
                type="button"
                class="btn btn-secondary"
                :disabled="loading"
                @click="emit(isLocked ? 'unlock' : 'lock', entry.id)"
              >
                {{ isLocked ? 'Unlock' : 'Lock' }}
              </button>
            </div>

            <LifecyclePanel
              v-if="lifecycleAction"
              :entry="entry"
              :ontology="lifecycleOntology"
              :action="lifecycleAction"
              :loading="loading"
              @confirm="confirmLifecycle"
              @back="lifecycleAction = null"
            />

            <div v-if="error" class="error-message">{{ error }}</div>
          </FormKit>
        </div>
      </div>
    </div>

    <ReferencesModal
      :visible="showReferencesModal"
      :selected-reference-ids="selectedReferenceIds"
      :initial-references="selectedReferences"
      :reference-types="REFERENCE_TYPE_GROUPS.EXTERNAL"
      public-only
      notice="The ontology is shared, so the references it cites must be public."
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

/* Categories builder */
.categories-builder-field {
  margin-bottom: 1.25rem;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.category-row input {
  padding: 0.35rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.875rem;
  min-width: 0;
}

.category-name {
  flex: 0 1 10rem;
}

.category-description {
  flex: 1 1 auto;
}

.category-btn {
  padding: 0.2rem 0.5rem;
  border: 1px solid #ddd;
  background: #f5f5f5;
  border-radius: 4px;
  cursor: pointer;
}

.category-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.category-remove {
  color: #f44336;
}

.category-help {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: #666;
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

.references-help {
  color: #6b7280;
  font-size: 0.8rem;
  margin: 0.5rem 0 0;
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

.locked-note {
  margin: 0 0 16px;
  padding: 10px 12px;
  background: #fff8e1;
  border: 1px solid #ffe082;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #6d4c00;
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