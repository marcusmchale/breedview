<script setup>
import {computed, ref} from "vue";

//import { useDefinePositionQueries} from "@/composables/blocks/definePositionQueries";
import { useMutatePositions } from "@/composables/blocks/mutatePositions";
import AddPositionModal from "@/components/blocks/addPositionModal.vue";

const props = defineProps({
  unitId: {
    type: Number,
    required: true
  },
  positions: {
    type: Array,
    required: true
  }
})

const {
  removePosition,
  removePositionLoading,
  removePositionError
} = useMutatePositions({unitId: props.unitId})

const currentPosition = computed(() => {
  if (!props.positions?.length) return null
  // First try to find a position with no end date
  const activePosition = props.positions.find(p => !p.end)
  if (activePosition) return activePosition
  // Otherwise return the position with the most recent start date
  return props.positions.reduce((latest, current) => {
    if (!latest) return current
    const latestStart = latest.start ? new Date(latest.start) : new Date(0)
    const currentStart = current.start ? new Date(current.start) : new Date(0)
    return currentStart > latestStart ? current : latest
  }, null)
})

const showHistory = ref(false)

const isAddPositionModalOpen = ref(false)
const openAddPositionModal = () => {
  isAddPositionModalOpen.value = true
}
const closeAddPositionModal = () => {
  isAddPositionModalOpen.value = false
}

const submitRemovePosition = async (position) => {
  try {
    removePositionError.value = ''

    const { status, errors } = await removePosition(position)

    if (status !== 'SUCCESS') {
      if (errors && errors.length > 0) {
        removePositionError.value = errors.map(err => err.message).join(', ')
      } else {
        removePositionError.value = 'Failed to remove position. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error removing position:', error)
    removePositionError.value = error.message || 'An unexpected error occurred.'
  }
}

// this is just in case we want to change the date formatting in the future
const formatDate = (dateString) => {
  if (!dateString) return ''
  return dateString
}

</script>

<template>
<div class="position-info">
    <button
    @click="openAddPositionModal"
    class="btn btn-sm btn-add-position"
    title="Add position"
  >
    + Position
  </button><br><br>
  <strong>Current Position:</strong>
  <div class="position-content">
    <div>Location: {{ currentPosition.location.name }}</div>
    <div v-if="currentPosition.layout">
      Layout: {{ currentPosition.layout.name || `${currentPosition.layout.type.name} ${currentPosition.layout.type.id}` }}
    </div>
    <div v-if="currentPosition.coordinates && currentPosition.coordinates.length > 0">
      Coordinates: {{ currentPosition.coordinates.join(', ') }}
    </div>
    <div v-if="currentPosition.start">
      Start: {{ formatDate(currentPosition.start) }}
    </div>
    <div v-if="currentPosition.end">
      End: {{ formatDate(currentPosition.end) }}
    </div>
  </div>
</div>

<div v-if="positions && positions.length > 1" class="position-history">
  <button @click="showHistory = !showHistory" class="btn btn-sm btn-link">
    {{ showHistory ? 'Hide' : 'View' }} Position History ({{ positions.length }})
  </button>
  <div v-if="removePositionLoading"> Removing position </div>
  <div v-else-if="removePositionError" class="error-message">
    {{ removePositionError }}
  </div>
  <div v-if="showHistory" class="history-list">
    <div
      v-for="(pos, index) in positions"
      :key="index"
      class="history-item"
  >
      <div>Location: {{ pos.location.name }}</div>
      <div v-if="pos.layout">Layout: {{ pos.layout.name || `${pos.layout.type.name} ${pos.layout.type.id}`}}</div>
      <div v-if="pos.coordinates && pos.coordinates.length > 0">
        Coordinates: {{ pos.coordinates.join(', ') }}
      </div>
      <div v-if="pos.start">Start: {{ formatDate(pos.start) }}</div>
      <div v-if="pos.end">End: {{ formatDate(pos.end) }}</div>
      <button
        @click="submitRemovePosition(pos)"
        class="btn btn-sm btn-add-position"
        title="Remove position record"
      >
      - Position
      </button>
    </div>
  </div>
</div>
<div v-if="isAddPositionModalOpen" class="modal-overlay" @click="closeAddPositionModal">
  <AddPositionModal
      :unitId="unitId"
      :currentPosition="currentPosition"
      @close="closeAddPositionModal"
  />
</div>

</template>

<style scoped>

.unit-node {
  display: flex;
  flex-direction: column;
}

.unit-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  justify-content: space-between;
}

.expand-btn,
.expand-placeholder {
  min-width: 24px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: #666;
  font-size: 12px;
  transition: transform 0.2s;
  margin-top: 4px;
}

.expand-btn.expanded {
  transform: rotate(90deg);
}

.expand-btn:hover {
  color: #333;
}

.expand-placeholder {
  background: none;
  border: none;
}

.unit-info {
  flex: 1;
}

.unit-name {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.unit-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
  flex-wrap: wrap;
}

.subject-badge {
  display: inline-block;
  background: #e8f5e9;
  color: #2e7d32;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.position-badge {
  display: inline-block;
  background: #fff3e0;
  color: #e65100;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.unit-description {
  margin: 6px 0 0 0;
  font-size: 13px;
  color: #666;
}

.position-details {
  margin-top: 12px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.position-info {
  font-size: 13px;
}

.position-content {
  margin-top: 6px;
  padding-left: 12px;
}

.position-content > div {
  margin-bottom: 4px;
  color: #555;
}

.position-history {
  margin-top: 12px;
}

.history-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  padding: 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.history-item > div {
  margin-bottom: 3px;
  color: #555;
}

.history-item > div:last-child {
  margin-bottom: 0;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 12px;
  align-items: flex-end;
  flex-shrink: 0;
}

.actions .btn-sm {
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  padding: 4px 8px;
  font-size: 11px;
  white-space: nowrap;
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

.btn-link {
  background: none;
  color: #007bff;
  text-decoration: underline;
  padding: 4px 0;
}

.btn-link:hover {
  color: #0056b3;
}

.btn-edit {
  background-color: #17a2b8;
  color: white;
}

.btn-edit:hover:not(:disabled) {
  background-color: #138496;
}

.btn-add-position {
  background-color: #ffc107;
  color: #333;
}

.btn-add-position:hover:not(:disabled) {
  background-color: #e0a800;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.btn-add-child {
  background-color: #28a745;
  color: white;
}

.btn-add-child:hover:not(:disabled) {
  background-color: #218838;
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

.children {
  margin-left: 36px;
  margin-top: 12px;
  padding-left: 12px;
  border-left: 2px solid #e0e0e0;
}

.child-item {
  margin-bottom: 12px;
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

.info-text {
  padding: 10px;
  background: #e3f2fd;
  border-radius: 4px;
  font-size: 14px;
  color: #333;
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

.delete-warning {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 14px;
}

.delete-warning-children {
  margin: 8px 0 16px 0;
  color: #d9534f;
  font-size: 13px;
  padding: 8px 12px;
  background-color: #f5e6e6;
  border-radius: 4px;
}
</style>