<template>
  <div class="form-container">
    <div v-if="loading">Verifying your email...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="success" class="success">
      {{ success }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import VERIFY_EMAIL from '../../graphql/authentication/verifyEmail.graphql'

const props = defineProps({
  token: {
    type: String,
    required: true
  }
})

const router = useRouter()
const error = ref('')
const success = ref('')

const { mutate: verifyEmail, loading } = useMutation(VERIFY_EMAIL)

onMounted(async () => {
  try {
    const response = await verifyEmail({
      token: props.token
    })
    
    if (response.data.accountsVerifyEmail.status === 'SUCCESS') {
      success.value = 'Email verified successfully! Redirecting to home...'
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } else {
      error.value = response.data.accountsVerifyEmail?.errors?.[0]?.message || 'Verification failed'
      setTimeout(() => {
        router.push('/')
      }, 2000)
    }
  } catch (e) {
    error.value = e.message
    console.error('Email verification error:', e)
  }
})
</script>