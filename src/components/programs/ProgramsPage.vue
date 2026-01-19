<script setup>
import { ref } from 'vue'

import { useProgramsQuery } from '@/composables/programs/programsQuery'

import ProgramPanel from './ProgramPanel.vue'
import CreateProgramModal from './CreateProgramModal.vue'

const {
  programs,
  programsLoading,
  programsError,
  queryErrors,
  refetchPrograms
} = useProgramsQuery()

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
      <h1>Programs</h1>
      <button @click="openCreateModal" class="btn btn-primary">
        Create New Program
      </button>
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

.programs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  gap: 20px;
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
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
}
</style>