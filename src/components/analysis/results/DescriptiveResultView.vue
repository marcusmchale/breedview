<script setup>
import { computed } from 'vue'
import { levelsLabel, termLabel } from '@/composables/analysis/useAnalysisNames'
import { termKey } from '@/composables/analysis/useAnalysisForm'
import { categoryCount, columnValue, descriptiveTables } from '@/composables/analysis/descriptiveTables'
import { formatNumber } from '@/components/analysis/results/format'
import EstimatedMeansView from '@/components/analysis/results/EstimatedMeansView.vue'

const props = defineProps({
  result: { type: Object, required: true },
  // accepted like the other result views, though descriptive results don't need it
  config: { type: Object, default: null }
})

// One table per term described: a continuous term's statistics, or an ordinal term's quantiles as categories and the
// count of each category (descriptiveTables.js); the overall row first, then each combination of levels
const tables = computed(() => descriptiveTables(props.result.terms, termKey))

// an ordinal term's quantiles are categories, shown as they are named
const shown = (value) => (typeof value === 'string' ? value : formatNumber(value))
</script>

<template>
  <div>
    <p v-if="tables.length === 0" class="hint">No statistics were produced.</p>
    <div v-for="table in tables" :key="termKey(table.term)" :class="{ 'ordinal-table': table.ordinal }">
      <h4 class="subsection-title">{{ termLabel(table.term) }}</h4>
      <p v-if="table.ordinal" class="hint">
        Ordinal: the quantiles are categories, and each category's count is shown with its share of the observations.
      </p>
      <div class="table-wrapper">
        <table class="result-table">
          <thead>
            <tr>
              <th>Levels</th>
              <th v-for="[key, label] in table.columns" :key="key" class="num">{{ label }}</th>
              <th v-for="(level, c) in table.categories" :key="`category-${level}`" class="num category" :class="{ first: c === 0 }">{{ level }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in table.rows" :key="i" :class="{ overall: row.levels.length === 0 }">
              <td>{{ row.levels.length ? levelsLabel(row.levels, row.group) : 'All observations' }}</td>
              <td v-for="[key] in table.columns" :key="key" class="num">{{ shown(columnValue(row, key)) }}</td>
              <td v-for="(level, c) in table.categories" :key="`category-${level}`" class="num category" :class="{ first: c === 0 }">{{ categoryCount(row, level) }}</td>
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

<style scoped>
/* an ordinal term's categories, set apart from its quantiles */
.result-table .category.first {
  border-left: 2px solid #ddd;
}
</style>
