<template>
  <div class="page-container">
    <div class="germplasm-header">
      <button @click="$router.push('/')" class="btn btn-secondary">
        ← Back to Home
      </button>
      <h1>Germplasm Graph Management</h1>
      <button @click="showCreateModal = true" class="btn btn-primary">
        Create New Entry
      </button>
    </div>

    <div class="germplasm-content">
      <div v-if="loading" class="loading-message">
        Loading germplasm data...
      </div>

      <div v-else-if="error" class="error-message">
        Error loading germplasm: {{ error.message }}
      </div>

      <div v-else-if="allEntries.length === 0" class="empty-message">
        <p>No germplasm crops found.</p>
      </div>

      <GermplasmNetworkGraph
        v-else
        :entries="allEntries"
        @expand-sources="handleExpandSources"
        @expand-sinks="handleExpandSinks"
        @collapse-sources="handleCollapseSources"
        @collapse-sinks="handleCollapseSinks"
        @update-entry="handleUpdateEntry"
        @delete-entry="handleDeleteEntry"
        @manage-controllers="handleManageControllers"
      />
    </div>

    <!-- Create Entry Modal -->
    <div v-if="showCreateModal" class="modal-overlay">
      <div class="modal modal-large">
        <div class="modal-header">
          <h2>Create Germplasm Entry</h2>
          <button @click="cancelCreate" class="modal-close">&times;</button>
        </div>

        <div v-if="createError" class="error-message">
          {{ createError }}
        </div>
        <div v-if="createSuccess" class="success-message">
          {{ createSuccess }}
        </div>

        <FormKit
          type="form"
          v-model="formData"
          @submit="submitCreate"
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

          <!-- Sinks Section -->
          <div class="relationships-section">
            <div class="section-header">
              <h3>Sinks</h3>
              <button
                type="button"
                @click="addSink"
                class="btn btn-small btn-primary"
              >
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
                <button
                  type="button"
                  @click="removeSink(index)"
                  class="btn btn-small btn-danger"
                >
                  Remove
                </button>
              </div>

              <div class="relationship-fields">
                <div class="form-group">
                  <label>Sink Entry *</label>
                  <select v-model="sink.sinkId" class="form-select">
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
                  <select v-model="sink.sourceType" class="form-select">
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
                    v-model="sink.description"
                    type="text"
                    class="form-input"
                    placeholder="Optional description"
                  />
                </div>
              </div>
            </div>

            <div v-if="sinks.length === 0" class="empty-state">
              No sinks added yet.
            </div>
          </div>

          <div class="form-actions">
            <FormKit
              type="submit"
              input-class="btn btn-primary"
              :disabled="creating"
            >
              {{ creating ? 'Creating...' : 'Create Entry' }}
            </FormKit>
            <button type="button" @click="cancelCreate" class="btn btn-secondary">
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>

    <!-- Update Entry Modal -->
    <div v-if="showUpdateModal" class="modal-overlay">
      <div class="modal modal-large">
        <div class="modal-header">
          <h2>Update Germplasm Entry</h2>
          <button @click="cancelUpdate" class="modal-close">&times;</button>
        </div>

        <div v-if="updateError" class="error-message">
          {{ updateError }}
        </div>
        <div v-if="updateSuccess" class="success-message">
          {{ updateSuccess }}
        </div>

        <FormKit
          type="form"
          v-model="updateFormData"
          @submit="submitUpdate"
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

          <!-- Sources Section -->
          <div class="relationships-section">
            <div class="section-header">
              <h3>Sources</h3>
              <button
                type="button"
                @click="addUpdateSource"
                class="btn btn-small btn-primary"
              >
                + Add Source
              </button>
            </div>

            <div
              v-for="(source, index) in updateSources"
              :key="'update-source-' + index"
              class="relationship-item"
            >
              <div class="relationship-header">
                <h4>Source {{ index + 1 }}</h4>
                <button
                  type="button"
                  @click="removeUpdateSource(index)"
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

            <div v-if="updateSources.length === 0" class="empty-state">
              No sources added yet.
            </div>
          </div>

          <!-- Sinks Section -->
          <div class="relationships-section">
            <div class="section-header">
              <h3>Sinks</h3>
              <button
                type="button"
                @click="addUpdateSink"
                class="btn btn-small btn-primary"
              >
                + Add Sink
              </button>
            </div>

            <div
              v-for="(sink, index) in updateSinks"
              :key="'update-sink-' + index"
              class="relationship-item"
            >
              <div class="relationship-header">
                <h4>Sink {{ index + 1 }}</h4>
                <button
                  type="button"
                  @click="removeUpdateSink(index)"
                  class="btn btn-small btn-danger"
                >
                  Remove
                </button>
              </div>

              <div class="relationship-fields">
                <div class="form-group">
                  <label>Sink Entry *</label>
                  <select v-model="sink.sinkId" class="form-select">
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
                  <select v-model="sink.sourceType" class="form-select">
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
                    v-model="sink.description"
                    type="text"
                    class="form-input"
                    placeholder="Optional description"
                  />
                </div>
              </div>
            </div>

            <div v-if="updateSinks.length === 0" class="empty-state">
              No sinks added yet.
            </div>
          </div>

          <div class="form-actions">
            <FormKit
              type="submit"
              input-class="btn btn-primary"
              :disabled="updating"
            >
              {{ updating ? 'Updating...' : 'Update Entry' }}
            </FormKit>
            <button type="button" @click="cancelUpdate" class="btn btn-secondary">
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>

    <!-- Delete Entry Modal -->
    <div v-if="showDeleteModal" class="modal-overlay">
      <div class="modal modal-small">
        <div class="modal-header">
          <h2>Delete Germplasm Entry</h2>
          <button @click="cancelDelete" class="modal-close">&times;</button>
        </div>

        <div v-if="deleteError" class="error-message">
          {{ deleteError }}
        </div>

        <div class="modal-body">
          <p>Are you sure you want to delete this germplasm entry?</p>
          <p class="delete-warning">
            <strong>{{ entryToDelete?.data?.name }}</strong>
          </p>
          <p class="warning-text">This action cannot be undone.</p>
        </div>

        <div class="form-actions">
          <button
            @click="confirmDelete"
            class="btn btn-danger"
            :disabled="deleting"
          >
            {{ deleting ? 'Deleting...' : 'Delete Entry' }}
          </button>
          <button
            type="button"
            @click="cancelDelete"
            class="btn btn-secondary"
            :disabled="deleting"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Controller Modal -->
    <ControllerModal
      :isVisible="showControllerModal"
      :controller="controller"
      :loading="loading"
      :error="error"
      entityLabel="GERMPLASM"
      :entityId="selectedEntryForController?.data?.id"
      @close="closeControllerModal"
      @releaseUpdated="handleControllerReleaseUpdated"
    />

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import ControllerModal from './ControllerModal.vue'
import { useControllerData } from '@/composables/useControllerData'

import GermplasmNetworkGraph from './GermplasmNetworkGraph.vue'
import GERMPLASM_CROPS_QUERY from '@/graphql/germplasm/crops.graphql'
import GERMPLASM_ENTRIES_QUERY from '@/graphql/germplasm/entries.graphql'
import GERMPLASM_CREATE_ENTRY from '@/graphql/germplasm/createEntry.graphql'
import GERMPLASM_UPDATE_ENTRY from '@/graphql/germplasm/updateEntry.graphql'
import DELETE_ENTRY from '../graphql/germplasm/deleteEntry.graphql'

// Initial query for crops
const { result, loading, error } = useQuery(GERMPLASM_CROPS_QUERY)

// Query to get all entries - used for selection AND for expanding
const { refetch: refetchAllEntries } = useQuery(GERMPLASM_ENTRIES_QUERY, {
  entryIds: null,
  names: null
})

// Mutation for creating entries
const { mutate: createEntry, loading: creating } = useMutation(GERMPLASM_CREATE_ENTRY)

// Mutation for updating entries
const { mutate: updateEntry, loading: updating } = useMutation(GERMPLASM_UPDATE_ENTRY)

// Store all loaded entries
const loadedEntries = ref(new Map())

// Track which entries should be hidden
const hiddenEntryIds = ref(new Set())

// Create modal state
const showCreateModal = ref(false)
const formData = ref({
  name: '',
  description: '',
  synonyms: ''
})
const sources = ref([])
const sinks = ref([])
const createError = ref(null)
const createSuccess = ref(null)

// Update modal state
const showUpdateModal = ref(false)
const updateFormData = ref({
  id: null,
  name: '',
  description: '',
  synonyms: ''
})
const updateSources = ref([])
const updateSinks = ref([])
const updateError = ref(null)
const updateSuccess = ref(null)

// Delete state
const showDeleteModal = ref(false)
const entryToDelete = ref(null)
const deleteError = ref('')
const deleting = ref(false)

// Source types for dropdown
const sourceTypes = [
  'UNKNOWN',
  'SEED',
  'TISSUE',
  'MATERNAL',
  'PATERNAL'
]

// Computed property to get all unique entries (excluding hidden ones)
// This is used for both the graph display AND the dropdown selections
const allEntries = computed(() => {
  const crops = result.value?.germplasmCrops?.result || []

  // Start with crops
  const entriesMap = new Map()
  crops.forEach(crop => {
    if (!hiddenEntryIds.value.has(crop.id)) {
      entriesMap.set(crop.id, crop)
    }
  })

  // Add any additionally loaded entries (excluding hidden ones)
  loadedEntries.value.forEach((entry, id) => {
    if (!hiddenEntryIds.value.has(id)) {
      entriesMap.set(id, entry)
    }
  })

  return Array.from(entriesMap.values())
})

// Computed property for available entries - same as allEntries (no hidden ones)
const availableEntries = computed(() => {
  return allEntries.value
})

// Event handlers
const handleExpandSources = async (entry) => {
  console.log('Expand sources for:', entry)

  try {
    // Get source IDs directly from the entry
    const sourceIds = entry.data?.sources?.map(sourceRel => sourceRel.source.id).filter(Boolean) || []

    if (sourceIds.length === 0) {
      console.log('No sources to expand')
      return
    }

    console.log('Source IDs from entry:', sourceIds)

    // First, unhide any already-loaded sources
    sourceIds.forEach(sourceId => {
      if (loadedEntries.value.has(sourceId)) {
        hiddenEntryIds.value.delete(sourceId)
      }
    })

    // Collect IDs of sources that aren't loaded yet
    const sourcesToFetch = sourceIds.filter(sourceId => !loadedEntries.value.has(sourceId))

    console.log('Sources to fetch:', sourcesToFetch)

    // Fetch complete data for sources that aren't loaded
    if (sourcesToFetch.length > 0) {
      const { data } = await refetchAllEntries({
        entryIds: sourcesToFetch,
        names: null
      })

      if (data?.germplasmEntries?.result) {
        data.germplasmEntries.result.forEach(sourceEntry => {
          loadedEntries.value.set(sourceEntry.id, sourceEntry)
          hiddenEntryIds.value.delete(sourceEntry.id)
        })
      }
    }

    // Trigger reactivity
    loadedEntries.value = new Map(loadedEntries.value)
    hiddenEntryIds.value = new Set(hiddenEntryIds.value)
  } catch (err) {
    console.error('Error expanding sources:', err)
  }
}


const handleExpandSinks = async (entry) => {
  console.log('Expand sinks for:', entry)

  try {
    // Get sink IDs directly from the entry
    const sinkIds = entry.data?.sinks?.map(sinkRel => sinkRel.sink.id).filter(Boolean) || []

    if (sinkIds.length === 0) {
      console.log('No sinks to expand')
      return
    }

    console.log('Sink IDs from entry:', sinkIds)

    // First, unhide any already-loaded sinks
    sinkIds.forEach(sinkId => {
      if (loadedEntries.value.has(sinkId)) {
        hiddenEntryIds.value.delete(sinkId)
      }
    })

    // Collect IDs of sinks that aren't loaded yet
    const sinksToFetch = sinkIds.filter(sinkId => !loadedEntries.value.has(sinkId))

    console.log('Sinks to fetch:', sinksToFetch)

    // Fetch complete data for sinks that aren't loaded
    if (sinksToFetch.length > 0) {
      const { data } = await refetchAllEntries({
        entryIds: sinksToFetch,
        names: null
      })

      if (data?.germplasmEntries?.result) {
        data.germplasmEntries.result.forEach(sinkEntry => {
          loadedEntries.value.set(sinkEntry.id, sinkEntry)
          hiddenEntryIds.value.delete(sinkEntry.id)
        })
      }
    }

    // Trigger reactivity
    loadedEntries.value = new Map(loadedEntries.value)
    hiddenEntryIds.value = new Set(hiddenEntryIds.value)
  } catch (err) {
    console.error('Error expanding sinks:', err)
  }
}

const handleCollapseSources = (entry) => {
  console.log('Collapse sources for:', entry)

  const entriesToHide = new Set()

  // Recursive function to find all sources up the tree
  const findSourcesRecursively = (currentEntry) => {
    // Get source IDs directly from the current entry
    const sourceIds = currentEntry.data?.sources?.map(sourceRel => sourceRel.source.id).filter(Boolean) || []

    sourceIds.forEach(sourceId => {
      if (sourceId !== entry.id) {
        entriesToHide.add(sourceId)
        // Recursively find sources of this source
        const sourceEntry = loadedEntries.value.get(sourceId)
        if (sourceEntry) {
          findSourcesRecursively({ data: sourceEntry })
        }
      }
    })
  }

  // Start the recursive search from the clicked entry
  findSourcesRecursively(entry)

  // Hide all the sources
  entriesToHide.forEach(id => {
    hiddenEntryIds.value.add(id)
  })

  // Trigger reactivity
  hiddenEntryIds.value = new Set(hiddenEntryIds.value)
}

const handleCollapseSinks = (entry) => {
  console.log('Collapse sinks for:', entry)

  const entriesToHide = new Set()

  // Recursive function to find all sinks down the tree
  const findSinksRecursively = (currentEntry) => {
    // Get sink IDs directly from the current entry
    const sinkIds = currentEntry.data?.sinks?.map(sinkRel => sinkRel.sink.id).filter(Boolean) || []

    sinkIds.forEach(sinkId => {
      entriesToHide.add(sinkId)
      // Recursively find sinks of this sink
      const sinkEntry = loadedEntries.value.get(sinkId)
      if (sinkEntry) {
        findSinksRecursively({ data: sinkEntry })
      }
    })
  }

  // Start the recursive search from the clicked entry
  findSinksRecursively(entry)

  // Hide all the sinks
  entriesToHide.forEach(id => {
    hiddenEntryIds.value.add(id)
  })

  // Trigger reactivity
  hiddenEntryIds.value = new Set(hiddenEntryIds.value)
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

const addSink = () => {
  sinks.value.push({
    sinkId: null,
    sourceType: 'UNKNOWN',
    description: ''
  })
}

const removeSink = (index) => {
  sinks.value.splice(index, 1)
}

const submitCreate = async () => {
  createError.value = null
  createSuccess.value = null

  try {
    // Parse synonyms from comma-separated string
    const synonyms = formData.value.synonyms
      ? formData.value.synonyms.split(',').map(s => s.trim()).filter(s => s)
      : []

    const entry = {
      name: formData.value.name,
      description: formData.value.description || null,
      synonyms: synonyms.length > 0 ? synonyms : null
    }

    // Add sources if any are defined
    if (sources.value.length > 0) {
      const validSources = sources.value
        .filter(s => s.sourceId !== null)
        .map(s => ({
          sourceId: parseInt(s.sourceId),
          sourceType: s.sourceType,
          description: s.description || null
        }))
      if (validSources.length > 0) {
        entry.sources = validSources
      }
    }

    // Add sinks if any are defined
    if (sinks.value.length > 0) {
      const validSinks = sinks.value
        .filter(s => s.sinkId !== null)
        .map(s => ({
          sinkId: parseInt(s.sinkId),
          sourceType: s.sourceType,
          description: s.description || null
        }))
      if (validSinks.length > 0) {
        entry.sinks = validSinks
      }
    }

    const response = await createEntry({ entry })

    if (response?.data?.germplasmCreateEntry?.status === 'SUCCESS') {
      createSuccess.value = 'Entry created successfully!'

      // Collect all IDs to fetch: the new entry by name, plus all source and sink IDs
      const idsToFetch = []
      if (entry.sources) {
        idsToFetch.push(...entry.sources.map(s => s.sourceId))
      }
      if (entry.sinks) {
        idsToFetch.push(...entry.sinks.map(s => s.sinkId))
      }
      // Fetch the newly created entry by name AND the defined sources/sinks by ID
      const [byName, byIds] = await Promise.all([
        refetchAllEntries({ entryIds: null, names: [formData.value.name] }),
        idsToFetch.length > 0 ? refetchAllEntries({ entryIds: idsToFetch, names: null }) : null
      ])

      // Merge results from both queries
      const allResults = [
        ...(byName.data?.germplasmEntries?.result || []),
        ...(byIds?.data?.germplasmEntries?.result || [])
      ]

      allResults.forEach(newEntry => {
        loadedEntries.value.set(newEntry.id, newEntry)
      })

      // Trigger reactivity
      loadedEntries.value = new Map(loadedEntries.value)

      // Reset form and close modal after a short delay
      setTimeout(() => {
        cancelCreate()
      }, 1500)
    } else {
      const errors = response?.data?.germplasmCreateEntry?.errors
      createError.value = errors?.[0]?.message || 'Failed to create entry'
    }
  } catch (err) {
    console.error('Error creating entry:', err)
    createError.value = err.message || 'An error occurred while creating the entry'
  }
}

const cancelCreate = () => {
  showCreateModal.value = false
  formData.value = {
    name: '',
    description: '',
    synonyms: ''
  }
  sources.value = []
  sinks.value = []
  createError.value = null
  createSuccess.value = null
}

const handleUpdateEntry = (entry) => {
  console.log('Update entry:', entry)

  // Populate the update form with existing data
  updateFormData.value = {
    id: entry.data.id,
    name: entry.data.name || '',
    description: entry.data.description || '',
    synonyms: entry.data.synonyms ? entry.data.synonyms.join(', ') : ''
  }

  // Populate sources
  updateSources.value = (entry.data.sources || []).map(sourceRel => ({
    sourceId: sourceRel.source.id,
    sourceType: sourceRel.sourceType || 'UNKNOWN',
    description: sourceRel.description || ''
  }))

  // Populate sinks
  updateSinks.value = (entry.data.sinks || []).map(sinkRel => ({
    sinkId: sinkRel.sink.id,
    sourceType: sinkRel.sourceType || 'UNKNOWN',
    description: sinkRel.description || ''
  }))

  showUpdateModal.value = true
}


const addUpdateSource = () => {
  updateSources.value.push({
    sourceId: null,
    sourceType: 'UNKNOWN',
    description: ''
  })
}

const removeUpdateSource = (index) => {
  updateSources.value.splice(index, 1)
}

const addUpdateSink = () => {
  updateSinks.value.push({
    sinkId: null,
    sourceType: 'UNKNOWN',
    description: ''
  })
}

const removeUpdateSink = (index) => {
  updateSinks.value.splice(index, 1)
}


const submitUpdate = async () => {
  updateError.value = null
  updateSuccess.value = null

  try {
    // Parse synonyms from comma-separated string
    const synonyms = updateFormData.value.synonyms
      ? updateFormData.value.synonyms.split(',').map(s => s.trim()).filter(s => s)
      : []

    const entry = {
      id: parseInt(updateFormData.value.id),
      name: updateFormData.value.name,
      description: updateFormData.value.description || null,
      synonyms: synonyms.length > 0 ? synonyms : null
    }

    // Collect source and sink IDs that were defined
    const sourceIds = []
    const sinkIds = []

    // Add sources if any are defined
    if (updateSources.value.length > 0) {
      const validSources = updateSources.value
        .filter(s => s.sourceId !== null)
        .map(s => ({
          sourceId: parseInt(s.sourceId),
          sourceType: s.sourceType,
          description: s.description || null
        }))
      if (validSources.length > 0) {
        entry.sources = validSources
        sourceIds.push(...validSources.map(s => s.sourceId))
      }
    }

    // Add sinks if any are defined
    if (updateSinks.value.length > 0) {
      const validSinks = updateSinks.value
        .filter(s => s.sinkId !== null)
        .map(s => ({
          sinkId: parseInt(s.sinkId),
          sourceType: s.sourceType,
          description: s.description || null
        }))
      if (validSinks.length > 0) {
        entry.sinks = validSinks
        sinkIds.push(...validSinks.map(s => s.sinkId))
      }
    }

    const response = await updateEntry({ entry })

    if (response?.data?.germplasmUpdateEntry?.status === 'SUCCESS') {
      updateSuccess.value = 'Entry updated successfully!'

      // Fetch the updated entry by ID AND the defined sources/sinks by ID
      const entryId = parseInt(updateFormData.value.id)
      const idsToFetch = [...sourceIds, ...sinkIds].filter(id => id !== entryId)

      const [byId, byIds] = await Promise.all([
        refetchAllEntries({ entryIds: [entryId], names: null }),
        idsToFetch.length > 0 ? refetchAllEntries({ entryIds: idsToFetch, names: null }) : null
      ])

      // Merge results from both queries
      const allResults = [
        ...(byId.data?.germplasmEntries?.result || []),
        ...(byIds?.data?.germplasmEntries?.result || [])
      ]

      allResults.forEach(updatedEntry => {
        loadedEntries.value.set(updatedEntry.id, updatedEntry)
      })

      // Trigger reactivity
      loadedEntries.value = new Map(loadedEntries.value)

      // Reset form and close modal after a short delay
      setTimeout(() => {
        cancelUpdate()
      }, 1500)
    } else {
      const errors = response?.data?.germplasmUpdateEntry?.errors
      updateError.value = errors?.[0]?.message || 'Failed to update entry'
    }
  } catch (err) {
    console.error('Error updating entry:', err)
    updateError.value = err.message || 'An error occurred while updating the entry'
  }
}

const cancelUpdate = () => {
  showUpdateModal.value = false
  updateFormData.value = {
    id: null,
    name: '',
    description: '',
    synonyms: ''
  }
  updateSources.value = []
  updateSinks.value = []
  updateError.value = null
  updateSuccess.value = null
}

const { mutate: deleteEntryMutation } = useMutation(DELETE_ENTRY)

const handleDeleteEntry = (entry) => {
  entryToDelete.value = entry
  deleteError.value = ''
  showDeleteModal.value = true
}

const cancelDelete = () => {
  showDeleteModal.value = false
  entryToDelete.value = null
  deleteError.value = ''
}


const confirmDelete = async () => {
  if (!entryToDelete.value || !entryToDelete.value.id) {
    deleteError.value = 'Invalid entry selected'
    return
  }

  deleting.value = true
  deleteError.value = ''

  try {
    const result = await deleteEntryMutation({
      entryId: entryToDelete.value.id
    })

    if (result?.data?.germplasmDeleteEntry?.status === 'SUCCESS') {
      const entryId = entryToDelete.value.id
      const entryData = entryToDelete.value.data

      // Collect IDs of sources and sinks from the entry being deleted
      const referencedEntryIds = new Set()

      if (entryData.sources && entryData.sources.length > 0) {
        entryData.sources.forEach(sourceRel => {
          if (sourceRel.source?.id) {
            referencedEntryIds.add(sourceRel.source.id)
          }
        })
      }

      if (entryData.sinks && entryData.sinks.length > 0) {
        entryData.sinks.forEach(sinkRel => {
          if (sinkRel.sink?.id) {
            referencedEntryIds.add(sinkRel.sink.id)
          }
        })
      }

      // Remove the deleted entry
      loadedEntries.value.delete(entryId)

      // Reload the referenced entries to update their relationships
      if (referencedEntryIds.size > 0) {
        const { data } = await refetchAllEntries({
          entryIds: Array.from(referencedEntryIds),
          names: null
        })

        if (data?.germplasmEntries?.result) {
          data.germplasmEntries.result.forEach(entry => {
            loadedEntries.value.set(entry.id, entry)
          })
        }
      }

      // Trigger reactivity
      loadedEntries.value = new Map(loadedEntries.value)

      // Close modal
      showDeleteModal.value = false
      entryToDelete.value = null
    } else {
      const errors = result?.data?.germplasmDeleteEntry?.errors
      deleteError.value =
        errors?.map((e) => e.message).join(', ') || 'Failed to delete entry'
    }
  } catch (err) {
    console.error('Error deleting entry:', err)
    deleteError.value = err.message || 'An error occurred while deleting the entry'
  } finally {
    deleting.value = false
  }
}

// Controller modal state
const showControllerModal = ref(false)
const selectedEntryForController = ref(null)
const { controller, fetchController, refetchController } = useControllerData()

const handleManageControllers = async (entry) => {
  selectedEntryForController.value = entry
  showControllerModal.value = true
  await fetchController('GERMPLASM', entry.data.id)
}

const closeControllerModal = () => {
  showControllerModal.value = false
  selectedEntryForController.value = null
}

const handleControllerReleaseUpdated = async () => {
  await refetchController()
}

</script>

<style scoped>
.page-container {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.germplasm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  gap: 1rem;
}

.germplasm-header h1 {
  flex: 1;
  text-align: center;
  margin: 0;
}

.germplasm-content {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.loading-message,
.error-message,
.empty-message {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.error-message {
  color: #d32f2f;
  background-color: #ffebee;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.success-message {
  color: #2e7d32;
  background-color: #e8f5e9;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
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

.btn-primary:hover {
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

.btn-secondary:hover {
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

.btn-danger:hover {
  background-color: #c82333;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-large {
  max-width: 800px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.modal-close {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #666;
  line-height: 1;
  padding: 0;
  width: 2rem;
  height: 2rem;
}

.modal-close:hover {
  color: #333;
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

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.form-actions button {
  flex: 1;
}
</style>