<template>
  <div class="form-container">
    <h2>Reset Password</h2>
    <FormKit
      type="form"
      :disabled="formDisabled"
      @submit="submitHandler"
      :actions="false"
    >
      <FormKit
        type="email"
        name="email"
        label="Email"
        validation="required|email"
        :disabled="formDisabled"
      />
      <div class="form-actions">
        <FormKit 
          type="submit" 
          input-class="submit-button"
          :disabled="formDisabled"
        >
          {{ formDisabled ? 'Sending...' : 'Send Reset Link' }}
        </FormKit>
      </div>
    </FormKit>
    <div v-if="error" class="error-message">{{ error }}</div>
    <div v-if="success" class="success-message">{{ success }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import REQUEST_PASSWORD_RESET from '../../graphql/authentication/requestPasswordReset.graphql'

const error = ref('')
const success = ref('')
const formDisabled = ref(false)

const { mutate: requestReset } = useMutation(REQUEST_PASSWORD_RESET, {
  variables: {
    email: ''
  }
})

const submitHandler = async (formData) => {
  error.value = ''
  success.value = ''
  formDisabled.value = true

  try {
    const variables = {
        email: formData.email
      }
    const response = await requestReset(variables)

    if (response?.data?.accountsRequestPasswordReset?.status === 'SUCCESS') {
      success.value = 'Password reset instructions have been sent to your email'
    } else {
      error.value = response?.data?.accountsRequestPasswordReset?.errors?.[0]?.message || 'Failed to request password reset'
    }
  } catch (e) {
    error.value = e.message
  } finally {
    formDisabled.value = false
  }
}
</script>