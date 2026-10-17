<script setup>
import { ref, computed, watch } from 'vue'
import ReadReleaseSelector from './ReadReleaseSelector.vue'
import { useUserAccess } from '@/composables/user/useUserAccess'
import { useTeamRootsQuery } from '@/composables/teams/teamRootsQuery'
import { useMutateTransfers } from '@/composables/controls/mutateTransfers'

// Offer control of one entity from the user's control teams to a recipient team.
// When the user also administers the recipient, the transfer is accepted at once.
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  entityLabel: {
    type: String,
    required: true
  },
  entityId: {
    type: String,
    required: true
  },
  // Control teams of the entity that the user administers
  controlTeams: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'offered'])

const { readTeams, writeTeams, adminTeams, curateTeams, adminTeamIds } = useUserAccess()
const { teamRoots } = useTeamRootsQuery()
const { offerTransfer, offerTransferLoading } = useMutateTransfers()

const fromTeamIds = ref([])
const recipientTeamId = ref('')
const keepFromTeams = ref(false)
const toTeamIds = ref([])
const release = ref('PRIVATE')
const errorMessage = ref('')

// Teams the user can name as recipient: the root teams visible to them, and their own teams
const recipientOptions = computed(() => {
  const byId = new Map()
  for (const team of teamRoots.value) {
    byId.set(String(team.id), { ...team, group: 'Root teams' })
  }
  for (const list of [adminTeams.value, curateTeams.value, writeTeams.value, readTeams.value]) {
    for (const team of list) {
      if (!byId.has(String(team.id))) byId.set(String(team.id), { ...team, group: 'Your teams' })
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.group.localeCompare(b.group) || (a.name || '').localeCompare(b.name || ''))
})

const recipientGroups = computed(() => {
  const groups = new Map()
  for (const team of recipientOptions.value) {
    if (!groups.has(team.group)) groups.set(team.group, [])
    groups.get(team.group).push(team)
  }
  return [...groups.entries()]
})

// Admin of the recipient: choose the teams taking control and the transfer is accepted immediately
const administersRecipient = computed(() =>
  !!recipientTeamId.value && adminTeamIds.value.map(String).includes(String(recipientTeamId.value))
)

const toTeamOptions = computed(() => {
  if (!administersRecipient.value) return []
  const recipient = recipientOptions.value.find(team => String(team.id) === String(recipientTeamId.value))
  const byId = new Map()
  if (recipient) byId.set(String(recipient.id), recipient)
  for (const team of adminTeams.value) byId.set(String(team.id), team)
  return [...byId.values()]
})

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    fromTeamIds.value = props.controlTeams.map(team => String(team.id))
    recipientTeamId.value = ''
    keepFromTeams.value = false
    toTeamIds.value = []
    release.value = 'PRIVATE'
    errorMessage.value = ''
  }
})

watch(recipientTeamId, (id) => {
  toTeamIds.value = administersRecipient.value && id ? [String(id)] : []
})

const isPerson = computed(() => props.entityLabel === 'PERSON')

const canSubmit = computed(() =>
  !offerTransferLoading.value &&
  fromTeamIds.value.length > 0 &&
  !!recipientTeamId.value &&
  (!administersRecipient.value || toTeamIds.value.length > 0)
)

const submitOffer = async () => {
  if (!canSubmit.value) return
  errorMessage.value = ''
  const offer = {
    entities: [{ label: props.entityLabel, id: props.entityId }],
    fromTeamIds: fromTeamIds.value,
    recipientTeamId: String(recipientTeamId.value),
    keepFromTeams: keepFromTeams.value
  }
  if (administersRecipient.value) {
    offer.toTeamIds = toTeamIds.value
    offer.release = release.value
  }
  try {
    const { status, errors } = await offerTransfer(offer)
    if (status === 'SUCCESS') {
      emit('offered', administersRecipient.value)
    } else {
      errorMessage.value = errors?.[0]?.message || 'Failed to offer the transfer'
    }
  } catch (error) {
    console.error('Offer transfer failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const closeModal = () => {
  if (!offerTransferLoading.value) emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.stop="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>Transfer control</h3>
        <button @click="closeModal" class="modal-close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <p class="intro">
          Offer control of this {{ entityLabel.toLowerCase() }} to another team. Admins of that team accept
          and choose which of their teams take control. Only this record moves, not others in its aggregate.
          <template v-if="isPerson">
            A person record can only go to a team tree with a declared legal entity, which becomes its data controller.
          </template>
        </p>

        <form @submit.prevent="submitOffer">
          <div class="form-group">
            <label>Teams giving up control</label>
            <label v-for="team in controlTeams" :key="team.id" class="check-option">
              <input v-model="fromTeamIds" type="checkbox" :value="String(team.id)" :disabled="offerTransferLoading" />
              <span>{{ team.fullname || team.name }}</span>
            </label>
          </div>

          <div class="form-group">
            <label for="recipient-team">Recipient team</label>
            <select id="recipient-team" v-model="recipientTeamId" :disabled="offerTransferLoading" required>
              <option value="">Choose a team</option>
              <optgroup v-for="[group, teams] in recipientGroups" :key="group" :label="group">
                <option v-for="team in teams" :key="team.id" :value="String(team.id)">
                  {{ team.fullname || team.name }}
                </option>
              </optgroup>
            </select>
            <p class="help-text">Often the root team of another team tree; its admins can assign control to a team below it.</p>
          </div>

          <div class="form-group">
            <label class="check-option">
              <input v-model="keepFromTeams" type="checkbox" :disabled="offerTransferLoading" />
              <span>Share control: the teams above keep their control as well</span>
            </label>
          </div>

          <div v-if="administersRecipient" class="immediate-accept">
            <p class="help-text">
              You administer the recipient team, so the transfer is accepted at once. Choose the teams taking control.
            </p>
            <div class="form-group">
              <label>Teams taking control</label>
              <label v-for="team in toTeamOptions" :key="team.id" class="check-option">
                <input v-model="toTeamIds" type="checkbox" :value="String(team.id)" :disabled="offerTransferLoading" />
                <span>{{ team.fullname || team.name }}</span>
              </label>
              <p class="help-text">Must be the recipient team or teams below it that you administer.</p>
            </div>
            <div class="form-group">
              <label>Release of the new controls</label>
              <ReadReleaseSelector v-model="release" />
            </div>
          </div>

          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

          <div class="form-actions right">
            <button type="button" class="btn btn-secondary" :disabled="offerTransferLoading" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="!canSubmit">
              {{ offerTransferLoading ? 'Sending...' : (administersRecipient ? 'Transfer' : 'Offer transfer') }}
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

.help-text {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: #666;
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

.immediate-accept {
  margin-top: 8px;
  padding: 12px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}
</style>
