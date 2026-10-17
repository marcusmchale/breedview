<script setup>
import { computed } from 'vue'
import { contributionLabel } from '@/composables/people/personDisplay'

// Who contributed to a record and how: "Name (Institution) — Investigation, Data curation"
const props = defineProps({
  contributions: {
    type: Array,
    default: () => []
  },
  label: {
    type: String,
    default: 'Contributors'
  }
})

const shown = computed(() => (props.contributions ?? []).filter((c) => c?.person))
</script>

<template>
  <p v-if="shown.length" class="contributions-list">
    <strong>{{ label }}:</strong>{{ " " }}
    <span v-for="(contribution, i) in shown" :key="contribution.person.id">
      {{ contributionLabel(contribution) }}<template v-if="i < shown.length - 1">; </template>
    </span>
  </p>
</template>

<style scoped>
.contributions-list {
  margin: 4px 0;
}
</style>
