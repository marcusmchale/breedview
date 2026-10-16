<script setup>
import { computed, reactive, ref, toRef } from 'vue'
import { provideAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { useAnalysisDataContext } from '@/composables/analysis/useAnalysisDataContext'
import { useAnalysisMessages, messageInfo } from '@/composables/analysis/useAnalysisMessages'
import { useSubmitAnalysis } from '@/composables/analysis/submitAnalysis'
import { analysisTypeLabel, buildAnalysisInput } from '@/composables/analysis/useAnalysisForm'
import { analysisHints, blockingProblems } from '@/composables/analysis/useTermRules'
import DataSection from '@/components/analysis/config/DataSection.vue'
import GroupingSection from '@/components/analysis/config/GroupingSection.vue'
import TermsSection from '@/components/analysis/config/TermsSection.vue'
import ModelOptionsSection from '@/components/analysis/config/ModelOptionsSection.vue'
import ExclusionsSection from '@/components/analysis/config/ExclusionsSection.vue'

/**
 * Editor for a new analysis, or for editing and resubmitting an earlier one.
 *
 * The form is owned by the caller and edited in place. Messages of the run the form
 * was loaded from are shown on their fields until the next submission.
 */
const props = defineProps({
  form: { type: Object, required: true },
  // errors and warnings of the submission the form was loaded from, with severity
  previousMessages: { type: Array, default: () => [] },
  title: { type: String, default: 'New analysis' }
})

const emit = defineEmits(['submitted', 'cancel'])

const formRef = toRef(props, 'form')
const data = reactive(useAnalysisDataContext(formRef))

/* ---------- submission ---------- */

const { submitAnalysis, submitLoading } = useSubmitAnalysis()

const submitErrors = ref([])
const requestError = ref(null)
const submitted = ref(false)

// Previous messages refer to the configuration as it was loaded, so drop them after a submit attempt
const messages = computed(() => (submitted.value ? submitErrors.value : [...submitErrors.value, ...props.previousMessages]))

const { messagesAt, unpathed, exclusionFeedback } = useAnalysisMessages(messages, () => props.form.analysisType)

const blocking = computed(() => blockingProblems(props.form))
const hints = computed(() => analysisHints(props.form, data.conceptsById, data.groupingsById).filter((h) => !blocking.value.includes(h)))

const submit = async () => {
  if (blocking.value.length > 0 || submitLoading.value) return
  submitErrors.value = []
  requestError.value = null
  submitted.value = true
  try {
    const payload = await submitAnalysis(buildAnalysisInput(props.form))
    if (payload?.status === 'SUCCESS' && payload.result) {
      emit('submitted', payload.result)
      return
    }
    // Submit errors are {name, message, path}; analysis messages use code
    submitErrors.value = (payload?.errors ?? []).map((e) => ({
      code: e.name,
      message: e.message,
      path: e.path,
      severity: 'error'
    }))
    if (submitErrors.value.length === 0) requestError.value = 'The analysis could not be submitted.'
  } catch (err) {
    console.error('Error submitting analysis:', err)
    requestError.value = err.message
  }
}

provideAnalysisEditor({ form: props.form, data, messagesAt, exclusionFeedback })

/* ---------- navigation ---------- */

const sections = computed(() => [
  { id: 'analysis-data', label: 'Data', prefixes: ['name', 'datasetIds'] },
  { id: 'analysis-grouping', label: 'Grouping', prefixes: ['grouping'] },
  { id: 'analysis-terms', label: 'Terms', prefixes: ['terms'] },
  {
    id: 'analysis-options',
    label: `${analysisTypeLabel(props.form.analysisType)} options`,
    prefixes: ['options', 'response', 'interactions', 'estimatedMeans']
  },
  { id: 'analysis-exclusions', label: 'Exclusions', prefixes: ['exclusions'] }
])

const sectionMessageCount = (section) =>
  section.prefixes.reduce((n, p) => n + messagesAt(p, { prefix: true }).length, 0)

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
</script>

<template>
  <div class="config-editor panel">
    <div class="editor-header">
      <h2>{{ title }}</h2>
      <nav class="section-nav">
        <button v-for="s in sections" :key="s.id" type="button" class="nav-item" @click="scrollTo(s.id)">
          {{ s.label }}
          <span v-if="sectionMessageCount(s)" class="nav-count">{{ sectionMessageCount(s) }}</span>
        </button>
      </nav>
    </div>

    <div v-if="unpathed.length || requestError" class="section">
      <p v-if="requestError" class="message error">{{ requestError }}</p>
      <p v-for="(m, i) in unpathed" :key="i" class="message" :class="m.severity ?? 'error'">
        <strong>{{ m.code }}</strong>: {{ m.message }}
        <span v-if="messageInfo(m.code).hint" class="hint">{{ messageInfo(m.code).hint }}</span>
      </p>
    </div>

    <section id="analysis-data" class="section">
      <h3 class="section-title">Data</h3>
      <DataSection />
    </section>

    <section id="analysis-grouping" class="section">
      <h3 class="section-title">Grouping</h3>
      <GroupingSection />
    </section>

    <section id="analysis-terms" class="section">
      <h3 class="section-title">Terms</h3>
      <TermsSection />
    </section>

    <section id="analysis-options" class="section">
      <h3 class="section-title">{{ sections[3].label }}</h3>
      <ModelOptionsSection />
    </section>

    <section id="analysis-exclusions" class="section">
      <h3 class="section-title">Exclusions</h3>
      <ExclusionsSection />
    </section>

    <div class="submit-bar">
      <ul v-if="blocking.length || hints.length" class="problems">
        <li v-for="p in blocking" :key="p" class="blocking">{{ p }}</li>
        <li v-for="h in hints" :key="h">{{ h }}</li>
      </ul>
      <div class="submit-actions">
        <button type="button" class="btn btn-secondary" @click="emit('cancel')">Cancel</button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="blocking.length > 0 || submitLoading"
          @click="submit"
        >
          {{ submitLoading ? 'Submitting…' : 'Submit analysis' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-header {
  position: sticky;
  top: 0;
  z-index: 5;
  background: white;
  padding: 16px 20px 0;
  border-bottom: 1px solid var(--an-border);
  border-radius: 8px 8px 0 0;
}

.editor-header h2 {
  margin: 0 0 8px;
  font-size: 1.2rem;
}

.section-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.nav-item {
  border: none;
  background: none;
  padding: 6px 10px;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--an-muted);
  border-bottom: 2px solid transparent;
  font-family: inherit;
}

.nav-item:hover {
  color: var(--an-accent);
  border-bottom-color: var(--an-accent);
}

.nav-count {
  display: inline-block;
  min-width: 18px;
  padding: 0 5px;
  margin-left: 4px;
  border-radius: 9px;
  background: var(--an-error);
  color: white;
  font-size: 0.7rem;
  text-align: center;
}

.submit-bar {
  position: sticky;
  bottom: 0;
  background: white;
  border-top: 1px solid var(--an-border);
  padding: 12px 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  border-radius: 0 0 8px 8px;
}

.problems {
  margin: 0;
  padding-left: 18px;
  font-size: 0.8rem;
  color: var(--an-warning);
}

.problems .blocking {
  color: var(--an-error);
  font-weight: 600;
}

.submit-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
</style>