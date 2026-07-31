<script setup>
import { ref, computed } from 'vue'

import { useUserAccess } from '@/composables/user/useUserAccess'
import DatasetSelectionForm from './DatasetSelectionForm.vue'
import DatasetCurationTable from './DatasetCurationTable.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'updated'])

// Phase management: 'selection' or 'table'
const phase = ref('selection')

// Selected data from selection form
const selectedDatasetIds = ref([])

// User access for determining curate permissions
const { curateTeamIds } = useUserAccess()

// Component refs
const selectionFormRef = ref(null)
const curationTableRef = ref(null)

// Track unsaved changes from table
const tableHasUnsavedChanges = ref(false)

// Close confirmation
const showCloseConfirm = ref(false)

const handleClose = () => {
  if (phase.value === 'table' && tableHasUnsavedChanges.value) {
    showCloseConfirm.value = true
  } else {
    confirmClose()
  }
}

const confirmClose = () => {
  showCloseConfirm.value = false
  if (curationTableRef.value) {
    curationTableRef.value.cleanup()
  }
  phase.value = 'selection'
  selectedDatasetIds.value = []
  if (selectionFormRef.value) {
    selectionFormRef.value.reset()
  }
  emit('close')
}

// Handle load table from selection form
const handleLoadTable = ({ datasetIds }) => {
  selectedDatasetIds.value = datasetIds
  phase.value = 'table'
}

// Handle back from table
const handleBackToSelection = () => {
  if (tableHasUnsavedChanges.value) {
    showCloseConfirm.value = true
  } else {
    if (curationTableRef.value) {
      curationTableRef.value.cleanup()
    }
    phase.value = 'selection'
  }
}

// Handle submit from table
const handleTableSubmit = () => {
  emit('updated')
}

// Track unsaved changes
const handleUnsavedChanges = (hasChanges) => {
  tableHasUnsavedChanges.value = hasChanges
}

// Computed for modal title
const modalTitle = computed(() => {
  return phase.value === 'selection' ? 'View & Curate Datasets' : 'Curate Datasets'
})

// Computed for showing table phase footer buttons
const isSubmitting = computed(() => {
  return curationTableRef.value?.isSubmitting ?? false
})
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container" :class="{ 'modal-large': phase === 'table' }">
        <!-- Header -->
        <div class="modal-header">
          <h2>{{ modalTitle }}</h2>
          <button class="close-btn" @click="handleClose">&times;</button>
        </div>

        <!-- Selection Phase -->
        <div v-if="phase === 'selection'" class="modal-content selection-phase">
          <DatasetSelectionForm
            ref="selectionFormRef"
            @load-table="handleLoadTable"
          />
        </div>

        <!-- Table Phase -->
        <div v-else class="modal-content table-phase">
          <DatasetCurationTable
            ref="curationTableRef"
            :dataset-ids="selectedDatasetIds"
            :curate-team-ids="curateTeamIds"
            @back="handleBackToSelection"
            @submit="handleTableSubmit"
            @has-unsaved-changes="handleUnsavedChanges"
          />
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="handleClose" :disabled="isSubmitting">
            Close
          </button>
        </div>
      </div>

      <!-- Close Confirmation -->
      <div v-if="showCloseConfirm" class="popover-overlay" @click.self="showCloseConfirm = false">
        <div class="popover-content">
          <h4>Unsaved Changes</h4>
          <p>You have unsaved changes. Are you sure you want to close?</p>
          <div class="popover-actions">
            <button class="btn btn-secondary" @click="showCloseConfirm = false">Cancel</button>
            <button class="btn btn-danger" @click="confirmClose">Close Anyway</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-container.modal-large {
  max-width: 95vw;
  width: 95vw;
  height: 90vh;
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
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.modal-content {
  flex: 1;
  overflow: auto;
  padding: 20px 24px;
}

.selection-phase {
  display: flex;
  justify-content: center;
}

.table-phase {
  display: flex;
  flex-direction: column;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
}

.btn {
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  background: #f44336;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #d32f2f;
}

.popover-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.popover-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  min-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.popover-content h4 {
  margin: 0 0 12px 0;
}

.popover-content p {
  margin: 0 0 16px 0;
  color: #666;
}

.popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>