
<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal modal-large">
      <h3>Manage Affiliations - {{ teamInfo?.fullname || teamInfo?.name }}</h3>

      <div class="affiliations-management">
        <!-- Read Affiliations -->
        <div v-if="allAffiliations.read?.length > 0" class="affiliation-section">
          <h4>Read Access</h4>
          <div class="affiliation-list">
            <div
              v-for="affiliation in allAffiliations.read"
              :key="`read-${affiliation.user.id}-${affiliation.isInherited ? 'inherited' : 'direct'}`"
              class="affiliation-item"
              :class="{ 'inherited-affiliation': affiliation.isInherited }"
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
                  <span v-if="affiliation.isInherited" class="inherited-badge">
                    (Inherited)
                  </span>
                </span>
              </div>
              <div class="affiliation-actions">
                <div v-if="affiliation.authorisation === 'REQUESTED'" class="approval-controls">
                  <div class="approval-buttons">
                    <button
                      @click="handleApproveAffiliation(affiliation.user.id, 'READ', false)"
                      :disabled="approveAffiliationLoading"
                      class="btn btn-sm btn-success"
                    >
                      {{ approveAffiliationLoading ? 'Approving...' : 'Approve' }}
                    </button>
                    <button
                      @click="handleApproveAffiliation(affiliation.user.id, 'READ', true)"
                      :disabled="approveAffiliationLoading"
                      class="btn btn-sm btn-success btn-heritable"
                    >
                      {{ approveAffiliationLoading ? 'Approving...' : 'Approve Heritable' }}
                    </button>
                  </div>
                  <button
                    v-if="!affiliation.isInherited"
                    @click="handleRevokeAffiliation(affiliation.user.id, 'READ')"
                    :disabled="revokeAffiliationLoading"
                    class="btn btn-sm btn-warning"
                  >
                    {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                  </button>
                  <span v-if="affiliation.isInherited" class="inherited-note">
                    (Cannot revoke inherited request - manage from parent team)
                  </span>
                </div>
                <button
                  v-if="affiliation.authorisation === 'AUTHORISED' && !affiliation.isInherited"
                  @click="handleRevokeAffiliation(affiliation.user.id, 'READ')"
                  :disabled="revokeAffiliationLoading"
                  class="btn btn-sm btn-warning"
                >
                  {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                </button>
                <span v-if="affiliation.authorisation === 'AUTHORISED' && affiliation.isInherited" class="inherited-note">
                  (Managed on parent team)
                </span>
              </div>
            </div>
          </div>
        </div>


        <!-- Write Affiliations -->
        <div v-if="allAffiliations.write?.length > 0" class="affiliation-section">
          <h4>Write Access</h4>
          <div class="affiliation-list">
            <div
              v-for="affiliation in allAffiliations.write"
              :key="`write-${affiliation.user.id}-${affiliation.isInherited ? 'inherited' : 'direct'}`"
              class="affiliation-item"
              :class="{ 'inherited-affiliation': affiliation.isInherited }"
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
                  <span v-if="affiliation.isInherited" class="inherited-badge">
                    (Inherited)
                  </span>
                </span>
              </div>
              <div class="affiliation-actions">
                <div v-if="affiliation.authorisation === 'REQUESTED'" class="approval-controls">
                  <button
                    @click="handleApproveAffiliation(affiliation.user.id, 'WRITE', false)"
                    :disabled="approveAffiliationLoading"
                    class="btn btn-sm btn-success"
                  >
                    {{ approveAffiliationLoading ? 'Approving...' : 'Approve' }}
                  </button>
                  <button
                    v-if="!affiliation.isInherited"
                    @click="handleRevokeAffiliation(affiliation.user.id, 'WRITE')"
                    :disabled="revokeAffiliationLoading"
                    class="btn btn-sm btn-warning"
                  >
                    {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                  </button>
                  <span v-if="affiliation.isInherited" class="inherited-note">
                    (Cannot revoke inherited request - manage from parent team)
                  </span>
                </div>
                <button
                  v-if="affiliation.authorisation === 'AUTHORISED' && !affiliation.isInherited"
                  @click="handleRevokeAffiliation(affiliation.user.id, 'WRITE')"
                  :disabled="revokeAffiliationLoading"
                  class="btn btn-sm btn-warning"
                >
                  {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                </button>
                <span v-if="affiliation.authorisation === 'AUTHORISED' && affiliation.isInherited" class="inherited-note">
                  (Managed on parent team)
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Admin Affiliations -->
        <div v-if="allAffiliations.admin?.length > 0" class="affiliation-section">
          <h4>Admin Access</h4>
          <div class="affiliation-list">
            <div
              v-for="affiliation in allAffiliations.admin"
              :key="`admin-${affiliation.user.id}-${affiliation.isInherited ? 'inherited' : 'direct'}`"
              class="affiliation-item"
              :class="{ 'inherited-affiliation': affiliation.isInherited }"
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
                  <span v-if="affiliation.isInherited" class="inherited-badge">
                    (Inherited)
                  </span>
                </span>
              </div>
              <div class="affiliation-actions">
                <div v-if="affiliation.authorisation === 'REQUESTED'" class="approval-controls">
                  <div class="approval-buttons">
                    <button
                      @click="handleApproveAffiliation(affiliation.user.id, 'ADMIN', false)"
                      :disabled="approveAffiliationLoading"
                      class="btn btn-sm btn-success"
                    >
                      {{ approveAffiliationLoading ? 'Approving...' : 'Approve' }}
                    </button>
                    <button
                      @click="handleApproveAffiliation(affiliation.user.id, 'ADMIN', true)"
                      :disabled="approveAffiliationLoading"
                      class="btn btn-sm btn-success btn-heritable"
                    >
                      {{ approveAffiliationLoading ? 'Approving...' : 'Approve Heritable' }}
                    </button>
                  </div>
                  <button
                    v-if="!affiliation.isInherited"
                    @click="handleRevokeAffiliation(affiliation.user.id, 'ADMIN')"
                    :disabled="revokeAffiliationLoading"
                    class="btn btn-sm btn-warning"
                  >
                    {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                  </button>
                  <span v-if="affiliation.isInherited" class="inherited-note">
                    (Cannot revoke inherited request - manage from parent team)
                  </span>
                </div>
                <button
                  v-if="affiliation.authorisation === 'AUTHORISED' && affiliation.user.id != currentUserId && !affiliation.isInherited"
                  @click="handleRevokeAffiliation(affiliation.user.id, 'ADMIN')"
                  :disabled="revokeAffiliationLoading"
                  class="btn btn-sm btn-warning"
                >
                  {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                </button>
                <span v-if="affiliation.user.id == currentUserId" class="self-admin-note">
                  (You cannot revoke your own admin access)
                </span>
                <span v-if="affiliation.authorisation === 'AUTHORISED' && affiliation.isInherited && affiliation.user.id != currentUserId" class="inherited-note">
                  (Managed on parent team)
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Curate Affiliations -->
        <div v-if="allAffiliations.curate?.length > 0" class="affiliation-section">
          <h4>Curate Access</h4>
          <div class="affiliation-list">
            <div
              v-for="affiliation in allAffiliations.curate"
              :key="`curate-${affiliation.user.id}-${affiliation.isInherited ? 'inherited' : 'direct'}`"
              class="affiliation-item"
              :class="{ 'inherited-affiliation': affiliation.isInherited }"
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
                  <span v-if="affiliation.isInherited" class="inherited-badge">
                    (Inherited)
                  </span>
                </span>
              </div>
              <div class="affiliation-actions">
                <div v-if="affiliation.authorisation === 'REQUESTED'" class="approval-controls">
                  <div class="approval-buttons">
                    <button
                      @click="handleApproveAffiliation(affiliation.user.id, 'CURATE', false)"
                      :disabled="approveAffiliationLoading"
                      class="btn btn-sm btn-success"
                    >
                      {{ approveAffiliationLoading ? 'Approving...' : 'Approve' }}
                    </button>
                    <button
                      @click="handleApproveAffiliation(affiliation.user.id, 'CURATE', true)"
                      :disabled="approveAffiliationLoading"
                      class="btn btn-sm btn-success btn-heritable"
                    >
                      {{ approveAffiliationLoading ? 'Approving...' : 'Approve Heritable' }}
                    </button>
                  </div>
                  <button
                    v-if="!affiliation.isInherited"
                    @click="handleRevokeAffiliation(affiliation.user.id, 'CURATE')"
                    :disabled="revokeAffiliationLoading"
                    class="btn btn-sm btn-warning"
                  >
                    {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                  </button>
                  <span v-if="affiliation.isInherited" class="inherited-note">
                    (Cannot revoke inherited request - manage from parent team)
                  </span>
                </div>
                <button
                  v-if="affiliation.authorisation === 'AUTHORISED' && !affiliation.isInherited"
                  @click="handleRevokeAffiliation(affiliation.user.id, 'CURATE')"
                  :disabled="revokeAffiliationLoading"
                  class="btn btn-sm btn-warning"
                >
                  {{ revokeAffiliationLoading ? 'Revoking...' : 'Revoke' }}
                </button>
                <span v-if="affiliation.authorisation === 'AUTHORISED' && affiliation.isInherited" class="inherited-note">
                  (Managed on parent team)
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- No affiliations message -->
        <div v-if="!hasAnyAffiliations" class="no-affiliations">
          <p>No affiliations found for this team.</p>
        </div>
      </div>

      <div v-if="approveError" class="error-message">
        {{ approveError }}
      </div>

      <div v-if="revokeError" class="error-message">
        {{ revokeError }}
      </div>

      <div class="modal-buttons">
        <button @click="$emit('close')" class="btn btn-secondary">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, computed, watch} from 'vue'
import {useMutation} from '@vue/apollo-composable'
import APPROVE_AFFILIATION_MUTATION from '../graphql/account/approveAffiliation.graphql'
import REVOKE_AFFILIATION_MUTATION from '../graphql/account/revokeAffiliation.graphql'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
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

// Reactive data
const approveError = ref('')
const revokeError = ref('')


//const inheritedAffiliations = computed(() => ({
//  read: [],
//  write: [],
//  admin: [],
//  curate: [],
//  ...props.teamInfo?.inheritedAffiliations
//}))
//
//const directAffiliations = computed(() => ({
//  read: [],
//  write: [],
//  admin: [],
//  curate: [],
//  ...props.teamInfo?.directAffiliations
//}))
//

const allAffiliations = computed(() => ({
  read: [],
  write: [],
  admin: [],
  curate: [],
  ...props.teamInfo?.affiliations
}))
console.log(allAffiliations.value)
console.log(props.teamInfo.affiliations)

// Apollo mutations
const {
  mutate: approveAffiliationMutation,
  loading: approveAffiliationLoading
} = useMutation(APPROVE_AFFILIATION_MUTATION)
const {mutate: revokeAffiliationMutation, loading: revokeAffiliationLoading} = useMutation(REVOKE_AFFILIATION_MUTATION)
  // Computed property to check if there are any affiliations
  const hasAnyAffiliations = computed(() => {
  return (
  (allAffiliations.value.read && allAffiliations.value.read.length > 0) ||
  (allAffiliations.value.write && allAffiliations.value.write.length > 0) ||
  (allAffiliations.value.admin && allAffiliations.value.admin.length > 0) ||
  (allAffiliations.value.curate && allAffiliations.value.curate.length > 0)
  )
})

  // Helper functions
  const getStatusClass = (status) => {
  switch (status) {
  case 'AUTHORISED': return 'status-authorised'
  case 'REQUESTED': return 'status-pending'
  default: return 'status-unknown'
}
}

  const getStatusText = (status) => {
  switch (status) {
  case 'AUTHORISED': return 'Authorised'
  case 'REQUESTED': return 'Requested'
  case 'REVOKED': return 'Revoked'
  default: return 'Unknown'
}
}

  // Event handlers
  const handleApproveAffiliation = async (userId, accessType, heritable) => {
  try {
  approveError.value = ''
  const response = await approveAffiliationMutation({
  user: userId,
  team: props.teamInfo.id,
  access: accessType,
  heritable: heritable
})

  if (response?.data?.approve_affiliation?.status === 'SUCCESS') {
  //await refetchInherited()  TODO reload team affiliation data
  emit('affiliation-updated')
} else {
  approveError.value = response?.data?.approve_affiliation?.errors?.[0]?.message || 'Failed to approve affiliation'
}
} catch (error) {
  console.error('Approve affiliation error:', error)
  approveError.value = error.message || 'An unexpected error occurred'
}
}

  const handleRevokeAffiliation = async (userId, accessType) => {
  try {
  revokeError.value = ''
  const response = await revokeAffiliationMutation({
  user: userId,
  team: props.teamInfo.id,
  access: accessType
})

  if (response?.data?.revoke_affiliation?.status === 'SUCCESS') {
  //await refetchInherited()  TODO reload team affiliation data
  emit('affiliation-updated')
} else {
  revokeError.value = response?.data?.accountsRevokeAffiliation?.errors?.[0]?.message || 'Failed to revoke affiliation'
}
} catch (error) {
  console.error('Revoke affiliation error:', error)
  revokeError.value = error.message || 'An unexpected error occurred'
}
}

  // Watch for modal open/close to refetch data
  watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
  approveError.value = ''
  revokeError.value = ''
  if (props.teamInfo?.id) {
  //refetchInherited()  TODO reload team affiliation data?
}
}
})
</script>

<style scoped>
/* Only component-specific styles that aren't reusable */
.modal-large {
  max-width: 1000px;
}
</style>