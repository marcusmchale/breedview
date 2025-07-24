<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal modal-large">
      <h3>Manage Affiliations - {{ teamInfo?.fullname || teamInfo?.name }}</h3>

      <div class="affiliations-management">
        <!-- Read Affiliations -->
        <div v-if="allTeamAffiliations.read?.length > 0" class="affiliation-section">
          <h4>Read Access</h4>
          <div class="affiliation-list">
            <div
              v-for="affiliation in allTeamAffiliations.read"
              :key="`read-${affiliation.user.id}`"
              class="affiliation-item"
            >
              <div class="affiliation-info">
                <strong>{{ affiliation.user.fullname || affiliation.user.name || `User ${affiliation.user.id}` }}</strong>
                <div class="user-meta">
                  <span v-if="affiliation.user.name" class="username">@{{ affiliation.user.name }}</span>
                  <span v-if="affiliation.user.email" class="email">{{ affiliation.user.email }}</span>
                </div>
                <span class="affiliation-meta">
                  {{ affiliation.heritable ? 'Heritable' : 'Direct only' }} |
                  <span :class="getStatusClass(affiliation.authorisation)">
                    {{ getStatusText(affiliation.authorisation) }}
                  </span>
                </span>
              </div>
              <div class="affiliation-actions">
                <button
                  v-if="affiliation.authorisation === 'REQUESTED'"
                  @click="handleApproveAffiliation(affiliation.user.id, 'READ', affiliation.heritable)"
                  :disabled="approveAffiliationLoading"
                  class="btn btn-sm btn-success"
                >
                  {{ approveAffiliationLoading ? 'Approving...' : 'Approve' }}
                </button>
                <button
                  v-if="affiliation.authorisation === 'AUTHORISED'"
                  @click="handleRevokeAffiliation(affiliation.user.id, 'READ')"
                  :disabled="revokeAffiliationLoading"
                  class="btn btn-sm btn-warning"
                >
                  {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Write Affiliations -->
        <div v-if="allTeamAffiliations.write?.length > 0" class="affiliation-section">
          <h4>Write Access</h4>
          <div class="affiliation-list">
            <div
              v-for="affiliation in allTeamAffiliations.write"
              :key="`write-${affiliation.user.id}`"
              class="affiliation-item"
            >
              <div class="affiliation-info">
                <strong>{{ affiliation.user.fullname || affiliation.user.name || `User ${affiliation.user.id}` }}</strong>
                <div class="user-meta">
                  <span v-if="affiliation.user.name" class="username">@{{ affiliation.user.name }}</span>
                  <span v-if="affiliation.user.email" class="email">{{ affiliation.user.email }}</span>
                </div>
                <span class="affiliation-meta">
                  {{ affiliation.heritable ? 'Heritable' : 'Direct only' }} |
                  <span :class="getStatusClass(affiliation.authorisation)">
                    {{ getStatusText(affiliation.authorisation) }}
                  </span>
                </span>
              </div>
              <div class="affiliation-actions">
                <button
                  v-if="affiliation.authorisation === 'REQUESTED'"
                  @click="handleApproveAffiliation(affiliation.user.id, 'WRITE', affiliation.heritable)"
                  :disabled="approveAffiliationLoading"
                  class="btn btn-sm btn-success"
                >
                  {{ approveAffiliationLoading ? 'Approving...' : 'Approve' }}
                </button>
                <button
                  v-if="affiliation.authorisation === 'AUTHORISED'"
                  @click="handleRevokeAffiliation(affiliation.user.id, 'WRITE')"
                  :disabled="revokeAffiliationLoading"
                  class="btn btn-sm btn-warning"
                >
                  {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Admin Affiliations -->
        <div v-if="allTeamAffiliations.admin?.length > 0" class="affiliation-section">
          <h4>Admin Access</h4>
          <div class="affiliation-list">
            <div
              v-for="affiliation in allTeamAffiliations.admin"
              :key="`admin-${affiliation.user.id}`"
              class="affiliation-item"
            >
              <div class="affiliation-info">
                <strong>{{ affiliation.user.fullname || affiliation.user.name || `User ${affiliation.user.id}` }}</strong>
                <div class="user-meta">
                  <span v-if="affiliation.user.name" class="username">@{{ affiliation.user.name }}</span>
                  <span v-if="affiliation.user.email" class="email">{{ affiliation.user.email }}</span>
                </div>
                <span class="affiliation-meta">
                  {{ affiliation.heritable ? 'Heritable' : 'Direct only' }} |
                  <span :class="getStatusClass(affiliation.authorisation)">
                    {{ getStatusText(affiliation.authorisation) }}
                  </span>
                </span>
              </div>
              <div class="affiliation-actions">
                <button
                  v-if="affiliation.authorisation === 'REQUESTED'"
                  @click="handleApproveAffiliation(affiliation.user.id, 'ADMIN', affiliation.heritable)"
                  :disabled="approveAffiliationLoading"
                  class="btn btn-sm btn-success"
                >
                  {{ approveAffiliationLoading ? 'Approving...' : 'Approve' }}
                </button>
                <button
                  v-if="affiliation.authorisation === 'AUTHORISED' && affiliation.user.id != currentUserId"
                  @click="handleRevokeAffiliation(affiliation.user.id, 'ADMIN')"
                  :disabled="revokeAffiliationLoading"
                  class="btn btn-sm btn-warning"
                >
                  {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                </button>
                <span v-if="affiliation.user.id == currentUserId" class="self-admin-note">
                  (You cannot revoke your own admin access)
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Curate Affiliations -->
        <div v-if="allTeamAffiliations.curate?.length > 0" class="affiliation-section">
          <h4>Curate Access</h4>
          <div class="affiliation-list">
            <div
              v-for="affiliation in allTeamAffiliations.curate"
              :key="`curate-${affiliation.user.id}`"
              class="affiliation-item"
            >
              <div class="affiliation-info">
                <strong>{{ affiliation.user.fullname || affiliation.user.name || `User ${affiliation.user.id}` }}</strong>
                <div class="user-meta">
                  <span v-if="affiliation.user.name" class="username">@{{ affiliation.user.name }}</span>
                  <span v-if="affiliation.user.email" class="email">{{ affiliation.user.email }}</span>
                </div>
                <span class="affiliation-meta">
                  {{ affiliation.heritable ? 'Heritable' : 'Direct only' }} |
                  <span :class="getStatusClass(affiliation.authorisation)">
                    {{ getStatusText(affiliation.authorisation) }}
                  </span>
                </span>
              </div>
              <div class="affiliation-actions">
                <button
                  v-if="affiliation.authorisation === 'REQUESTED'"
                  @click="handleApproveAffiliation(affiliation.user.id, 'CURATE', affiliation.heritable)"
                  :disabled="approveAffiliationLoading"
                  class="btn btn-sm btn-success"
                >
                  {{ approveAffiliationLoading ? 'Approving...' : 'Approve' }}
                </button>
                <button
                  v-if="affiliation.authorisation === 'AUTHORISED'"
                  @click="handleRevokeAffiliation(affiliation.user.id, 'CURATE')"
                  :disabled="revokeAffiliationLoading"
                  class="btn btn-sm btn-warning"
                >
                  {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- No affiliations message -->
        <div v-if="!hasAnyAffiliations" class="no-affiliations">
          <p>No affiliations found for this team.</p>
        </div>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="success" class="success-message">
        {{ success }}
      </div>

      <div class="form-actions right">
        <button type="button" @click="closeModal" class="btn btn-secondary">
          Close
        </button>
      </div>
    </div>
  </div>
</template>


<script setup>
import { computed, ref } from 'vue'
import { useMutation, useApolloClient } from '@vue/apollo-composable'
import APPROVE_AFFILIATION_MUTATION from '../graphql/account/approveAffiliation.graphql'
import REVOKE_AFFILIATION_MUTATION from '../graphql/account/revokeAffiliation.graphql'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  teamInfo: {
    type: Object,
    required: true
  },
  currentUserId: {
    type: [String, Number],
    required: true
  }
})

const emit = defineEmits(['close', 'affiliation-updated'])

const { client } = useApolloClient()

// State
const error = ref('')
const success = ref('')

// Use Apollo mutations
const { mutate: approveAffiliationMutation, loading: approveAffiliationLoading } = useMutation(APPROVE_AFFILIATION_MUTATION)
const { mutate: revokeAffiliationMutation, loading: revokeAffiliationLoading } = useMutation(REVOKE_AFFILIATION_MUTATION)

// Computed property to get all team affiliations (excluding revoked ones)
const allTeamAffiliations = computed(() => {
  const affiliations = props.teamInfo?.affiliations || {}

  return {
    read: (affiliations.read || []).filter(aff => aff.authorisation !== 'REVOKED'),
    write: (affiliations.write || []).filter(aff => aff.authorisation !== 'REVOKED'),
    admin: (affiliations.admin || []).filter(aff => aff.authorisation !== 'REVOKED'),
    curate: (affiliations.curate || []).filter(aff => aff.authorisation !== 'REVOKED')
  }
})

// Computed property to check if there are any affiliations to display
const hasAnyAffiliations = computed(() => {
  const affiliations = allTeamAffiliations.value
  return (
    affiliations.read.length > 0 ||
    affiliations.write.length > 0 ||
    affiliations.admin.length > 0 ||
    affiliations.curate.length > 0
  )
})

// Helper function to get status CSS class
const getStatusClass = (status) => {
  switch (status) {
    case 'AUTHORISED':
      return 'status-authorised'
    case 'REQUESTED':
      return 'status-pending'
    default:
      return 'status-unknown'
  }
}

// Helper function to get readable status text
const getStatusText = (status) => {
  switch (status) {
    case 'AUTHORISED':
      return 'Authorised'
    case 'REQUESTED':
      return 'Pending Approval'
    default:
      return 'Unknown'
  }
}

// Handle approve affiliation
const handleApproveAffiliation = async (userId, accessType, heritable) => {
  try {
    error.value = ''
    success.value = ''

    const response = await approveAffiliationMutation({
      user: userId,
      team: props.teamInfo.id,
      access: accessType,
      heritable: heritable
    })

    if (response?.data?.approve_affiliation?.status === 'SUCCESS') {
      success.value = `${accessType} affiliation approved successfully`

      // Clear cache and emit event to refresh team data
      try {
        client.cache.evict({ fieldName: 'teams' })
        client.cache.gc()
      } catch (cacheError) {
        console.warn('Error clearing teams cache:', cacheError)
      }

      emit('affiliation-updated')
    } else {
      error.value = response?.data?.approve_affiliation?.errors?.[0]?.message || 'Failed to approve affiliation'
    }
  } catch (err) {
    console.error('Approve affiliation error:', err)
    error.value = err.message || 'An unexpected error occurred'
  }
}

// Handle revoke affiliation
const handleRevokeAffiliation = async (userId, accessType) => {
  try {
    error.value = ''
    success.value = ''

    const response = await revokeAffiliationMutation({
      user: userId,
      team: props.teamInfo.id,
      access: accessType
    })

    if (response?.data?.revoke_affiliation?.status === 'SUCCESS') {
      success.value = `${accessType} affiliation revoked successfully`

      // Clear cache and emit event to refresh team data
      try {
        client.cache.evict({ fieldName: 'teams' })
        client.cache.gc()
      } catch (cacheError) {
        console.warn('Error clearing teams cache:', cacheError)
      }

      emit('affiliation-updated')
    } else {
      error.value = response?.data?.revoke_affiliation?.errors?.[0]?.message || 'Failed to revoke affiliation'
    }
  } catch (err) {
    console.error('Revoke affiliation error:', err)
    error.value = err.message || 'An unexpected error occurred'
  }
}

// Close modal and clear messages
const closeModal = () => {
  error.value = ''
  success.value = ''
  emit('close')
}
</script>

<style scoped>
.affiliations-management {
  margin-bottom: 1.5rem;
}

.affiliation-section {
  margin-bottom: 2rem;
}

.affiliation-section h4 {
  margin: 0 0 1rem 0;
  color: #495057;
  border-bottom: 2px solid #e9ecef;
  padding-bottom: 0.5rem;
}

.affiliation-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.affiliation-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.affiliation-info {
  flex: 1;
}

.user-meta {
  display: flex;
  gap: 1rem;
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: #6c757d;
}

.username {
  font-weight: 500;
}

.affiliation-meta {
  font-size: 0.875rem;
  color: #495057;
}

.affiliation-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.self-admin-note {
  font-size: 0.875rem;
  color: #6c757d;
  font-style: italic;
}

.no-affiliations {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}
</style>
