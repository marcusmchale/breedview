<template>
  <div class="form-container">
    <div v-if="!showRequestReset && !showRegistration">
      <h1>Login</h1>
      <FormKit
        type="form"
        v-model="formValues"
        @submit="submitHandler"
        :actions="false"
      >
        <FormKit
          type="text"
          name="username"
          label="Username"
          validation="required"
          placeholder="Enter your username"
        />
        <FormKit
          type="password"
          name="password"
          label="Password"
          validation="required"
          placeholder="Enter your password"
        />
        <div class="form-actions">
          <FormKit
            type="submit"
            input-class="btn btn-primary"
            :disabled="loading"
          >
            {{ loading ? 'Logging in...' : 'Login' }}
          </FormKit>
        </div>
      </FormKit>
      <div class="additional-actions">
        <button @click="showRequestReset = true" class="link-button">
          Forgot Password?
        </button>
        <span class="separator">|</span>
        <button @click="showRegistration = true" class="link-button">
          Create Account
        </button>
      </div>
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>

    <div v-else-if="showRequestReset">
      <RequestPasswordReset />
      <div class="additional-actions">
        <button @click="showRequestReset = false" class="link-button">
          Back to Login
        </button>
      </div>
    </div>

    <div v-else>
      <RegistrationPage @registration-complete="showRegistration = false" />
      <div class="additional-actions">
        <button @click="showRegistration = false" class="link-button">
          Back to Login
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import { useRouter } from 'vue-router'
import RequestPasswordReset from './RequestPasswordReset.vue'
import RegistrationPage from './RegistrationPage.vue'
import LOGIN_MUTATION from '../../graphql/authentication/login.graphql'

const router = useRouter()
const error = ref('')
const formValues = ref({})
const showRequestReset = ref(false)
const showRegistration = ref(false)

const { mutate, loading, onError } = useMutation(LOGIN_MUTATION)

onError((err) => {
  console.error('Login error:', err)
  error.value = err.message
})

const submitHandler = async (formData) => {
  error.value = ''

  try {
    const variables = {
        username: formData.username,
        password: formData.password
    }
    const response = await mutate(variables)

    // Add debugging logs
    console.log('Login status:', response?.data?.accountsLogin?.status)

    if (response?.data?.accountsLogin?.status === 'SUCCESS') {
      await router.push('/')
    } else {
      error.value = response?.data?.accountsLogin?.errors?.[0]?.message || 'Login failed. Please check your credentials.'
    }
  } catch (e) {
    console.error('Login error:', e)  // Enhanced error logging
    error.value = e.message || 'An unexpected error occurred.'
  }
}
</script>

<style scoped>
.additional-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.link-button {
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  text-decoration: underline;
  font-size: 14px;
}

.link-button:hover {
  color: #0056b3;
}
</style>
