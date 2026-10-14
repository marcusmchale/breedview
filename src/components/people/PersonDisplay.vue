<script setup>
import { computed } from 'vue'
import ControllerBadge from '@/components/controls/ControllerBadge.vue'
import { personForm, personLabel, orcidUrl } from '@/composables/people/personDisplay'

// Inline credit for a Person in any of its forms: full ("Name (Institution)"), restricted or erased.
const props = defineProps({
  person: {
    type: Object,
    required: true
  },
  // For a restricted Person, show who controls the record so the viewer can ask for access
  showController: {
    type: Boolean,
    default: true
  },
  showOrcid: {
    type: Boolean,
    default: true
  }
})

const form = computed(() => personForm(props.person))
const label = computed(() => personLabel(props.person))
const orcidLink = computed(() => orcidUrl(props.person?.orcid))
</script>

<template>
  <span class="person-display" :class="`person-${form}`" :title="form === 'restricted' ? 'You do not have access to this person record' : null">
    <span class="person-label">{{ label }}</span>
    <a
      v-if="showOrcid && form === 'full' && orcidLink"
      :href="orcidLink"
      target="_blank"
      rel="noopener"
      class="orcid-link"
      :title="orcidLink"
    >
      <span class="orcid-id">iD</span>
    </a>
    <ControllerBadge
      v-if="showController && form === 'restricted'"
      entity-label="PERSON"
      :entity-id="String(person.id)"
    />
  </span>
</template>

<style scoped>
.person-display {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.person-restricted .person-label,
.person-erased .person-label {
  font-style: italic;
  color: #666;
}

.orcid-link {
  text-decoration: none;
}

.orcid-id {
  display: inline-block;
  padding: 0 4px;
  border-radius: 3px;
  background-color: #a6ce39;
  color: white;
  font-size: 0.7em;
  font-weight: bold;
  line-height: 1.4;
}
</style>
