<script setup>
import {useUserAccess} from "@/composables/user/useUserAccess";

const model = defineModel()
const emit = defineEmits(['error', 'loading'])

const {
    writeTeams,
    loading,
    onResult,
    onError
} = useUserAccess()

// Handle successful result
onResult((result) => {
  const teams = result.data?.accountsUserAccess?.result?.write || []

  if (teams.length === 0) {
    emit('error', 'Creating controlled records requires a write affiliation')
    return
  }

  // Clear any previous error
  emit('error', null)

  // Auto-select first team if none selected
  if (!model.value) {
    model.value = teams[0].id
  }

  // Re-select if current selection no longer valid
  if (!teams.some(t => t.id === model.value)) {
    model.value = teams[0].id
  }
})

// Handle GraphQL errors
onError((error) => {
  const messages = error.graphQLErrors?.map(e => e.message) || []
  if (error.networkError) {
    messages.push(error.networkError.message || 'Network error')
  }
  emit('error', messages.join('; ') || 'Failed to load user access information')
})

</script>

<template>
  <select
    v-model="model"
    :disabled="loading"
  >
    <option
      v-for="team in writeTeams"
      :key="team.id"
      :value="team.id"
    >
      {{ team.name }}
    </option>
  </select>
</template>

<style scoped>

</style>