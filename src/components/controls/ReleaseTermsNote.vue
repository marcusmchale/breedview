<script setup>
// What releasing beyond the team means, for a release chosen beyond private. Each deployment's Terms of Use say it,
// a consortium's after its agreement say (breedgraph docs/legal/README.md), so the note links to them rather than
// repeating them.
defineProps({
  release: {
    type: String,
    default: null
  }
})
</script>

<template>
  <p v-if="release && release !== 'PRIVATE'" class="release-terms-note">
    Released beyond the team, data comes under its study's licence, and other information under the
    <RouterLink to="/terms" target="_blank">Terms of Use</RouterLink>.
  </p>
</template>

<style scoped>
.release-terms-note {
  margin: 4px 0 0;
  font-size: 12px;
  color: #666;
}
</style>
