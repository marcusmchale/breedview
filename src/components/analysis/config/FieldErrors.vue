<script setup>
import { computed } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { messageInfo, messageVariant } from '@/composables/analysis/useAnalysisMessages'

const props = defineProps({
  path: { type: [String, Array], required: true },
  prefix: { type: Boolean, default: false }
})

const { messagesAt } = useAnalysisEditor()

const messages = computed(() => messagesAt(props.path, { prefix: props.prefix }))

// Replicate messages point at the term's replicate aggregation, so say there what to do
const fieldHint = (m) => (messageVariant(m) || m.code === 'REPLICATES_POOLED' ? messageInfo(m.code, m).hint : null)
</script>

<template>
  <div v-if="messages.length" class="field-errors">
    <p v-for="(m, i) in messages" :key="i" class="message" :class="m.severity ?? 'error'">
      {{ m.message }}
      <span v-if="fieldHint(m)" class="field-hint">{{ fieldHint(m) }}</span>
    </p>
  </div>
</template>

<style scoped>
.field-errors .message {
  margin: 4px 0;
  padding: 4px 8px;
  font-size: 0.8rem;
}
.field-hint {
  display: block;
  margin-top: 2px;
  opacity: 0.85;
}
</style>
