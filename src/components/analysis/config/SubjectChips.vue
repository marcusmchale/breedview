<script setup>
/**
 * The ontology's subjects as chips to choose from, for the observation unit, units of a subject as levels and placing
 * by subject. A chosen subject the ontology doesn't list (from a loaded analysis) shows by its id, to be removed.
 * disabledReason(subject) says why one can't be chosen, or null when it can.
 */
import { computed } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabledReason: { type: Function, default: () => null }
})
const emit = defineEmits(['update:modelValue'])

const { data } = useAnalysisEditor()

const chosen = computed(() => props.modelValue ?? [])
const unknown = computed(() => chosen.value.filter((id) => !data.subjectsById[id]))
const reason = (s) => (chosen.value.includes(s.id) ? null : props.disabledReason(s))

const toggle = (id) =>
  emit('update:modelValue', chosen.value.includes(id) ? chosen.value.filter((s) => s !== id) : [...chosen.value, id])
</script>

<template>
  <p v-if="data.subjects.length === 0 && unknown.length === 0" class="hint">
    {{ data.subjectsLoading ? 'Loading subjects…' : 'No subjects are defined in the ontology.' }}
  </p>
  <div v-else class="chip-list subject-chips">
    <button
      v-for="s in data.subjects"
      :key="s.id"
      type="button"
      class="chip"
      :class="{ selected: chosen.includes(s.id) }"
      :disabled="!!reason(s)"
      :title="reason(s) ?? ''"
      @click="toggle(s.id)"
    >
      {{ s.name }}
    </button>
    <span v-for="id in unknown" :key="id" class="chip selected">
      Subject {{ id }}
      <button type="button" class="chip-remove" title="Remove" @click="toggle(id)">×</button>
    </span>
  </div>
</template>
