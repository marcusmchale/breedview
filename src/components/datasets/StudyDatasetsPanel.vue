<!-- src/components/datasets/StudyDatasetsPanel.vue: a study's datasets, within its card on the programs page -->
<template>
  <div class="study-datasets-panel">
    <div class="datasets-section">
      <h4>Dataset Summaries</h4>

      <div v-if="summariesLoading" class="loading">Loading datasets...</div>
      <div v-else-if="summariesError" class="error">Error loading datasets</div>
      <div v-else-if="datasetSummaries.length === 0" class="empty-state">
        No datasets found for this study.
      </div>
      <div v-else class="datasets-list">
        <div
          v-for="dataset in datasetSummaries"
          :key="dataset.id"
          class="dataset-item"
        >
          <div class="dataset-header" @click="toggleExpanded(dataset.id)">
            <button class="expand-btn" :class="{ expanded: isExpanded(dataset.id) }">
              ▶
            </button>
            <span class="concept-name">{{ dataset.concept?.name || `Concept ${dataset.concept?.id}` }}<RetiredTag :entry="dataset.concept" /></span>
            <span class="record-count">{{ plural(dataset.record_count, 'record') }}</span>
          </div>

          <div v-if="isExpanded(dataset.id)" class="dataset-details">
            <div class="detail-row">
              <span class="label">Units:</span>
              <span class="value">{{ detailsById[dataset.id]?.unit_count ?? '…' }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Date Range:</span>
              <span class="value">
                {{ formatDate(dataset.start) }} - {{ formatDate(dataset.end) }}
              </span>
            </div>
            <div v-if="dataset.subjects?.length" class="detail-row">
              <span class="label">Subjects:</span>
              <span class="value">
                {{ dataset.subjects.map(s => s.name).join(', ') }}
              </span>
            </div>
            <div v-if="detailsLoading && !detailsById[dataset.id]" class="detail-row muted">Loading locations…</div>
            <div v-if="detailsById[dataset.id]?.locations?.length" class="detail-row">
              <span class="label">Locations:</span>
              <span class="value">
                {{ detailsById[dataset.id].locations.map(l => l.name).join(', ') }}
              </span>
            </div>
            <div v-if="detailsById[dataset.id]?.unitRoots?.length" class="detail-row">
              <span class="label">Unit graphs:</span>
              <span class="value">
                {{ detailsById[dataset.id].unitRoots.map(b => b.name).join(', ') }}
              </span>
            </div>
            <div v-if="attributionsById[dataset.id]?.length" class="detail-row dataset-credit">
              <span class="label">Credit:</span>
              <span class="value">{{ attributionsById[dataset.id].join('; ') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { plural } from '@/composables/system/counts'
import { useDatasetSummariesQuery } from '@/composables/datasets/datasetSummariesQuery'
import { useAttributionsQuery } from '@/composables/controls/useAttributionsQuery'
import STUDY_DATASETS_SUMMARIES_QUERY from '@/graphql/datasets/studyDatasetsSummaries.graphql'
import RetiredTag from '@/components/ontology/RetiredTag.vue'

const props = defineProps({
  studyId: {
    type: String,
    default: null
  }
})

// The light summaries, shared with the study summary above; locations and unit graphs are slow to resolve for large
// studies, so they are read once a dataset is first expanded
const {
  datasetSummaries,
  summariesLoading,
  summariesError
} = useDatasetSummariesQuery(() => props.studyId, { query: STUDY_DATASETS_SUMMARIES_QUERY })

const detailsWanted = ref(false)
const {
  datasetSummaries: detailedSummaries,
  summariesLoading: detailsLoading
} = useDatasetSummariesQuery(() => (detailsWanted.value ? props.studyId : null))
const detailsById = computed(() => Object.fromEntries(detailedSummaries.value.map((s) => [s.id, s])))
// whom to credit for each dataset, for anyone, asked for once for the study's datasets when one is first expanded
const { attributionsById } = useAttributionsQuery({
  entityLabel: 'DATASET',
  entityIds: () => datasetSummaries.value.map((s) => s.id),
  enabled: detailsWanted
})


const expandedDatasets = ref(new Set())

const toggleExpanded = (datasetId) => {
  detailsWanted.value = true
  if (expandedDatasets.value.has(datasetId)) {
    expandedDatasets.value.delete(datasetId)
  } else {
    expandedDatasets.value.add(datasetId)
  }
}

const isExpanded = (datasetId) => expandedDatasets.value.has(datasetId)

// Record times keep the precision they were entered with (a day, or a minute), so show them as given
// rather than parsing a date alone into midnight in the browser's time zone
const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return String(dateStr).replace('T', ' ')
}
</script>

<style scoped>
.study-datasets-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.muted {
  color: #888;
}

.datasets-section h4 {
  margin: 16px 0;
  font-size: 16px;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 8px;
}

.loading,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 14px;
}

.error {
  text-align: center;
  padding: 20px;
  color: #dc3545;
}

.datasets-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dataset-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fafafa;
  overflow: hidden;
}

.dataset-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.dataset-header:hover {
  background-color: #f0f0f0;
}

.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: #666;
  font-size: 12px;
  transition: transform 0.2s;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-btn.expanded {
  transform: rotate(90deg);
}

.concept-name {
  flex: 1;
  font-weight: 500;
  color: #333;
}

.record-count {
  font-size: 13px;
  color: #666;
  background: var(--brand-accent-light);
  padding: 2px 8px;
  border-radius: 12px;
}

.dataset-details {
  padding: 12px 12px 12px 44px;
  background: white;
  border-top: 1px solid #e0e0e0;
}

.detail-row {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-row .label {
  font-weight: 500;
  color: #666;
  min-width: 80px;
}

.detail-row .value {
  color: #333;
}
</style>