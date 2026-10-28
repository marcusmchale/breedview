<script setup>
import { computed } from 'vue'
import { termKey, toReference } from '@/composables/analysis/useAnalysisForm'
import { termLabel } from '@/composables/analysis/useAnalysisNames'

/** Toggleable chips selecting term references from a list of terms. */
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  options: { type: Array, required: true },
  emptyText: { type: String, default: 'No eligible terms.' }
})

const emit = defineEmits(['update:modelValue'])

const isSelected = (ref) => props.modelValue.some((r) => termKey(r) === termKey(ref))

// Selected terms that are no longer options, e.g. made continuous since: shown, so that they can be removed
const ineligible = computed(() =>
  props.modelValue.filter((r) => !props.options.some((t) => termKey(t.reference) === termKey(r)))
)

const toggle = (ref) => {
  const next = isSelected(ref)
    ? props.modelValue.filter((r) => termKey(r) !== termKey(ref))
    : [...props.modelValue, toReference(ref)]
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="chip-list">
    <button
      v-for="term in options"
      :key="termKey(term.reference)"
      type="button"
      class="chip"
      :class="{ selected: isSelected(term.reference) }"
      @click="toggle(term.reference)"
    >
      {{ termLabel(term.reference) }}
    </button>
    <button
      v-for="ref in ineligible"
      :key="termKey(ref)"
      type="button"
      class="chip selected ineligible"
      title="No longer eligible here: click to remove"
      @click="toggle(ref)"
    >
      {{ termLabel(ref) }}
    </button>
    <span v-if="options.length === 0 && ineligible.length === 0" class="hint">{{ emptyText }}</span>
  </div>
</template>

<style scoped>
.chip.ineligible {
  text-decoration: line-through;
}
</style>
