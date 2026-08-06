<script setup>

import { ref, computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import { useRouter } from 'vue-router'

import COMMIT_HISTORY from '../../graphql/ontology/commitHistory.graphql'
import OntologyNetworkGraph from "@/components/ontology/OntologyNetworkGraph.vue";

import { useOntologyQuery } from "@/composables/ontology/ontologyQuery";

// Pagination
const lastVersionId = ref(null)
const versionCursorHistory = ref([])
const limit = ref(10)

// Graph display
const selectedVersion = ref(null)

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

const hasPrior = computed(() => {
  console.log(versionCursorHistory.value.length > 0)
  console.log(versionCursorHistory.value)
  return versionCursorHistory.value.length > 0
})
const hasMore = computed( () =>
    commits.value?.length < limit || true
)

const loadNext = () => {
  versionCursorHistory.value.push(lastVersionId.value)
  console.log('commits', commits.value.at(-1))
  lastVersionId.value = commits.value.at(-1).version.id
  selectedVersion.value = null
  refetch()
}

const loadPrevious = () => {
  lastVersionId.value = versionCursorHistory.value.pop()
  selectedVersion.value = null
  refetch()
}

const toggleSelectVersion = (versionId) => {
  if (selectedVersion.value === versionId) {selectedVersion.value = null}
  else selectedVersion.value = versionId
  console.log('selectedVersion', selectedVersion.value)
}


const {
    ontology,
    ontologyLoading,
    ontologyErrors,
    ontologyRefetch,
} = useOntologyQuery({ versionId: selectedVersion, view: "PUBLISHED" })

</script>

<template>
  <div class="commit-history-page">
    <h1>Commit History</h1>

    <div v-if="selectedVersion" class="graph-container">
      <OntologyNetworkGraph
        v-if="ontology"
        :ontology="ontology"
        :lifecycleFilters="false"
      />
    </div>

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
              @click="toggleSelectVersion(commit.version.id)"
              class="btn-display"
              :class="{ active: selectedVersion === commit.version.id }"
            >Display</button>
          </div>
          <div class="commit-body">
            <p><strong>Comment:</strong> {{ commit.comment || 'No comment' }}</p>
            <div v-if="commit.licence">
              <p><strong>Licence:</strong> {{ commit.licence }}</p>
            </div>
            <div v-if="commit.copyright">
              <p><strong>Copyright:</strong> {{ commit.copyright }}</p>
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
  </div>
</template>

<style scoped>
.graph-container {
  width: 100%;
  height: 600px;
  margin: 2rem 0;
  display: flex;
  flex-direction: row;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}


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

.actions {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
}

.btn-back {
  background-color: #2196F3;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-back:hover {
  background-color: #0b7dda;
}
</style>
