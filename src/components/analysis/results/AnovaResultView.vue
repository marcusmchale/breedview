<script setup>
import { computed } from 'vue'
import { termLabel } from '@/composables/analysis/useAnalysisNames'
import { formatNumber, formatPValue, isSignificant } from '@/components/analysis/results/format'
import EstimatedMeansView from '@/components/analysis/results/EstimatedMeansView.vue'

const props = defineProps({
  result: { type: Object, required: true },
  config: { type: Object, required: true }
})

const alpha = computed(() => props.config.alpha ?? 0.05)

// Any random term makes it a mixed model, with denominator df and variance components but no residual row
const isMixed = computed(
  () =>
    props.result.randomEffects.length > 0 ||
    [...props.result.terms, ...props.result.interactions].some((r) => r.denominatorDegreesOfFreedom != null)
)

const rows = computed(() => [
  ...props.result.terms.map((r) => ({ ...r, label: termLabel(r.term) })),
  ...props.result.interactions.map((r) => ({ ...r, label: r.terms.map(termLabel).join(' × ') }))
])
</script>

<template>
  <div>
    <p class="hint">
      {{ isMixed ? `Linear mixed model (${config.ddf.toLowerCase().replace('_', '-')} df)` : 'Linear model' }} of
      <strong>{{ termLabel(config.response) }}</strong>, type {{ config.sumOfSquares === 'TYPE_III' ? 'III' : 'II' }} sums
      of squares. Terms significant at α = {{ alpha }} are highlighted. Rows are complete observations of the model terms.
    </p>

    <div class="table-wrapper">
      <table class="result-table">
        <thead>
          <tr>
            <th>Term</th>
            <th class="num">df</th>
            <th v-if="isMixed" class="num">Denominator df</th>
            <th class="num">Sum of squares</th>
            <th class="num">Mean square</th>
            <th class="num">F</th>
            <th class="num">p</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i" :class="{ significant: isSignificant(r.pValue, alpha) }">
            <td>{{ r.label }}</td>
            <td class="num">{{ formatNumber(r.degreesOfFreedom, 3) }}</td>
            <td v-if="isMixed" class="num">{{ formatNumber(r.denominatorDegreesOfFreedom, 3) }}</td>
            <td class="num">{{ formatNumber(r.sumOfSquares) }}</td>
            <td class="num">{{ formatNumber(r.meanSquare) }}</td>
            <td class="num">{{ formatNumber(r.fStatistic) }}</td>
            <td class="num">
              {{ formatPValue(r.pValue) }}<span v-if="isSignificant(r.pValue, alpha)" class="sig-mark">*</span>
            </td>
          </tr>
          <tr v-if="result.residual" class="overall">
            <td>Residual</td>
            <td class="num">{{ formatNumber(result.residual.degreesOfFreedom, 3) }}</td>
            <td v-if="isMixed" />
            <td class="num">{{ formatNumber(result.residual.sumOfSquares) }}</td>
            <td class="num">{{ formatNumber(result.residual.meanSquare) }}</td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>
    </div>

    <template v-if="result.randomEffects.length">
      <h4 class="subsection-title">Random effects</h4>
      <div class="table-wrapper">
        <table class="result-table">
          <thead>
            <tr>
              <th>Group</th>
              <th>Effect</th>
              <th class="num">Variance</th>
              <th class="num">Std. deviation</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in result.randomEffects" :key="i">
              <td>{{ termLabel(r.group) }}</td>
              <td>{{ r.slope ? `Slope: ${termLabel(r.slope)}` : 'Intercept' }}</td>
              <td class="num">{{ formatNumber(r.variance) }}</td>
              <td class="num">{{ formatNumber(r.standardDeviation) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-if="result.estimatedMeans.length">
      <h4 class="subsection-title">Estimated marginal means</h4>
      <EstimatedMeansView v-for="(em, i) in result.estimatedMeans" :key="i" :result="em" />
    </template>
  </div>
</template>
