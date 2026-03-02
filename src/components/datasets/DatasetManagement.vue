
<!-- src/components/datasets/DatasetManagement.vue -->
<template>
  <div class="dataset-management">
    <div class="management-header">
      <h2>Dataset Management</h2>
      <button class="btn btn-secondary" @click="openCurationModal">
        📊 View & Curate Datasets
      </button>
    </div>

    <div class="management-content">
      <div class="tree-panel">
        <h3>Programs / Trials / Studies</h3>
        <ProgramTree @study-selected="onStudySelected" />
      </div>

      <div class="main-panel">
        <div v-if="!selectedStudyId" class="empty-selection">
          <p>Select a study from the tree to view its datasets</p>
        </div>
        <StudyDatasetsPanel
          v-else
          :study="selectedStudy"
          :studyId="selectedStudyId"
          @create-dataset="openCreateModal"
        />
      </div>
    </div>

    <!-- Create Dataset Modal (DatasetSubmission) -->
    <DatasetSubmission
      v-if="showCreateModal"
      :visible="showCreateModal"
      :preselectedStudy="selectedStudy"
      @close="closeCreateModal"
      @submitted="handleDatasetCreated"
    />

    <!-- Curation Modal -->
    <DatasetCurationModal
      :visible="showCurationModal"
      @close="closeCurationModal"
      @updated="handleDatasetsUpdated"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ProgramTree from '@/components/programs/ProgramTree.vue'
import StudyDatasetsPanel from './StudyDatasetsPanel.vue'
import DatasetSubmission from './DatasetSubmission.vue'
import DatasetCurationModal from './DatasetCurationModal.vue'

const selectedStudyId = ref(null)
const selectedStudy = ref(null)

const showCreateModal = ref(false)
const showCurationModal = ref(false)

const onStudySelected = (studyId, study) => {
  selectedStudyId.value = studyId
  selectedStudy.value = study
}

const openCreateModal = () => {
  showCreateModal.value = true
}

const closeCreateModal = () => {
  showCreateModal.value = false
}

const handleDatasetCreated = () => {
  closeCreateModal()
}

const openCurationModal = () => {
  showCurationModal.value = true
}

const closeCurationModal = () => {
  showCurationModal.value = false
}

const handleDatasetsUpdated = () => {
  // Optionally refresh data or show notification
  closeCurationModal()
}
</script>

<style scoped>
.dataset-management {
  padding: 20px;
  height: 100%;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.management-header h2 {
  margin: 0;
  color: #333;
}

.management-content {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 20px;
  min-height: 600px;
}

.tree-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.tree-panel h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 8px;
}

.main-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  min-height: 600px;
}

.empty-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 16px;
  font-style: italic;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #5a6268;
}
</style>