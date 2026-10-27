<script setup>
import { ref, computed } from 'vue'
import {useMutation} from "@vue/apollo-composable";

import SET_WRITE_TEAM from '../../graphql/account/setWriteTeam.graphql'
import { useUserAccess } from "@/composables/user/useUserAccess";
import { useMutateOwnAffiliations } from '@/composables/account/mutateAffiliations'



const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  selectedAffiliation: {
    type: Object,
    default: null
  },
  team: {
    type: Object,
    required: true
  },
  removeAffiliationLoading: {
    type: Boolean,
    default: false
  },
  removeAffiliationError: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'remove-affiliation', 'affiliation-changed'])

const { refetch: refetchAccessTeams } = useUserAccess()

const {
  requestHeritability, requestHeritabilityLoading, removeHeritability, removeHeritabilityLoading
} = useMutateOwnAffiliations()
const heritabilityError = ref('')

// How far the user's own affiliation reaches. One authorised for this team only may be asked for the teams below too
// (write access never reaches them), and the admins decide; one that reaches them may be kept to this team, and a
// request withdrawn, at once. An inherited affiliation is changed on the team it is from.
const affiliation = computed(() => props.selectedAffiliation?.data)
const ownAffiliation = computed(() => !!affiliation.value && !props.selectedAffiliation.inherited)
const canRequestHeritable = computed(() => ownAffiliation.value
  && props.selectedAffiliation.accessType !== 'WRITE'
  && affiliation.value.authorisation === 'AUTHORISED'
  && !affiliation.value.heritable
  && !affiliation.value.heritableRequested)
const canRemoveHeritability = computed(() => ownAffiliation.value
  && (affiliation.value.heritable || affiliation.value.heritableRequested))
const heritabilityLoading = computed(() => requestHeritabilityLoading.value || removeHeritabilityLoading.value)

const changeHeritability = async (change) => {
  heritabilityError.value = ''
  try {
    const { status, errors } = await change({ teamId: props.team.id, access: props.selectedAffiliation.accessType })
    if (status === 'SUCCESS') {
      await refetchAccessTeams()
      emit('affiliation-changed')
    } else {
      heritabilityError.value = errors?.[0]?.message || 'Failed to change how far the affiliation reaches'
    }
  } catch (error) {
    console.error('Heritability change error:', error)
    heritabilityError.value = error.message || 'An unexpected error occurred'
  }
}

const { mutate: setWriteTeam, loading: setWriteLoading } = useMutation(SET_WRITE_TEAM)
const setWriteError = ref('')

const handleSetWriteTeam = async () => {
  try {
    setWriteError.value = ''
    const response = await setWriteTeam({
      teamId: props.team?.id,
    })
    if (response?.data?.accountsSetWriteTeam?.status === 'SUCCESS') {
      await refetchAccessTeams()
      emit('close')
    } else {
      setWriteError.value = response?.data?.accountsSetWriteTeam?.errors?.[0]?.message || 'Failed to set default write team'
    }
  } catch (error) {
    console.error('Set write team error:', error)
    setWriteError.value = error.message || 'An unexpected error occurred'
  }
}


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
</script>

<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal">
      <h3>{{ selectedAffiliation?.accessType }} Affiliation Details</h3>

      <div class="affiliation-details">
        <p><strong>Team:</strong> {{ team.fullname || team.name }}</p>
        <p><strong>Access Type:</strong> {{ selectedAffiliation?.accessType }}</p>
        <p><strong>Status: </strong>
          <span :class="getStatusClass(selectedAffiliation?.data.authorisation)">
            {{ getStatusText(selectedAffiliation?.data.authorisation) }}
          </span>
        </p>
        <p><strong>Inheritance:</strong> {{ selectedAffiliation?.data.heritable ? 'Heritable (applies to child teams)' : 'Direct only (this team only)' }}</p>
        <p v-if="selectedAffiliation?.inherited" class="text-muted">
          Inherited from a team above this one, where it is changed or removed.
        </p>
        <p v-else-if="selectedAffiliation?.data.heritableRequested" class="text-muted heritability-requested">
          You asked for this access to the teams below too. The team's admins decide; you keep it for this team
          meanwhile.
        </p>
      </div>

      <div class="form-actions right">
        <button
          v-if="!selectedAffiliation?.inherited"
          type="button"
          class="btn btn-danger"
          @click="$emit('remove-affiliation')"
          :disabled="removeAffiliationLoading"
        >
          {{ removeAffiliationLoading ? 'Removing...' : 'Remove Affiliation' }}
        </button>

        <button v-if="canRequestHeritable"
          type="button"
          class="btn"
          title="Ask the team's admins for this access to the teams below this one too"
          @click="changeHeritability(requestHeritability)"
          :disabled="heritabilityLoading"
        >
          {{ requestHeritabilityLoading ? 'Requesting...' : 'Request Heritable' }}
        </button>

        <button v-if="canRemoveHeritability"
          type="button"
          class="btn"
          :title="affiliation.heritable
            ? 'Keep this access to this team only, at once: asking for the teams below again needs an admin\'s approval'
            : 'Withdraw the request for this access to the teams below'"
          @click="changeHeritability(removeHeritability)"
          :disabled="heritabilityLoading"
        >
          {{ removeHeritabilityLoading ? 'Changing...' : (affiliation.heritable ? 'Make Direct Only' : 'Withdraw Request') }}
        </button>

        <button v-if="selectedAffiliation?.accessType === 'WRITE'"
          type="button"
          class="btn"
          @click="handleSetWriteTeam"
          :disabled="setWriteLoading"
        >
          {{ setWriteLoading ? 'Setting default...' : 'Set As Default' }}
        </button>

        <button type="button" @click="$emit('close')" class="btn btn-secondary">
          Cancel
        </button>
      </div>

      <div v-if="removeAffiliationError" class="error-message">
        {{ removeAffiliationError }}
      </div>

      <div v-if="setWriteError" class="error-message">
        {{ setWriteError }}
      </div>

      <div v-if="heritabilityError" class="error-message">
        {{ heritabilityError }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.affiliation-details {
  margin-bottom: 1.5rem;
}

.affiliation-details p {
  margin: 0.5rem 0;
}
</style>