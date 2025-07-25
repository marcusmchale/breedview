<template>
  <div class="form-container">
    <h1>Register</h1>
    <FormKit
      type="form"
      v-model="formValues"
      @submit="submitHandler"
      :actions="false"
    >
      <FormKit
        type="text"
        name="name"
        label="Username"
        validation="required"
        placeholder="Enter your username"
      />
      <FormKit
        type="text"
        name="fullname"
        label="Full Name"
        validation="required"
        placeholder="Enter your full name"
      />
      <FormKit
        type="email"
        name="email"
        label="Email"
        validation="required|email"
        placeholder="Enter your email address"
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
          {{ loading ? 'Registering...' : 'Register' }}
        </FormKit>
      </div>
    </FormKit>
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    <div v-if="success" class="success-message">
      {{ success }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import ADD_ACCOUNT from '../graphql/account/addAccount.graphql'

const error = ref('')
const success = ref('')
const formValues = ref({})

const { mutate, loading, onError } = useMutation(ADD_ACCOUNT)

onError((err) => {
  console.error('Registration error:', err)
  error.value = err.message
})

const emit = defineEmits(['registrationComplete'])

const submitHandler = async (formData) => {
  error.value = ''
  success.value = ''

  try {
    const response = await mutate({
      name: formData.name,
      fullname: formData.fullname,
      email: formData.email,
      password: formData.password
    })

    console.log('Registration response:', response.data.add_account)

    if (response.data.add_account.status === 'SUCCESS') {
      success.value = 'Registration successful! Redirecting to login...'
      setTimeout(() => {
        emit('registrationComplete')
      }, 2000)
    } else {
      // Handle server-side validation errors
      const errorMsg = response.data.add_account.errors?.[0]?.message || 'Registration failed. Please try again.'
      error.value = errorMsg
    }
  } catch (e) {
    console.error('Registration error:', e)
    error.value = e.message || 'An unexpected error occurred during registration.'
  }
}
</script>