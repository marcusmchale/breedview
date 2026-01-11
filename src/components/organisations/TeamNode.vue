<template>
  <div class="team-node" :style="{ marginLeft: depth * 20 + 'px' }">
    <div class="team-header">
      <div class="team-title-row">
        <div class="team-title">
          <button
            v-if="hasChildren"
            @click="toggleExpanded"
            class="btn-clickable expand-button"
            :class="{ expanded: isExpanded }"
          >
            {{ isExpanded ? '▼' : '▶' }}
          </button>
          <div v-else class="expand-spacer"></div>
          <h3>{{ teamInfo.fullname || teamInfo.name }}</h3>
        </div>

        <AffiliationBadges
          :team-affiliations="teamInfo.affiliations"
          :current-user-id="currentUserId"
          @badge-click="showAffiliationDialog"
        />
      </div>

      <div class="team-meta">
        <p><strong>ID:</strong> {{ teamInfo.id }}</p>
        <p><strong>Name:</strong> {{ teamInfo.name }}</p>
        <p v-if="teamInfo.fullname"><strong>Full Name:</strong> {{ teamInfo.fullname }}</p>
        <p><strong>Children:</strong> {{ teamInfo.children?.length || 0 }}</p>
      </div>
    </div>

    <TeamActions
      :user-is-admin="userIsAdminForTeam"
      :has-children="hasChildren"
      :delete-team-loading="deleteTeamLoading"
      :delete-team-error="deleteTeamError"
      @request-affiliation="emit('request-affiliation', teamInfo)"
      @manage-affiliations="showManageAffiliationsModal"
      @create-team="emit('create-team', teamInfo)"
      @delete-team="handleDeleteTeam"
    />

    <div v-if="isExpanded" class="children-section">
      <div v-if="childrenLoading" class="loading">Loading...</div>
      <div v-else-if="childrenError" class="error">{{ childrenError }}</div>
      <div v-else-if="childrenData.length > 0" class="teams-list">
        <TeamNode
          v-for="child in childrenData"
          :key="child.id"
          :team-data="child"
          :depth="depth + 1"
          :current-user-id="currentUserId"
          @create-team="emit('create-team', $event)"
          @request-affiliation="emit('request-affiliation', $event)"
          @team-deleted="handleChildTeamDeleted"
          @team-created="handleTeamCreated"
        />
      </div>
      <div v-else class="no-teams">
        <p>No teams found.</p>
      </div>
    </div>

    <!-- Modals remain the same -->
    <AffiliationDetailsModal
      :is-open="showAffiliationModal"
      :selected-affiliation="selectedAffiliation"
      :team-name="teamInfo.fullname || teamInfo.name"
      :remove-affiliation-loading="removeAffiliationLoading"
      :remove-affiliation-error="removeAffiliationError"
      @close="closeAffiliationDialog"
      @remove-affiliation="handleRemoveAffiliation"
    />

    <ManageAffiliationsModal
      :is-open="showManageAffiliationsDialog"
      :team-info="teamInfo"
      :current-user-id="currentUserId"
      @close="closeManageAffiliationsModal"
      @affiliation-updated="handleAffiliationUpdated"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import DELETE_TEAM_MUTATION from '../../graphql/organisations/deleteTeam.graphql'
import REMOVE_AFFILIATION_MUTATION from '../../graphql/account/removeAffiliation.graphql'
import { useTeamData } from '@/composables/organisations/useTeamData'
import AffiliationBadges from '../affiliations/AffiliationBadges.vue'
import TeamActions from './TeamActions.vue'
import AffiliationDetailsModal from '../affiliations/AffiliationDetailsModal.vue'
import ManageAffiliationsModal from '../affiliations/ManageAffiliationsModal.vue'

const props = defineProps({
  teamData: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  currentUserId: { type: [String, Number], required: true }
})

const emit = defineEmits(['create-team', 'request-affiliation', 'team-deleted', 'team-created'])

// Use the composable for team data management
const {
  teamInfo, isExpanded, childrenData, childrenLoading, childrenError,
  hasChildren, userIsAdminForTeam, refreshTeamData, toggleExpanded
} = useTeamData(props.teamData, props.currentUserId)

// Modal states
const showAffiliationModal = ref(false)
const selectedAffiliation = ref({ accessType: '', data: null })
const removeAffiliationError = ref('')
const showManageAffiliationsDialog = ref(false)
const deleteTeamError = ref('')

// Mutations
const { mutate: deleteTeamMutation, loading: deleteTeamLoading } = useMutation(DELETE_TEAM_MUTATION)
const { mutate: removeAffiliationMutation, loading: removeAffiliationLoading } = useMutation(REMOVE_AFFILIATION_MUTATION)

// Event handlers
const showAffiliationDialog = (accessType, affiliationData) => {
  selectedAffiliation.value = { accessType, data: affiliationData }
  showAffiliationModal.value = true
  removeAffiliationError.value = ''
}

const closeAffiliationDialog = () => {
  showAffiliationModal.value = false
  selectedAffiliation.value = { accessType: '', data: null }
  removeAffiliationError.value = ''
}

const showManageAffiliationsModal = () => {
  showManageAffiliationsDialog.value = true
}

const closeManageAffiliationsModal = () => {
  showManageAffiliationsDialog.value = false
}

const handleAffiliationUpdated = async () => {
  await refreshTeamData()
}

const handleRemoveAffiliation = async () => {
  try {
    removeAffiliationError.value = ''
    const response = await removeAffiliationMutation({
      team: teamInfo.value.id,
      access: selectedAffiliation.value.accessType
    })

    if (response?.data?.accountsRemoveAffiliation?.status === 'SUCCESS') {
      closeAffiliationDialog()
      await refreshTeamData()
    } else {
      removeAffiliationError.value = response?.data?.accountsRemoveAffiliation?.errors?.[0]?.message || 'Failed to remove affiliation'
    }
  } catch (error) {
    console.error('Remove affiliation error:', error)
    removeAffiliationError.value = error.message || 'An unexpected error occurred'
  }
}

const handleDeleteTeam = async () => {
  try {
    deleteTeamError.value = ''
    const response = await deleteTeamMutation({ team: props.teamData.id })

    if (response?.data?.organisationsDeleteTeam?.status === 'SUCCESS') {
      emit('team-deleted', props.teamData.id)
    } else {
      deleteTeamError.value = response?.data?.organisationsDeleteTeam?.errors?.[0]?.message || 'Failed to delete team'
    }
  } catch (error) {
    deleteTeamError.value = error.message || 'An error occurred'
  }
}

const handleChildTeamDeleted = (teamId) => {
  childrenData.value = childrenData.value.filter(child => child.id !== teamId)
  if (teamInfo.value.children) {
    teamInfo.value.children = teamInfo.value.children.filter(child => child.id !== teamId)
  }
  if (childrenData.value.length === 0) {
    isExpanded.value = false
  }
}

const handleTeamCreated = (teamId) => {
  emit('team-created', teamId)
}

// Global event listeners (keeping the existing functionality)
const handleGlobalTeamCreated = async (event) => {
  const { parentTeamId } = event.detail
  if (parentTeamId === props.teamData.id) {
    await refreshTeamData()
  }
}

const handleGlobalAffiliationRequested = async (event) => {
  const { teamId } = event.detail
  if (teamId === props.teamData.id) {
    await refreshTeamData()
  }
}

onMounted(() => {
  window.addEventListener('team-created', handleGlobalTeamCreated)
  window.addEventListener('affiliation-requested', handleGlobalAffiliationRequested)
})

onUnmounted(() => {
  window.removeEventListener('team-created', handleGlobalTeamCreated)
  window.removeEventListener('affiliation-requested', handleGlobalAffiliationRequested)
})
</script>

<style scoped>
.team-node {
  margin-bottom: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background-color: #fafafa;
}

.team-header {
  padding: 1rem;
}

.team-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.team-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.team-title h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.expand-button {
  width: 24px;
  height: 24px;
  border: none;
  background: #f0f0f0;
  border-radius: 3px;
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-spacer {
  width: 24px;
  height: 24px;
}

.team-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.875rem;
  color: #666;
}

.team-meta p {
  margin: 0;
}

.children-section {
  border-top: 1px solid #e0e0e0;
  background-color: #f9f9f9;
  padding: 1rem;
}

.no-teams {
  text-align: center;
  color: #666;
  font-style: italic;
}
</style>
