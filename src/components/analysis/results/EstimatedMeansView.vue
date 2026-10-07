<script setup>
import { computed, ref } from 'vue'
import { levelsLabel, termLabel } from '@/composables/analysis/useAnalysisNames'
import { formatInterval, formatNumber, formatPValue } from '@/components/analysis/results/format'
import MeansChart from '@/components/analysis/charts/MeansChart.vue'

const props = defineProps({
  result: { type: Object, required: true }
})

const title = computed(() => {
  const r = props.result
  let text = `Means of ${r.terms.map(termLabel).join(' × ')}`
  if (r.by.length) text += ` by ${r.by.map(termLabel).join(' × ')}`
  if (r.response) text = `${termLabel(r.response)}: ${text.charAt(0).toLowerCase()}${text.slice(1)}`
  return text
})

const facets = computed(() => {
  const out = new Map()
  for (const m of props.result.means) {
    const key = levelsLabel(m.by)
    if (!out.has(key)) out.set(key, { label: key, points: [] })
    out.get(key).points.push({
      label: levelsLabel(m.levels),
      mean: m.mean,
      lower: m.lowerConfidenceLimit,
      upper: m.upperConfidenceLimit,
      standardError: m.standardError
    })
  }
  return [...out.values()]
})

const hasBy = computed(() => props.result.by.length > 0)
const showContrasts = computed(() => props.result.contrast !== 'NONE' && props.result.contrasts.length > 0)
const view = ref('chart')
</script>

<template>
  <div class="estimated-means">
    <div class="em-header">
      <h4 class="subsection-title">{{ title }}</h4>
      <div class="view-toggle" role="tablist">
        <button type="button" class="chip" :class="{ selected: view === 'chart' }" @click="view = 'chart'">Chart</button>
        <button type="button" class="chip" :class="{ selected: view === 'table' }" @click="view = 'table'">Table</button>
      </div>
    </div>

    <MeansChart
      v-if="view === 'chart'"
      :facets="facets"
      :y-label="result.response ? termLabel(result.response) : 'Estimated mean'"
    />

    <div v-else class="table-wrapper">
      <table class="result-table">
        <thead>
          <tr>
            <th>Level</th>
            <th v-if="hasBy">Conditioned on</th>
            <th class="num">Mean</th>
            <th class="num">SE</th>
            <th class="num">df</th>
            <th class="num">Confidence interval</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(m, i) in result.means" :key="i">
            <td>{{ levelsLabel(m.levels) }}</td>
            <td v-if="hasBy">{{ levelsLabel(m.by) }}</td>
            <td class="num">{{ formatNumber(m.mean) }}</td>
            <td class="num">{{ formatNumber(m.standardError) }}</td>
            <td class="num">{{ formatNumber(m.degreesOfFreedom, 3) }}</td>
            <td class="num">{{ formatInterval(m.lowerConfidenceLimit, m.upperConfidenceLimit) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <template v-if="showContrasts">
      <p class="hint">
        {{ result.contrast === 'PAIRWISE' ? 'Pairwise contrasts' : 'Contrasts against the control' }}, p values adjusted by
        {{ result.adjustment.toLowerCase() }}. Significant contrasts are highlighted.
      </p>
      <div class="table-wrapper">
        <table class="result-table">
          <thead>
            <tr>
              <th>Contrast</th>
              <th v-if="hasBy">Conditioned on</th>
              <th class="num">Estimate</th>
              <th class="num">SE</th>
              <th class="num">df</th>
              <th class="num">Statistic</th>
              <th class="num">p</th>
              <th class="num">Confidence interval</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(c, i) in result.contrasts" :key="i" :class="{ significant: c.significant }">
              <td :title="c.label">
                {{ levelsLabel(c.levelsA) }} <span class="muted">−</span> {{ levelsLabel(c.levelsB) }}
              </td>
              <td v-if="hasBy">{{ levelsLabel(c.by) }}</td>
              <td class="num">{{ formatNumber(c.estimate) }}</td>
              <td class="num">{{ formatNumber(c.standardError) }}</td>
              <td class="num">{{ formatNumber(c.degreesOfFreedom, 3) }}</td>
              <td class="num">{{ formatNumber(c.statistic) }}</td>
              <td class="num">
                {{ formatPValue(c.pValue) }}<span v-if="c.significant" class="sig-mark" title="Significant">*</span>
              </td>
              <td class="num">{{ formatInterval(c.lowerConfidenceLimit, c.upperConfidenceLimit) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.estimated-means {
  margin-bottom: 16px;
}

.em-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.view-toggle {
  display: flex;
  gap: 4px;
}
</style>
