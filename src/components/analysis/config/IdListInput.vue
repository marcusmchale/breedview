<script setup>
import { ref, watch } from 'vue'

/** Text input for a list of IDs separated by commas, spaces or new lines. */
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Paste IDs separated by commas or new lines' }
})

const emit = defineEmits(['update:modelValue'])

const text = ref(props.modelValue.join(', '))

watch(
  () => props.modelValue,
  (ids) => {
    if (parse(text.value).join(',') !== ids.join(',')) text.value = ids.join(', ')
  }
)

function parse(value) {
  return [...new Set(value.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))]
}

const update = () => emit('update:modelValue', parse(text.value))
</script>

<template>
  <div class="id-list-input">
    <textarea v-model="text" rows="2" :placeholder="placeholder" @change="update" @blur="update" />
    <span class="hint">{{ modelValue.length }} ID{{ modelValue.length === 1 ? '' : 's' }}</span>
  </div>
</template>

<style scoped>
.id-list-input {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
}
</style>
