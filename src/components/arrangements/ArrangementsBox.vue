<script setup>
import { ref, toRef } from 'vue'

import { useArrangementsBoxQueries } from "@/composables/arrangements/arrangementsBoxQueries"

import CreateArrangementModal from "@/components/arrangements/createArrangementModal.vue"

const props = defineProps({
  locationId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['arrangement-selected'])

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

// Selected arrangement
const selectedArrangementId = ref(null)
const handleArrangementClick = (arrangement) => {
  selectedArrangementId.value = arrangement.id
  emit('arrangement-selected', arrangement.id, layoutTypes.value)
}
</script>

<template>
  <div class="arrangements-box">
    <div class="arrangements-header">
      <h5>Arrangements</h5>
      <button
        @click="openAddLayoutModal"
        class="btn btn-sm btn-add-layout"
        title="Create new arrangement"
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
        :class="{ selected: selectedArrangementId === layout.id }"
        @click="handleArrangementClick(layout)"
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
  </div>
</template>

<style scoped>
.arrangements-box {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #f9f9f9;
  height: 100%;
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
  transition: all 0.2s;
}

.layout-item:hover {
  background-color: #f5f5f5;
  border-color: #bbb;
}

.layout-item.selected {
  background-color: #e3f2fd;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
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