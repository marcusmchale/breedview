<script setup>
import {computed, ref} from 'vue'
import { FormKit } from '@formkit/vue'

import { useMutateEntries } from '@/composables/germplasm/mutateEntries'
import ControlSelector from '@/components/controls/ControlSelector.vue'

import { useOntologyEntriesQuery } from "@/composables/ontology/ontologyEntriesQuery";

const props = defineProps({
  availableEntries: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['close', 'success'])

const { createEntry, createEntryLoading } = useMutateEntries()

//todo use an enum for views rather than strings, put it somewhere convenient for import.

const {
    entries: controlMethods
} = useOntologyEntriesQuery({labels: ['CONTROL_METHOD'], view: "PUBLISHED"})

const controlMethodOptions = computed( () => {
   return [
       ...controlMethods.value?.map(method => ({ value: method.id, label: method.name }))
   ] || []
})


const formData = ref({
  name: '',
  description: '',
  synonyms: '',
  controlMethodIds: []
})

const sources = ref([])
const formError = ref('')
const selectedControlTeamId = ref(null)
const selectedRelease = ref(null)

// Source types for dropdown
const sourceTypes = [
  'UNKNOWN',
  'SEED',
  'TISSUE',
  'MATERNAL',
  'PATERNAL'
]

const handleControlTeamError = (errorMessage) => {
  formError.value = errorMessage
}

const addSource = () => {
  sources.value.push({
    sourceId: null,
    sourceType: 'UNKNOWN',
    description: ''
  })
}

const removeSource = (index) => {
  sources.value.splice(index, 1)
}


const submitForm = async () => {
  formError.value = ''

  try {
    // Parse synonyms from comma-separated string
    const synonyms = formData.value.synonyms
      ? formData.value.synonyms.split(',').map(s => s.trim()).filter(s => s)
      : []
    const entry = {
      name: formData.value.name,
      description: formData.value.description || null,
      synonyms: synonyms.length > 0 ? synonyms : null,
      controlMethodIds: formData.value.controlMethods || null
    }
    console.log('creating entry', entry)
    // Add sources if any are defined
    if (sources.value.length > 0) {
      const validSources = sources.value
        .filter(s => s.sourceId !== null)
        .map(s => ({
          sourceId: s.sourceId,
          sourceType: s.sourceType,
          description: s.description || null
        }))
      if (validSources.length > 0) {
        entry.sources = validSources
      }
    }

    const { status, errors } = await createEntry({
      entryData: entry,
      controlTeamId: selectedControlTeamId,
      release: selectedRelease
    })

    if (status === 'SUCCESS') {
      emit('success', {
        entryName: formData.value.name,
        sourceIds: entry.sources?.map(s => s.sourceId) || []
      })
    } else {
      formError.value = errors?.[0]?.message || 'Failed to create entry'
    }
  } catch (err) {
    console.error('Error creating entry:', err)
    formError.value = err.message || 'An error occurred while creating the entry'
  }
}
</script>

<template>
  <div class="modal" @click.stop>
    <div class="modal-header">
      <h2>Create Germplasm Entry</h2>
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

        <FormKit
          type="select"
          multiple
          name="controlMethods"
          label="Control Methods:"
          placeholder="Select Control Methods"
          :options="controlMethodOptions"
        />

        <!-- Sources Section -->
        <div class="relationships-section">
          <div class="section-header">
            <h3>Sources</h3>
            <button
              type="button"
              @click="addSource"
              class="btn btn-small btn-primary"
            >
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
              <button
                type="button"
                @click="removeSource(index)"
                class="btn btn-small btn-danger"
              >
                Remove
              </button>
            </div>

            <div class="relationship-fields">
              <div class="form-group">
                <label>Source Entry *</label>
                <select v-model="source.sourceId" class="form-select">
                  <option :value="null">Select a germplasm entry...</option>
                  <option
                    v-for="entry in availableEntries"
                    :key="entry.id"
                    :value="entry.id"
                  >
                    {{ entry.name }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label>Source Type *</label>
                <select v-model="source.sourceType" class="form-select">
                  <option
                    v-for="type in sourceTypes"
                    :key="type"
                    :value="type"
                  >
                    {{ type }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label>Description</label>
                <input
                  v-model="source.description"
                  type="text"
                  class="form-input"
                  placeholder="Optional description"
                />
              </div>
            </div>
          </div>

          <div v-if="sources.length === 0" class="empty-state">
            No sources added yet.
          </div>
        </div>


        <div class="form-actions">
          <ControlSelector
            v-model:controlTeamId="selectedControlTeamId"
            v-model:readRelease="selectedRelease"
            class="form-control"
            @error="handleControlTeamError"
          />
          <button type="submit" class="btn btn-primary" :disabled="createEntryLoading">
            {{ createEntryLoading ? 'Creating...' : 'Create Entry' }}
          </button>
          <button type="button" @click="$emit('close')" class="btn btn-secondary">
            Cancel
          </button>
        </div>
      </FormKit>
    </div>
  </div>
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
.form-input,
.form-control {
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

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
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