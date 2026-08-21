<script setup>
import { ref, computed} from 'vue'

import GermplasmEntryModal from './GemplasmEntryModal.vue'
import GermplasmCard from './GermplasmCard.vue'

import GERMPLASM_FRAGMENT from '@/graphql/germplasm/entryFragment.graphql'

import { useCacheUpdates } from "@/apolloConfig/cacheUpdates";
import { useMutateEntries } from '@/composables/germplasm/mutateEntries'

import { useAllGermplasmQuery } from "@/composables/germplasm/allGermplasmQuery";
import { useGermplasmByIdsQuery } from "@/composables/germplasm/germplasmByIdsQuery";

import GermplasmNetworkGraph from './GermplasmNetworkGraph.vue'

// Mutations
const { deleteEntry, deleteEntryLoading } = useMutateEntries()

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

// Selected entry state
const selectedEntryId = ref(null)

const {
  germplasm: allGermplasm,
  germplasmLoading: allGermplasmLoading,
  germplasmError: allGermplasmError,
  refetchGermplasm: refetchAllGermplasm
} = useAllGermplasmQuery()

const toLoadGermplasmIds = ref([])
const { refetchGermplasm } = useGermplasmByIdsQuery(toLoadGermplasmIds)

const loadedEntries = computed(() => {
      return new Map((allGermplasm.value ?? []).map(entry => [entry.id, entry]))
    }
)

const visibleEntries = computed(() => {
  return Array.from(loadedEntries.value.values()).filter(
    entry => !hiddenEntryIds.value.has(entry.id)
  )
})

const { deleteFromCache } = useCacheUpdates({
  typename: "GermplasmEntry",
  fragment: GERMPLASM_FRAGMENT
})


// Event handlers
const handleSelectEntry = async (entryId) => {
  selectedEntryId.value = entryId
}


const handleExpandSources = async (entry) => {

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

  } catch (err) {
    console.error('Error expanding sources:', err)
  }
}


const handleExpandSinks = async (entry) => {
  try {
    // Get sink IDs by finding entries in the loadedEntries map with current entry ID as a source:
    const sinkIds = loadedEntries.value?.filter(e => e.data?.sources?.some(s => s.source.id === entry.id)).map(e => e.id) || []

    if (sinkIds.length === 0) {
      return
    }
    // Unhide sinks
    sinkIds.forEach(sinkId => {
        hiddenEntryIds.value.delete(sinkId)
    })

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

}

const handleCollapseSinks = (entry) => {
  console.debug('Collapse sinks for:', entry)

  const entriesToHide = new Set()

  // Recursive function to find all sinks down the tree
  const findSinksRecursively = (currentEntry) => {

    // Get sink IDs by finding entries in the loadedEntries map with current entry ID as a source:
    const sinkIds = loadedEntries.value?.filter(e => e.data?.sources?.some(s => s.source.id === currentEntry.id)).map(e => e.id) || []

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

}

const handleToggleExpanded = (entry) => {
  console.debug('handleToggleExpanded', entry)
  // Get sink IDs by finding entries in the loadedEntries map with current entry ID as a source:
  const sinkIds = loadedEntries.value?.filter(e => e.data?.sources?.some(s => s.source.id === entry.id)).map(e => e.id) || []
  if (sinkIds.length === 0) {
    return
  }
  const visibleSinkIds = sinkIds.filter(id => !hiddenEntryIds.value.has(id))
  const loadedEntryIds = sinkIds.filter(id => loadedEntries.value.has(id))
  if (loadedEntryIds.length > 0 && visibleSinkIds.length === loadedEntryIds.length) {
    handleCollapseSinks(entry)
  } else {
    handleExpandSinks(entry)
  }
}

const handleCreateSuccess = async ({ entryName, sourceIds, sinkIds }) => {
  showCreateModal.value = false
  await refetchAllGermplasm()
}

const handleUpdateEntry = (entry) => {
  entryToUpdate.value = entry
  showUpdateModal.value = true
}

const handleUpdateSuccess = async ({ entryId, sourceIds, sinkIds }) => {

  // Fetch the updated entry by ID AND the defined sources/sinks by ID
  const idsToFetch = [entryId, ...sourceIds, ...sinkIds] //.filter(id => id !== entryId)
  const sameIds = toLoadGermplasmIds.value?.length === idsToFetch.length && toLoadGermplasmIds.value.every((id, i) => id === idsToFetch[i])
  if (sameIds) {
    await refetchGermplasm()
  } else {
    toLoadGermplasmIds.value = idsToFetch
  }

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
      const entryData = entryToDelete.value

      // Collect IDs of sources from the entry being deleted
      const sourceEntryIds = new Set()

      if (entryData.sources && entryData.sources.length > 0) {
        entryData.sources.forEach(sourceRel => {
          if (sourceRel.source?.id) {
            sourceEntryIds.add(sourceRel.source.id)
          }
        })
      }

      // Remove the deleted entry from the cache
      deleteFromCache({id: entryId})

      // Reload the referenced entries to update their relationships
      if (sourceEntryIds.size > 0) {
        const idsToFetch = Array.from(sourceEntryIds)
        const sameIds = toLoadGermplasmIds.value?.length === idsToFetch.length && toLoadGermplasmIds.value.every((id, i) => id === idsToFetch[i])
        if (sameIds) {
          await refetchGermplasm()
        } else {
          toLoadGermplasmIds.value = idsToFetch
        }
      }
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


</script>

<template>
  <div class="page-container">
    <div class="germplasm-header">
      <button @click="showCreateModal = true" class="btn btn-primary">
        Create New Entry
      </button>
    </div>

    <div class="germplasm-content">
      <div v-if="allGermplasmLoading" class="loading-message">
        Loading germplasm data...
      </div>

      <div v-else-if="allGermplasmError" class="error-message">
        Error loading germplasm: {{ allGermplasmError.message }}
      </div>

      <div v-else-if="allGermplasm.length === 0" class="empty-message">
        <p>No germplasm found.</p>
      </div>

      <GermplasmNetworkGraph
        v-else
        :entries="visibleEntries"
        @select-entry="handleSelectEntry"
        @expand-sources="handleExpandSources"
        @expand-sinks="handleExpandSinks"
        @collapse-sources="handleCollapseSources"
        @toggle-expanded="handleToggleExpanded"
        @collapse-sinks="handleCollapseSinks"
      />
    </div>

    <!-- Create Entry Modal -->
    <div v-if="showCreateModal" class="modal-overlay">
      <GermplasmEntryModal
        :availableEntries="allGermplasm"
        @close="showCreateModal = false"
        @success="handleCreateSuccess"
      />
    </div>

    <!-- Update Entry Modal -->
    <div v-if="showUpdateModal && entryToUpdate" class="modal-overlay">
      <GermplasmEntryModal
        :entry="entryToUpdate"
        :availableEntries="allGermplasm"
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

    <!-- Germplasm Details Card -->
    <div v-if="selectedEntryId" class="details-card-container">
      <GermplasmCard
        :entry="loadedEntries.get(selectedEntryId)"
        @edit-entry="handleUpdateEntry(loadedEntries.get(selectedEntryId))"
        @delete-entry="handleDeleteEntry(loadedEntries.get(selectedEntryId))"
      />
    </div>

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

.modal-close:hover {
  color: #333;
}

.form-actions button {
  flex: 1;
}

.details-card-container {
  margin-top: 20px;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

</style>