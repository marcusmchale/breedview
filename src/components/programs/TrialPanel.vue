<script setup>
import { ref, computed } from 'vue'

import { useTrialQuery } from '@/composables/programs/trialQuery'

import ControllerBadge from '@/components/controls/ControllerBadge.vue'
import ReferencesDisplay from '@/components/references/ReferencesDisplay.vue'
import StudyPanel from './StudyPanel.vue'
import UpdateTrialModal from './UpdateTrialModal.vue'
import DeleteTrialModal from './DeleteTrialModal.vue'
import CreateStudyModal from './CreateStudyModal.vue'

const props = defineProps({
  trialId: {
    type: Number,
    required: true
  },
  programId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['deleted'])

const {
  trial,
  trialLoading,
  trialError,
  refetchTrial
} = useTrialQuery(() => props.trialId)

// Expansion state
const expandStudies = ref(false)

const toggleExpand = () => {
  expandStudies.value = !expandStudies.value
}

// Check if trial has studies
const hasStudies = computed(() => {
  return trial.value?.studies && trial.value.studies.length > 0
})

// Modal states
const isUpdateModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const isCreateStudyModalOpen = ref(false)

// Update modal
const openUpdateModal = () => {
  isUpdateModalOpen.value = true
}
const closeUpdateModal = () => {
  isUpdateModalOpen.value = false
}
const handleUpdateSuccess = () => {
  refetchTrial()
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

// Create study modal
const openCreateStudyModal = () => {
  isCreateStudyModalOpen.value = true
}
const closeCreateStudyModal = () => {
  isCreateStudyModalOpen.value = false
}
const handleCreateStudySuccess = () => {
  refetchTrial()
  closeCreateStudyModal()
}

// Handle study deletion
const handleStudyDeleted = () => {
  refetchTrial()
}
</script>

<template>
  <div class="trial-card">
    <div v-if="trialLoading && !trial" class="loading">Loading...</div>
    <div v-else-if="trialError" class="error">Error: {{ trialError.message }}</div>
    <div v-else-if="trial">
      <div class="trial-header">
        <div class="trial-title-section">
          <strong>{{ trial.name }}</strong>
        </div>
        <div class="trial-actions">
          <button @click="openCreateStudyModal" class="btn btn-sm btn-outline">
            Create Study
          </button>
          <button @click="openUpdateModal" class="btn btn-sm btn-outline">
            Edit
          </button>
          <button
            v-if="!hasStudies"
            @click="openDeleteModal"
            class="btn btn-sm btn-danger"
          >
            Delete
          </button>
        </div>
        <ControllerBadge
          entity-label="TRIAL"
          :entity-id="trialId"
        />
      </div>

      <div class="trial-content">
        <p v-if="trial.fullname"><strong>Full Name:</strong> {{ trial.fullname }}</p>
        <p v-if="trial.description">{{ trial.description }}</p>
        <p v-if="trial.start || trial.end" class="trial-dates">
          <span v-if="trial.start"><strong>Start:</strong> {{ trial.start }}</span>
          <span v-if="trial.end"><strong>End:</strong> {{ trial.end }}</span>
        </p>

        <!-- References Display -->
        <ReferencesDisplay
          :references="trial.references"
          title="References"
        />

        <!-- Studies Expansion Panel -->
        <div v-if="hasStudies" class="studies-section">
          <div class="studies-header" @click="toggleExpand">
            <strong>Studies:</strong> {{ trial.studies.length }}
            <span class="expand-icon">{{ expandStudies ? '▼' : '►' }}</span>
          </div>

          <div v-if="expandStudies" class="studies-list">
            <StudyPanel
              v-for="study in trial.studies"
              :key="study.id"
              :studyId="study.id"
              :trialId="trialId"
              @deleted="handleStudyDeleted"
            />
          </div>
        </div>

        <div class="trial-footer">

        </div>
      </div>
    </div>

    <!-- Update Trial Modal -->
    <div v-if="isUpdateModalOpen" class="modal-overlay" @click="closeUpdateModal">
      <UpdateTrialModal
        :trial="trial"
        @close="closeUpdateModal"
        @success="handleUpdateSuccess"
      />
    </div>

    <!-- Delete Trial Modal -->
    <div v-if="isDeleteModalOpen" class="modal-overlay" @click="closeDeleteModal">
      <DeleteTrialModal
        :trial="trial"
        @close="closeDeleteModal"
        @success="handleDeleteSuccess"
      />
    </div>

    <!-- Create Study Modal -->
    <div v-if="isCreateStudyModalOpen" class="modal-overlay" @click="closeCreateStudyModal">
      <CreateStudyModal
        :trialId="trialId"
        :trialName="trial.name"
        @close="closeCreateStudyModal"
        @success="handleCreateStudySuccess"
      />
    </div>
  </div>
</template>

<style scoped>
.trial-card {
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  background: #fafafa;
}

.trial-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  gap: 10px;
}

.trial-title-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.trial-actions {
  display: flex;
  gap: 5px;
}

.trial-content {
  color: #666;
}

.trial-content p {
  margin: 5px 0;
}

.trial-dates {
  display: flex;
  gap: 15px;
  font-size: 0.9em;
}

.trial-footer {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e9ecef;
}

.studies-section {
  margin-top: 10px;
}

.studies-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
}

.expand-icon {
  font-size: 0.8em;
  color: #666;
}

.studies-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
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