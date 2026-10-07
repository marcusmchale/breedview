<script setup>
import { computed, ref } from 'vue'
import { groupLabel } from '@/composables/analysis/useAnalysisNames'
import { formatNumber } from '@/components/analysis/results/format'
import MdsScatter from '@/components/analysis/charts/MdsScatter.vue'

const props = defineProps({
  result: { type: Object, required: true },
  config: { type: Object, required: true }
})

const dimensions = computed(() => Math.max(0, ...props.result.observations.map((o) => o.coordinates.length)))
const dimensionIndexes = computed(() => [...Array(dimensions.value).keys()])

const xDim = ref(0)
const yDim = ref(1)

// Cluster IDs in a stable order, so a cluster keeps its colour
const clusterIds = computed(() => {
  const ids = [...new Set(props.result.observations.map((o) => o.clusterId).filter((id) => id != null))]
  return ids.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
})

const points = computed(() =>
  props.result.observations.map((o) => ({
    x: o.coordinates[xDim.value],
    y: o.coordinates[yDim.value] ?? 0,
    clusterIndex: o.clusterId == null ? null : clusterIds.value.indexOf(o.clusterId),
    label: groupLabel(o.group),
    recordCount: o.recordIds.length
  }))
)
</script>

<template>
  <div>
    <p class="hint">
      {{ result.observations.length }} complete observations, {{ config.distance?.toLowerCase() }} distance on
      standardised continuous terms.
      <template v-if="config.clustering">
        {{ config.clustering.method === 'KMEANS' ? 'k-means' : 'Hierarchical' }} clustering on the standardised data.
      </template>
    </p>

    <div v-if="dimensions > 2" class="field-row">
      <div class="field">
        <label>Horizontal axis</label>
        <select v-model.number="xDim">
          <option v-for="d in dimensionIndexes" :key="d" :value="d" :disabled="d === yDim">Dimension {{ d + 1 }}</option>
        </select>
      </div>
      <div class="field">
        <label>Vertical axis</label>
        <select v-model.number="yDim">
          <option v-for="d in dimensionIndexes" :key="d" :value="d" :disabled="d === xDim">Dimension {{ d + 1 }}</option>
        </select>
      </div>
    </div>

    <MdsScatter
      v-if="points.length"
      :points="points"
      :clusters="clusterIds.map((id) => `Cluster ${id}`)"
      :x-label="`Dimension ${xDim + 1}`"
      :y-label="dimensions > 1 ? `Dimension ${yDim + 1}` : ''"
    />

    <div class="table-wrapper">
      <table class="result-table">
        <thead>
          <tr>
            <th>Observation</th>
            <th v-if="clusterIds.length">Cluster</th>
            <th v-for="d in dimensionIndexes" :key="d" class="num">Dim {{ d + 1 }}</th>
            <th class="num">Records</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(o, i) in result.observations" :key="i">
            <td>{{ groupLabel(o.group) }}</td>
            <td v-if="clusterIds.length">{{ o.clusterId ?? '—' }}</td>
            <td v-for="d in dimensionIndexes" :key="d" class="num">{{ formatNumber(o.coordinates[d]) }}</td>
            <td class="num">{{ o.recordIds.length }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
