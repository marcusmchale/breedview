<script setup>
import { computed, ref } from 'vue'
import { groupLabel, termLabel } from '@/composables/analysis/useAnalysisNames'
import { exclusionFromOutput } from '@/composables/analysis/useAnalysisForm'
import { formatNumber } from '@/components/analysis/results/format'

const props = defineProps({
  result: { type: Object, required: true },
  config: { type: Object, required: true }
})

const emit = defineEmits(['exclude'])

const METHOD_NOTES = {
  Z_SCORE: '|z| > 3',
  IQR: 'outside Q1 − 1.5·IQR or Q3 + 1.5·IQR; the score is the distance in IQR units',
  MAHALANOBIS: 'squared Mahalanobis distance with χ² p < 0.001, on complete observations'
}

const selected = ref(new Set())

const allSelected = computed(
  () => props.result.outliers.length > 0 && selected.value.size === props.result.outliers.length
)

const toggle = (i) => {
  const next = new Set(selected.value)
  next.has(i) ? next.delete(i) : next.add(i)
  selected.value = next
}

const toggleAll = () => {
  selected.value = allSelected.value ? new Set() : new Set(props.result.outliers.map((_, i) => i))
}

const excludeSelected = () => {
  const rules = [...selected.value].sort((a, b) => a - b).map((i) => exclusionFromOutput(props.result.outliers[i].exclusion))
  emit('exclude', rules)
}
</script>

<template>
  <div>
    <p class="hint">
      {{ config.outlierMethod?.replace('_', '-').toLowerCase() }}: {{ METHOD_NOTES[config.outlierMethod] }}. Sorted by
      score, highest first.
    </p>
    <p v-if="result.outliers.length === 0" class="message info">No potential outliers were found.</p>

    <template v-else>
      <div class="exclude-bar">
        <button type="button" class="btn btn-sm btn-primary" :disabled="selected.size === 0" @click="excludeSelected">
          Exclude {{ selected.size || '' }} selected in a new analysis
        </button>
        <span class="hint">
          Each rule matches the observation's base units, time bin and record group codes. It is approximate: it also
          matches records overlapping the time bin that were assigned to a neighbouring bin, and with several record
          group dimensions it matches any of the observation's codes.
        </span>
      </div>
      <div class="table-wrapper">
        <table class="result-table">
          <thead>
            <tr>
              <th><input type="checkbox" :checked="allSelected" aria-label="Select all" @change="toggleAll" /></th>
              <th>Observation</th>
              <th>Term</th>
              <th class="num">Value</th>
              <th class="num">Score</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(o, i) in result.outliers" :key="i">
              <td><input type="checkbox" :checked="selected.has(i)" @change="toggle(i)" /></td>
              <td>{{ groupLabel(o.observation) || 'Observation' }}</td>
              <td>{{ o.term ? termLabel(o.term) : 'All terms' }}</td>
              <td class="num">{{ formatNumber(o.value) }}</td>
              <td class="num">{{ formatNumber(o.score) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.exclude-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
</style>
