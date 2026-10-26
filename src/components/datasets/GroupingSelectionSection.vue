<script setup>
import { computed } from 'vue'
import { RECORD_GROUP_EXTENT_DESCRIPTIONS, extentLabel } from '@/composables/ontology/recordGroupExtent'

const props = defineProps({
  groupings: { type: Array, default: () => [] },
  datasetSummaries: { type: Array, default: () => [] },
  summariesLoading: { type: Boolean, default: false },
  selectedIds: { type: Array, default: () => [] },
  mergeTargets: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:selectedIds', 'update:mergeTargets'])

const datasetScopedSelected = computed(() =>
  props.groupings.filter((g) => g.scope === 'DATASET_SCOPED' && props.selectedIds.includes(g.id))
)

const scopeLabel = (scope) => (scope === 'DATASET_SCOPED' ? 'Dataset-scoped' : 'Study-wide')

const toggle = (groupingId, checked) => {
  const ids = checked
    ? [...new Set([...props.selectedIds, groupingId])]
    : props.selectedIds.filter((id) => id !== groupingId)
  emit('update:selectedIds', ids)
}

const getMode = (groupingId) => {
  const target = props.mergeTargets[groupingId]
  return target === null || target === undefined ? 'new' : 'merge'
}

const setTarget = (groupingId, value) => {
  emit('update:mergeTargets', { ...props.mergeTargets, [groupingId]: value })
}

const setMode = (groupingId, mode) => setTarget(groupingId, mode === 'new' ? null : '')

const onDatasetSelect = (groupingId, rawValue) => {
  const ds = props.datasetSummaries.find((d) => String(d.id) === rawValue)
  setTarget(groupingId, ds ? ds.id : '')
}

const findSummary = (datasetId) =>
  props.datasetSummaries.find((d) => String(d.id) === String(datasetId))

const scopeIndexFor = (grouping, datasetId) =>
  (grouping.dataset_scopes || []).findIndex((s) =>
    (s.datasetIds || []).map(String).includes(String(datasetId))
  )

const datasetLabel = (grouping, ds) => {
  const name = ds.concept?.name || `Dataset ${ds.id}`
  const scopeIdx = scopeIndexFor(grouping, ds.id)
  const scopeText = scopeIdx >= 0 ? ` — in scope ${scopeIdx + 1}` : ''
  return `${name} (#${ds.id})${scopeText}`
}
</script>

<template>
  <section v-if="groupings.length" class="grouping-selection">
    <h3>Include Record Groupings</h3>
    <p class="section-help">
      Each selected grouping adds a column to the data table. Values are shared by all records in a row.
    </p>

    <div class="grouping-options">
      <label v-for="g in groupings" :key="g.id" class="grouping-option">
        <input
          type="checkbox"
          :checked="selectedIds.includes(g.id)"
          @change="toggle(g.id, $event.target.checked)"
        />
        <span class="grouping-name">{{ g.name }}</span>
        <span class="scope-badge" :class="g.scope">{{ scopeLabel(g.scope) }}</span>
        <span v-if="g.type" class="grouping-type">{{ g.type.name }}</span>
        <span v-if="g.extent && g.extent !== 'SHARED'" class="extent-badge" :title="RECORD_GROUP_EXTENT_DESCRIPTIONS[g.extent]">
          {{ extentLabel(g.extent) }}
        </span>
      </label>
    </div>

    <div v-if="datasetScopedSelected.length" class="scope-config">
      <h4>Dataset Scope Configuration</h4>

      <div v-for="g in datasetScopedSelected" :key="g.id" class="scope-config-card">
        <div class="scope-config-title">{{ g.name }} — merge into an existing scope?</div>

        <label class="radio-label">
          <input
            type="radio"
            :name="`scope-mode-${g.id}`"
            :checked="getMode(g.id) === 'new'"
            @change="setMode(g.id, 'new')"
          />
          Create new scope
        </label>
        <label class="radio-label">
          <input
            type="radio"
            :name="`scope-mode-${g.id}`"
            :checked="getMode(g.id) === 'merge'"
            :disabled="!datasetSummaries.length"
            @change="setMode(g.id, 'merge')"
          />
          Merge into the scope of an existing dataset
          <span v-if="!summariesLoading && !datasetSummaries.length" class="muted">(no datasets in this study yet)</span>
        </label>

        <div v-if="getMode(g.id) === 'merge'" class="merge-target">
          <select
            :value="mergeTargets[g.id] ? String(mergeTargets[g.id]) : ''"
            :disabled="summariesLoading"
            @change="onDatasetSelect(g.id, $event.target.value)"
          >
            <option value="">-- Select dataset --</option>
            <option v-for="ds in datasetSummaries" :key="ds.id" :value="String(ds.id)">
              {{ datasetLabel(g, ds) }}
            </option>
          </select>

          <div v-if="findSummary(mergeTargets[g.id])" class="dataset-summary">
            <template v-for="ds in [findSummary(mergeTargets[g.id])]" :key="ds.id">
              <div><strong>Concept:</strong> {{ ds.concept?.name || '—' }}</div>
              <div><strong>Units:</strong> {{ ds.unit_count ?? '—' }}, <strong>Records:</strong> {{ ds.record_count ?? '—' }}</div>
              <div v-if="ds.start || ds.end"><strong>Date range:</strong> {{ ds.start || '?' }} to {{ ds.end || '?' }}</div>
            </template>
          </div>
          <span v-else class="error-text">Select a dataset, or choose "Create new scope".</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.grouping-selection {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e0e0e0;
}
.grouping-selection h3 { margin: 0 0 6px 0; font-size: 1rem; color: #333; }
.grouping-selection h4 { margin: 16px 0 8px 0; font-size: 0.95rem; color: #333; }
.section-help { margin: 0 0 12px 0; font-size: 0.875rem; color: #666; }
.grouping-options { display: flex; flex-direction: column; gap: 6px; }
.grouping-option { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.grouping-name { font-weight: 500; }
.grouping-type { font-size: 0.8rem; color: #666; }
.scope-badge { font-size: 0.75rem; padding: 2px 6px; border-radius: 10px; background: var(--brand-accent-light); color: var(--brand-accent-darker); }
.scope-badge.DATASET_SCOPED { background: #fff3e0; color: #e65100; }
.extent-badge { font-size: 0.75rem; padding: 2px 6px; border-radius: 10px; background: #f3e5f5; color: #6a1b9a; }
.scope-config-card { border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 10px; background: #fafafa; }
.scope-config-title { font-weight: 500; margin-bottom: 8px; }
.radio-label { display: flex; align-items: center; gap: 6px; margin: 4px 0; cursor: pointer; }
.merge-target { margin: 8px 0 0 22px; }
.merge-target select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.dataset-summary { margin-top: 8px; font-size: 0.85rem; color: #555; display: flex; flex-direction: column; gap: 2px; }
.error-text { display: block; margin-top: 6px; color: #f44336; font-size: 0.85rem; }
.muted { color: #999; font-size: 0.8rem; }
</style>