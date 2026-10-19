<script setup>
import { computed } from 'vue'
import { personForm, personLabel, orcidUrl } from '@/composables/people/personDisplay'

// A credited Person's name, opening a small card with who they are: name, institution and ORCID iD. Restricted and
// erased Persons are plain text. Only signed-in users see Persons (breedgraph docs/person.md §3).
const props = defineProps({
  person: {
    type: Object,
    required: true
  }
})

const form = computed(() => personForm(props.person))
const label = computed(() => personLabel(props.person))
const orcidLink = computed(() => orcidUrl(props.person?.orcid))
const named = computed(() => form.value === 'full' || form.value === 'attribution')
const hasCard = computed(() => named.value && !!(props.person.institution || orcidLink.value))
</script>

<template>
  <details v-if="hasCard" class="person-attribution" :class="`person-${form}`">
    <summary class="person-label">{{ label }}</summary>
    <div class="attribution-card">
      <div class="attribution-name">{{ person.name }}</div>
      <div v-if="person.institution" class="attribution-line">{{ person.institution }}</div>
      <div v-if="orcidLink" class="attribution-line">
        <a :href="orcidLink" target="_blank" rel="noopener">{{ orcidLink }}</a>
      </div>
    </div>
  </details>
  <span v-else class="person-label" :class="`person-${form}`">{{ label }}</span>
</template>

<style scoped>
.person-attribution {
  display: inline-block;
  position: relative;
}

.person-attribution summary {
  display: inline;
  cursor: pointer;
  list-style: none;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.person-attribution summary::-webkit-details-marker {
  display: none;
}

.person-restricted .person-label,
.person-erased.person-label {
  font-style: italic;
  color: #666;
}

.attribution-card {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 240px;
  max-width: min(360px, calc(100vw - 32px));
  padding: 8px 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  font-size: 0.85rem;
  font-style: normal;
  font-weight: normal;
  color: #333;
  white-space: normal;
}

.attribution-name {
  font-weight: 600;
}

.attribution-line a {
  overflow-wrap: anywhere;
}
</style>
