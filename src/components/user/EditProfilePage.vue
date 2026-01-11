<template>
  <div class="page-container">
    <div class="page-header">
      <h1>Update Profile</h1>
      <button @click="$emit('back-to-home')" class="btn btn-secondary">Back to Home</button>
    </div>

    <div v-if="loading" class="loading">
      Loading user data...
    </div>

    <div v-else-if="error" class="error">
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
          validation="required"
          placeholder="Enter your username"
          :value="account.user.name"
        />
        <FormKit
          type="text"
          name="fullname"
          label="Full Name"
          validation="required"
          placeholder="Enter your full name"
          :value="account.user.fullname"
        />
        <FormKit
          type="email"
          name="email"
          label="Email"
          validation="required|email"
          placeholder="Enter your email"
          :value="account.user.email"
        />
        <FormKit
          type="password"
          name="password"
          label="New Password (optional)"
          placeholder="Leave blank to keep current password"
          help="Only fill this if you want to change your password"
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

      <div v-if="updateError" class="error-message">
        {{ updateError }}
      </div>

      <div v-if="successMessage" class="success-message">
        {{ successMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import ACCOUNT_QUERY from '../../graphql/account/account.graphql'
import UPDATE_USER_MUTATION from '../../graphql/account/updateUser.graphql'

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
    formValues.value = {
      name: accountData.result.user.name,
      fullname: accountData.result.user.fullname,
      email: accountData.result.user.email,
      password: ''
    }
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
      email: formData.email
    }

    // Only include password if user entered one
    if (formData.password && formData.password.trim() !== '') {
      variables.password = formData.password
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
</script>

<style scoped>
.page-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #eee;
}

.page-header h1 {
  margin: 0;
  color: #333;
}

.form-container {
  background: #f8f9fa;
  padding: 25px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}
</style>
