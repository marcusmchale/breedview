<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal">
      <h3>Add New Team</h3>
      <form @submit.prevent="submitAddTeam">
        <div class="form-group">
          <label>Team Name:</label>
          <input
            v-model="teamData.name"
            type="text"
            required
            placeholder="Enter team name"
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label>Team Full Name (Optional):</label>
          <input
            v-model="teamData.fullname"
            type="text"
            placeholder="Enter team full name (optional)"
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label>Parent Team:</label>
          <p class="info-display">{{ parentTeam?.fullname || parentTeam?.name }}</p>
        </div>
        <div class="form-actions right">
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Adding...' : 'Add Team' }}
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


<script setup>
import { ref, watch } from 'vue'
import { useMutation, useApolloClient } from '@vue/apollo-composable'
import ADD_TEAM_MUTATION from '../graphql/organisations/addTeam.graphql'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  parentTeam: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'team-added'])

const { client } = useApolloClient()
const teamData = ref({ name: '', fullname: '' })
const errorMessage = ref('')

// Use the addTeam mutation
const { mutate: addTeamMutation, loading, onError, onDone } = useMutation(ADD_TEAM_MUTATION)

// Handle mutation errors
onError((error) => {
  console.error('Add team error:', error)
  errorMessage.value = error.message || 'Failed to add team. Please try again.'
})

// Handle successful mutation
onDone((result) => {
  const response = result.data?.add_team
  if (response?.status === 'SUCCESS') {
    // Clear cache and emit success
    try {
      client.cache.evict({ fieldName: 'teams' })
      client.cache.evict({ fieldName: 'organisations' })
      client.cache.gc()
    } catch (error) {
      console.warn('Error clearing cache:', error)
    }
    
    emit('team-added', response.result)
    handleCancel() // Close modal and reset form
  } else {
    // Handle GraphQL errors
    const errorMsg = response?.errors?.[0]?.message || 'Failed to add team'
    errorMessage.value = errorMsg
  }
})

// Watch for modal open/close to reset form
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Reset form when modal opens
    teamData.value = { name: '', fullname: '' }
    errorMessage.value = ''
  }
})

const submitAddTeam = async () => {
  if (!teamData.value.name.trim() || !props.parentTeam) return
  
  errorMessage.value = ''
  
  try {
    await addTeamMutation({
      name: teamData.value.name.trim(),
      fullname: teamData.value.fullname.trim() || null,
      parent: props.parentTeam.id
    })
  } catch (error) {
    console.error('Add team failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const handleCancel = () => {
  if (!loading.value) {
    teamData.value = { name: '', fullname: '' }
    errorMessage.value = ''
    emit('close')
  }
}
</script>

<style scoped>
.info-display {
  margin: 0;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  color: #495057;
}
</style>
