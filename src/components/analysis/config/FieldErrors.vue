<script setup>
import { computed, onBeforeUnmount } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { messageInfo, messageVariant } from '@/composables/analysis/useAnalysisMessages'
import { formPathLabel } from '@/composables/analysis/useAnalysisNames'

const props = defineProps({
  path: { type: [String, Array], required: true },
  prefix: { type: Boolean, default: false },
  // shows the messages below the path that no other field shows, each with the field it is about
  fallback: { type: Boolean, default: false }
})

const { form, messagesAt, registerField, unshownAt } = useAnalysisEditor()

// so that fallbacks know which messages are shown
const unregister = registerField(() => ({ path: props.path, prefix: props.prefix, fallback: props.fallback }))
onBeforeUnmount(unregister)

const messages = computed(() =>
  props.fallback ? unshownAt(props.path) : messagesAt(props.path, { prefix: props.prefix })
)

const pathOf = computed(() => (Array.isArray(props.path) ? props.path.join('.') : props.path))

// below the fallback's own path, the field it is about, e.g. "Binning › boundaries › 2"
const fieldLabel = (m) => {
  if (!props.fallback || m.formPath === pathOf.value) return ''
  const own = pathOf.value ? formPathLabel(pathOf.value, form) : ''
  const label = formPathLabel(m.formPath, form)
  const below = own && label.startsWith(`${own} › `) ? label.slice(own.length + 3) : label
  return below.charAt(0).toUpperCase() + below.slice(1)
}

// Replicate messages point at the term's replicate aggregation, so say there what to do
const fieldHint = (m) => (messageVariant(m) || m.code === 'REPLICATES_POOLED' ? messageInfo(m.code, m).hint : null)
</script>

<template>
  <div v-if="messages.length" class="field-errors">
    <p v-for="(m, i) in messages" :key="i" class="message" :class="m.severity ?? 'error'">
      <strong v-if="fieldLabel(m)" class="field-label-prefix">{{ fieldLabel(m) }}:</strong>
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
.field-label-prefix {
  margin-right: 4px;
}
.field-hint {
  display: block;
  margin-top: 2px;
  opacity: 0.85;
}
</style>
