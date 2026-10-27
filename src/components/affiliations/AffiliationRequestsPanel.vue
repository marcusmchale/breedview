<script setup>
import { ref } from 'vue'
import { useUserAccess } from '@/composables/user/useUserAccess'
import { useAffiliationRequestsQuery } from '@/composables/teams/affiliationRequestsQuery'
import { useMutateAffiliations } from '@/composables/account/mutateAffiliations'

// Requests by users to join teams the viewer administers, or to reach the teams below them, approved as asked or
// rejected. Rejecting a request to reach the teams below approves the access for the team only, which the user keeps.
const { adminTeams, loading: accessLoading } = useUserAccess()
const {
  affiliationRequests,
  affiliationRequestsLoading,
  affiliationRequestsError,
  refetchAffiliationRequests
} = useAffiliationRequestsQuery()
const { approveAffiliation, revokeAffiliation } = useMutateAffiliations()

const busyKey = ref(null)
const message = ref('')
const errorMessage = ref('')

const requestKey = (request) => `${request.team.id}:${request.user.id}:${request.access}`
const nameOf = (item) => item.fullname || item.name
const accessText = (access) => access.charAt(0) + access.slice(1).toLowerCase()

// What a request asks for, as the decision's message says it
const askedFor = (request) => `${request.access.toLowerCase()} access to ` + (request.held
  ? `the teams below ${nameOf(request.team)}`
  : `${nameOf(request.team)}${request.heritable ? ' and the teams below it' : ''}`)

const decide = async (request, approve) => {
  message.value = ''
  errorMessage.value = ''
  busyKey.value = requestKey(request)
  const affiliation = { userId: request.user.id, teamId: request.team.id, access: request.access }
  try {
    const { status, errors } = approve || request.held
      ? await approveAffiliation({ ...affiliation, heritable: approve && request.heritable })
      : await revokeAffiliation(affiliation)
    if (status === 'SUCCESS') {
      message.value = `${approve ? 'Approved' : 'Rejected'}: ${nameOf(request.user)}, ${askedFor(request)}` +
        (!approve && request.held ? `; they keep it for ${nameOf(request.team)}.` : '.')
      await refetchAffiliationRequests()
    } else {
      errorMessage.value = errors?.[0]?.message || `Failed to ${approve ? 'approve' : 'reject'} the request`
    }
  } catch (error) {
    console.error('Affiliation decision failed:', error)
    errorMessage.value = error.message || `Failed to ${approve ? 'approve' : 'reject'} the request`
  } finally {
    busyKey.value = null
  }
}
</script>

<template>
  <div class="affiliation-requests-panel">
    <p class="intro text-muted">
      Requests to join the teams you administer, or to have access to one of them reach the teams below it too.
      Approving one gives the access asked for; a rejected request can be made again. To change an affiliation later,
      use Manage Affiliations on its team under Teams.
    </p>

    <div v-if="message" class="success-message">{{ message }}</div>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

    <div v-if="accessLoading && !adminTeams.length" class="text-muted">Loading your teams…</div>
    <p v-else-if="!adminTeams.length" class="text-muted empty-state">
      You administer no team. Requests to join a team go to its admins.
    </p>
    <div v-else-if="affiliationRequestsLoading && !affiliationRequests.length" class="text-muted">Loading requests…</div>
    <div v-else-if="affiliationRequestsError && !affiliationRequests.length" class="error-message">
      Failed to load the requests: {{ affiliationRequestsError.message }}
    </div>
    <p v-else-if="!affiliationRequests.length" class="text-muted empty-state">No requests are waiting.</p>
    <ul v-else class="request-list">
      <li v-for="request in affiliationRequests" :key="requestKey(request)" class="request-item">
        <div class="request-info">
          <span><strong>{{ nameOf(request.user) }}</strong> ({{ request.user.name }})</span>
          <span v-if="request.held" class="request-text">
            asks for
            <span class="badge" :class="`badge-${request.access.toLowerCase()}`">{{ accessText(request.access) }}</span>
            access to the teams below <strong>{{ nameOf(request.team) }}</strong> too, having it for that team
          </span>
          <span v-else class="request-text">
            asks for
            <span class="badge" :class="`badge-${request.access.toLowerCase()}`">{{ accessText(request.access) }}</span>
            access to <strong>{{ nameOf(request.team) }}</strong>
            <template v-if="request.heritable"> and the teams below it</template>
          </span>
        </div>
        <div class="request-actions">
          <button
            class="btn btn-success btn-small"
            :disabled="busyKey === requestKey(request)"
            @click="decide(request, true)"
          >
            Approve
          </button>
          <button
            class="btn btn-danger btn-small"
            :disabled="busyKey === requestKey(request)"
            @click="decide(request, false)"
          >
            Reject
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.intro {
  margin: 0 0 16px;
}

.request-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.request-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 14px;
  background: white;
  border: 1px solid #e0e0e0;
  border-left: 4px solid #ffc107;
  border-radius: 6px;
}

.request-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.request-text {
  font-size: 0.9rem;
  color: #555;
}

.request-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  padding: 40px;
  text-align: center;
}
</style>
