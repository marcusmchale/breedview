
<script setup>
const model = defineModel()

const props = defineProps( {
  fixedRelease: String
})

const READ_RELEASE_OPTIONS = [
  { value: 'PRIVATE', label: 'Private', description: 'Accessible with a read affiliation' },
  { value: 'REGISTERED', label: 'Registered', description: 'Accessible to registered users' },
  { value: 'PUBLIC', label: 'Public', description: 'Accessible to everyone' }
]

// Auto-select first option if none selected

if (!model.value) {
  if (props.fixedRelease) {
    model.value = props.fixedRelease
  } else {
    model.value = READ_RELEASE_OPTIONS[0].value
  }
}
</script>

<template>
  <select v-model="model">
    <option
      v-for="option in READ_RELEASE_OPTIONS"
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