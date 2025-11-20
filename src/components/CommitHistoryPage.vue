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
          :disabled="offset === 0"
          class="btn-pagination"
        >
          Previous
        </button>
        <span class="pagination-info">
          Showing {{ offset + 1 }} - {{ offset + commits.length }} of {{ totalCommits || '?' }}
        </span>
        <button 
          @click="loadNext" 
          :disabled="!hasMore"
          class="btn-pagination"
        >
          Next
        </button>
      </div>

      <div class="actions">
        <button @click="goBack" class="btn-back">
          Back to Ontology Management
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import { useRouter } from 'vue-router'
import COMMIT_HISTORY from '../graphql/ontology/commitHistory.graphql'

export default {
  name: 'CommitHistoryPage',
  setup() {
    const router = useRouter()
    const offset = ref(0)
    const limit = ref(5)

    const { result, loading, error, refetch } = useQuery(
      COMMIT_HISTORY,
      () => ({
        limit: limit.value,
        offset: offset.value
      }),
      { fetchPolicy: 'network-only' }
    )

    const commits = computed(() => 
      result.value?.ontologyCommitHistory?.result || []
    )

    const totalCommits = computed(() => 
      result.value?.ontologyCommitHistory?.total || null
    )

    const hasMore = computed(() => {
      if (!totalCommits.value) return commits.value.length === limit.value
      return offset.value + commits.value.length < totalCommits.value
    })

    const formatVersion = (version) => {
      if (!version) return 'N/A'
      return `${version.major}.${version.minor}.${version.patch}`
    }

    const formatDate = (timestamp) => {
      return new Date(timestamp).toLocaleString()
    }

    const loadNext = () => {
      offset.value += limit.value
      refetch()
    }

    const loadPrevious = () => {
      offset.value = Math.max(0, offset.value - limit.value)
      refetch()
    }

    const goBack = () => {
      router.push({ name: 'Ontology' })
    }

    return {
      commits,
      loading,
      error,
      offset,
      limit,
      totalCommits,
      hasMore,
      formatVersion,
      formatDate,
      loadNext,
      loadPrevious,
      goBack
    }
  }
}
</script>

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

.pagination-info {
  color: #666;
  font-size: 0.9em;
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
