<script setup>
import { ref, computed, watch } from 'vue'
import { useUserAccess } from '@/composables/user/useUserAccess'
import { useInvitationsQuery } from '@/composables/account/invitationsQuery'
import { useMutateInvitations } from '@/composables/account/mutateInvitations'
import { ACCESS_LEVELS, describeAccesses, offersByTeam } from '@/composables/account/invitationOffers'
import { useOfferablePeople } from '@/composables/people/offerablePeopleQuery'
import { personLabel } from '@/composables/people/personDisplay'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'invited'])

const email = ref('')
// teamId -> the access levels offered to it
const offeredAccess = ref({})
// a Person to offer for the invited user to link, or '' for none
const personId = ref('')
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

const { offerablePeople } = useOfferablePeople({ enabled: computed(() => props.isOpen) })

const busy = computed(() =>
  inviteLoading.value || cancelInvitationLoading.value || resendInvitationLoading.value
)

// One offer for each access ticked: the invited user accepts or declines each team, with every access offered to it
const offeredTeams = computed(() =>
  Object.entries(offeredAccess.value).flatMap(([teamId, levels]) =>
    ACCESS_LEVELS.filter((level) => levels.includes(level)).map((access) => ({ teamId, access }))
  )
)

const isOffered = (teamId, level) => (offeredAccess.value[teamId] ?? []).includes(level)

const setOffered = (teamId, level, offered) => {
  const levels = (offeredAccess.value[teamId] ?? []).filter((other) => other !== level)
  offeredAccess.value = { ...offeredAccess.value, [teamId]: offered ? [...levels, level] : levels }
}

const resetForm = () => {
  email.value = ''
  offeredAccess.value = {}
  personId.value = ''
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
    const result = await invite({ email: address, teams: offeredTeams.value, personId: personId.value || null })
    if (showResult(result, `Invitation sent to ${address}.`, 'Failed to send invitation')) {
      emit('invited', address)
      email.value = ''
      offeredAccess.value = {}
      personId.value = ''
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
  const teams = offersByTeam(invitation.teams, {
    teamId: (offer) => offer.team?.id,
    teamName: (offer) => offer.team?.name
  })
  const parts = teams.map(({ teamName, accesses }) => `${teamName ?? 'team'} (${describeAccesses(accesses)})`)
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

          <!-- affiliations and person records are offered by a team's admins: without them, say why there are none -->
          <p v-if="!accessLoading && adminTeams.length === 0" class="form-group help-text no-offers">
            You administer no teams, so this invitation offers no affiliations or person records. Once registered, they
            can ask to join a team under Access control → Teams.
          </p>

          <div v-if="adminTeams.length > 0" class="form-group">
            <label>Offer affiliations</label>
            <p class="help-text">
              The invited user chooses which teams to join when registering, with every access you tick for each.
              Write alone gives no read access to a team's private records; Curate and Admin include Read. Only teams
              you administer are listed.
            </p>
            <div v-if="accessLoading" class="loading-text">Loading teams...</div>
            <div v-else class="offer-list">
              <div v-for="team in adminTeams" :key="team.id" class="offer-item">
                <span class="offer-team">{{ team.fullname || team.name }}</span>
                <div class="offer-accesses">
                  <label v-for="level in ACCESS_LEVELS" :key="level" class="offer-access">
                    <input
                      type="checkbox"
                      :name="`offer-${team.id}-${level}`"
                      :checked="isOffered(team.id, level)"
                      :disabled="busy"
                      @change="setOffered(team.id, level, $event.target.checked)"
                    />
                    {{ level.charAt(0) + level.slice(1).toLowerCase() }}
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div v-if="offerablePeople.length > 0" class="form-group">
            <label for="invite-person">Person record (optional)</label>
            <select id="invite-person" v-model="personId" :disabled="busy">
              <option value="">No person record</option>
              <option v-for="person in offerablePeople" :key="person.id" :value="person.id">
                {{ personLabel(person) }}
              </option>
            </select>
            <p class="help-text">
              A person record a team you administer controls, not yet linked to an account, such as one already
              credited for their work. They can link it to their account when registering.
            </p>
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

.offer-accesses {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
}

.offer-access {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: normal;
  white-space: nowrap;
}

.offer-access input {
  width: auto;
  margin: 0;
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
