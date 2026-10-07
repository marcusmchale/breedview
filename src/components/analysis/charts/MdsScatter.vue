<script setup>
import { computed, ref } from 'vue'
import { scaleLinear } from 'd3'
import { INK, markerPath, seriesColor, shapeFor } from '@/components/analysis/charts/chartPalette'
import { formatNumber } from '@/components/analysis/results/format'

/**
 * Observations in two MDS dimensions. Both axes share one scale so distances read true.
 * Clusters are told apart by colour and marker shape together.
 */
const props = defineProps({
  // [{ x, y, clusterIndex (null when unclustered), label, recordCount }]
  points: { type: Array, required: true },
  // cluster labels by index
  clusters: { type: Array, default: () => [] },
  xLabel: { type: String, default: 'Dimension 1' },
  yLabel: { type: String, default: 'Dimension 2' }
})

const SIZE = 420
const M = { top: 16, right: 16, bottom: 44, left: 56 }

const domain = computed(() => {
  const xs = props.points.map((p) => p.x)
  const ys = props.points.map((p) => p.y)
  const lo = Math.min(...xs, ...ys)
  const hi = Math.max(...xs, ...ys)
  const pad = (hi - lo || 1) * 0.06
  return [lo - pad, hi + pad]
})

const x = computed(() => scaleLinear().domain(domain.value).range([M.left, SIZE - M.right]).nice())
const y = computed(() => scaleLinear().domain(domain.value).range([SIZE - M.bottom, M.top]).nice())

const xTicks = computed(() => x.value.ticks(5))
const yTicks = computed(() => y.value.ticks(5))

const color = (p) => (p.clusterIndex == null ? seriesColor(0) : seriesColor(p.clusterIndex))
const shape = (p) => (p.clusterIndex == null ? 'circle' : shapeFor(p.clusterIndex))

const hover = ref(null)
</script>

<template>
  <div class="chart-wrapper">
    <div v-if="clusters.length" class="legend">
      <span v-for="(c, i) in clusters" :key="i" class="legend-item">
        <svg width="12" height="12" aria-hidden="true">
          <path :d="markerPath(shapeFor(i), 9)" transform="translate(6,6)" :fill="seriesColor(i)" />
        </svg>
        {{ c }}
      </span>
    </div>
    <svg :width="SIZE" :height="SIZE" role="img" aria-label="MDS plot of observations">
      <line
        v-for="t in xTicks"
        :key="`gx${t}`"
        :x1="x(t)"
        :x2="x(t)"
        :y1="M.top"
        :y2="SIZE - M.bottom"
        :stroke="INK.grid"
      />
      <line
        v-for="t in yTicks"
        :key="`gy${t}`"
        :x1="M.left"
        :x2="SIZE - M.right"
        :y1="y(t)"
        :y2="y(t)"
        :stroke="INK.grid"
      />
      <text v-for="t in xTicks" :key="`tx${t}`" :x="x(t)" :y="SIZE - M.bottom + 16" text-anchor="middle" class="tick">
        {{ formatNumber(t, 3) }}
      </text>
      <text
        v-for="t in yTicks"
        :key="`ty${t}`"
        :x="M.left - 8"
        :y="y(t)"
        text-anchor="end"
        dominant-baseline="middle"
        class="tick"
      >
        {{ formatNumber(t, 3) }}
      </text>
      <text :x="(M.left + SIZE - M.right) / 2" :y="SIZE - 6" text-anchor="middle" class="axis-label">{{ xLabel }}</text>
      <text
        :transform="`translate(14, ${(M.top + SIZE - M.bottom) / 2}) rotate(-90)`"
        text-anchor="middle"
        class="axis-label"
      >
        {{ yLabel }}
      </text>

      <g v-for="(p, i) in points" :key="i" :transform="`translate(${x(p.x)}, ${y(p.y)})`">
        <path
          :d="markerPath(shape(p), 9)"
          :fill="color(p)"
          :stroke="INK.surface"
          stroke-width="2"
          :opacity="hover && hover.index !== i ? 0.45 : 1"
        />
        <circle r="9" fill="transparent" @mouseenter="hover = { index: i, point: p, x: x(p.x), y: y(p.y) }" @mouseleave="hover = null" />
      </g>
    </svg>

    <div v-if="hover" class="chart-tooltip" :style="{ left: `${hover.x}px`, top: `${hover.y + (clusters.length ? 24 : 0)}px` }">
      <strong>{{ hover.point.label || 'Observation' }}</strong>
      <div v-if="hover.point.clusterIndex != null">{{ clusters[hover.point.clusterIndex] }}</div>
      <div>{{ xLabel }} {{ formatNumber(hover.point.x) }} · {{ yLabel }} {{ formatNumber(hover.point.y) }}</div>
      <div class="muted">{{ hover.point.recordCount }} record{{ hover.point.recordCount === 1 ? '' : 's' }}</div>
    </div>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.8rem;
  color: #52514e;
  margin-bottom: 4px;
  min-height: 20px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
