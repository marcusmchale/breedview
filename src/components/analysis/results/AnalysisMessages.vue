<script setup>
import { computed } from 'vue'
import { exclusionMatchCount, messageDatasetIndex, messageInfo, messageVariant } from '@/composables/analysis/useAnalysisMessages'
import { inputPathToFormPath } from '@/composables/analysis/useAnalysisForm'
import { datasetName } from '@/composables/analysis/useAnalysisNames'

/**
 * Errors and warnings of a finished analysis, grouped by code, with suggested actions.
 * Messages are only written when the analysis completes or fails, so this is only shown then.
 */
const props = defineProps({
  errors: { type: Array, default: () => [] },
  warnings: { type: Array, default: () => [] },
  datasetIds: { type: Array, default: () => [] },
  analysisType: { type: String, required: true }
})

const emit = defineEmits(['exclude-records', 'remove-dataset', 'edit'])

const groups = computed(() => {
  const out = new Map()
  const add = (m, severity) => {
    const key = `${severity}:${m.code}:${messageVariant(m)}`
    if (!out.has(key)) out.set(key, { key, code: m.code, severity, info: messageInfo(m.code, m), messages: [] })
    out.get(key).messages.push(m)
  }
  props.errors.forEach((m) => add(m, 'error'))
  props.warnings.forEach((m) => add(m, 'warning'))
  return [...out.values()]
})

const fieldLabel = (m) => {
  const path = inputPathToFormPath(m.path, props.analysisType)
  return path ? path.split('.').join(' › ') : ''
}

const datasetOf = (m) => {
  const i = messageDatasetIndex(m)
  return i == null ? null : props.datasetIds[i] ?? null
}

const groupRecordIds = (group) => [...new Set(group.messages.flatMap((m) => m.recordIds ?? []))]

const countLabel = (m) => {
  if (m.code === 'EXCLUDED_BY_CONFIG') {
    const count = exclusionMatchCount(m)
    return count == null ? '' : `${count} record${count === 1 ? '' : 's'}`
  }
  const n = m.recordIds?.length ?? 0
  return n ? `${n} record${n === 1 ? '' : 's'}` : ''
}
</script>

<template>
  <div v-if="groups.length" class="analysis-messages">
    <div v-for="group in groups" :key="group.key" class="message" :class="group.severity">
      <div class="message-header">
        <span class="icon" aria-hidden="true">{{ group.severity === 'error' ? '✕' : '!' }}</span>
        <strong>{{ group.code }}</strong>
        <span class="kind">{{ group.severity }}</span>
        <span class="actions">
          <button
            v-if="group.info.excludeRecords && groupRecordIds(group).length"
            type="button"
            class="btn-link"
            @click="emit('exclude-records', groupRecordIds(group))"
          >
            Exclude {{ groupRecordIds(group).length }} record{{ groupRecordIds(group).length === 1 ? '' : 's' }} and edit
          </button>
        </span>
      </div>
      <p v-if="group.info.hint" class="hint">{{ group.info.hint }}</p>
      <ul>
        <li v-for="(m, i) in group.messages" :key="i">
          {{ m.message }}
          <span v-if="countLabel(m)" class="muted">· {{ countLabel(m) }}</span>
          <button v-if="fieldLabel(m)" type="button" class="btn-link" @click="emit('edit')">
            {{ fieldLabel(m) }}
          </button>
          <button
            v-if="group.info.removeDataset && datasetOf(m)"
            type="button"
            class="btn-link"
            @click="emit('remove-dataset', datasetOf(m))"
          >
            Remove {{ datasetName(datasetOf(m)) }} and edit
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.kind {
  font-size: 0.7rem;
  text-transform: uppercase;
  opacity: 0.8;
}

.actions {
  margin-left: auto;
}

ul {
  margin: 4px 0 0;
  padding-left: 18px;
}

li .btn-link {
  margin-left: 6px;
}
</style>
