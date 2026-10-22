<!-- src/components/user/TermsGate.vue: the Terms of Use, shown in place of any page until they are accepted, as the API
     refuses everything else until then (breedgraph docs/licences.md §4). Accepting loads the page again, signed in or
     not. -->
<script setup>
import { ref, onMounted } from 'vue'
import { useTermsOfUse } from '@/composables/system/useTermsOfUse'

const { terms, loading, error, load, accept } = useTermsOfUse()

const agreed = ref(false)
const accepting = ref(false)
const acceptError = ref('')

onMounted(() => load())

const acceptTerms = async () => {
  accepting.value = true
  acceptError.value = ''
  try {
    const { status, errors } = await accept()
    if (status === 'SUCCESS') {
      window.location.reload()
      return
    }
    agreed.value = false
    acceptError.value = errors?.[0]?.message || 'The Terms of Use could not be accepted'
  } catch (e) {
    acceptError.value = e.message || 'The Terms of Use could not be accepted'
  } finally {
    accepting.value = false
  }
}
</script>

<template>
  <div class="page-container terms-gate">
    <p class="intro">
      Please read and accept the Terms of Use to use BreedGraph. How we use personal data is in the
      <router-link to="/privacy">privacy notice</router-link>.
    </p>
    <div v-if="loading && !terms" class="loading-state">Loading the Terms of Use...</div>
    <div v-else-if="error && !terms" class="error-message">
      Failed to load the Terms of Use. <button type="button" class="btn btn-secondary" @click="load(true)">Try again</button>
    </div>
    <template v-else-if="terms">
      <!-- renderMarkdown escapes everything it is given -->
      <div class="terms-content" v-html="terms.html"></div>
      <div class="acceptance">
        <label class="agree">
          <input v-model="agreed" type="checkbox" name="termsAgreed" :disabled="accepting" />
          I have read and agree to the Terms of Use
        </label>
        <div v-if="acceptError" class="error-message">{{ acceptError }}</div>
        <button type="button" class="btn btn-primary accept" :disabled="!agreed || accepting" @click="acceptTerms">
          {{ accepting ? 'Accepting...' : 'Accept' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.terms-gate {
  max-width: 860px;
  margin: 0 auto;
}

.intro {
  background: #e8f4fd;
  border: 1px solid #b6dcf7;
  border-radius: 4px;
  padding: 12px 16px;
}

.terms-content {
  line-height: 1.6;
  color: #333;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px 20px;
  max-height: 60vh;
  overflow-y: auto;
  background: white;
}

.terms-content :deep(h1) {
  font-size: 1.5em;
}

.terms-content :deep(h2) {
  font-size: 1.2em;
  margin-top: 20px;
}

.acceptance {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 16px 0 32px;
}

.agree {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.accept {
  align-self: flex-start;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid #f5c6cb;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.btn-primary {
  background-color: #2196f3;
  color: white;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
