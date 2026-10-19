<script setup>
import { ref, computed, watch } from 'vue'
import ReadReleaseSelector from './ReadReleaseSelector.vue'
import { releasesFor } from '@/composables/controls/releases'
import { useUserAccess } from '@/composables/user/useUserAccess'
import { useMutateTransfers } from '@/composables/controls/mutateTransfers'

// Accept a transfer offered to a team the user administers, choosing the teams that take control
// (the recipient team or teams below it that the user administers) and the release level.
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  transfer: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'accepted'])

const { adminTeams } = useUserAccess()
const { acceptTransfer, acceptTransferLoading } = useMutateTransfers()

const toTeamIds = ref([])
const release = ref('PRIVATE')
// the widest release the offered entities can be given (Persons: registered users)
const maxRelease = computed(() => releasesFor((props.transfer?.entities ?? []).map((entity) => entity.label)).at(-1))
const errorMessage = ref('')

// The recipient team first, then the user's other admin teams; the server checks they are below the recipient
const teamOptions = computed(() => {
  const recipient = props.transfer?.recipientTeam
  const byId = new Map()
  if (recipient) byId.set(String(recipient.id), recipient)
  for (const team of adminTeams.value) {
    if (!byId.has(String(team.id))) byId.set(String(team.id), team)
  }
  return [...byId.values()]
})

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    const recipient = props.transfer?.recipientTeam
    toTeamIds.value = recipient ? [String(recipient.id)] : []
    release.value = 'PRIVATE'
    errorMessage.value = ''
  }
})

const canSubmit = computed(() => !acceptTransferLoading.value && toTeamIds.value.length > 0)

const submitAccept = async () => {
  if (!canSubmit.value || !props.transfer) return
  errorMessage.value = ''
  try {
    const { status, errors } = await acceptTransfer({
      id: props.transfer.id,
      toTeamIds: toTeamIds.value,
      release: release.value
    })
    if (status === 'SUCCESS') {
      emit('accepted')
      emit('close')
    } else {
      errorMessage.value = errors?.[0]?.message || 'Failed to accept the transfer'
    }
  } catch (error) {
    console.error('Accept transfer failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const closeModal = () => {
  if (!acceptTransferLoading.value) emit('close')
}
</script>

<template>
  <div v-if="isOpen && transfer" class="modal-overlay" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>Accept transfer</h3>
        <button @click="closeModal" class="modal-close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <p class="intro">
          Control of {{ transfer.entities.length }} record(s) is offered to
          <strong>{{ transfer.recipientTeam?.fullname || transfer.recipientTeam?.name }}</strong>.
          Choose the teams that take control: the recipient team, or teams below it that you administer.
        </p>

        <form @submit.prevent="submitAccept">
          <div class="form-group">
            <label>Teams taking control</label>
            <label v-for="team in teamOptions" :key="team.id" class="check-option">
              <input v-model="toTeamIds" type="checkbox" :value="String(team.id)" :disabled="acceptTransferLoading" />
              <span>{{ team.fullname || team.name }}</span>
            </label>
          </div>

          <div class="form-group">
            <label>Release of the new controls</label>
            <ReadReleaseSelector v-model="release" :max-release="maxRelease" />
          </div>

          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

          <div class="form-actions right">
            <button type="button" class="btn btn-secondary" :disabled="acceptTransferLoading" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="!canSubmit">
              {{ acceptTransferLoading ? 'Accepting...' : 'Accept' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.intro {
  margin: 0 0 16px;
  color: #495057;
}

.check-option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  font-weight: normal;
  cursor: pointer;
}

.check-option input {
  width: auto;
}
</style>
