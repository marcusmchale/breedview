<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMutateOrcid } from '@/composables/people/mutateOrcid'

// ORCID redirects here after sign-in with code and state, or error when the user cancelled.
// The verified iD is stored by completing the link, then the user returns to their profile.
const props = defineProps({
  code: { type: String, default: null },
  state: { type: String, default: null },
  error: { type: String, default: null }
})

const router = useRouter()
const { completeOrcidLink } = useMutateOrcid()

const failure = ref('')

const backToProfile = (query) => router.replace({ path: '/profile', query })

onMounted(async () => {
  if (props.error) {
    const message = props.error === 'access_denied'
      ? 'ORCID sign-in was cancelled.'
      : `ORCID sign-in failed: ${props.error}`
    await backToProfile({ orcid: 'error', message })
    return
  }
  if (!props.code || !props.state) {
    failure.value = 'The ORCID redirect is missing its code or state.'
    return
  }
  try {
    const { status, errors } = await completeOrcidLink({ code: props.code, state: props.state })
    if (status === 'SUCCESS') {
      await backToProfile({ orcid: 'linked' })
    } else {
      failure.value = errors?.[0]?.message || 'ORCID linking did not complete.'
    }
  } catch (error) {
    console.error('Complete ORCID link failed:', error)
    failure.value = error.message || 'ORCID linking did not complete.'
  }
})
</script>

<template>
  <div class="form-container orcid-callback">
    <h1>ORCID</h1>
    <div v-if="failure" class="error-message">{{ failure }}</div>
    <p v-else class="loading-text">Completing your ORCID link...</p>
    <router-link v-if="failure" to="/profile" class="btn btn-secondary">Back to your profile</router-link>
  </div>
</template>

<style scoped>
.orcid-callback {
  text-align: center;
}
</style>
