<script setup>
import { onMounted } from 'vue'
import { usePrivacyNotice } from '@/composables/system/usePrivacyNotice'

// The published privacy notice, open to everyone, so people whose data BreedGraph holds can read it without an account
const { html, loading, error, load } = usePrivacyNotice()

onMounted(load)
</script>

<template>
  <div class="page-container privacy-page">
    <div v-if="loading && !html" class="loading-state">Loading privacy notice...</div>
    <div v-else-if="error" class="error-state">Failed to load the privacy notice. Please try again.</div>
    <div v-else class="privacy-content" v-html="html"></div>
  </div>
</template>

<style scoped>
.privacy-page {
  max-width: 860px;
  margin: 0 auto;
}

.privacy-content {
  line-height: 1.6;
  color: #333;
}

.privacy-content :deep(h1) {
  font-size: 1.5em;
  margin-top: 0;
  color: #222;
}

.privacy-content :deep(h2) {
  font-size: 1.25em;
  margin-top: 24px;
  color: #333;
}

.privacy-content :deep(h3) {
  font-size: 1.1em;
  margin-top: 16px;
  color: #444;
}

.privacy-content :deep(ul) {
  padding-left: 20px;
}

.privacy-content :deep(li) {
  margin: 8px 0;
}

.privacy-content :deep(hr) {
  border: none;
  border-top: 1px solid #eee;
  margin: 24px 0;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
</style>
