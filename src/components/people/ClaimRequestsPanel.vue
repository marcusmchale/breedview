<script setup>
import { ref } from 'vue'
import PersonDisplay from './PersonDisplay.vue'
import { useClaimRequestsQuery } from '@/composables/people/claimsQuery'
import { useMutateClaims } from '@/composables/people/mutateClaims'

// Pending requests by users to be linked to Persons controlled by teams the viewer administers.
// Shown only when there are any.
const emit = defineEmits(['decided'])

const { claimRequests, refetchClaimRequests } = useClaimRequestsQuery()
const { approveClaim, approveClaimLoading, rejectClaim, rejectClaimLoading } = useMutateClaims()

const confirmingKey = ref(null)
const errorMessage = ref('')

const requestKey = (request) => `${request.person?.id}:${request.userId}`

const decide = async (request, approve) => {
  errorMessage.value = ''
  const variables = { personId: String(request.person.id), userId: String(request.userId) }
  const { status, errors } = approve ? await approveClaim(variables) : await rejectClaim(variables)
  confirmingKey.value = null
  if (status === 'SUCCESS') {
    await refetchClaimRequests()
    emit('decided')
  } else {
    errorMessage.value = errors?.[0]?.message || `Failed to ${approve ? 'approve' : 'reject'} the request`
  }
}

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
</script>

<template>
  <div v-if="claimRequests.length > 0" class="claim-requests">
    <h3>Requests to link accounts</h3>
    <p class="text-muted">
      These users ask to be linked to person records controlled by your teams. Confirm the user's identity
      before approving: the link gives them control over the record and routes contact messages to them.
    </p>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <div v-for="request in claimRequests" :key="requestKey(request)" class="request-item">
      <div class="request-info">
        <PersonDisplay :person="request.person" />
        <span class="requester">
          requested by <strong>{{ request.fullname || request.name }}</strong>
          ({{ request.name }}) on {{ formatDate(request.requestedAt) }}
        </span>
      </div>
      <div class="request-actions">
        <template v-if="confirmingKey === requestKey(request)">
          <span class="confirm-text">Have you confirmed this user's identity?</span>
          <button class="btn btn-secondary btn-small" :disabled="approveClaimLoading" @click="confirmingKey = null">No</button>
          <button class="btn btn-success btn-small" :disabled="approveClaimLoading" @click="decide(request, true)">
            {{ approveClaimLoading ? 'Approving...' : 'Yes, approve' }}
          </button>
        </template>
        <template v-else>
          <button class="btn btn-success btn-small" :disabled="rejectClaimLoading" @click="confirmingKey = requestKey(request)">
            Approve
          </button>
          <button class="btn btn-danger btn-small" :disabled="rejectClaimLoading" @click="decide(request, false)">
            {{ rejectClaimLoading ? 'Rejecting...' : 'Reject' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.claim-requests {
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #fff8e1;
  border: 1px solid #ffe082;
  border-radius: 6px;
}

.claim-requests h3 {
  margin: 0 0 4px;
}

.request-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #ffe082;
  border-radius: 4px;
  margin-top: 8px;
}

.request-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.requester {
  font-size: 0.85rem;
  color: #666;
}

.request-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.confirm-text {
  font-size: 0.85rem;
}
</style>
