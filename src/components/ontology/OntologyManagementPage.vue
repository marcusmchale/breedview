<script setup>
import { computed, ref } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import { useRouter } from 'vue-router'

import { useAuthStore } from '@/composables/user/useAuthStore'

import OntologyEditor from "@/components/ontology/OntologyEditor.vue";
import COMMIT_HISTORY from '../../graphql/ontology/commitHistory.graphql'
import { useMutateOntology } from "@/composables/ontology/mutateOntology";

const router = useRouter()
const { user } = useAuthStore()

const showCommitVersionForm = ref(false)
const commitVersionFormData = ref({})

const { commitVersionMutation } = useMutateOntology({ versionId: null })

const canEdit = computed(() => {
  console.log('user can edit:', ["ADMIN", "EDITOR"].includes( user.value?.ontologyRole ))
  return ["ADMIN", "EDITOR"].includes( user.value?.ontologyRole )
})

const canCreate = computed( () => {
  return ["ADMIN", "EDITOR", "CONTRIBUTOR"].includes( user.value?.ontologyRole )
})

// Navigation functions
const goToCommitHistory = () => {
  router.push({ name: 'commit-history' })
}

const goToOntologyRoles = () => {
  router.push({ name: 'ontology-roles' })
}


const openCommitVersionForm = () => {
  commitVersionFormData.value = {}
  showCommitVersionForm.value = true
}

const closeCommitVersionForm = () => {
  showCommitVersionForm.value = false
  commitVersionFormData.value = {}
}

const handleCommitVersionSubmit = async (formDataValues) => {
  try {
    const result = await commitVersionMutation.mutate({
      versionChange: formDataValues.versionChange,
      comment: formDataValues.comment,
      licenceId: formDataValues.licenceId ? parseInt(formDataValues.licenceId) : null,
      copyrightId: formDataValues.copyrightId ? parseInt(formDataValues.copyrightId) : null
    })

    const response = result.data?.ontologyCommitVersion

    if (response?.errors?.length) {
      alert('Error: ' + response.errors.map(e => e.message).join(', '))
      return
    }

    if (response?.status === 'SUCCESS' || response?.status === 'success') {
      alert('Ontology version committed!')
      closeCommitVersionForm()
      await latestCommitHistoryQuery.refetch()
    }
  } catch (error) {
    console.error('Commit version mutation error:', error)
    alert('An error occurred: ' + error.message)
  }
}

const latestCommitHistoryQuery = useQuery(
  COMMIT_HISTORY,
  { limit: 1 }
)

const latestCommit = computed(() =>
  latestCommitHistoryQuery.result.value?.ontologyCommitHistory?.result?.[0] || null
)

// Format helpers
const formatVersion = (version) => {
  if (!version) return 'N/A'
  return `${version.major}.${version.minor}.${version.patch}`
}

</script>

<template>
  <div class="ontology-management-page">
    <h1>Ontology</h1>

    <OntologyEditor v-if="latestCommit" :versionId="latestCommit.version.id" :editor="canEdit" :creator="canCreate"/>

    <section>
        <h2>Latest Commit</h2>
        <div v-if="latestCommit" class="latest-commit-info">
          <p><strong>Version:</strong> {{ formatVersion(latestCommit.version) }}</p>
          <p><strong>Time:</strong> {{ new Date(latestCommit.time).toLocaleString() }}</p>
          <p><strong>Comment:</strong> {{ latestCommit.comment || 'No comment' }}</p>
        </div>
        <div v-else>
          Loading commit history...
        </div>
        <div class="version-actions">
          <button
            title="View commit history"
            class="btn-version btn-history"
            @click="goToCommitHistory"
          >
            View History
          </button>
          <button
            v-if='user && (user.ontologyRole === "ADMIN" || user.ontologyRole === "EDITOR")'
            title="Commit drafted entries to active and deprecated entries to removed in a new version"
            class="btn-version"
            @click="openCommitVersionForm"
          >
            Commit Changes
          </button>
          <button
            v-if='user && user.ontologyRole === "ADMIN"'
            title="Manage Roles"
            class="btn-version btn-history"
            @click="goToOntologyRoles"
          >
            Manage Roles
          </button>
        </div>
      </section>

      <div v-if="showCommitVersionForm" class="form-modal">
          <div class="form-container">
            <h2>Commit Ontology Version</h2>
            <FormKit
              type="form"
              @submit="handleCommitVersionSubmit"
              :actions="false"
              v-model="commitVersionFormData"
            >
              <FormKit
                type="select"
                name="versionChange"
                label="Version Change Type"
                validation="required"
                placeholder="Select version change type"
                :options="['MAJOR', 'MINOR', 'PATCH']"
              />

              <FormKit
                type="textarea"
                name="comment"
                label="Version Comment"
                validation="required"
                placeholder="Enter version comment"
              />

              <FormKit
                type="number"
                name="licenceId"
                label="Licence ID (Optional)"
                placeholder="Enter licence ID"
              />

              <FormKit
                type="number"
                name="copyrightId"
                label="Copyright ID (Optional)"
                placeholder="Enter copyright ID"
              />

              <div class="form-actions">
                <button type="submit" class="btn-version">Commit</button>
                <button type="button" @click="closeCommitVersionForm" class="btn-cancel">Cancel</button>
              </div>
            </FormKit>
          </div>
        </div>
  </div>
</template>

<style scoped>

.version-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.latest-commit-info p {
  margin: 0.25rem 0;
  font-size: 0.9em;
}

.form-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.form-container {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  min-width: 400px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  justify-content: flex-end;
}

.btn-cancel {
  background-color: #f44336;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel:hover {
  background-color: #da190b;
}

.btn-version {
  background-color: #4CAF50;
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
  background-color: #2196F3;
}

.btn-history:hover {
  background-color: #0b7dda;
}

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


</style>