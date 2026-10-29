<script setup>
import { computed, ref, watch } from 'vue'
import { useAnalysisSubmissionQuery } from '@/composables/analysis/analysisSubmissionQuery'
import { useAnalysisSummary } from '@/composables/analysis/useAnalysisSummary'
import { groupingDimensions } from '@/composables/analysis/summaryTables'
import { analysisTypeLabel, TERM_TYPE_LABELS } from '@/composables/analysis/useAnalysisForm'
import {
  collectIds,
  datasetConcepts,
  datasetName,
  termLabel,
  useAnalysisNames
} from '@/composables/analysis/useAnalysisNames'
import AnalysisStatusBadge from '@/components/analysis/AnalysisStatusBadge.vue'
import AnalysisMessages from '@/components/analysis/results/AnalysisMessages.vue'
import AnovaResultView from '@/components/analysis/results/AnovaResultView.vue'
import DescriptiveResultView from '@/components/analysis/results/DescriptiveResultView.vue'
import CorrelationResultView from '@/components/analysis/results/CorrelationResultView.vue'
import MdsResultView from '@/components/analysis/results/MdsResultView.vue'
import OutlierResultView from '@/components/analysis/results/OutlierResultView.vue'

const props = defineProps({
  analysisId: { type: String, required: true }
})

const emit = defineEmits(['edit', 'exclude', 'remove-dataset'])

const { submission, status, isTerminal, notFound, queryErrors, loading, error } = useAnalysisSubmissionQuery(
  () => props.analysisId
)

/* ---------- names ---------- */

const { ensureDatasets, ensureStudies, ensureGermplasm, ensureUnits, ensureLocations, ensureLayouts } = useAnalysisNames()

watch(
  () => submission.value?.datasetIds,
  (ids) => ids && ensureDatasets(ids),
  { immediate: true }
)

// Studies of the datasets, for study and record grouping names
watch(
  () => (submission.value?.datasetIds ?? []).map((id) => datasetConcepts[id]?.studyId).filter(Boolean),
  (ids) => ensureStudies(ids),
  { immediate: true }
)

const termLevels = (em) => [
  ...em.means.flatMap((m) => [...m.levels, ...m.by]),
  ...em.contrasts.flatMap((c) => [...c.levelsA, ...c.levelsB, ...c.by])
]

const referenced = computed(() => {
  const r = submission.value?.result
  if (!r) return null
  const groups = []
  const levels = []
  switch (r.__typename) {
    case 'DescriptiveStatisticsResult':
      r.terms.forEach((t) => {
        groups.push(t.group)
        levels.push(...t.levels)
      })
      break
    case 'MDSResult':
      groups.push(...r.observations.map((o) => o.group))
      break
    case 'OutlierDetectionResult':
      groups.push(...r.outliers.map((o) => o.observation))
      break
  }
  for (const em of r.estimatedMeans ?? []) levels.push(...termLevels(em))
  return collectIds({ groups, levels })
})

watch(referenced, (ids) => {
  if (!ids) return
  ensureGermplasm(ids.germplasm)
  ensureUnits(ids.unit)
  ensureStudies(ids.study)
  ensureLocations(ids.location)
  ensureLayouts(ids.layout)
})

/* ---------- display ---------- */

const STATUS_TEXT = {
  PENDING: 'Stored, waiting to be prepared.',
  PROCESSING: 'Loading data and building observations, or running the analysis.',
  QUEUED: 'Observations are prepared; waiting for a free analysis worker.',
  FAILED: 'The analysis failed. See the errors below.'
}

const config = computed(() => submission.value?.config ?? null)
const result = computed(() => submission.value?.result ?? null)
const errors = computed(() => submission.value?.errors ?? [])
const warnings = computed(() => submission.value?.warnings ?? [])
const notConverged = computed(() => warnings.value.some((w) => w.code === 'MODEL_NOT_CONVERGED'))

const dimensions = computed(() => groupingDimensions(config.value?.grouping))

// the summary download: a zip of a printable report, the settings and each result table as CSV, with the charts as
// drawn in the results section
const resultsSection = ref(null)
const { downloadSummary, preparing, summaryError } = useAnalysisSummary()

const RESULT_VIEWS = {
  AnovaResult: AnovaResultView,
  DescriptiveStatisticsResult: DescriptiveResultView,
  CorrelationResult: CorrelationResultView,
  MDSResult: MdsResultView,
  OutlierDetectionResult: OutlierResultView
}

const resultView = computed(() => (result.value ? RESULT_VIEWS[result.value.__typename] : null))
</script>

<template>
  <div class="submission-view panel">
    <div v-if="notFound || error" class="section">
      <p class="message error">
        {{ queryErrors[0]?.message ?? error?.message ?? 'The analysis was not found. It may have expired.' }}
      </p>
    </div>

    <p v-else-if="!submission && loading" class="section hint">Loading analysis…</p>

    <template v-else-if="submission">
      <div class="section header">
        <div class="title-row">
          <h2>{{ submission.name || `${analysisTypeLabel(submission.analysisType)} analysis` }}</h2>
          <AnalysisStatusBadge :status="status" />
          <div class="header-actions">
            <button
              type="button"
              class="btn btn-sm btn-outline download-summary"
              :disabled="!result || preparing"
              title="A zip of a printable report, the settings, and each result table as CSV"
              @click="downloadSummary(submission, resultsSection)"
            >
              {{ preparing ? 'Preparing…' : 'Download summary' }}
            </button>
            <button type="button" class="btn btn-sm btn-outline" :disabled="!config" @click="emit('edit', submission)">
              Edit &amp; resubmit
            </button>
          </div>
        </div>
        <p v-if="summaryError" class="message error">{{ summaryError }}</p>
        <div class="meta">
          <span class="meta-item"><span class="muted">Type</span> {{ analysisTypeLabel(submission.analysisType) }}</span>
          <span class="meta-item"><span class="muted">ID</span> {{ analysisId }}</span>
        </div>
        <div class="chip-list">
          <span v-for="id in submission.datasetIds" :key="id" class="chip">{{ datasetName(id) }}</span>
        </div>
        <div v-if="config" class="config-summary">
          <span>
            <span class="muted">Terms</span>
            {{ config.terms.map((t) => `${termLabel(t.reference)}${t.reference.type === 'CONCEPT' ? '' : ` (${TERM_TYPE_LABELS[t.reference.type].toLowerCase()})`}`).join(', ') }}
          </span>
          <span v-if="dimensions.length"><span class="muted">Dimensions</span> {{ dimensions.join(', ') }}</span>
          <span v-if="submission.exclusions.length">
            <span class="muted">Exclusions</span> {{ submission.exclusions.length }} rule{{
              submission.exclusions.length === 1 ? '' : 's'
            }}
          </span>
        </div>
      </div>

      <div v-if="!isTerminal" class="section">
        <p class="message info">
          <strong>{{ status }}</strong> — {{ STATUS_TEXT[status] }} This page updates automatically.
        </p>
      </div>

      <div v-if="isTerminal && (errors.length || warnings.length)" class="section">
        <h3 class="section-title">Messages</h3>
        <AnalysisMessages
          :errors="errors"
          :warnings="warnings"
          :dataset-ids="submission.datasetIds"
          :analysis-type="submission.analysisType"
          :config="config"
          @exclude-records="emit('exclude', submission, [{ recordIds: $event }])"
          @remove-dataset="emit('remove-dataset', submission, $event)"
          @edit="emit('edit', submission)"
        />
      </div>

      <div v-if="status === 'FAILED' && !errors.length" class="section">
        <p class="message error">{{ STATUS_TEXT.FAILED }}</p>
      </div>

      <div v-if="result && resultView" ref="resultsSection" class="section">
        <h3 class="section-title">Results</h3>
        <p v-if="notConverged" class="message warning">
          The model did not converge; interpret these results with caution.
        </p>
        <component
          :is="resultView"
          :result="result"
          :config="config"
          @exclude="emit('exclude', submission, $event)"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.title-row h2 {
  margin: 0;
  font-size: 1.2rem;
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.meta,
.config-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 0.85rem;
  margin: 8px 0;
}

.config-summary {
  flex-direction: column;
}

.meta-item .muted,
.config-summary .muted {
  margin-right: 4px;
}
</style>
