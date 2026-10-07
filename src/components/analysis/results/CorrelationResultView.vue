<script setup>
import { computed } from 'vue'
import { termLabel } from '@/composables/analysis/useAnalysisNames'
import { formatNumber } from '@/components/analysis/results/format'
import CorrelationHeatmap from '@/components/analysis/charts/CorrelationHeatmap.vue'

const props = defineProps({
  result: { type: Object, required: true },
  config: { type: Object, required: true }
})

const labels = computed(() => props.result.terms.map(termLabel))
const values = computed(() => props.result.matrix.map((row) => row.values))
</script>

<template>
  <div>
    <p class="hint">
      {{ config.correlationMethod?.toLowerCase() }} correlation on pairwise complete observations. A coefficient is
      missing (n&lt;3) when fewer than 3 observations pair up.
    </p>
    <CorrelationHeatmap :labels="labels" :values="values" />
    <div class="table-wrapper">
      <table class="result-table">
        <thead>
          <tr>
            <th />
            <th v-for="(label, j) in labels" :key="j" class="num">{{ label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in result.matrix" :key="i">
            <th>{{ termLabel(row.term) }}</th>
            <td v-for="(v, j) in row.values" :key="j" class="num">{{ formatNumber(v, 3) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
