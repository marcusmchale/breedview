<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal">
      <h3>Request Affiliation</h3>
      <form @submit.prevent="submitRequestAffiliation">
        <div class="form-group">
          <label>Team:</label>
          <p>{{ selectedTeam?.fullname || selectedTeam?.name }}</p>
        </div>
        <div class="form-group">
          <label>Access Type:</label>
          <select v-model="affiliationRequest.access" required :disabled="loading">
            <option value="">Select access type</option>
            <option
              v-for="accessType in availableAccessTypes"
              :key="accessType.value"
              :value="accessType.value"
            >
              {{ accessType.label }}
            </option>
          </select>
        </div>
        <!-- Show message if no access types are available -->
        <div v-if="availableAccessTypes.length === 0" class="info-message">
          You already have all possible access types for this team.
        </div>
        <!-- Show warning message for WRITE access -->
        <div v-if="affiliationRequest.access === 'WRITE' && userIsAdminForSelectedTeam" class="warning-message">
          <strong>Note:</strong> Heritable write affiliations are not recommended or supported by this application. This is to reduce the complexity of access control for any resulting records.
        </div>
        <!-- Only show heritable checkbox if user is admin for this team -->
        <div v-if="userIsAdminForSelectedTeam" class="form-group checkbox-group">
          <label class="checkbox-label" :class="{ disabled: affiliationRequest.access === 'WRITE' }">
            <input
              type="checkbox"
              v-model="affiliationRequest.heritable"
              :value="true"
              :disabled="affiliationRequest.access === 'WRITE' || loading"
            />
            <span>Heritable affiliation</span>
          </label>
          <p class="help-text">
            A heritable affiliation provides the same access to all child teams.
          </p>
        </div>
        <div class="form-actions">
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="loading || availableAccessTypes.length === 0"
          >
            {{ loading ? 'Requesting...' : 'Request Affiliation' }}
          </button>
          <button type="button" @click="handleCancel" class="btn btn-secondary" :disabled="loading">
            Cancel
          </button>
        </div>
      </form>
      <div v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useMutation, useApolloClient } from '@vue/apollo-composable'
import REQUEST_AFFILIATION_MUTATION from '../graphql/account/requestAffiliation.graphql'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  selectedTeam: {
    type: Object,
    default: null
  },
  currentUserId: {
    type: [String, Number],
    required: true
  }
})

const emit = defineEmits(['close', 'affiliation-requested'])

const { client } = useApolloClient()
const affiliationRequest = ref({ access: '', heritable: true })
const errorMessage = ref('')
const successMessage = ref('')

// Use the requestAffiliation mutation
const { mutate: requestAffiliationMutation, loading, onError, onDone } = useMutation(REQUEST_AFFILIATION_MUTATION)

// Computed property to get available access types (excluding those the user already has)
const availableAccessTypes = computed(() => {
  if (!props.selectedTeam) return []

  const allAccessTypes = [
    { value: 'READ', label: 'Read' },
    { value: 'WRITE', label: 'Write' },
    { value: 'ADMIN', label: 'Admin' },
    { value: 'CURATE', label: 'Curate' }
  ]

  const affiliations = props.selectedTeam.affiliations || {}
  const userId = props.currentUserId

  // Function to check if user has an active (non-revoked) affiliation for a given access type
  const hasActiveAffiliation = (accessType) => {
    const affiliationList = affiliations[accessType.value.toLowerCase()] || []
    const userAffiliation = affiliationList.find(affiliation => affiliation.user.id == userId)
    // Return true if user has any non-revoked affiliation (authorized or pending)
    return userAffiliation && userAffiliation.authorisation !== 'REVOKED'
  }

  // Filter out access types that the user already has
  return allAccessTypes.filter(accessType => !hasActiveAffiliation(accessType))
})

// Computed property to check if current user is admin for selected team
const userIsAdminForSelectedTeam = computed(() => {
  if (!props.selectedTeam) return false

  const affiliations = props.selectedTeam.affiliations || {}
  const userId = props.currentUserId

  const adminAffiliations = affiliations.admin || []
  const userAdmin = adminAffiliations.find(affiliation => affiliation.user.id == userId)
  
  return userAdmin && userAdmin.authorisation === 'AUTHORISED'
})

// Handle mutation errors
onError((error) => {
  console.error('Request affiliation error:', error)
  errorMessage.value = error.message || 'Failed to request affiliation. Please try again.'
  successMessage.value = ''
})

// Handle successful mutation
onDone((result) => {
  const response = result.data?.request_affiliation
  if (response?.status === 'SUCCESS') {
    successMessage.value = 'Affiliation requested successfully!'
    errorMessage.value = ''
    
    // Clear cache
    try {
      client.cache.evict({ fieldName: 'teams' })
      client.cache.evict({ fieldName: 'organisations' })
      client.cache.gc()
    } catch (error) {
      console.warn('Error clearing cache:', error)
    }
    
    emit('affiliation-requested', {
      team: props.selectedTeam,
      access: affiliationRequest.value.access,
      heritable: affiliationRequest.value.heritable
    })
    
    // Auto-close modal after 2 seconds
    setTimeout(() => {
      handleCancel()
    }, 2000)
  } else {
    // Handle GraphQL errors
    const errorMsg = response?.errors?.[0]?.message || 'Failed to request affiliation'
    errorMessage.value = errorMsg
    successMessage.value = ''
  }
})

// Watch for modal open/close to reset form
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Reset form when modal opens
    affiliationRequest.value = { access: '', heritable: true }
    errorMessage.value = ''
    successMessage.value = ''
  }
})

const submitRequestAffiliation = async () => {
  if (!affiliationRequest.value.access || !props.selectedTeam || availableAccessTypes.value.length === 0) return
  
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    await requestAffiliationMutation({
      team: props.selectedTeam.id,
      access: affiliationRequest.value.access,
      heritable: affiliationRequest.value.heritable
    })
  } catch (error) {
    console.error('Request affiliation failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const handleCancel = () => {
  if (!loading.value) {
    affiliationRequest.value = { access: '', heritable: true }
    errorMessage.value = ''
    successMessage.value = ''
    emit('close')
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 1.5rem;
}

.modal h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-group input:disabled,
.form-group select:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-group p {
  margin: 0;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  color: #495057;
}

.checkbox-group {
  margin-bottom: 1.5rem;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  cursor: pointer;
  font-weight: normal;
}

.checkbox-label.disabled {
  color: #6c757d;
  cursor: not-allowed;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin-right: 0.5rem;
  margin-top: 0.125rem;
}

.help-text {
  font-size: 0.875rem;
  color: #6c757d;
  margin: 0.25rem 0 0 1.5rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}

.info-message {
  background-color: #d1ecf1;
  color: #0c5460;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #bee5eb;
  margin-bottom: 1rem;
}

.warning-message {
  background-color: #fff3cd;
  color: #856404;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #ffeaa7;
  margin-bottom: 1rem;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #f5c6cb;
  margin-top: 1rem;
}

.success-message {
  background-color: #d4edda;
  color: #155724;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #c3e6cb;
  margin-top: 1rem;
}
</style>
