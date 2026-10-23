<script setup>
import { computed, ref } from 'vue'
import { useSelectStudyQueries } from '@/composables/datasets/selectStudyQueries'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { ANALYSIS_TYPES } from '@/composables/analysis/useAnalysisForm'
import { datasetName, registerNames, studyName } from '@/composables/analysis/useAnalysisNames'
import { useProgramsTree } from '@/composables/programs/programsTreeQuery'
import TreeMultiPicker from '@/components/analysis/config/TreeMultiPicker.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'
import RetiredTag from '@/components/ontology/RetiredTag.vue'

const { form, data, messagesAt } = useAnalysisEditor()

/* ---------- study tree ---------- */

const selectedProgram = ref(null)
const selectedTrial = ref(null)

const { programs, programsLoading, trials, trialsLoading, studies, studiesLoading } = useSelectStudyQueries({
  programId: selectedProgram,
  trialId: selectedTrial,
  studyId: () => null
})

const loadChildren = (nodeId, node) => {
  if (node?.__typename === 'Program') {
    selectedProgram.value = nodeId
    selectedTrial.value = null
  } else if (node?.__typename === 'Trial') {
    selectedTrial.value = nodeId
  }
}

const childrenLoading = computed(() => !!(studiesLoading.value || trialsLoading.value || programsLoading.value))

const currentChildren = computed(() => {
  if (!selectedProgram.value) return []
  return (selectedTrial.value ? studies.value : trials.value) ?? []
})

const hasChildren = (node) => {
  if (node.__typename === 'Trial') return node.studies ? node.studies.length > 0 : true
  if (node.__typename === 'Program') return node.trials ? node.trials.length > 0 : true
  return false
}

const isSelectable = (node) => node.__typename === 'Study'

// Everything below a program or a trial, or every trial and study, for selecting all studies at once
const { loadStudyGroups } = useProgramsTree()
const loadTypeGroups = async (node) => {
  const groups = await loadStudyGroups(node)
  for (const group of groups) if (group.key === 'Study') registerNames('study', group.nodes)
  return groups
}

// Selected datasets keep their study selected, so deselecting a study drops its datasets
const setStudies = (ids) => {
  form.datasetIds = form.datasetIds.filter((id) => {
    const studyId = data.datasetStudy[id]
    return studyId == null || ids.includes(studyId)
  })
  form.studyIds = ids
}

/* ---------- datasets ---------- */

const summariesByStudy = computed(() => {
  const out = {}
  for (const s of data.summaries) (out[s._studyId] ??= []).push(s)
  return out
})

// Selected datasets not listed under a study, e.g. deleted or unreadable since a submission was made
const orphanDatasetIds = computed(() => {
  const known = new Set(data.summaries.map((s) => s.id))
  return form.datasetIds.filter((id) => !known.has(id))
})

const isSelected = (id) => form.datasetIds.includes(id)

// Order of datasetIds determines observation order, so keep selection order
const toggleDataset = (id) => {
  form.datasetIds = isSelected(id) ? form.datasetIds.filter((x) => x !== id) : [...form.datasetIds, id]
}

const selectAllInStudy = (studyId, select) => {
  const ids = (summariesByStudy.value[studyId] ?? []).map((s) => s.id)
  form.datasetIds = select
    ? [...form.datasetIds, ...ids.filter((id) => !isSelected(id))]
    : form.datasetIds.filter((id) => !ids.includes(id))
}

const formatDate = (value) => (value ? String(value).slice(0, 10) : '')

const datasetErrors = (id) => messagesAt(['datasetIds', String(form.datasetIds.indexOf(id))])
</script>

<template>
  <div>
    <div class="field-row">
      <div class="field">
        <label for="analysis-name">Name</label>
        <input id="analysis-name" v-model="form.name" type="text" placeholder="Optional name for the analysis" />
        <FieldErrors path="name" />
      </div>
    </div>

    <div class="field">
      <span class="field-label">Analysis type</span>
      <div class="type-cards">
        <label
          v-for="t in ANALYSIS_TYPES"
          :key="t.value"
          class="type-card"
          :class="{ selected: form.analysisType === t.value }"
        >
          <input v-model="form.analysisType" type="radio" name="analysis-type" :value="t.value" />
          <strong>{{ t.label }}</strong>
          <span class="hint">{{ t.description }}</span>
        </label>
      </div>
    </div>

    <div class="field">
      <span class="field-label">Studies</span>
      <TreeMultiPicker
        :model-value="form.studyIds"
        :root-nodes="programs ?? []"
        :load-children-fn="loadChildren"
        :children-loading="childrenLoading"
        :current-children="currentChildren"
        :has-children-fn="hasChildren"
        :is-selectable-fn="isSelectable"
        :load-type-groups-fn="loadTypeGroups"
        :label-fn="studyName"
        placeholder="Select studies"
        @update:model-value="setStudies"
      />
      <p class="hint">Datasets are listed for the selected studies.</p>
    </div>

    <div class="field">
      <span class="field-label">Datasets</span>
      <p v-if="data.summariesLoading" class="hint">Loading datasets…</p>
      <p v-else-if="form.studyIds.length === 0 && orphanDatasetIds.length === 0" class="hint">
        Select one or more studies first.
      </p>

      <div v-for="studyId in form.studyIds" :key="studyId" class="study-datasets">
        <div class="box-header">
          <h4>{{ studyName(studyId) }}</h4>
          <span v-if="summariesByStudy[studyId]?.length" class="study-actions">
            <button type="button" class="btn-link" @click="selectAllInStudy(studyId, true)">Select all</button>
            <button type="button" class="btn-link" @click="selectAllInStudy(studyId, false)">None</button>
          </span>
        </div>
        <p v-if="!summariesByStudy[studyId]?.length && !data.summariesLoading" class="hint">
          No datasets in this study.
        </p>
        <label v-for="s in summariesByStudy[studyId] ?? []" :key="s.id" class="dataset-row">
          <input type="checkbox" :value="s.id" :checked="isSelected(s.id)" @change="toggleDataset(s.id)" />
          <span class="dataset-concept">{{ s.concept?.name ?? `Dataset ${s.id}` }}<RetiredTag :entry="s.concept" /></span>
          <span class="muted">
            {{ s.record_count }} records · {{ s.unit_count }} units
            <template v-if="s.start || s.end"> · {{ formatDate(s.start) }} – {{ formatDate(s.end) }}</template>
          </span>
          <span v-if="isSelected(s.id)" class="order" title="Order of the dataset in the analysis">
            #{{ form.datasetIds.indexOf(s.id) + 1 }}
          </span>
          <FieldErrors :path="['datasetIds', String(form.datasetIds.indexOf(s.id))]" />
        </label>
      </div>

      <div v-if="orphanDatasetIds.length && !data.summariesLoading" class="study-datasets">
        <div class="box-header">
          <h4>Other datasets</h4>
        </div>
        <p class="hint">These datasets aren't listed in a selected study; they may have been removed or be unreadable.</p>
        <label v-for="id in orphanDatasetIds" :key="id" class="dataset-row">
          <input type="checkbox" :value="id" checked @change="toggleDataset(id)" />
          <span class="dataset-concept">{{ datasetName(id) }}</span>
          <span v-for="(m, i) in datasetErrors(id)" :key="i" class="message error">{{ m.message }}</span>
        </label>
      </div>
      <FieldErrors path="datasetIds" />
    </div>
  </div>
</template>

<style scoped>
.type-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.type-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 10px;
  cursor: pointer;
}

.type-card input {
  display: none;
}

.type-card.selected {
  border-color: var(--an-accent);
  background: var(--an-accent-soft);
}

.study-datasets {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
}

.study-actions {
  display: flex;
  gap: 12px;
}

.dataset-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 0.875rem;
  cursor: pointer;
}

.dataset-concept {
  font-weight: 500;
}

.order {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--an-accent);
}
</style>
