<script setup>
import { computed } from 'vue'
import { useAnalysisSubmissionQuery } from '@/composables/analysis/analysisSubmissionQuery'
import { analysisTypeLabel } from '@/composables/analysis/useAnalysisForm'
import AnalysisStatusBadge from '@/components/analysis/AnalysisStatusBadge.vue'

const props = defineProps({
  analysisId: { type: String, required: true },
  selected: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'delete'])

// The open submission view polls the selected analysis; this item follows it through the cache
const { submission, status, notFound } = useAnalysisSubmissionQuery(() => props.analysisId, {
  summary: true,
  poll: () => !props.selected
})

const title = computed(() => {
  const s = submission.value
  if (!s) return `Analysis ${props.analysisId}`
  return s.name || analysisTypeLabel(s.analysisType)
})

const messageCounts = computed(() => {
  const s = submission.value
  if (!s) return ''
  const parts = []
  if (s.errors.length) parts.push(`${s.errors.length} error${s.errors.length === 1 ? '' : 's'}`)
  if (s.warnings.length) parts.push(`${s.warnings.length} warning${s.warnings.length === 1 ? '' : 's'}`)
  return parts.join(' · ')
})
</script>

<template>
  <li v-if="!notFound">
    <button type="button" class="item" :class="{ selected }" @click="emit('select', analysisId)">
      <span class="item-title">
        <span class="name">{{ title }}</span>
        <AnalysisStatusBadge :status="status" />
      </span>
      <span v-if="submission" class="muted details">
        <template v-if="submission.name">{{ analysisTypeLabel(submission.analysisType) }} · </template>
        {{ submission.datasetIds.length }} dataset{{ submission.datasetIds.length === 1 ? '' : 's' }}
        <template v-if="messageCounts"> · {{ messageCounts }}</template>
      </span>
    </button>
    <!-- A sibling of the item button, as buttons cannot be nested -->
    <button
      type="button"
      class="delete"
      :title="`Delete ${title}`"
      :aria-label="`Delete ${title}`"
      @click="emit('delete', { id: analysisId, title })"
    >
      ×
    </button>
  </li>
</template>

<style scoped>
li {
  position: relative;
}

.item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-left: 3px solid transparent;
  padding: 8px 12px;
  cursor: pointer;
  font-family: inherit;
  color: inherit;
}

.item:hover {
  background: #f9fafb;
}

.item.selected {
  background: var(--an-accent-soft);
  border-left-color: var(--an-accent);
}

.item-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.name {
  font-weight: 600;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.details {
  font-size: 0.75rem;
  padding-right: 20px;
}

.delete {
  position: absolute;
  right: 8px;
  bottom: 6px;
  width: 20px;
  height: 20px;
  padding: 0;
  line-height: 1;
  font-size: 1rem;
  background: none;
  border: none;
  border-radius: 4px;
  color: #6b7280;
  cursor: pointer;
  opacity: 0;
}

li:hover .delete,
.item.selected + .delete,
.delete:focus-visible {
  opacity: 1;
}

@media (hover: none) {
  .delete {
    opacity: 1;
  }
}

.delete:hover {
  background: #fee2e2;
  color: #b91c1c;
}
</style>
