<script setup>
import { itemKey, useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { createEmptyExclusion } from '@/composables/analysis/useAnalysisForm'
import ExclusionRuleEditor from '@/components/analysis/config/ExclusionRuleEditor.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

const { form } = useAnalysisEditor()

const add = () => form.exclusions.push(createEmptyExclusion())
const remove = (i) => form.exclusions.splice(i, 1)
</script>

<template>
  <div>
    <p class="hint intro">
      A record is excluded if it matches any rule. Within a rule all criteria must match, and within a criterion any
      listed value may match.
    </p>
    <ExclusionRuleEditor
      v-for="(rule, i) in form.exclusions"
      :key="itemKey(rule)"
      :index="i"
      @remove="remove(i)"
    />
    <button type="button" class="btn btn-sm btn-outline" @click="add">+ Add exclusion rule</button>
    <FieldErrors path="exclusions" />
  </div>
</template>

<style scoped>
.intro {
  margin-bottom: 12px;
}
</style>