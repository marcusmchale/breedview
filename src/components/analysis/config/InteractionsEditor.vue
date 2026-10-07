<script setup>
import { computed } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { sameTerm } from '@/composables/analysis/useAnalysisForm'
import { categoricalTerms } from '@/composables/analysis/useTermRules'
import TermChecklist from '@/components/analysis/config/TermChecklist.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

const { form, data } = useAnalysisEditor()

// ANOVA: any fixed model term; descriptive statistics: categorical terms
const options = computed(() => {
  if (form.analysisType === 'ANOVA') {
    return form.terms.filter((t) => !sameTerm(t.reference, form.response) && t.effect !== 'RANDOM')
  }
  return categoricalTerms(form, data.conceptsById)
})

const add = () => form.interactions.push({ terms: [] })
const remove = (i) => form.interactions.splice(i, 1)
</script>

<template>
  <div>
    <p class="hint">
      <template v-if="form.analysisType === 'ANOVA'">Random terms can't be part of an interaction.</template>
      <template v-else>Interactions between categorical terms, used for estimated means.</template>
    </p>
    <div v-for="(interaction, i) in form.interactions" :key="i" class="interaction">
      <TermChecklist v-model="interaction.terms" :options="options" />
      <button type="button" class="btn-link danger" @click="remove(i)">Remove</button>
      <span v-if="interaction.terms.length < 2" class="hint">Select at least two terms.</span>
      <FieldErrors :path="`interactions.${i}`" prefix />
    </div>
    <button type="button" class="btn-link" :disabled="options.length < 2" @click="add">+ Add interaction</button>
    <FieldErrors path="interactions" />
  </div>
</template>

<style scoped>
.interaction {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px dashed var(--an-border);
}
</style>