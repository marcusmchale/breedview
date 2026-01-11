<script setup>

import { ref, computed } from 'vue'

import { useBlocksBoxQueries } from '@/composables/blocks/blocksBoxQueries'

import UnitNode from "@/components/blocks/UnitNode.vue";
import CreateBlockModal from "@/components/blocks/createBlockModal.vue";

const props = defineProps({
  locationId: {
    type: Number,
    required: true
  }
})

const locationIds = computed( () => {
  return [props.locationId]
} )

const {
  blocks,
  blocksLoading,
  blocksError,
  refetchBlocks,
  subjects
} = useBlocksBoxQueries({locationIds: locationIds})

// Add Unit Modal state
const isAddUnitModalOpen = ref(false)
const openAddUnitModal = () => {
  isAddUnitModalOpen.value = true
}
const closeAddUnitModal = () => {
  isAddUnitModalOpen.value = false
}
const handleAddUnitSuccess = () => {
  refetchBlocks()
}

// Unit details modal state
const selectedUnit = ref(null)
const openUnitDetailsModal = (unit) => {
  selectedUnit.value = unit
}

const closeUnitDetailsModal = () => {
  selectedUnit.value = null
}

const handleReloadBlocks = () => {
  refetchBlocks()
}

</script>

<template>
  <div class="blocks-box">
    <div class="blocks-header">
      <h5>Blocks</h5>
      <button
        @click="openAddUnitModal"
        class="btn btn-sm btn-add-unit"
        title="Create new blocks"
      >
        + New Block
      </button>
    </div>

    <div v-if="blocksLoading" class="loading">
      Loading blocks...
    </div>
    <div v-else-if="blocksError" class="error">
      Error loading blocks!
    </div>
    <div v-else-if="blocks.length === 0" class="empty-state">
      No blocks at this location
    </div>

    <div v-else class="blocks-list">
      <div
        v-for="block in blocks"
        :key="block.id"
        class="block-item"
        @click="openUnitDetailsModal(block)"
      >
        <span class="block-name">{{ block.name || `${block.subject?.name} ${block.id}` }}</span>
        <span class="block-subject">{{ block.subject?.name }}</span>
      </div>
    </div>

    <div v-if="isAddUnitModalOpen" class="modal-overlay" @click="closeAddUnitModal">
      <CreateBlockModal
          :subjects="subjects"
          :locationId="locationId"
          @close="closeAddUnitModal"
          @success="handleAddUnitSuccess"
      />
    </div>

    <!-- Unit details modal -->
    <div v-if="selectedUnit" class="modal-overlay" @click="closeUnitDetailsModal">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
         <h4>{{ selectedUnit.name || `${selectedUnit.subject?.name} ${selectedUnit.id}` }}</h4>
         <button @click="closeUnitDetailsModal" class="modal-close">&times;</button>
        </div>

        <div class="unit-details">
          <UnitNode
            :key="selectedUnit.id"
            :unitId="selectedUnit.id"
            :blockId="selectedUnit.id"
            :locationId="locationId"
            :subjects="subjects"
            @close="closeUnitDetailsModal"
            @reload-blocks="handleReloadBlocks"
          />
        </div>
      </div>
    </div>
  </div>

</template>


<style scoped>
.blocks-box {
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.blocks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.blocks-header h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.btn-create {
  padding: 4px 10px;
  font-size: 12px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-create:hover {
  background-color: #218838;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 12px;
  color: #666;
  font-size: 13px;
  font-style: italic;
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.block-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.block-item:hover {
  background-color: #e3f2fd;
}

.block-name {
  font-weight: 500;
  color: #333;
  font-size: 13px;
}

.block-subject {
  font-size: 11px;
  color: #666;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 10px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
}

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-large {
  max-width: 700px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
}

.modal-header h4 {
  margin: 0;
  color: #333;
  font-size: 18px;
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
  border-radius: 50%;
}

.modal-close:hover:not(:disabled) {
  background-color: #e9ecef;
}

.modal-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.form-section h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.coordinates-section {
  margin-top: 12px;
}

.coordinates-inputs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.date-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

.error-message {
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  font-size: 14px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.unit-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-section label {
  font-weight: 600;
  font-size: 14px;
  color: #555;
}

.detail-section span,
.detail-section p {
  font-size: 14px;
  color: #333;
  margin: 0;
}

.text-muted {
  color: #999 !important;
  font-style: italic;
}

.position-info {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.position-info > div {
  margin-bottom: 6px;
  font-size: 13px;
}

.position-info > div:last-child {
  margin-bottom: 0;
}

.history-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  padding: 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.history-item > div {
  margin-bottom: 4px;
}

.history-item > div:last-child {
  margin-bottom: 0;
}


:deep(.formkit-list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.formkit-list-item) {
  display: flex;
  gap: 8px;
  align-items: center;
}

:deep(.formkit-list-item input) {
  flex: 1;
}

</style>