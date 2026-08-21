<script setup>

import { ref, computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import COMMIT_HISTORY from '../../graphql/ontology/commitHistory.graphql'
import OntologyGraphTools from "@/components/ontology/OntologyGraphTools.vue";
import ReferencesDisplay from "@/components/references/ReferencesDisplay.vue";

import { useOntologyQuery } from "@/composables/ontology/ontologyQuery";

// Pagination
const lastVersionId = ref(null)
const versionCursorHistory = ref([])
const limit = ref(10)

// Graph display
const selectedVersion = ref(null)
const selectedVersionLabel = ref(null)

const { result, loading, error, refetch } = useQuery(
  COMMIT_HISTORY,
  () => ({
    limit: limit.value,
    lastVersionId: lastVersionId.value
  })
)

const commits = computed(() =>
  result.value?.ontologyCommitHistory?.result || []
)

const formatVersion = (version) => {
  if (!version) return 'N/A'
  return `${version.major}.${version.minor}.${version.patch}`
}

const formatDate = (timestamp) => {
  return new Date(timestamp).toISOString()
}

const hasPrior = computed(() => versionCursorHistory.value.length > 0)
const hasMore = computed( () => commits.value?.length < limit || true)

const loadNext = () => {
  versionCursorHistory.value.push(lastVersionId.value)
  lastVersionId.value = commits.value.at(-1).version.id
  selectedVersion.value = null
  selectedVersionLabel.value = null
  refetch()
}

const loadPrevious = () => {
  lastVersionId.value = versionCursorHistory.value.pop()
  selectedVersion.value = null
  selectedVersionLabel.value = null
  refetch()
}

const openGraph = (commit) => {
  selectedVersion.value = commit.version.id
  selectedVersionLabel.value = formatVersion(commit.version)
}

const closeGraph = () => {
  selectedVersion.value = null
  selectedVersionLabel.value = null
}


const {
    ontology,
    ontologyLoading,
    ontologyErrors
} = useOntologyQuery({ versionId: selectedVersion, view: "PUBLISHED" })

</script>

<template>
  <div class="commit-history-page">
    <h1>Commit History</h1>

    <div v-if="loading">Loading commit history...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>

    <div v-else>
      <div class="commits-list">
        <div
          v-for="commit in commits"
          :key="commit.id"
          class="commit-card"
        >
          <div class="commit-header">
            <h3>Version {{ formatVersion(commit.version) }}</h3>
            <span class="commit-time">{{ formatDate(commit.time) }}</span>
            <button
              @click="openGraph(commit)"
              class="btn-display"
            >Display</button>
          </div>
          <div class="commit-body">
            <p><strong>Comment:</strong> {{ commit.comment || 'No comment' }}</p>
            <div v-if="commit.licence">
              <ReferencesDisplay :references="[commit.licence]" title="Licence"/>
            </div>
            <div v-if="commit.copyright">
              <ReferencesDisplay :references="[commit.copyright]" title="Copyright"/>
            </div>
          </div>
        </div>
      </div>

      <div class="pagination-controls">
        <button
          @click="loadPrevious"
          :disabled="!hasPrior"
          class="btn-pagination"
        >
          Previous
        </button>
        <button
          @click="loadNext"
          :disabled="!hasMore"
          class="btn-pagination"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Graph modal -->
    <Teleport to="body">
      <div
        v-if="selectedVersion"
        class="graph-modal-overlay"
        @click.self="closeGraph"
      >
        <div class="graph-modal">
          <div class="graph-modal-header">
            <h2>Ontology — Version {{ selectedVersionLabel }}</h2>
            <button class="close-btn" @click="closeGraph">&times;</button>
          </div>
          <div class="graph-modal-body">
            <OntologyGraphTools
              v-if="ontology || ontologyLoading || ontologyErrors?.length"
              :ontology="ontology"
              :ontology-loading="ontologyLoading"
              :ontology-errors="ontologyErrors"
              :lifecycle-filters="false"
              :show-create-buttons="false"
              :show-edit-buttons="false"
            />
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>

.commit-history-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.commits-list {
  margin: 2rem 0;
}

.commit-card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.commit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}

.commit-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.2em;
}

.commit-time {
  color: #666;
  font-size: 0.9em;
}

.commit-body p {
  margin: 0.5rem 0;
  color: #555;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin: 2rem 0;
}

.btn-display {
  background-color: #d0d0d0;
  color: #333;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
  font-weight: 500;
}

.btn-display:hover {
  background-color: #b8b8b8;
}

.btn-display.active {
  background-color: #4CAF50;
  color: white;
}

.btn-display.active:hover {
  background-color: #45a049;
}

.btn-pagination {
  background-color: #4CAF50;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-pagination:hover:not(:disabled) {
  background-color: #45a049;
}

.btn-pagination:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}


/* ── Graph modal ─────────────────────────────────────────────────────────── */

.graph-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.graph-modal {
  background: white;
  border-radius: 8px;
  width: 92vw;
  height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.graph-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

.graph-modal-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
  color: #666;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.graph-modal-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

</style>
