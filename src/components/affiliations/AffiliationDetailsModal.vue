<script setup>
import { ref } from 'vue'
import {useMutation} from "@vue/apollo-composable";

import SET_WRITE_TEAM from '../../graphql/account/setWriteTeam.graphql'
import { useUserAccess } from "@/composables/user/useUserAccess";



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

const emit = defineEmits(['close', 'remove-affiliation'])

const { refetch: refetchAccessTeams } = useUserAccess()

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
      </div>

      <div class="form-actions right">
        <button
          type="button"
          class="btn btn-danger"
          @click="$emit('remove-affiliation')"
          :disabled="removeAffiliationLoading"
        >
          {{ removeAffiliationLoading ? 'Removing...' : 'Remove Affiliation' }}
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