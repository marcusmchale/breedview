<script setup>
import { ref, computed} from 'vue'

import ControllerModal from '../controls/ControllerModal.vue'
import GermplasmEntryModal from './GemplasmEntryModal.vue'

import GERMPLASM_FRAGMENT from '@/graphql/germplasm/entryFragment.graphql'

import { useCacheUpdates } from "@/apolloConfig/cacheUpdates";

import { useControllerData } from '@/composables/controls/useControllerData'
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
  console.log('entries to hide', entriesToHide)

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
  //todo consider refetching only the newly created entry and related using the event data
  // for now just refetch all
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
      console.log('deleting entry', entryToDelete.value)
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

      // Remove the deleted entry from the cache
      deleteFromCache({id: entryId})

      // Reload the referenced entries to update their relationships
      if (referencedEntryIds.size > 0) {
        const idsToFetch = Array.from(referencedEntryIds)
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

    <!-- Controller Modal -->
    <ControllerModal
      :isVisible="showControllerModal"
      :controller="controller"
      :loading="allGermplasmLoading"
      :error="allGermplasmError"
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