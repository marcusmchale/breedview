<script setup>
import { ref } from 'vue'

import { useStudyQuery } from '@/composables/programs/studyQuery'

import ControllerBadge from '@/components/controls/ControllerBadge.vue'
import ReferencesDisplay from '@/components/references/ReferencesDisplay.vue'
import UpdateStudyModal from './UpdateStudyModal.vue'
import DeleteStudyModal from './DeleteStudyModal.vue'

const props = defineProps({
  studyId: {
    type: Number,
    required: true
  },
  trialId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['deleted'])

const {
  study,
  studyLoading,
  studyError,
  refetchStudy
} = useStudyQuery(() => props.studyId)

console.log('study', study.value)

// Modal states
const isUpdateModalOpen = ref(false)
const isDeleteModalOpen = ref(false)

// Update modal
const openUpdateModal = () => {
  isUpdateModalOpen.value = true
}
const closeUpdateModal = () => {
  isUpdateModalOpen.value = false
}
const handleUpdateSuccess = () => {
  refetchStudy()
  closeUpdateModal()
}

// Delete modal
const openDeleteModal = () => {
  isDeleteModalOpen.value = true
}
const closeDeleteModal = () => {
  isDeleteModalOpen.value = false
}
const handleDeleteSuccess = () => {
  closeDeleteModal()
  emit('deleted')
}
</script>

<template>
  <div class="study-card">
    <div v-if="studyLoading && !study" class="loading">Loading...</div>
    <div v-else-if="studyError" class="error">Error: {{ studyError.message }}</div>
    <div v-else-if="study">
      <div class="study-header">
        <div class="study-title-section">
          <strong>{{ study.name }}</strong>
        </div>
        <div class="study-actions">
          <button @click="openUpdateModal" class="btn btn-sm btn-outline">
            Edit
          </button>
          <button @click="openDeleteModal" class="btn btn-sm btn-danger">
            Delete
          </button>
        </div>
        <ControllerBadge
          entity-label="STUDY"
          :entity-id="studyId"
        />
      </div>

      <div class="study-content">
        <p v-if="study.fullname"><strong>Full Name:</strong> {{ study.fullname }}</p>
        <p v-if="study.description">{{ study.description }}</p>
        <p v-if="study.start || study.end" class="study-dates">
          <span v-if="study.start"><strong>Start:</strong> {{ study.start }}</span>
          <span v-if="study.end"><strong>End:</strong> {{ study.end }}</span>
        </p>
        <p v-if="study.design"><strong>Design:</strong> {{ study.design.name }}</p>
        <p v-if="study.practices"><strong>Practices:</strong> {{ study.practices }}</p>

        <!-- Licence Display -->
        <div v-if="study.licence" class="licence-display">
          <strong>Licence:</strong>
          <span class="licence-info">
            ⚖️ {{ study.licence.description || 'Legal Reference #' + study.licence.id }}
          </span>
        </div>

        <!-- References Display -->
        <ReferencesDisplay
          :references="study.references"
          title="References"
        />
      </div>
    </div>

    <!-- Update Study Modal -->
    <div v-if="isUpdateModalOpen" class="modal-overlay" @click="closeUpdateModal">
      <UpdateStudyModal
        :study="study"
        @close="closeUpdateModal"
        @success="handleUpdateSuccess"
      />
    </div>

    <!-- Delete Study Modal -->
    <div v-if="isDeleteModalOpen" class="modal-overlay" @click="closeDeleteModal">
      <DeleteStudyModal
        :study="study"
        @close="closeDeleteModal"
        @success="handleDeleteSuccess"
      />
    </div>
  </div>
</template>

<style scoped>
.study-card {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 12px;
  background: white;
}

.study-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 10px;
}

.study-title-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.study-actions {
  display: flex;
  gap: 5px;
}

.study-content {
  color: #666;
  font-size: 0.9em;
}

.study-content p {
  margin: 4px 0;
}

.study-dates {
  display: flex;
  gap: 15px;
}

.licence-display {
  margin-top: 8px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

.licence-info {
  margin-left: 8px;
  color: #333;
}

.loading, .error {
  text-align: center;
  padding: 10px;
  color: #666;
  font-size: 0.9em;
}

.error {
  color: #dc3545;
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
  z-index: 1000;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-outline {
  background-color: transparent;
  color: #007bff;
  border: 1px solid #007bff;
}

.btn-outline:hover {
  background-color: #007bff;
  color: white;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover {
  background-color: #c82333;
}
</style>