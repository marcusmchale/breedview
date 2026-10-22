<script setup>
import { onMounted } from 'vue'
import { useTermsOfUse } from '@/composables/system/useTermsOfUse'

// The Terms of Use, open before they are accepted, so they can be read and linked to
const { terms, accepted, loading, error, load } = useTermsOfUse()

onMounted(() => load())
</script>

<template>
  <div class="page-container terms-page">
    <div v-if="loading && !terms" class="loading-state">Loading the Terms of Use...</div>
    <div v-else-if="error && !terms" class="error-state">Failed to load the Terms of Use. Please try again.</div>
    <template v-else-if="terms">
      <p v-if="accepted" class="accepted-note">You have accepted these Terms of Use.</p>
      <!-- renderMarkdown escapes everything it is given -->
      <div class="terms-content" v-html="terms.html"></div>
    </template>
  </div>
</template>

<style scoped>
.terms-page {
  max-width: 860px;
  margin: 0 auto;
}

.terms-content {
  line-height: 1.6;
  color: #333;
}

.terms-content :deep(h1) {
  font-size: 1.5em;
  margin-top: 0;
  color: #222;
}

.terms-content :deep(h2) {
  font-size: 1.25em;
  margin-top: 24px;
  color: #333;
}

.accepted-note {
  color: #155724;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  padding: 8px 12px;
}
</style>
