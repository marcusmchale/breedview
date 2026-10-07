<script setup>
import { computed, ref } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { TERM_TYPE_LABELS, createTerm, removeTermReferences, termKey } from '@/composables/analysis/useAnalysisForm'
import { isAnalysableScale, isGroupingConfigured, requiredGrouping } from '@/composables/analysis/useTermRules'
import TermEditor from '@/components/analysis/config/TermEditor.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

const { form, data } = useAnalysisEditor()

const usedKeys = computed(() => new Set(form.terms.map((t) => termKey(t.reference))))
const isUsed = (ref) => usedKeys.value.has(termKey(ref))

/* ---------- concept terms ---------- */

const selectedConceptId = ref('')

const conceptOptions = computed(() =>
  data.concepts.map((c) => ({
    ...c,
    disabled: !isAnalysableScale(c.scaleType) || isUsed({ type: 'CONCEPT', conceptId: c.id })
  }))
)

const addConcept = () => {
  if (!selectedConceptId.value) return
  form.terms.push(createTerm({ type: 'CONCEPT', conceptId: selectedConceptId.value }))
  selectedConceptId.value = ''
}

/* ---------- domain terms ---------- */

const GROUPING_LABELS = { time: 'time', germplasm: 'germplasm', position: 'position' }

const domainTerms = computed(() =>
  ['UNIT', 'STUDY', 'TIME', 'GERMPLASM', 'POSITION'].map((type) => {
    const ref = { type }
    const configured = isGroupingConfigured(form.grouping, type)
    let reason = ''
    if (isUsed(ref)) reason = 'Already added'
    else if (!configured) reason = `Configure the ${GROUPING_LABELS[requiredGrouping(type)]} dimension first`
    return { ref, label: TERM_TYPE_LABELS[type], disabled: !!reason, reason }
  })
)

const recordGroupTerms = computed(() =>
  form.grouping.recordGroups
    .filter((d) => d.name)
    .map((d) => {
      const ref = { type: 'RECORD_GROUP', recordGroupDimension: d.name }
      return { ref, label: d.name, disabled: isUsed(ref), reason: isUsed(ref) ? 'Already added' : '' }
    })
)

const addDomain = (ref) => form.terms.push(createTerm(ref))

const removeTerm = (i) => removeTermReferences(form, form.terms[i].reference)
</script>

<template>
  <div>
    <p class="hint intro">
      Each concept term contributes one value per observation, from the selected datasets of that concept. Domain terms
      use the dimensions of observations; unit and study need no configuration.
    </p>

    <div class="add-terms">
      <div class="field">
        <span class="field-label">Add a concept</span>
        <div class="inline-controls">
          <select v-model="selectedConceptId" :disabled="data.concepts.length === 0">
            <option value="">{{ data.concepts.length ? 'Select a concept' : 'Select datasets first' }}</option>
            <option v-for="c in conceptOptions" :key="c.id" :value="c.id" :disabled="c.disabled">
              {{ c.name }} ({{ c.scaleType?.toLowerCase() ?? 'unknown scale' }}){{
                isAnalysableScale(c.scaleType) ? '' : ' — complex scales cannot be analysed'
              }}
            </option>
          </select>
          <button type="button" class="btn btn-sm btn-outline" :disabled="!selectedConceptId" @click="addConcept">
            Add
          </button>
        </div>
      </div>

      <div class="field">
        <span class="field-label">Add a domain term</span>
        <div class="chip-list">
          <button
            v-for="t in [...domainTerms, ...recordGroupTerms]"
            :key="termKey(t.ref)"
            type="button"
            class="chip"
            :disabled="t.disabled"
            :title="t.reason"
            @click="addDomain(t.ref)"
          >
            + {{ t.label }}
          </button>
        </div>
        <p v-if="recordGroupTerms.length === 0" class="hint">
          Record group terms become available once a record group dimension is configured.
        </p>
      </div>
    </div>

    <FieldErrors path="terms" />
    <p v-if="form.terms.length === 0" class="hint">No terms yet.</p>
    <TermEditor
      v-for="(term, i) in form.terms"
      :key="termKey(term.reference)"
      :index="i"
      @remove="removeTerm(i)"
    />
  </div>
</template>

<style scoped>
.intro {
  margin-bottom: 12px;
}

.add-terms {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.inline-controls {
  display: flex;
  gap: 6px;
}

.inline-controls select {
  flex: 1;
}

button.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>