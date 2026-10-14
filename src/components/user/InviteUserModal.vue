<script setup>
import { ref, computed, watch } from 'vue'
import { useUserAccess } from '@/composables/user/useUserAccess'
import { useInvitationsQuery } from '@/composables/account/invitationsQuery'
import { useMutateInvitations } from '@/composables/account/mutateInvitations'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'invited'])

const ACCESS_LEVELS = ['READ', 'WRITE', 'ADMIN', 'CURATE']

const email = ref('')
// teamId -> access level offered, or '' for no offer
const offeredAccess = ref({})
const errorMessage = ref('')
const successMessage = ref('')
const busyInvitationId = ref(null)

const { adminTeams, loading: accessLoading } = useUserAccess()

const {
  invitations,
  invitationsLoading,
  refetchInvitations
} = useInvitationsQuery({ enabled: computed(() => props.isOpen) })

const {
  invite,
  inviteLoading,
  cancelInvitation,
  cancelInvitationLoading,
  resendInvitation,
  resendInvitationLoading
} = useMutateInvitations()

const busy = computed(() =>
  inviteLoading.value || cancelInvitationLoading.value || resendInvitationLoading.value
)

const offeredTeams = computed(() =>
  Object.entries(offeredAccess.value)
    .filter(([, access]) => !!access)
    .map(([teamId, access]) => ({ teamId, access }))
)

const resetForm = () => {
  email.value = ''
  offeredAccess.value = {}
  errorMessage.value = ''
  successMessage.value = ''
  busyInvitationId.value = null
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    resetForm()
    refetchInvitations()
  }
})

const showResult = ({ status, errors }, successText, failureText) => {
  if (status === 'SUCCESS') {
    successMessage.value = successText
    errorMessage.value = ''
    refetchInvitations()
    return true
  }
  errorMessage.value = errors?.[0]?.message || failureText
  successMessage.value = ''
  return false
}

const inviteUser = async () => {
  const address = email.value.trim()
  if (!address) return
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const result = await invite({ email: address, teams: offeredTeams.value })
    if (showResult(result, `Invitation sent to ${address}.`, 'Failed to send invitation')) {
      emit('invited', address)
      email.value = ''
      offeredAccess.value = {}
    }
  } catch (error) {
    console.error('Invitation failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const handleResend = async (invitation) => {
  busyInvitationId.value = invitation.id
  try {
    await showResult(
      await resendInvitation(invitation.id),
      `Invitation to ${invitation.email} sent again.`,
      'Failed to resend invitation'
    )
  } finally {
    busyInvitationId.value = null
  }
}

const handleCancel = async (invitation) => {
  busyInvitationId.value = invitation.id
  try {
    await showResult(
      await cancelInvitation(invitation.id),
      `Invitation to ${invitation.email} cancelled.`,
      'Failed to cancel invitation'
    )
  } finally {
    busyInvitationId.value = null
  }
}

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

const describeOffers = (invitation) => {
  const parts = invitation.teams.map(({ team, access }) =>
    `${team?.name ?? 'team'} (${access.toLowerCase()})`
  )
  if (invitation.person) {
    parts.push(`link to ${invitation.person.name ?? 'a person record'}`)
  }
  return parts.join(', ')
}

const closeModal = () => {
  if (!busy.value) {
    emit('close')
  }
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>Invite User</h3>
        <button @click="closeModal" class="modal-close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <form @submit.prevent="inviteUser">
          <div class="form-group">
            <label for="invite-email">Email address</label>
            <input
              id="invite-email"
              v-model="email"
              type="email"
              placeholder="Enter email address"
              required
              :disabled="busy"
            />
            <p class="help-text">
              They receive a registration link, valid for 30 days. The address is only kept until they register
              or the invitation is cancelled or expires.
            </p>
          </div>

          <div v-if="adminTeams.length > 0" class="form-group">
            <label>Offer affiliations</label>
            <p class="help-text">
              The invited user chooses which to accept when registering. Only teams you administer are listed.
            </p>
            <div v-if="accessLoading" class="loading-text">Loading teams...</div>
            <div v-else class="offer-list">
              <div v-for="team in adminTeams" :key="team.id" class="offer-item">
                <span class="offer-team">{{ team.fullname || team.name }}</span>
                <select v-model="offeredAccess[team.id]" :disabled="busy">
                  <option value="">No offer</option>
                  <option v-for="level in ACCESS_LEVELS" :key="level" :value="level">
                    {{ level.charAt(0) + level.slice(1).toLowerCase() }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
          <div v-if="successMessage" class="success-message">{{ successMessage }}</div>

          <div class="form-actions right">
            <button type="button" @click="closeModal" class="btn btn-secondary" :disabled="busy">
              Close
            </button>
            <button type="submit" class="btn btn-primary" :disabled="busy || !email.trim()">
              {{ inviteLoading ? 'Sending...' : 'Send Invitation' }}
            </button>
          </div>
        </form>

        <div class="invitations-section">
          <h4>Pending invitations</h4>
          <div v-if="invitationsLoading && invitations.length === 0" class="loading-text">
            Loading invitations...
          </div>
          <p v-else-if="invitations.length === 0" class="text-muted">
            You have no pending invitations.
          </p>
          <div v-else class="invitation-list">
            <div v-for="invitation in invitations" :key="invitation.id" class="invitation-item">
              <div class="invitation-info">
                <span class="invitation-email">{{ invitation.email }}</span>
                <span class="invitation-meta">
                  Expires {{ formatDate(invitation.expiresAt) }}
                  <template v-if="describeOffers(invitation)">
                    &middot; offers {{ describeOffers(invitation) }}
                  </template>
                </span>
              </div>
              <div class="invitation-actions">
                <button
                  @click="handleResend(invitation)"
                  class="btn btn-secondary btn-small"
                  :disabled="busy"
                  title="Send the link again and extend the expiry"
                >
                  {{ resendInvitationLoading && busyInvitationId === invitation.id ? 'Sending...' : 'Resend' }}
                </button>
                <button
                  @click="handleCancel(invitation)"
                  class="btn btn-danger btn-small"
                  :disabled="busy"
                >
                  {{ cancelInvitationLoading && busyInvitationId === invitation.id ? 'Cancelling...' : 'Cancel' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help-text {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: #666;
}

.offer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.offer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.offer-team {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invitations-section {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.invitations-section h4 {
  margin: 0 0 12px;
}

.invitation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.invitation-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.invitation-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.invitation-email {
  font-weight: 500;
}

.invitation-meta {
  font-size: 0.85rem;
  color: #666;
}

.invitation-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
</style>
