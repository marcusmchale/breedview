<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>Invite User</h3>
        <button @click="closeModal" class="close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <form @submit.prevent="inviteUser">
          <div class="form-group">
            <label for="email">Email Address:</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="Enter email address"
              required
              :disabled="loading"
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
              :disabled="loading"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="loading || !email.trim()"
            >
              {{ loading ? 'Sending...' : 'Send Invitation' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>


<script setup>
import { ref, watch } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import ADD_EMAIL_MUTATION from '../graphql/account/addEmail.graphql'

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

// Use the addEmail mutation
const { mutate: addEmailMutation, loading, onError, onDone } = useMutation(ADD_EMAIL_MUTATION)

// Handle mutation errors
onError((error) => {
  console.error('Add email error:', error)
  errorMessage.value = error.message || 'Failed to send invitation. Please try again.'
  successMessage.value = ''
})

// Handle successful mutation
onDone((result) => {
  const response = result.data?.add_email
  if (response?.status === 'SUCCESS') {
    successMessage.value = 'Invitation sent successfully!'
    errorMessage.value = ''
    emit('invited', email.value)
    
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

// Watch for modal open/close to reset form
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Reset form when modal opens
    email.value = ''
    errorMessage.value = ''
    successMessage.value = ''
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

const closeModal = () => {
  if (!loading.value) {
    emit('close')
  }
}
</script>

<style scoped>
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #e5e5e5;
  margin-bottom: 1.5rem;
}

.modal-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  line-height: 1;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}
</style>
