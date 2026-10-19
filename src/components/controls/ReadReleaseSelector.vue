
<script setup>
import { computed, watch } from 'vue'
import { RELEASES } from '@/composables/controls/releases'

const model = defineModel()

const props = defineProps( {
  fixedRelease: String,
  // the widest release offered, e.g. REGISTERED for Persons (see releasesFor)
  maxRelease: String
})

const READ_RELEASE_OPTIONS = [
  { value: 'PRIVATE', label: 'Private', description: 'Accessible with a read affiliation' },
  { value: 'REGISTERED', label: 'Registered', description: 'Accessible to registered users' },
  { value: 'PUBLIC', label: 'Public', description: 'Accessible to everyone' }
]

const options = computed(() => {
  const widest = props.maxRelease ? RELEASES.indexOf(props.maxRelease) : RELEASES.length - 1
  return READ_RELEASE_OPTIONS.filter((option) => RELEASES.indexOf(option.value) <= widest)
})

// Auto-select first option if none selected

if (!model.value) {
  if (props.fixedRelease) {
    model.value = props.fixedRelease
  } else {
    model.value = READ_RELEASE_OPTIONS[0].value
  }
}

// a release wider than offered falls back to the widest offered
watch(options, (offered) => {
  if (model.value && !offered.some((option) => option.value === model.value)) {
    model.value = offered[offered.length - 1].value
  }
}, { immediate: true })
</script>

<template>
  <select v-model="model">
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="fixedRelease"
    >
      {{ option.label }}
    </option>
  </select>
</template>

<style scoped>
</style>