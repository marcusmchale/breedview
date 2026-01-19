<script setup>
import { ref, computed } from 'vue'

import { useProgramQuery } from '@/composables/programs/programQuery'

import ControllerBadge from '@/components/controls/ControllerBadge.vue'
import ReferencesDisplay from '@/components/references/ReferencesDisplay.vue'
import TrialPanel from './TrialPanel.vue'
import UpdateProgramModal from './UpdateProgramModal.vue'
import DeleteProgramModal from './DeleteProgramModal.vue'
import CreateTrialModal from './CreateTrialModal.vue'

const props = defineProps({
  programId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['deleted'])

const {
  program,
  programLoading,
  programError,
  refetchProgram
} = useProgramQuery(() => props.programId)

// Expansion state
const expandTrials = ref(false)

const toggleExpand = () => {
  expandTrials.value = !expandTrials.value
}

// Check if program has trials
const hasTrials = computed(() => {
  return program.value?.trials && program.value.trials.length > 0
})

// Modal states
const isUpdateModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const isCreateTrialModalOpen = ref(false)

// Update modal
const openUpdateModal = () => {
  isUpdateModalOpen.value = true
}
const closeUpdateModal = () => {
  isUpdateModalOpen.value = false
}
const handleUpdateSuccess = () => {
  refetchProgram()
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

// Create trial modal
const openCreateTrialModal = () => {
  isCreateTrialModalOpen.value = true
}
const closeCreateTrialModal = () => {
  isCreateTrialModalOpen.value = false
}
const handleCreateTrialSuccess = () => {
  refetchProgram()
  closeCreateTrialModal()
}

// Handle trial deletion
const handleTrialDeleted = () => {
  refetchProgram()
}

</script>

<template>
  <div class="program-card">
    <div v-if="programLoading && !program" class="loading">Loading...</div>
    <div v-else-if="programError" class="error">Error: {{ programError.message }}</div>
    <div v-else-if="program">
      <div class="program-card-header">
        <div class="program-title-section">
          <h3>{{ program.name }}</h3>
        </div>
        <div class="program-actions">
          <button @click="openCreateTrialModal" class="btn btn-sm btn-outline">
            Create Trial
          </button>
          <button @click="openUpdateModal" class="btn btn-sm btn-outline">
            Edit
          </button>
          <button
            v-if="!hasTrials"
            @click="openDeleteModal"
            class="btn btn-sm btn-danger"
          >
            Delete
          </button>
        </div>
        <ControllerBadge
          entity-label="PROGRAM"
          :entity-id="programId"
        />
      </div>

      <div class="program-card-content">
        <p v-if="program.fullname"><strong>Full Name:</strong> {{ program.fullname }}</p>
        <p v-if="program.description"><strong>Description:</strong> {{ program.description }}</p>

        <!-- References Display -->
        <ReferencesDisplay
          :references="program.references"
          title="References"
        />

        <!-- Trials Expansion Panel -->
        <div v-if="hasTrials" class="trials-section">
          <div class="trials-header" @click="toggleExpand">
            <strong>Trials:</strong> {{ program.trials.length }}
            <span class="expand-icon">{{ expandTrials ? '▼' : '►' }}</span>
          </div>

          <div v-if="expandTrials" class="trials-list">
            <TrialPanel
              v-for="trial in program.trials"
              :key="trial.id"
              :trialId="trial.id"
              :programId="programId"
              @deleted="handleTrialDeleted"
            />
          </div>
        </div>
      </div>

      <div class="program-card-footer">

      </div>
    </div>

    <!-- Update Program Modal -->
    <div v-if="isUpdateModalOpen" class="modal-overlay" @click="closeUpdateModal">
      <UpdateProgramModal
        :program="program"
        @close="closeUpdateModal"
        @success="handleUpdateSuccess"
      />
    </div>

    <!-- Delete Program Modal -->
    <div v-if="isDeleteModalOpen" class="modal-overlay" @click="closeDeleteModal">
      <DeleteProgramModal
        :program="program"
        @close="closeDeleteModal"
        @success="handleDeleteSuccess"
      />
    </div>

    <!-- Create Trial Modal -->
    <div v-if="isCreateTrialModalOpen" class="modal-overlay" @click="closeCreateTrialModal">
      <CreateTrialModal
        :programId="programId"
        :programName="program.name"
        @close="closeCreateTrialModal"
        @success="handleCreateTrialSuccess"
      />
    </div>
  </div>
</template>

<style scoped>
.program-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s ease;
}

.program-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.program-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
  gap: 15px;
}

.program-title-section {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.program-card-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25em;
}

.program-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.program-card-content p {
  margin: 8px 0;
  color: #666;
  line-height: 1.4;
}

.program-card-content strong {
  color: #333;
}

.program-card-footer {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.trials-section {
  margin-top: 15px;
}

.trials-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.expand-icon {
  font-size: 0.8em;
  color: #666;
}

.trials-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.loading, .error {
  text-align: center;
  padding: 20px;
  color: #666;
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