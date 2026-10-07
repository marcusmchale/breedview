<script setup>
import { computed } from 'vue'
import { levelsLabel, termLabel } from '@/composables/analysis/useAnalysisNames'
import { termKey } from '@/composables/analysis/useAnalysisForm'
import { formatNumber } from '@/components/analysis/results/format'
import EstimatedMeansView from '@/components/analysis/results/EstimatedMeansView.vue'

const props = defineProps({
  result: { type: Object, required: true },
  // accepted like the other result views, though descriptive results don't need it
  config: { type: Object, default: null }
})

// One table per continuous term: the overall row (no levels) first, then each combination of levels
const tables = computed(() => {
  const out = new Map()
  for (const row of props.result.terms) {
    const key = termKey(row.term)
    if (!out.has(key)) out.set(key, { term: row.term, overall: [], rows: [] })
    out.get(key)[row.levels.length === 0 ? 'overall' : 'rows'].push(row)
  }
  return [...out.values()].map((t) => ({ ...t, all: [...t.overall, ...t.rows] }))
})

const STATS = [
  ['count', 'n'],
  ['missingCount', 'Missing'],
  ['mean', 'Mean'],
  ['standardDeviation', 'SD'],
  ['standardError', 'SE'],
  ['minimum', 'Min'],
  ['lowerQuartile', 'Q1'],
  ['median', 'Median'],
  ['upperQuartile', 'Q3'],
  ['maximum', 'Max']
]
</script>

<template>
  <div>
    <p v-if="tables.length === 0" class="hint">No statistics were produced.</p>
    <div v-for="table in tables" :key="termKey(table.term)">
      <h4 class="subsection-title">{{ termLabel(table.term) }}</h4>
      <div class="table-wrapper">
        <table class="result-table">
          <thead>
            <tr>
              <th>Levels</th>
              <th v-for="[key, label] in STATS" :key="key" class="num">{{ label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in table.all" :key="i" :class="{ overall: row.levels.length === 0 }">
              <td>{{ row.levels.length ? levelsLabel(row.levels, row.group) : 'All observations' }}</td>
              <td v-for="[key] in STATS" :key="key" class="num">{{ formatNumber(row[key]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template v-if="result.estimatedMeans.length">
      <h4 class="subsection-title">Estimated marginal means</h4>
      <EstimatedMeansView v-for="(em, i) in result.estimatedMeans" :key="i" :result="em" />
    </template>
  </div>
</template>
