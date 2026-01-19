
<script setup>
import { ref, watch } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'

import ACCOUNT_QUERY from '../../graphql/account/account.graphql'
import UPDATE_USER_MUTATION from '../../graphql/account/updateUser.graphql'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const account = ref(null)
const loading = ref(true)
const error = ref(false)
const formValues = ref({})
const updateError = ref('')
const successMessage = ref('')
const emit = defineEmits(['back-to-home', 'profile-updated'])

// Use Apollo query to get current user data
const { result, loading: queryLoading, error: queryError } = useQuery(ACCOUNT_QUERY, {}, {
  fetchPolicy: 'network-only',
  errorPolicy: 'all'
})

// Use update user mutation
const { mutate: updateUserMutation, loading: updateLoading, onError: onUpdateError } = useMutation(UPDATE_USER_MUTATION)

// Handle update errors
onUpdateError((err) => {
  console.error('Update error:', err)
  updateError.value = err.message || 'Update failed. Please try again.'
})

// Watch for query state changes
watch([queryLoading, queryError, result], () => {
  if (queryLoading.value) {
    loading.value = true
    return
  }

  loading.value = false

  // Check if there's an error or if the query failed
  if (queryError.value) {
    error.value = true
    return
  }

  // Check if we have a valid result
  const accountData = result.value?.accountsAccount
  if (!accountData) {
    error.value = true
    return
  }

  // Check if the account query was successful
  if (accountData.status === 'SUCCESS' && accountData.result) {
    account.value = accountData.result
    error.value = false

    // Pre-populate form with current user data
    formValues.value = {}
  } else {
    // Account query returned an error status
    error.value = true
    console.error('Account query failed:', accountData.errors)
  }
}, { immediate: true })

const updateProfile = async (formData) => {
  try {
    updateError.value = ''
    successMessage.value = ''

    // Prepare variables, only include password if it's provided
    const variables = {
      name: formData.name,
      fullname: formData.fullname,
      email: formData.email,
      password: formData.password
    }

    const response = await updateUserMutation(variables)

    console.log('Update response:', response?.data?.accountsUpdateUser)

    if (response?.data?.accountsUpdateUser?.status === 'SUCCESS') {
      successMessage.value = 'Profile updated successfully!'
      // Emit profile-updated event to trigger refetch in parent
      setTimeout(() => {
        emit('profile-updated')
      }, 2000)
    } else {
      // Update failed, show error
      const errorMsg = response?.data?.accountsUpdateUser?.errors?.[0]?.message || 'Update failed'
      updateError.value = errorMsg
    }
  } catch (error) {
    console.error('Update failed:', error)
    updateError.value = error.message || 'An unexpected error occurred during update.'
  }
}

const closeModal = () => {
  error.value = null
  emit('close')
}

</script>


<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">>
    <div class="modal-content">
      <div class="modal-header">
        <h2>Update Profile</h2>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>
      <div class="modal-body">

        <div v-if="loading" class="loading">
          Loading user data...
        </div>

        <div v-else-if=           "error" class="error">
          <p>Unable to load user information</p>
          <button @click="$emit('back-to-home')" class="btn btn-primary">
            Go Back
          </button>
        </div>

        <div v-else-if="account && account.user" class="form-container">
          <FormKit
            type="form"
            v-model="formValues"
            @submit="updateProfile"
            :actions="false"
          >
            <FormKit
              type="text"
              name="name"
              label="Username"
              :help="account.user.name"
            />
            <FormKit
              type="text"
              name="fullname"
              label="Full Name"
              :help="account.user.fullname"
            />
            <FormKit
              type="email"
              name="email"
              label="Email"
              validation="email"
              :help="account.user.email"
            />
            <FormKit
              type="password"
              name="password"
              label="New Password (optional)"
              help="Leave blank to keep current password"
            />
            <div class="form-actions right">
              <FormKit
                type="submit"
                input-class="btn btn-primary"
                :disabled="updateLoading"
              >
                {{ updateLoading ? 'Updating...' : 'Update Profile' }}
              </FormKit>
            </div>
          </FormKit>

        </div>

        <div v-if="updateError" class="error-message">
          {{ updateError }}
        </div>

        <div v-if="successMessage" class="success-message">
          {{ successMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 90%;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #eee;
}

.modal-header h2 {
  margin: 0;
  color: #333;
}

.form-container {
  background: #f8f9fa;
  padding: 25px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}


.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}


</style>
