<template>
  <div class="form-container">
    <h1>Set New Password</h1>
    <p v-if="!token" class="error-message">No token provided</p>
    <FormKit
      v-if="token"
      type="form"
      :disabled="formDisabled"
      @submit="submitHandler"
      :actions="false"
    >
      <FormKit
        type="password"
        name="password"
        label="New Password"
        validation="required|length:8"
        :disabled="formDisabled"
        placeholder="Enter your new password"
      />
      <FormKit
        type="password"
        name="confirmPassword"
        label="Confirm Password"
        validation="required|confirm:password"
        :disabled="formDisabled"
        placeholder="Confirm your new password"
      />
      <div class="form-actions">
        <FormKit 
          type="submit" 
          label="Reset Password"
          input-class="submit-button"
          :disabled="formDisabled"
        >
          {{ formDisabled ? 'Resetting...' : 'Reset Password' }}
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
import RESET_PASSWORD from '../graphql/authentication/resetPassword.graphql'
import { useRouter } from 'vue-router'

const props = defineProps({
  token: {
    type: String,
    required: true
  }
})

const router = useRouter()
const error = ref('')
const success = ref('')
const formDisabled = ref(false)

const { mutate: resetPassword } = useMutation(RESET_PASSWORD)

const submitHandler = async (formData) => {
  error.value = ''
  success.value = ''
  formDisabled.value = true

  try {
    const variables = {
      token: props.token,
      password: formData.password
    }
    const response = await resetPassword(variables)
    
    if (response?.data?.accountsResetPassword?.status === 'SUCCESS') {
      success.value = 'Password has been reset successfully'
      // Redirect to login page after timeout
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } else {
      error.value = response?.data?.accountsResetPassword?.errors?.[0]?.message || 'Failed to reset password'
    }
  } catch (e) {
    error.value = e.message
  } finally {
    formDisabled.value = false
  }
}
</script>