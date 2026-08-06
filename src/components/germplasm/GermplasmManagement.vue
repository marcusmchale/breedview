<script setup>
import { ref, computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import ControllerModal from '../controls/ControllerModal.vue'
import CreateEntryModal from './CreateEntryModal.vue'
import UpdateEntryModal from './UpdateEntryModal.vue'

import { useControllerData } from '@/composables/controls/useControllerData'
import { useMutateEntries } from '@/composables/germplasm/mutateEntries'

import GermplasmNetworkGraph from './GermplasmNetworkGraph.vue'

import GERMPLASM_CROPS_QUERY from '@/graphql/germplasm/crops.graphql'
import GERMPLASM_ENTRIES_QUERY from '@/graphql/germplasm/entries.graphql'


// Initial query for crops
const { result, loading, error } = useQuery(GERMPLASM_CROPS_QUERY, {fetchPolicy: 'cache-and-network'})

// Query to get all entries - used for selection AND for expanding
const { result: allEntriesResult, refetch: refetchAllEntries } = useQuery(GERMPLASM_ENTRIES_QUERY, {
  entryIds: null,
  names: null

}, {fetchPolicy: 'cache-and-network'})

// Mutations
const { deleteEntry, deleteEntryLoading } = useMutateEntries()

// Store all loaded entries
const loadedEntries = ref(new Map())

// Track which entries should be hidden
const hiddenEntryIds = ref(new Set())

// Create modal state
const showCreateModal = ref(false)

// Update modal state
const showUpdateModal = ref(false)
const entryToUpdate = ref(null)

// Delete state
const showDeleteModal = ref(false)
const entryToDelete = ref(null)
const deleteError = ref('')

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
  console.debug('Expand sources for:', entry)

  try {
    // Get source IDs directly from the entry
    const sourceIds = entry.data?.sources?.map(sourceRel => sourceRel.source.id).filter(Boolean) || []

    if (sourceIds.length === 0) {
      return
    }
    // First, unhide any already-loaded sources
    sourceIds.forEach(sourceId => {
      if (loadedEntries.value.has(sourceId)) {
        hiddenEntryIds.value.delete(sourceId)
      }
    })

    // Collect IDs of sources that aren't loaded yet
    const sourcesToFetch = sourceIds.filter(sourceId => !loadedEntries.value.has(sourceId))

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
      return
    }

    // First, unhide any already-loaded sinks
    sinkIds.forEach(sinkId => {
      if (loadedEntries.value.has(sinkId)) {
        hiddenEntryIds.value.delete(sinkId)
      }
    })

    // Collect IDs of sinks that aren't loaded yet
    const sinksToFetch = sinkIds.filter(sinkId => !loadedEntries.value.has(sinkId))

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
  console.debug('Collapse sources for:', entry)

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
  console.debug('Collapse sinks for:', entry)

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

const handleToggleExpanded = (entry) => {
  console.debug('handleToggleExpanded', entry)
  const sinkIds = entry.data?.sinks?.map(sinkRel => sinkRel.sink.id).filter(Boolean) || []
  if (sinkIds.length === 0) {
    return
  }
  console.log('sinkIds', sinkIds)
  const visibleSinkIds = sinkIds.filter(id => !hiddenEntryIds.value.has(id))
  console.log('visibleSinkIds', visibleSinkIds)
  const loadedEntryIds = sinkIds.filter(id => loadedEntries.value.has(id))
  console.log('loadedEntryIds', loadedEntryIds)
  if (loadedEntryIds.length > 0 && visibleSinkIds.length === loadedEntryIds.length) {
    handleCollapseSinks(entry)
  } else {
    handleExpandSinks(entry)
  }
}

const handleCreateSuccess = async ({ entryName, sourceIds, sinkIds }) => {
  // Collect all IDs to fetch: the new entry by name, plus all source and sink IDs
  const idsToFetch = [...sourceIds, ...sinkIds]

  // Fetch the newly created entry by name AND the defined sources/sinks by ID
  const [byName, byIds] = await Promise.all([
    refetchAllEntries({ entryIds: null, names: [entryName] }),
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

  showCreateModal.value = false
}

const handleUpdateEntry = (entry) => {
  console.debug('Update entry:', entry)
  entryToUpdate.value = entry
  showUpdateModal.value = true
}

const handleUpdateSuccess = async ({ entryId, sourceIds, sinkIds }) => {
  // Fetch the updated entry by ID AND the defined sources/sinks by ID
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

  showUpdateModal.value = false
  entryToUpdate.value = null
}

const cancelUpdate = () => {
  showUpdateModal.value = false
  entryToUpdate.value = null
}

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

  deleteError.value = ''

  try {
    const { status, errors } = await deleteEntry(entryToDelete.value.id)

    if (status === 'SUCCESS') {
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
      deleteError.value =
        errors?.map((e) => e.message).join(', ') || 'Failed to delete entry'
    }
  } catch (err) {
    console.error('Error deleting entry:', err)
    deleteError.value = err.message || 'An error occurred while deleting the entry'
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


<template>
  <div class="page-container">
    <div class="germplasm-header">
      <h1>Germplasm</h1>
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
        @toggle-expanded="handleToggleExpanded"
        @collapse-sinks="handleCollapseSinks"
        @update-entry="handleUpdateEntry"
        @delete-entry="handleDeleteEntry"
        @manage-controllers="handleManageControllers"
      />
    </div>

    <!-- Create Entry Modal -->
    <div v-if="showCreateModal" class="modal-overlay">
      <CreateEntryModal
        :availableEntries="availableEntries"
        @close="showCreateModal = false"
        @success="handleCreateSuccess"
      />
    </div>

    <!-- Update Entry Modal -->
    <div v-if="showUpdateModal && entryToUpdate" class="modal-overlay">
      <UpdateEntryModal
        :entry="entryToUpdate"
        :availableEntries="availableEntries"
        @close="cancelUpdate"
        @success="handleUpdateSuccess"
      />
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
            :disabled="deleteEntryLoading"
          >
            {{ deleteEntryLoading ? 'Deleting...' : 'Delete Entry' }}
          </button>
          <button
            type="button"
            @click="cancelDelete"
            class="btn btn-secondary"
            :disabled="deleteEntryLoading"
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
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 15px;
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

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.form-actions button {
  flex: 1;
}
</style>