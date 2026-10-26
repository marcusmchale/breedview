<script setup>
import { computed } from 'vue'

import { useDatasetSummariesQuery } from '@/composables/datasets/datasetSummariesQuery'
import STUDY_DATASETS_SUMMARIES_QUERY from '@/graphql/datasets/studyDatasetsSummaries.graphql'
import RetiredTag from '@/components/ontology/RetiredTag.vue'

const props = defineProps({
  studyId: {
    type: String,
    required: true
  }
})

const {
  datasetSummaries,
  summariesLoading,
  summariesError
} = useDatasetSummariesQuery(() => props.studyId, { query: STUDY_DATASETS_SUMMARIES_QUERY })

// The concepts the study's datasets record, one chip per concept with the records of all its datasets
const conceptsOfType = (typename) => {
  const byId = new Map()
  for (const summary of datasetSummaries.value) {
    const concept = summary.concept
    if (concept?.__typename !== typename) continue
    const entry = byId.get(concept.id) || { concept, datasetCount: 0, recordCount: 0 }
    entry.datasetCount += 1
    entry.recordCount += summary.record_count
    byId.set(concept.id, entry)
  }
  return [...byId.values()].sort((a, b) => (a.concept.name || '').localeCompare(b.concept.name || ''))
}

const variables = computed(() => conceptsOfType('Variable'))
const factors = computed(() => conceptsOfType('Factor'))

const recordCount = computed(() => datasetSummaries.value.reduce((sum, s) => sum + s.record_count, 0))

// Record times keep the precision they were entered with, so compare and show them as given
const dateRange = computed(() => {
  const starts = datasetSummaries.value.map(s => s.start).filter(Boolean).map(String).sort()
  const ends = datasetSummaries.value.map(s => s.end).filter(Boolean).map(String).sort()
  if (!starts.length && !ends.length) return null
  const show = (value) => value ? value.replace('T', ' ') : '—'
  return `${show(starts[0])} – ${show(ends[ends.length - 1])}`
})

const namesOf = (key) => {
  const byId = new Map()
  for (const summary of datasetSummaries.value) {
    for (const item of summary[key] || []) byId.set(item.id, item.name)
  }
  return [...byId.values()].sort((a, b) => (a || '').localeCompare(b || ''))
}

const subjects = computed(() => namesOf('subjects'))

const conceptGroups = computed(() => [
  { label: 'Variables', entries: variables.value },
  { label: 'Factors', entries: factors.value }
].filter(group => group.entries.length))

const chipTitle = (entry) =>
  `${entry.recordCount} records in ${entry.datasetCount} dataset${entry.datasetCount === 1 ? '' : 's'}`
</script>

<template>
  <div class="study-summary">
    <div v-if="summariesLoading && !datasetSummaries.length" class="muted">Loading datasets...</div>
    <div v-else-if="summariesError" class="error">Error loading datasets: {{ summariesError.message }}</div>
    <div v-else-if="!datasetSummaries.length" class="muted">No datasets recorded for this study.</div>
    <template v-else>
      <p class="totals">
        <span><strong>{{ datasetSummaries.length }}</strong> dataset{{ datasetSummaries.length === 1 ? '' : 's' }}</span>
        <span><strong>{{ recordCount }}</strong> record{{ recordCount === 1 ? '' : 's' }}</span>
        <span v-if="dateRange">{{ dateRange }}</span>
      </p>

      <div v-for="group in conceptGroups" :key="group.label" class="concept-group">
        <span class="group-label">{{ group.label }}:</span>
        <span
          v-for="entry in group.entries"
          :key="entry.concept.id"
          class="chip"
          :title="chipTitle(entry)"
        >
          {{ entry.concept.name || `Concept ${entry.concept.id}` }}
          <RetiredTag :entry="entry.concept" />
          <span class="chip-count">{{ entry.recordCount }}</span>
        </span>
      </div>

      <p v-if="subjects.length" class="names"><strong>Subjects:</strong> {{ subjects.join(', ') }}</p>
    </template>
  </div>
</template>

<style scoped>
.study-summary {
  margin-top: 8px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.9em;
  color: #666;
}

.study-summary p {
  margin: 4px 0;
}

.totals {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.concept-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 6px 0;
}

.group-label {
  font-weight: bold;
  margin-right: 4px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  background: var(--brand-accent-light);
  border-radius: 12px;
  color: #333;
}

.chip-count {
  font-size: 0.85em;
  color: #666;
}

.muted {
  color: #666;
}

.error {
  color: #dc3545;
}
</style>
