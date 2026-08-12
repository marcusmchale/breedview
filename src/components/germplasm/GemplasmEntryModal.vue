
<script setup>
import { computed, ref, watch } from 'vue'
import { FormKit } from '@formkit/vue'

import { useMutateEntries } from '@/composables/germplasm/mutateEntries'
import ControlSelector from '@/components/controls/ControlSelector.vue'
import ReferencesModal from '@/components/references/ReferencesModal.vue'

import { useOntologyEntriesQuery } from '@/composables/ontology/ontologyEntriesQuery'
import { useRegionsQuery } from '@/composables/regions/regionsQuery'
import { useLocationsLazyQuery } from '@/composables/regions/locationsLazyQuery'
import { useLocationQuery } from '@/composables/regions/locationQuery'

import { REFERENCE_TYPE_GROUPS } from '@/composables/references/referenceTypes'

const props = defineProps({
  entry: {
    type: Object,
    default: null
  },
  availableEntries: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['close', 'success'])

const isUpdateMode = computed(() => props.entry !== null)
const title = computed(() => isUpdateMode.value ? 'Update Germplasm Entry' : 'Create Germplasm Entry')
const isLoading = computed(() => isUpdateMode.value ? updateEntryLoading.value : createEntryLoading.value)

const { createEntry, createEntryLoading, updateEntry, updateEntryLoading } = useMutateEntries()

// ── Ontology: control methods ──────────────────────────────────────────────────
const { entries: publishedControlMethods } = useOntologyEntriesQuery({ labels: ['CONTROL_METHOD'], view: 'PUBLISHED' })

// In update mode, the entry already carries its linked controlMethods resolved at REFERENTIAL view.
// We prepend those to the published list so deprecated-but-linked methods remain selectable,
// then deduplicate by id so methods available in PUBLISHED only appear once.
const controlMethodOptions = computed(() => {
  const existingMethods = isUpdateMode.value
    ? (props.entry?.data?.controlMethods ?? [])
    : []
  const publishedIds = new Set(publishedControlMethods.value?.map(m => m.id) ?? [])
  // Existing entries that are NOT already in the published list (i.e. referential-only)
  const referentialOnly = existingMethods.filter(m => !publishedIds.has(m.id))
  const combined = [...referentialOnly, ...(publishedControlMethods.value ?? [])]
  return combined.map(m => ({ value: m.id, label: m.name }))
})


// ── References ─────────────────────────────────────────────────────────────────
const showReferencesModal = ref(false)
const selectedReferenceIds = ref([])
const selectedReferences = ref([])

const handleReferencesSave = ({ referenceIds, references }) => {
  selectedReferenceIds.value = referenceIds
  selectedReferences.value = references
}

const removeReference = (id) => {
  selectedReferenceIds.value = selectedReferenceIds.value.filter(r => r !== id)
  selectedReferences.value = selectedReferences.value.filter(r => r.id !== id)
}

// ── Form state ─────────────────────────────────────────────────────────────────
const formData = ref({
  name: '',
  description: '',
  synonyms: '',
  time: '',
  reproduction: '',
  controlMethodIds: [],
  originId: null
})


// ── Location hierarchical select ───────────────────────────────────────────────

const { location: selectedOrigin } = useLocationQuery(() => formData.value.originId || null)

const {
  regions,
  loadChildLocations,
  childLocationsLoading,
  currentChildLocations
} = (() => {
  const { regions } = useRegionsQuery()
  const { locations: currentChildLocations, locationsLoading: childLocationsLoading, loadChildLocations } = useLocationsLazyQuery()
  return { regions, loadChildLocations, childLocationsLoading, currentChildLocations }
})()

const sources = ref([])
const sinks = ref([])
const formError = ref('')
const selectedControlTeamId = ref(null)
const selectedRelease = ref(null)

const sourceTypes = ['UNKNOWN', 'SEED', 'TISSUE', 'MATERNAL', 'PATERNAL']
const reproductionOptions = [
  { value: '', label: '— None —' },
  { value: 'CLONAL', label: 'Clonal' },
  { value: 'SEXUAL', label: 'Sexual' },
  { value: 'APOMIXIS', label: 'Apomixis' }
]

// ── Initialise form when entry prop changes (update mode) ──────────────────────
watch(() => props.entry, (entry) => {
  if (!entry) return

  const data = entry.data

  selectedReferenceIds.value = data.references?.map(r => r.id) ?? []
  selectedReferences.value = data.references ?? []

  formData.value = {
    name: data.name ?? '',
    description: data.description ?? '',
    synonyms: data.synonyms ? data.synonyms.join(', ') : '',
    time: data.time ?? '',
    reproduction: data.reproduction ?? '',
    controlMethodIds: data.controlMethods?.map(m => m.id) ?? [],
    originId: data.origin?.id ?? null
  }

  sources.value = (data.sources ?? []).map(rel => ({
    sourceId: rel.source.id,
    sourceType: rel.sourceType ?? 'UNKNOWN',
    description: rel.description ?? ''
  }))

  sinks.value = (data.sinks ?? []).map(rel => ({
    sinkId: rel.sink.id,
    sourceType: rel.sourceType ?? 'UNKNOWN',
    description: rel.description ?? ''
  }))
}, { immediate: true })

// ── Sources / sinks helpers ────────────────────────────────────────────────────
const addSource = () => sources.value.push({ sourceId: null, sourceType: 'UNKNOWN', description: '' })
const removeSource = (index) => sources.value.splice(index, 1)
const addSink = () => sinks.value.push({ sinkId: null, sourceType: 'UNKNOWN', description: '' })
const removeSink = (index) => sinks.value.splice(index, 1)

const handleControlTeamError = (errorMessage) => { formError.value = errorMessage }

// ── Submit ─────────────────────────────────────────────────────────────────────
const submitForm = async () => {
  formError.value = ''

  try {
    const synonyms = formData.value.synonyms
      ? formData.value.synonyms.split(',').map(s => s.trim()).filter(s => s)
      : []

    const validSources = sources.value
      .filter(s => s.sourceId !== null)
      .map(s => ({ sourceId: s.sourceId, sourceType: s.sourceType, description: s.description || null }))

    const validSinks = sinks.value
      .filter(s => s.sinkId !== null)
      .map(s => ({ sinkId: s.sinkId, sourceType: s.sourceType, description: s.description || null }))

    if (isUpdateMode.value) {
      const entry = {
        id: props.entry.data.id,
        name: formData.value.name || null,
        description: formData.value.description || null,
        synonyms: synonyms.length > 0 ? synonyms : null,
        originId: formData.value.originId || null,
        time: formData.value.time || null,
        reproduction: formData.value.reproduction || null,
        controlMethodIds: formData.value.controlMethodIds || null,
        referenceIds: selectedReferenceIds.value || null,
        sources: validSources.length > 0 ? validSources : null,
        sinks: validSinks.length > 0 ? validSinks : null
      }

      const { status, errors } = await updateEntry(entry)

      if (status === 'SUCCESS') {
        console.log('update success', entry)
        emit('success', {
          entryId: entry.id,
          sourceIds: validSources.map(s => s.sourceId),
          sinkIds: validSinks.map(s => s.sinkId)
        })
      } else {
        formError.value = errors?.[0]?.message || 'Failed to update entry'
      }
    } else {
      const entry = {
        name: formData.value.name,
        description: formData.value.description || null,
        synonyms: synonyms.length > 0 ? synonyms : null,
        originId: formData.value.originId || null,
        time: formData.value.time || null,
        reproduction: formData.value.reproduction || null,
        controlMethodIds: formData.value.controlMethodIds?.length > 0 ? formData.value.controlMethodIds : null,
        referenceIds: selectedReferenceIds.value.length > 0 ? selectedReferenceIds.value : [],
        sources: validSources.length > 0 ? validSources : null,
        sinks: validSinks.length > 0 ? validSinks : null
      }

      const { status, errors } = await createEntry({
        entryData: entry,
        controlTeamId: selectedControlTeamId,
        release: selectedRelease
      })

      if (status === 'SUCCESS') {
        emit('success', {
          entryName: formData.value.name,
          sourceIds: validSources.map(s => s.sourceId),
          sinkIds: validSinks.map(s => s.sinkId)
        })
      } else {
        formError.value = errors?.[0]?.message || 'Failed to create entry'
      }
    }
  } catch (err) {
    console.error('Error submitting germplasm entry:', err)
    formError.value = err.message || 'An unexpected error occurred'
  }
}
</script>

<template>
  <div class="modal" @click.stop>
    <div class="modal-header">
      <h2>{{ title }}</h2>
      <button @click="$emit('close')" class="modal-close">&times;</button>
    </div>

    <div class="modal-content">
      <div v-if="formError" class="error-message">
        {{ formError }}
      </div>

      <FormKit
        type="form"
        v-model="formData"
        @submit="submitForm"
        :actions="false"
      >
        <FormKit
          type="text"
          name="name"
          label="Name"
          validation="required"
          placeholder="Enter germplasm name"
        />

        <FormKit
          type="textarea"
          name="description"
          label="Description"
          placeholder="Enter description"
          :input-attrs="{ rows: 3 }"
        />

        <FormKit
          type="text"
          name="synonyms"
          label="Synonyms (comma-separated)"
          placeholder="Enter synonyms"
          help="Separate multiple synonyms with commas"
        />

        <!-- Origin location hierarchical select (outside FormKit v-model scope) -->
        <FormKit
          type="hierarchical-select"
          name="originId"
          label="Origin Location (optional):"
          help="Select the place of origin"
          :selected="selectedOrigin"
          :rootNodes="regions"
          :loadChildrenFn="loadChildLocations"
          :childrenLoading="childLocationsLoading"
          :currentChildren="currentChildLocations"
          :exclude-node-id="null"
          :get-node-label-fn="(loc) => loc.name || `${loc.type?.name} ${loc.id}`"
        />

        <FormKit
          type="text"
          name="time"
          label="Time (optional):"
          help="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
          validation="partialDateTime"
          placeholder="e.g. 2024-01"
        />

        <FormKit
          type="select"
          name="reproduction"
          label="Reproduction (optional):"
          :options="reproductionOptions"
        />

        <FormKit
          type="select"
          multiple
          name="controlMethodIds"
          label="Control Methods (optional):"
          placeholder="Select control methods"
          :options="controlMethodOptions"
        />

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
              <a :href="ref.url" target="_blank" class="reference-url">{{ ref.url }}</a>
              <span v-if="ref.externalId" class="reference-external-id">: {{ ref.externalId }}</span>
              <button
                type="button"
                class="remove-ref-btn"
                @click="removeReference(ref.id)"
                title="Remove"
              >&times;</button>
            </div>
          </div>
          <p v-else class="no-references">No references selected.</p>
        </div>

        <!-- Sources Section -->
        <div class="relationships-section">
          <div class="section-header">
            <h3>Sources</h3>
            <button type="button" @click="addSource" class="btn btn-small btn-primary">
              + Add Source
            </button>
          </div>

          <div
            v-for="(source, index) in sources"
            :key="'source-' + index"
            class="relationship-item"
          >
            <div class="relationship-header">
              <h4>Source {{ index + 1 }}</h4>
              <button type="button" @click="removeSource(index)" class="btn btn-small btn-danger">
                Remove
              </button>
            </div>
            <div class="relationship-fields">
              <div class="form-group">
                <label>Source Entry *</label>
                <select v-model="source.sourceId" class="form-select">
                  <option :value="null">Select a germplasm entry...</option>
                  <option v-for="e in availableEntries" :key="e.id" :value="e.id">
                    {{ e.name }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Source Type *</label>
                <select v-model="source.sourceType" class="form-select">
                  <option v-for="type in sourceTypes" :key="type" :value="type">{{ type }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Description</label>
                <input v-model="source.description" type="text" class="form-input" placeholder="Optional description" />
              </div>
            </div>
          </div>

          <div v-if="sources.length === 0" class="empty-state">No sources added yet.</div>
        </div>

        <!-- Sinks Section -->
        <div class="relationships-section">
          <div class="section-header">
            <h3>Sinks</h3>
            <button type="button" @click="addSink" class="btn btn-small btn-primary">
              + Add Sink
            </button>
          </div>

          <div
            v-for="(sink, index) in sinks"
            :key="'sink-' + index"
            class="relationship-item"
          >
            <div class="relationship-header">
              <h4>Sink {{ index + 1 }}</h4>
              <button type="button" @click="removeSink(index)" class="btn btn-small btn-danger">
                Remove
              </button>
            </div>
            <div class="relationship-fields">
              <div class="form-group">
                <label>Sink Entry *</label>
                <select v-model="sink.sinkId" class="form-select">
                  <option :value="null">Select a germplasm entry...</option>
                  <option v-for="e in availableEntries" :key="e.id" :value="e.id">
                    {{ e.name }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Source Type *</label>
                <select v-model="sink.sourceType" class="form-select">
                  <option v-for="type in sourceTypes" :key="type" :value="type">{{ type }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Description</label>
                <input v-model="sink.description" type="text" class="form-input" placeholder="Optional description" />
              </div>
            </div>
          </div>

          <div v-if="sinks.length === 0" class="empty-state">No sinks added yet.</div>
        </div>

        <div class="form-actions">
          <ControlSelector
            v-if="!isUpdateMode"
            v-model:controlTeamId="selectedControlTeamId"
            v-model:readRelease="selectedRelease"
            class="form-control-selector"
            @error="handleControlTeamError"
          />
          <button type="submit" class="btn btn-primary" :disabled="isLoading">
            {{ isLoading ? (isUpdateMode ? 'Updating...' : 'Creating...') : (isUpdateMode ? 'Update Entry' : 'Create Entry') }}
          </button>
          <button type="button" @click="$emit('close')" class="btn btn-secondary">
            Cancel
          </button>
        </div>
      </FormKit>
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
</template>

<style scoped>
.modal {
  background: white;
  border-radius: 8px;
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 10px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  font-size: 1.5rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: #333;
}

.modal-content {
  padding: 20px;
}

.error-message {
  color: #d32f2f;
  background-color: #ffebee;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
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

.reference-external-id {
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

/* Relationships */
.relationships-section {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1.2rem;
}

.relationship-item {
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.relationship-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.relationship-header h4 {
  margin: 0;
  font-size: 1rem;
}

.relationship-fields {
  display: grid;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.form-select,
.form-input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.empty-state {
  text-align: center;
  padding: 1rem;
  color: #999;
  font-style: italic;
}

/* Actions */
.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
  align-items: flex-end;
  flex-wrap: wrap;
}

.form-control-selector {
  flex: 1;
  min-width: 0;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-primary {
  background-color: #4CAF50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #45a049;
}

.btn-primary:disabled {
  background-color: #a5d6a7;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn-sm {
  padding: 0.35rem 0.7rem;
  font-size: 0.8rem;
}

.btn-small {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>