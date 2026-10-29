<script setup>
import { ref, watch } from 'vue'
import { useMutateTeams } from '@/composables/teams/mutateTeams'
import AttributionField from './AttributionField.vue'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  // the team as its node shows it, with its attribution and the one it inherits
  team: { type: Object, required: true }
})

const emit = defineEmits(['close', 'team-updated'])

const teamData = ref({ name: '', fullname: '', attribution: '' })
const errorMessage = ref('')

const { updateTeam, updateTeamLoading: loading } = useMutateTeams()

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    teamData.value = {
      name: props.team.name ?? '',
      fullname: props.team.fullname ?? '',
      attribution: props.team.attribution ?? ''
    }
    errorMessage.value = ''
  }
})

const submit = async () => {
  if (!teamData.value.name.trim()) return
  errorMessage.value = ''
  try {
    // an empty full name or attribution clears it
    const { status, errors } = await updateTeam({
      id: props.team.id,
      name: teamData.value.name.trim(),
      fullname: teamData.value.fullname.trim() || null,
      attribution: teamData.value.attribution.trim() || null
    })
    if (status === 'SUCCESS') {
      emit('team-updated')
      emit('close')
    } else {
      errorMessage.value = errors?.[0]?.message || 'Failed to update the team'
    }
  } catch (error) {
    console.error('Update team failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const handleCancel = () => {
  if (!loading.value) emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal edit-team-modal">
      <h3>Edit Team</h3>
      <form @submit.prevent="submit">
        <div class="form-group">
          <label>Team Name:</label>
          <input v-model="teamData.name" type="text" required :disabled="loading" />
        </div>
        <div class="form-group">
          <label>Team Full Name (Optional):</label>
          <input v-model="teamData.fullname" type="text" :disabled="loading" />
        </div>
        <AttributionField
          v-model="teamData.attribution"
          :inherited="team.inheritedAttribution"
          :disabled="loading"
        />
        <div class="form-actions right">
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Saving...' : 'Save' }}
          </button>
          <button type="button" @click="handleCancel" class="btn btn-secondary" :disabled="loading">
            Cancel
          </button>
        </div>
      </form>
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>
