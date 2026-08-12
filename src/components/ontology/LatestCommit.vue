<script setup>
import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/composables/user/useAuthStore'

import COMMIT_HISTORY from '@/graphql/ontology/commitHistory.graphql'

const emit = defineEmits(['commit'])

const router = useRouter()
const { user } = useAuthStore()

const { result, refetch } = useQuery(COMMIT_HISTORY, { limit: 1 })

const latestCommit = computed(
  () => result.value?.ontologyCommitHistory?.result?.[0] || null
)

const formatVersion = (version) => {
  if (!version) return 'N/A'
  return `${version.major}.${version.minor}.${version.patch}`
}
</script>

<template>
  <section>
    <h2>Latest Commit</h2>
    <div v-if="latestCommit" class="latest-commit-info">
      <p><strong>Version:</strong> {{ formatVersion(latestCommit.version) }}</p>
      <p><strong>Time:</strong> {{ new Date(latestCommit.time).toLocaleString() }}</p>
      <p><strong>Comment:</strong> {{ latestCommit.comment || 'No comment' }}</p>
    </div>
    <div v-else>Loading commit history...</div>

    <div class="version-actions">
      <button
        title="View commit history"
        class="btn-version btn-history"
        @click="router.push({ name: 'commit-history' })"
      >
        View History
      </button>
      <button
        v-if='user && (user.ontologyRole === "ADMIN" || user.ontologyRole === "EDITOR")'
        title="Commit drafted entries to active and deprecated entries to removed in a new version"
        class="btn-version"
        @click="emit('commit')"
      >
        Commit Changes
      </button>
      <button
        v-if='user && user.ontologyRole === "ADMIN"'
        title="Manage Roles"
        class="btn-version btn-history"
        @click="router.push({ name: 'ontology-roles' })"
      >
        Manage Roles
      </button>
    </div>
  </section>
</template>

<style scoped>
.latest-commit-info {
  background-color: #f4f4f4;
  border-radius: 4px;
  padding: 1rem;
  margin-top: 0.5rem;
}

.latest-commit-info p {
  margin: 0.25rem 0;
  font-size: 0.9em;
}

.version-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn-version {
  background-color: #4caf50;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-version:hover {
  background-color: #45a049;
}

.btn-history {
  background-color: #2196f3;
}

.btn-history:hover {
  background-color: #0b7dda;
}
</style>