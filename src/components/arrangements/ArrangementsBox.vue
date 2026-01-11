<script setup>

import { ref, toRef } from 'vue'

import { useArrangementsBoxQueries } from "@/composables/arrangements/arrangementsBoxQueries";

import LayoutNode from './LayoutNode.vue'
import CreateArrangementModal from "@/components/arrangements/createArrangementModal.vue";

const props = defineProps({
  locationId: {
    type: Number,
    required: true
  }
})

const locationId = toRef(props, "locationId")
const {
    arrangements,
    arrangementsLoading,
    arrangementsError,
    refetchArrangements,
    layoutTypes
} = useArrangementsBoxQueries(locationId)


// Add Layout Modal state
const isAddLayoutModalOpen = ref(false)
const openAddLayoutModal = () => {
  isAddLayoutModalOpen.value = true
}
const closeAddLayoutModal = () => {
  isAddLayoutModalOpen.value = false
}
const handleAddLayoutSuccess = () => {
  refetchArrangements()
}

// Layout details modal state
const selectedLayout = ref(null)
const openLayoutDetailsModal = (layout) => {
  selectedLayout.value = layout
}

const closeLayoutDetailsModal = () => {
  selectedLayout.value = null
}

</script>

<template>
  <div class="arrangements-box">
    <div class="arrangements-header">
      <h5>Arrangements</h5>
      <button
        @click="openAddLayoutModal"
        class="btn btn-sm btn-add-layout"
        title="Create new arrangements"
      >
        + New Layout
      </button>
    </div>

    <div v-if="arrangementsLoading" class="loading">
      Loading arrangements...
    </div>
    <div v-else-if="arrangementsError" class="error">
      Error loading arrangements!
    </div>
    <div v-else-if="arrangements.length === 0" class="empty-state">
      No arrangements at this location
    </div>
    <div v-else class="layouts-list">
      <div
        v-for="layout in arrangements"
        :key="`layoutNode_${layout?.id}`"
        class="layout-item"
        @click.prevent="openLayoutDetailsModal(layout)"
      >
        <span class="layout-name">{{ layout.name || `${layout.type?.name} ${layout.id}` }}</span>
        <span class="layout-subject">{{ layout.type?.name }}</span>
      </div>
    </div>

    <div v-if="isAddLayoutModalOpen" class="modal-overlay" @click="closeAddLayoutModal">
      <CreateArrangementModal
          :layoutTypes="layoutTypes"
          :locationId="locationId"
          @close="closeAddLayoutModal"
          @success="handleAddLayoutSuccess"
      />
    </div>

    <!-- Layout details modal -->
    <div v-if="selectedLayout" class="modal-overlay" @click="closeLayoutDetailsModal">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
         <h4>{{ selectedLayout.name || `${selectedLayout.type.name} ${selectedLayout.id}` }}</h4>
         <button @click="closeLayoutDetailsModal" class="modal-close">&times;</button>
        </div>

        <div class="layout-details">
          <LayoutNode
            :key="selectedLayout.id"
            :layoutId="selectedLayout.id"
            :arrangementId="selectedLayout.id"
            :layoutTypes="layoutTypes"
            @close="closeLayoutDetailsModal"
          />
        </div>
      </div>
    </div>
  </div>
</template>


<style scoped>
.arrangements-box {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #f9f9f9;
}

.arrangements-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.arrangements-header h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}


.layout-name {
  font-weight: 500;
  color: #333;
  font-size: 13px;
}

.layout-subject {
  font-size: 11px;
  color: #666;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 10px;
}

.btn-add-layout {
  background-color: #28a745;
  color: white;
  white-space: nowrap;
}

.btn-add-layout:hover:not(:disabled) {
  background-color: #218838;
}

.loading,
.empty-state {
  text-align: center;
  padding: 20px;
  color: #666;
  font-size: 13px;
}

.layouts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layout-item {
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

.layout-item:hover {
  background-color: #e3f2fd;
}

.layout-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}


/* Axes section styling */
.axes-section {
  padding: 12px;
  background-color: #f0f8ff;
  border: 1px solid #d0e8ff;
  border-radius: 4px;
  margin-top: 8px;
}

.axes-section h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}



/* Modal styles */
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
  max-width: 450px;
  width: 90%;
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
}

.modal-close:hover:not(:disabled) {
  background-color: #e9ecef;
  border-radius: 50%;
}

.modal-close:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.modal-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>