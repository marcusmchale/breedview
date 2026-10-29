<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMutateOrcid } from '@/composables/people/mutateOrcid'

// ORCID redirects here after sign-in with an id_token it signed and the state, or error when the user cancelled.
// The API checks the id_token and stores the iD it names, then the user returns to their profile, which also takes
// this page, with the id_token in its address, out of the history. ORCID's access token is not used.
const props = defineProps({
  idToken: { type: String, default: null },
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
  if (!props.idToken || !props.state) {
    failure.value = 'The ORCID redirect is missing its id_token or state.'
    return
  }
  try {
    const { status, errors } = await completeOrcidLink({ idToken: props.idToken, state: props.state })
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
