<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>Invite User</h3>
        <button @click="closeModal" class="modal-close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <!-- Add Email Form -->
        <form @submit.prevent="inviteUser">
          <div class="form-group">
            <label for="email">Email Address:</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="Enter email address"
              required
              :disabled="loading || removeLoading"
            />
          </div>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <div v-if="successMessage" class="success-message">
            {{ successMessage }}
          </div>

          <div class="form-actions right">
            <button
              type="button"
              @click="closeModal"
              class="btn btn-secondary"
              :disabled="loading || removeLoading"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="loading || removeLoading || !email.trim()"
            >
              {{ loading ? 'Sending...' : 'Send Invitation' }}
            </button>
          </div>
        </form>

        <!-- Allowed Emails List -->
        <div v-if="allowedEmails && allowedEmails.length > 0" class="allowed-emails-section">
          <h4>Allowed Emails</h4>
          <div v-if="accountLoading" class="loading-text">
            Loading allowed emails...
          </div>
          <div v-else class="allowed-emails-list">
            <div
              v-for="allowedEmail in allowedEmails"
              :key="allowedEmail"
              class="allowed-email-item"
            >
              <span class="email-text">{{ allowedEmail }}</span>
              <button
                @click="removeEmail(allowedEmail)"
                class="btn btn-danger btn-small"
                :disabled="removeLoading || loading"
                :title="`Remove ${allowedEmail}`"
              >
                {{ removeLoading && emailBeingRemoved === allowedEmail ? 'Removing...' : 'Remove' }}
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="!accountLoading" class="no-emails-message">
          <p>No allowed emails found.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import ADD_EMAIL_MUTATION from '../graphql/account/addEmail.graphql'
import REMOVE_EMAIL_MUTATION from '../graphql/account/removeEmail.graphql'
import ACCOUNT_QUERY from '../graphql/account/account.graphql'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'invited'])

const email = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const emailBeingRemoved = ref('')

// Query for account data to get allowed emails
const { result: accountResult, loading: accountLoading, refetch: refetchAccount } = useQuery(
  ACCOUNT_QUERY,
  {},
  {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
    enabled: computed(() => props.isOpen)
  }
)

// Computed property for allowed emails
const allowedEmails = computed(() => {
  return accountResult.value?.account?.result?.allowed_emails || []
})

// Use the addEmail mutation
const { mutate: addEmailMutation, loading, onError, onDone } = useMutation(ADD_EMAIL_MUTATION)

// Use the removeEmail mutation
const {
  mutate: removeEmailMutation,
  loading: removeLoading,
  onError: onRemoveError,
  onDone: onRemoveDone
} = useMutation(REMOVE_EMAIL_MUTATION)

// Handle add email mutation errors
onError((error) => {
  console.error('Add email error:', error)
  errorMessage.value = error.message || 'Failed to send invitation. Please try again.'
  successMessage.value = ''
})

// Handle successful add email mutation
onDone((result) => {
  const response = result.data?.accountsAddEmail
  if (response?.status === 'SUCCESS') {
    successMessage.value = 'Invitation sent successfully!'
    errorMessage.value = ''
    emit('invited', email.value)

    // Refetch account data to update the allowed emails list
    refetchAccount()

    // Auto-close modal after 2 seconds
    setTimeout(() => {
      closeModal()
    }, 2000)
  } else {
    // Handle GraphQL errors
    const errorMsg = response?.errors?.[0]?.message || 'Failed to send invitation'
    errorMessage.value = errorMsg
    successMessage.value = ''
  }
})

// Handle remove email mutation errors
onRemoveError((error) => {
  console.error('Remove email error:', error)
  errorMessage.value = error.message || 'Failed to remove email. Please try again.'
  successMessage.value = ''
  emailBeingRemoved.value = ''
})

// Handle successful remove email mutation
onRemoveDone((result) => {
  const response = result.data?.accountsRemoveEmail
  if (response?.status === 'SUCCESS') {
    successMessage.value = `Email removed successfully!`
    errorMessage.value = ''

    // Refetch account data to update the allowed emails list
    refetchAccount()

    // Clear the loading state
    emailBeingRemoved.value = ''

    // Clear success message after 3 seconds
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } else {
    // Handle GraphQL errors
    const errorMsg = response?.errors?.[0]?.message || 'Failed to remove email'
    errorMessage.value = errorMsg
    successMessage.value = ''
    emailBeingRemoved.value = ''
  }
})

// Watch for modal open/close to reset form
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Reset form when modal opens
    email.value = ''
    errorMessage.value = ''
    successMessage.value = ''
    emailBeingRemoved.value = ''

    // Refetch account data when modal opens
    refetchAccount()
  }
})

const inviteUser = async () => {
  if (!email.value.trim()) return

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await addEmailMutation({
      email: email.value.trim()
    })
  } catch (error) {
    console.error('Invitation failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const removeEmail = async (emailToRemove) => {
  if (!emailToRemove || removeLoading.value) return

  errorMessage.value = ''
  successMessage.value = ''
  emailBeingRemoved.value = emailToRemove

  try {
    await removeEmailMutation({
      email: emailToRemove
    })
  } catch (error) {
    console.error('Remove email failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred while removing email.'
    emailBeingRemoved.value = ''
  }
}

const closeModal = () => {
  if (!loading.value && !removeLoading.value) {
    emit('close')
  }
}
</script>
