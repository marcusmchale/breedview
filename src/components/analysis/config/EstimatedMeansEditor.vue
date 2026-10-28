<script setup>
import { computed } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { createEstimatedMeans, sameTerm } from '@/composables/analysis/useAnalysisForm'
import { categoricalTerms, knownLevels } from '@/composables/analysis/useTermRules'
import { germplasmName, studyName } from '@/composables/analysis/useAnalysisNames'
import TermChecklist from '@/components/analysis/config/TermChecklist.vue'
import GermplasmPicker from '@/components/analysis/config/GermplasmPicker.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

const { form, data } = useAnalysisEditor()

const CONTRASTS = [
  { value: 'PAIRWISE', label: 'All pairwise comparisons' },
  { value: 'TRT_VS_CTRL', label: 'Each level against a control' },
  { value: 'NONE', label: 'Means only' }
]
const ADJUSTMENTS = ['TUKEY', 'BONFERRONI', 'HOLM', 'SIDAK', 'NONE']

// Fixed categorical model terms (for ANOVA, categoricalTerms excludes the response and random terms)
const options = computed(() => categoricalTerms(form, data.conceptsById))

const byOptions = (em) => options.value.filter((t) => !em.terms.some((r) => sameTerm(r, t.reference)))

const setTerms = (em, terms) => {
  em.terms = terms
  em.by = em.by.filter((r) => !terms.some((t) => sameTerm(t, r)))
  em.control = null
}

/** Levels that can be chosen as the control, as {value, label}; empty when they can't be known in advance. */
const controlOptions = (em) => {
  if (em.terms.length !== 1) return []
  const ref = em.terms[0]
  if (ref.type === 'GERMPLASM') {
    return (form.grouping.germplasm?.germplasmIds ?? []).map((id) => ({ value: id, label: germplasmName(id) }))
  }
  if (ref.type === 'STUDY') return form.studyIds.map((id) => ({ value: id, label: studyName(id) }))
  const term = form.terms.find((t) => sameTerm(t.reference, ref))
  if (!term) return []
  const concept = ref.type === 'CONCEPT' ? data.conceptsById[ref.conceptId] : null
  return knownLevels(term, concept, form.grouping).map((l) => ({ value: l, label: l }))
}

const setContrast = (em, value) => {
  em.contrast = value
  if (value !== 'TRT_VS_CTRL') em.control = null
}

const add = () => form.estimatedMeans.push(createEstimatedMeans())
const remove = (i) => form.estimatedMeans.splice(i, 1)
</script>

<template>
  <div>
    <p class="hint">
      Estimated marginal (least-squares) means of fixed categorical terms
      <template v-if="form.analysisType === 'DESCRIPTIVE_STATISTICS'">, from a linear model of each continuous term</template>,
      with optional contrasts between them.
    </p>
    <div v-for="(em, i) in form.estimatedMeans" :key="i" class="box">
      <div class="box-header">
        <h4>Estimated means {{ i + 1 }}</h4>
        <button type="button" class="btn-link danger" @click="remove(i)">Remove</button>
      </div>

      <div class="field">
        <span class="field-label">Means of</span>
        <TermChecklist
          :model-value="em.terms"
          :options="options"
          empty-text="Add a fixed categorical term first."
          @update:model-value="setTerms(em, $event)"
        />
        <FieldErrors :path="`estimatedMeans.${i}.terms`" prefix />
      </div>

      <div class="field">
        <span class="field-label">Conditioned on (optional, for simple effects)</span>
        <TermChecklist v-model="em.by" :options="byOptions(em)" empty-text="No other eligible terms." />
        <FieldErrors :path="`estimatedMeans.${i}.by`" prefix />
      </div>

      <div class="field-row">
        <div class="field">
          <label>Contrasts</label>
          <select :value="em.contrast" @change="setContrast(em, $event.target.value)">
            <option v-for="c in CONTRASTS" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
          <FieldErrors :path="`estimatedMeans.${i}.contrast`" />
        </div>

        <div v-if="em.contrast === 'TRT_VS_CTRL'" class="field">
          <label>Control level</label>
          <p v-if="em.terms.length !== 1" class="hint">Select exactly one term to compare against a control.</p>
          <select
            v-else-if="controlOptions(em).length"
            :value="em.control ?? ''"
            @change="em.control = $event.target.value || null"
          >
            <option value="">Select the control level</option>
            <option v-for="o in controlOptions(em)" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <!-- grouped by each unit's own germplasm, any germplasm: the one picked last -->
          <GermplasmPicker
            v-else-if="em.terms[0].type === 'GERMPLASM'"
            :model-value="em.control ? [em.control] : []"
            placeholder="Select the control germplasm"
            @update:model-value="em.control = $event.at(-1) ?? null"
          />
          <input
            v-else
            type="text"
            :value="em.control ?? ''"
            placeholder="Level of the control"
            @change="em.control = $event.target.value.trim() || null"
          />
          <FieldErrors :path="`estimatedMeans.${i}.control`" />
        </div>

        <div v-if="em.contrast !== 'NONE'" class="field">
          <label>p value adjustment</label>
          <select v-model="em.adjustment">
            <option v-for="a in ADJUSTMENTS" :key="a" :value="a">{{ a.toLowerCase() }}</option>
          </select>
          <FieldErrors :path="`estimatedMeans.${i}.adjustment`" />
        </div>
      </div>
      <FieldErrors :path="`estimatedMeans.${i}`" fallback />
    </div>
    <button type="button" class="btn-link" :disabled="options.length === 0" @click="add">+ Add estimated means</button>
    <FieldErrors path="estimatedMeans" />
  </div>
</template>