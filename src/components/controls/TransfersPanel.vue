<script setup>
import { ref, computed } from 'vue'
import AcceptTransferModal from './AcceptTransferModal.vue'
import { useTransfersQuery } from '@/composables/controls/transfersQuery'
import { useMutateTransfers } from '@/composables/controls/mutateTransfers'
import { useUserAccess } from '@/composables/user/useUserAccess'

// Control transfers offered to or from teams the user administers
const tab = ref('pending')
const statuses = computed(() => tab.value === 'pending' ? ['PENDING'] : ['ACCEPTED', 'REJECTED', 'CANCELLED'])

const { transfers, transfersLoading, transfersError, refetchTransfers } = useTransfersQuery(statuses)
const { rejectTransfer, rejectTransferLoading, cancelTransfer, cancelTransferLoading } = useMutateTransfers()
const { adminTeamIds } = useUserAccess()

const transferToAccept = ref(null)
const busyId = ref(null)
const errorMessage = ref('')
const message = ref('')

const adminIds = computed(() => adminTeamIds.value.map(String))
const isIncoming = (transfer) => !!transfer.recipientTeam && adminIds.value.includes(String(transfer.recipientTeam.id))
const isOutgoing = (transfer) => transfer.fromTeams.some(team => adminIds.value.includes(String(team.id)))

const teamNames = (teams) => (teams ?? []).map(team => team.fullname || team.name).join(', ') || '—'
const entityText = (entity) => `${entity.label.charAt(0) + entity.label.slice(1).toLowerCase()} #${entity.id}`

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

// The user is often null where the viewer may not see user details; show the team instead
const byWhom = (user, teams) => user ? (user.fullname || user.name) : teamNames(teams)

const outcome = (transfer) => {
  switch (transfer.status) {
    case 'ACCEPTED':
      return `Accepted ${formatDate(transfer.acceptedAt)} by ${byWhom(transfer.acceptedBy, [transfer.recipientTeam])}`
    case 'REJECTED':
      return `Rejected ${formatDate(transfer.rejectedAt)} by ${byWhom(transfer.rejectedBy, [transfer.recipientTeam])}`
    case 'CANCELLED':
      return `Cancelled ${formatDate(transfer.cancelledAt)} by ${byWhom(transfer.cancelledBy, transfer.fromTeams)}`
    default:
      return 'Pending'
  }
}

const act = async (transfer, action) => {
  errorMessage.value = ''
  message.value = ''
  busyId.value = transfer.id
  try {
    const { status, errors } = action === 'reject'
      ? await rejectTransfer(transfer.id)
      : await cancelTransfer(transfer.id)
    if (status === 'SUCCESS') {
      message.value = action === 'reject' ? 'Transfer rejected.' : 'Transfer cancelled.'
      await refetchTransfers()
    } else {
      errorMessage.value = errors?.[0]?.message || `Failed to ${action} the transfer`
    }
  } finally {
    busyId.value = null
  }
}

const handleAccepted = async () => {
  message.value = 'Transfer accepted.'
  await refetchTransfers()
}
</script>

<template>
  <div class="transfers-panel">
    <h3>Transfer offers</h3>
    <p class="text-muted page-intro">
      Control of a record moves between teams by offer and acceptance. Offers to teams you administer are accepted
      or rejected here, offers from your teams can be cancelled, and History lists the offers answered. To offer a
      transfer, choose records under Bulk control, or use the controller badge on a record.
    </p>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'pending' }" @click="tab = 'pending'">Pending</button>
      <button class="tab" :class="{ active: tab === 'history' }" @click="tab = 'history'">History</button>
    </div>

    <div v-if="message" class="success-message">{{ message }}</div>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

    <div v-if="transfersLoading && transfers.length === 0" class="loading">Loading transfers...</div>
    <div v-else-if="transfersError" class="error">Failed to load transfers: {{ transfersError.message }}</div>
    <div v-else-if="transfers.length === 0" class="empty-state text-muted">
      No {{ tab === 'pending' ? 'pending' : 'past' }} transfers.
    </div>
    <div v-else class="transfer-list">
      <div v-for="transfer in transfers" :key="transfer.id" class="transfer-item" :class="transfer.status.toLowerCase()">
        <div class="transfer-main">
          <div class="transfer-direction">
            <span v-if="isIncoming(transfer)" class="badge badge-read">Offered to your team</span>
            <span v-if="isOutgoing(transfer)" class="badge badge-write">Offered by your team</span>
            <span class="status">{{ outcome(transfer) }}</span>
          </div>
          <ul class="entities">
            <li v-for="entity in transfer.entities" :key="`${entity.label}:${entity.id}`">{{ entityText(entity) }}</li>
          </ul>
          <dl class="details">
            <dt>From</dt>
            <dd>{{ teamNames(transfer.fromTeams) }}<span v-if="transfer.keepFromTeams" class="text-muted"> (keeps control, shared)</span></dd>
            <dt>To</dt>
            <dd>
              {{ transfer.recipientTeam?.fullname || transfer.recipientTeam?.name || '—' }}
              <template v-if="transfer.toTeams?.length"> → {{ teamNames(transfer.toTeams) }}</template>
              <template v-if="transfer.release"> ({{ transfer.release.toLowerCase() }})</template>
            </dd>
            <dt>Offered</dt>
            <dd>{{ formatDate(transfer.offeredAt) }} by {{ byWhom(transfer.offeredBy, transfer.fromTeams) }}</dd>
          </dl>
        </div>
        <div v-if="transfer.status === 'PENDING'" class="transfer-actions">
          <template v-if="isIncoming(transfer)">
            <button class="btn btn-success btn-small" :disabled="busyId === transfer.id" @click="transferToAccept = transfer">
              Accept
            </button>
            <button class="btn btn-danger btn-small" :disabled="busyId === transfer.id" @click="act(transfer, 'reject')">
              {{ rejectTransferLoading && busyId === transfer.id ? 'Rejecting...' : 'Reject' }}
            </button>
          </template>
          <button v-if="isOutgoing(transfer)" class="btn btn-secondary btn-small" :disabled="busyId === transfer.id" @click="act(transfer, 'cancel')">
            {{ cancelTransferLoading && busyId === transfer.id ? 'Cancelling...' : 'Cancel offer' }}
          </button>
        </div>
      </div>
    </div>

    <AcceptTransferModal
      :is-open="!!transferToAccept"
      :transfer="transferToAccept"
      @close="transferToAccept = null"
      @accepted="handleAccepted"
    />
  </div>
</template>

<style scoped>
.transfers-panel h3 {
  margin: 0 0 8px;
}

.page-intro {
  margin: 0 0 16px;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid #dee2e6;
}

.tab {
  padding: 8px 16px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  cursor: pointer;
  color: #495057;
}

.tab.active {
  border-bottom-color: #007bff;
  color: #007bff;
  font-weight: 500;
}

.transfer-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transfer-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: white;
  border: 1px solid #e0e0e0;
  border-left: 4px solid #ffc107;
  border-radius: 6px;
}

.transfer-item.accepted {
  border-left-color: #28a745;
}

.transfer-item.rejected,
.transfer-item.cancelled {
  border-left-color: #adb5bd;
}

.transfer-main {
  flex: 1;
  min-width: 0;
}

.transfer-direction {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.status {
  font-size: 0.85rem;
  color: #666;
}

.entities {
  margin: 0 0 6px;
  padding-left: 18px;
}

.details {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 12px;
  margin: 0;
  font-size: 0.9rem;
}

.details dt {
  color: #666;
}

.details dd {
  margin: 0;
}

.transfer-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.empty-state {
  padding: 40px;
  text-align: center;
}
</style>
