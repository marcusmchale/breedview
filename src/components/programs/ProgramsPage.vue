<script setup>
import { ref } from 'vue'

import { useProgramsQuery } from '@/composables/programs/programsQuery'
import { useCanCreate } from '@/composables/controls/useWriteAccess'

import ProgramPanel from './ProgramPanel.vue'
import CreateProgramModal from './CreateProgramModal.vue'
import DatasetCurationModal from '@/components/datasets/DatasetCurationModal.vue'
import DatasetSubmission from '@/components/datasets/DatasetSubmission.vue'
import { useAuthStore } from '@/composables/user/useAuthStore'
import { SUBMIT_DATA, useViewDatasetsLabel } from '@/composables/datasets/datasetActions'

const {
  programs,
  programsLoading,
  programsError,
  queryErrors,
  refetchPrograms
} = useProgramsQuery()

const canCreate = useCanCreate()
const { isAuthenticated } = useAuthStore()

const showCuration = ref(false)
// data for any study, chosen in the form
const showSubmission = ref(false)
const viewDatasets = useViewDatasetsLabel()

// Create program modal state
const isCreateModalOpen = ref(false)

const openCreateModal = () => {
  isCreateModalOpen.value = true
}

const closeCreateModal = () => {
  isCreateModalOpen.value = false
}

const handleCreateSuccess = () => {
  refetchPrograms()
  closeCreateModal()
}

const handleProgramDeleted = () => {
  refetchPrograms()
}
</script>

<template>
  <div class="page-container">
    <div class="programs-header">
      <button v-if="canCreate" @click="openCreateModal" class="btn btn-primary">
        Create New Program
      </button>
      <div class="header-actions">
        <button v-if="canCreate" class="btn btn-secondary submit-data" @click="showSubmission = true">{{ SUBMIT_DATA }}</button>
        <button class="btn btn-secondary view-datasets" @click="showCuration = true">{{ viewDatasets }}</button>
        <router-link v-if="isAuthenticated" to="/analysis" class="btn btn-secondary">Analysis</router-link>
      </div>
    </div>

    <!-- Query errors -->
    <div v-if="queryErrors.length > 0" class="error-message">
      {{ queryErrors[0].message }}
    </div>

    <!-- Programs List -->
    <div class="programs-content">
      <div v-if="programsLoading && !programs.length" class="loading">
        Loading programs...
      </div>

      <div v-else-if="programsError" class="error">
        Error loading programs: {{ programsError.message }}
      </div>

      <div v-else-if="programs.length === 0" class="empty-state">
        <h3>No programs found</h3>
        <p>Create your first program to get started!</p>
      </div>

      <div v-else class="programs-grid">
        <ProgramPanel
          v-for="program in programs"
          :key="program.id"
          :programId="program.id"
          @deleted="handleProgramDeleted"
        />
      </div>
    </div>

    <!-- Curating the datasets of any studies -->
    <DatasetCurationModal :visible="showCuration" @close="showCuration = false" />
    <Teleport to="body">
      <DatasetSubmission
        v-if="showSubmission"
        :visible="showSubmission"
        @close="showSubmission = false"
        @submitted="showSubmission = false"
      />
    </Teleport>

    <!-- Create Program Modal -->
    <div v-if="isCreateModalOpen" class="modal-overlay" @click="closeCreateModal">
      <CreateProgramModal
        @close="closeCreateModal"
        @success="handleCreateSuccess"
      />
    </div>
  </div>
</template>

<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.programs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 15px;
}

.programs-header h1 {
  margin: 0;
  color: #333;
}

.programs-content {
  margin-top: 20px;
}

/* one column, so the nested trial and study cards have room */
.programs-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.header-actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  font-size: 1.1em;
}

.error {
  color: #dc3545;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty-state h3 {
  margin-bottom: 10px;
  color: #333;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  border: 1px solid #f5c6cb;
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
  text-decoration: none;
  display: inline-block;
  text-align: center;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: var(--brand-primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--brand-primary-dark);
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #5a6268;
}
</style>