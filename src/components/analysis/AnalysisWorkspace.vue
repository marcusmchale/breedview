<script setup>
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRecentSubmissions } from '@/composables/analysis/recentSubmissionsQuery'
import { useDeleteAnalysis } from '@/composables/analysis/deleteAnalysis'
import {
  analysisTypeLabel,
  createEmptyExclusion,
  createEmptyForm,
  submissionToForm
} from '@/composables/analysis/useAnalysisForm'
import RecentAnalysesList from '@/components/analysis/RecentAnalysesList.vue'
import AnalysisConfigEditor from '@/components/analysis/config/AnalysisConfigEditor.vue'
import AnalysisSubmissionView from '@/components/analysis/results/AnalysisSubmissionView.vue'

/**
 * Analysis workspace: recent analyses on the left; on the right either the editor,
 * for a new analysis or an edited one, or the selected submission with its results.
 * The selected submission is kept in the route query (?id=) so it can be linked to. Without one, ?study= (and
 * optionally ?datasets=, comma-separated) start a new analysis with that study and those datasets selected, e.g. from
 * a study's Analyse button on the programs page.
 */
const route = useRoute()
const router = useRouter()

const { ids, recentLoading, refetchRecent } = useRecentSubmissions()

const { deleteAnalysis } = useDeleteAnalysis()

// Submitted in this session, shown before the recent list catches up
const submittedIds = ref([])
// Hidden as soon as deletion starts, and until the recent list no longer has them
const deletedIds = ref(new Set())
const allIds = computed(() =>
  [...submittedIds.value.filter((id) => !ids.value.includes(id)), ...ids.value]
    .filter((id) => !deletedIds.value.has(id))
)

const selectedId = ref(route.query.id ?? null)
const mode = ref(selectedId.value ? 'view' : 'edit')

/* ---------- editor ---------- */

const queryIds = (value) => (value ? String(value).split(',').filter(Boolean) : [])
const initialForm = () => {
  const empty = createEmptyForm()
  if (route.query.id || !route.query.study) return empty
  return { ...empty, studyIds: queryIds(route.query.study), datasetIds: queryIds(route.query.datasets) }
}

const form = shallowRef(reactive(initialForm()))
const previousMessages = ref([])
const editorTitle = ref('New analysis')
// Remounts the editor for each new form, so its sections start from the new state
const editorKey = ref(0)

const openEditor = (nextForm, messages = [], title = 'New analysis') => {
  form.value = reactive(nextForm)
  previousMessages.value = messages
  editorTitle.value = title
  editorKey.value++
  mode.value = 'edit'
  window.scrollTo({ top: 0 })
}

const newAnalysis = () => {
  selectedId.value = null
  router.replace({ query: {} })
  openEditor(createEmptyForm())
}

const messagesOf = (submission) => [
  ...submission.errors.map((m) => ({ ...m, severity: 'error' })),
  ...submission.warnings.map((m) => ({ ...m, severity: 'warning' }))
]

const submissionTitle = (s) => s.name || analysisTypeLabel(s.analysisType)

const edit = (submission) => {
  openEditor(submissionToForm(submission), messagesOf(submission), `Edit: ${submissionTitle(submission)}`)
}

// Rules are appended, so messages about the existing rules keep their indexes
const exclude = (submission, rules) => {
  const next = submissionToForm(submission)
  next.exclusions.push(...rules.map((r) => ({ ...createEmptyExclusion(), ...r })))
  openEditor(next, messagesOf(submission), `Edit: ${submissionTitle(submission)}`)
}

// Removing a dataset shifts dataset indexes, so drop the messages that refer to them
const removeDataset = (submission, datasetId) => {
  const next = submissionToForm(submission)
  next.datasetIds = next.datasetIds.filter((id) => id !== datasetId)
  const messages = messagesOf(submission).filter((m) => m.path?.[0] !== 'datasetIds')
  openEditor(next, messages, `Edit: ${submissionTitle(submission)}`)
}

const cancelEdit = () => {
  if (selectedId.value) mode.value = 'view'
  else openEditor(createEmptyForm())
}

/* ---------- selection ---------- */

const select = (id) => {
  selectedId.value = id
  mode.value = 'view'
  if (route.query.id !== id) router.replace({ query: { id } })
}

const onSubmitted = (id) => {
  submittedIds.value = [id, ...submittedIds.value]
  select(String(id))
  refetchRecent()
}

/* ---------- deletion ---------- */

const setDeleted = (id, deleted) => {
  const next = new Set(deletedIds.value)
  if (deleted) next.add(id)
  else next.delete(id)
  deletedIds.value = next
}

const removeAnalysis = async ({ id, title }) => {
  if (!confirm(`Delete analysis "${title}"? A queued or running analysis is cancelled.`)) return

  // Hide it and close it first, so nothing polls the analysis while it is deleted
  setDeleted(id, true)
  if (selectedId.value === id) newAnalysis()

  let outcome
  try {
    outcome = await deleteAnalysis(id)
  } catch (e) {
    outcome = { deleted: false, errors: [{ message: e.message }] }
  }

  if (!outcome.deleted) {
    setDeleted(id, false)
    alert(`Failed to delete: ${outcome.errors.map((e) => e.message).join('; ') || 'Unknown error'}`)
    return
  }

  submittedIds.value = submittedIds.value.filter((s) => s !== id)
  try {
    await refetchRecent()
    if (!ids.value.includes(id)) setDeleted(id, false)
  } catch {
    // Stays hidden; the next refresh drops it from the list
  }
}

watch(
  () => route.query.id,
  (id) => {
    if (id && id !== selectedId.value) select(id)
  }
)
</script>

<template>
  <div class="analysis-workspace">
    <RecentAnalysesList
      :ids="allIds"
      :selected-id="mode === 'view' ? selectedId : null"
      :loading="recentLoading"
      @select="select"
      @delete="removeAnalysis"
      @new="newAnalysis"
      @refresh="refetchRecent()"
    />

    <main class="workspace-main">
      <router-link to="/programs" class="programs-link">← Programs</router-link>
      <AnalysisConfigEditor
        v-if="mode === 'edit'"
        :key="editorKey"
        :form="form"
        :previous-messages="previousMessages"
        :title="editorTitle"
        @submitted="onSubmitted"
        @cancel="cancelEdit"
      />
      <AnalysisSubmissionView
        v-else-if="selectedId"
        :key="selectedId"
        :analysis-id="selectedId"
        @edit="edit"
        @exclude="exclude"
        @remove-dataset="removeDataset"
      />
    </main>
  </div>
</template>

<style scoped>
.analysis-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  padding: 16px;
}

.analysis-workspace :deep(.recent) {
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}

.programs-link {
  display: inline-block;
  margin-bottom: 8px;
  color: #1976d2;
  text-decoration: none;
  font-size: 0.9rem;
}

.programs-link:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .analysis-workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .analysis-workspace :deep(.recent) {
    position: static;
    max-height: none;
  }
}
</style>
