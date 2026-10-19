<script setup>
import { computed } from 'vue'
import PersonAttribution from './PersonAttribution.vue'

// Who contributed to a record and how: "Name (Institution) — Investigation, Data curation", each name opening who
// they are (PersonAttribution). Signed out, the API gives no contributions, so nothing is shown
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
const roleNames = (contribution) => (contribution.roles ?? []).map((role) => role?.name).filter(Boolean).join(', ')
</script>

<template>
  <div v-if="shown.length" class="contributions-list">
    <strong>{{ label }}:</strong>{{ " " }}
    <span v-for="(contribution, i) in shown" :key="contribution.person.id">
      <PersonAttribution :person="contribution.person" /><template v-if="roleNames(contribution)"> — {{ roleNames(contribution) }}</template><template v-if="i < shown.length - 1">; </template>
    </span>
  </div>
</template>

<style scoped>
.contributions-list {
  margin: 4px 0;
}
</style>
