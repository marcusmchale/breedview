<template>
  <div class="teams-panel">
    <p class="intro text-muted">
      Every team tree, with the teams you belong to below its root. Request an affiliation to a team to read, write,
      curate or administer what it controls; a team's admins manage its affiliations and the teams below it.
    </p>

    <div v-if="loading" class="loading">
      Loading teams...
    </div>

    <div v-else-if="error" class="error">
      <p>Unable to load teams</p>
      <button @click="refetchTeamRoots()" class="btn btn-primary">
        Retry
      </button>
    </div>

    <template v-else>
      <!-- Every team tree's root, with the teams the user is affiliated with below it -->
      <div class="teams-section">
        <div v-if="teamRoots.length === 0" class="no-teams">
          <p>No teams found.</p>
        </div>
        <div v-else class="teams-list">
          <TeamNode
            v-for="root in teamRoots"
            :key="root.id"
            :team-data="root"
            :depth="0"
            :current-user-id="currentUserId"
            @create-team="handleCreateTeam"
            @request-affiliation="handleRequestAffiliation"
            @team-deleted="refetchTeamRoots()"
            @team-created="refetchTeamRoots()"
          />
        </div>
      </div>

      <!-- A new team tree, collapsed so the trees above stay in view -->
      <details class="create-tree-section" :open="createOpen" @toggle="createOpen = $event.target.open">
        <summary>Create a team tree</summary>
        <form @submit.prevent="submitCreateTree" class="create-tree-form">
          <div class="form-row">
            <div class="form-group">
              <label>Name:</label>
              <input
                v-model="newTree.name"
                type="text"
                required
                placeholder="The root team's name"
              />
            </div>
            <div class="form-group">
              <label>Full name (optional):</label>
              <input
                v-model="newTree.fullname"
                type="text"
                placeholder="The root team's full name"
              />
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="createLoading">
              {{ createLoading ? 'Creating...' : 'Create team tree' }}
            </button>
          </div>
        </form>
        <div v-if="createError" class="error-message">
          {{ createError }}
        </div>
        <div v-if="createSuccess" class="success-message">
          {{ createSuccess }}
        </div>
      </details>
    </template>

    <!-- Create Team Modal -->
    <CreateTeamModal
      :is-open="showCreateTeamModal"
      :parent-team="selectedParentTeam"
      @close="showCreateTeamModal = false"
      @team-created="refetchTeamRoots()"
    />

    <!-- Request Affiliation Modal -->
    <RequestAffiliationModal
      :is-open="showRequestAffiliationModal"
      :selected-team="selectedTeamForAffiliation"
      :current-user-id="currentUserId"
      @close="showRequestAffiliationModal = false"
      @affiliation-requested="refetchTeamRoots()"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import { useAuthStore } from '@/composables/user/useAuthStore'
import { useTeamRootsQuery } from '@/composables/teams/teamRootsQuery'
import CREATE_TEAM_MUTATION from '@/graphql/teams/createTeam.graphql'
import TeamNode from './TeamNode.vue'
import CreateTeamModal from './CreateTeamModal.vue'
import RequestAffiliationModal from '@/components/affiliations/RequestAffiliationModal.vue'

const { currentUserId } = useAuthStore()

const { teamRoots, teamRootsLoading, teamRootsError, refetchTeamRoots } = useTeamRootsQuery()
// a refetch keeps the tree shown; only the first load shows the loading state
const loading = computed(() => teamRootsLoading.value && teamRoots.value.length === 0)
const error = computed(() => !!teamRootsError.value && teamRoots.value.length === 0)

const showCreateTeamModal = ref(false)
const selectedParentTeam = ref(null)
const showRequestAffiliationModal = ref(false)
const selectedTeamForAffiliation = ref(null)

const handleCreateTeam = (parentTeam) => {
  selectedParentTeam.value = parentTeam
  showCreateTeamModal.value = true
}

const handleRequestAffiliation = (team) => {
  selectedTeamForAffiliation.value = team
  showRequestAffiliationModal.value = true
}

/* ---------- a new team tree ---------- */

const createOpen = ref(false)
const newTree = ref({ name: '', fullname: '' })
const createError = ref('')
const createSuccess = ref('')

const { mutate: createTeam, loading: createLoading } = useMutation(CREATE_TEAM_MUTATION)

const submitCreateTree = async () => {
  if (!newTree.value.name.trim()) return
  createError.value = ''
  createSuccess.value = ''
  const team = {
    name: newTree.value.name.trim(),
    fullname: newTree.value.fullname.trim() || null
  }
  try {
    const response = (await createTeam({ team }))?.data?.teamsCreateTeam
    if (response?.status === 'SUCCESS') {
      createSuccess.value = 'Team tree created.'
      newTree.value = { name: '', fullname: '' }
      refetchTeamRoots()
    } else {
      createError.value = response?.errors?.[0]?.message || 'Failed to create the team tree'
    }
  } catch (err) {
    console.error('Create team tree failed:', err)
    createError.value = err.message || 'Failed to create the team tree. Please try again.'
  }
}
</script>

<style scoped>
.intro {
  margin: 0 0 16px;
}

.teams-section {
  margin-bottom: 1rem;
}

.no-teams {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}

.create-tree-section {
  background: #f8f9fa;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.create-tree-section summary {
  cursor: pointer;
  font-weight: 500;
  color: #495057;
}

.create-tree-section[open] summary {
  margin-bottom: 1rem;
}

.create-tree-form .form-row {
  display: flex;
  gap: 1rem;
  align-items: end;
}

.create-tree-form > .form-actions {
  margin-top: 1rem;
}

.form-group {
  flex: 1;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #495057;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}
</style>
