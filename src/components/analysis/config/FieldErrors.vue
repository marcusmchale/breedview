<script setup>
import { computed } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'

const props = defineProps({
  path: { type: [String, Array], required: true },
  prefix: { type: Boolean, default: false }
})

const { messagesAt } = useAnalysisEditor()

const messages = computed(() => messagesAt(props.path, { prefix: props.prefix }))
</script>

<template>
  <div v-if="messages.length" class="field-errors">
    <p v-for="(m, i) in messages" :key="i" class="message" :class="m.severity ?? 'error'">
      {{ m.message }}
    </p>
  </div>
</template>

<style scoped>
.field-errors .message {
  margin: 4px 0;
  padding: 4px 8px;
  font-size: 0.8rem;
}
</style>
