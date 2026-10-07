<script setup>
import { computed, ref } from 'vue'
import { INK, divergingColor, divergingInk } from '@/components/analysis/charts/chartPalette'
import { formatNumber } from '@/components/analysis/results/format'

/** Correlation matrix as a heatmap on a diverging scale from −1 to 1; missing values are hatched. */
const props = defineProps({
  labels: { type: Array, required: true },
  // values[i][j], null where fewer than 3 observations pair up
  values: { type: Array, required: true }
})

const CELL = 56
const GAP = 2
const LABEL_WIDTH = 140
const TOP = 110

const size = computed(() => props.labels.length * CELL)
const truncate = (text, n = 18) => (String(text).length > n ? `${String(text).slice(0, n - 1)}…` : String(text))

const LEGEND_STOPS = [-1, -0.5, 0, 0.5, 1]

const hover = ref(null)
</script>

<template>
  <div class="chart-wrapper">
    <svg :width="LABEL_WIDTH + size + 16" :height="TOP + size + 56" role="img" aria-label="Correlation matrix">
      <defs>
        <pattern id="corr-missing" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" :fill="INK.surface" />
          <line x1="0" y1="0" x2="0" y2="6" :stroke="INK.axis" stroke-width="2" />
        </pattern>
      </defs>

      <g :transform="`translate(${LABEL_WIDTH}, ${TOP})`">
        <text
          v-for="(label, j) in labels"
          :key="`c${j}`"
          :transform="`translate(${j * CELL + CELL / 2}, -8) rotate(-45)`"
          class="tick"
        >
          {{ truncate(label) }}
          <title>{{ label }}</title>
        </text>
        <text
          v-for="(label, i) in labels"
          :key="`r${i}`"
          :x="-8"
          :y="i * CELL + CELL / 2"
          text-anchor="end"
          dominant-baseline="middle"
          class="tick"
        >
          {{ truncate(label) }}
          <title>{{ label }}</title>
        </text>

        <g v-for="(row, i) in values" :key="i">
          <g
            v-for="(v, j) in row"
            :key="j"
            :transform="`translate(${j * CELL}, ${i * CELL})`"
            @mouseenter="hover = { i, j, v, x: LABEL_WIDTH + j * CELL + CELL / 2, y: TOP + i * CELL }"
            @mouseleave="hover = null"
          >
            <rect
              :x="GAP / 2"
              :y="GAP / 2"
              :width="CELL - GAP"
              :height="CELL - GAP"
              rx="4"
              :fill="v == null ? 'url(#corr-missing)' : divergingColor(v)"
            />
            <text
              :x="CELL / 2"
              :y="CELL / 2"
              text-anchor="middle"
              dominant-baseline="middle"
              class="cell-value"
              :fill="v == null ? INK.secondary : divergingInk(v)"
            >
              {{ v == null ? 'n<3' : formatNumber(v, 2) }}
            </text>
          </g>
        </g>
      </g>

      <!-- legend -->
      <g :transform="`translate(${LABEL_WIDTH}, ${TOP + size + 20})`">
        <rect
          v-for="(s, k) in 40"
          :key="k"
          :x="(k * Math.min(size, 240)) / 40"
          y="0"
          :width="Math.min(size, 240) / 40 + 0.5"
          height="10"
          :fill="divergingColor(-1 + (2 * k) / 39)"
        />
        <text
          v-for="s in LEGEND_STOPS"
          :key="s"
          :x="((s + 1) / 2) * Math.min(size, 240)"
          y="24"
          text-anchor="middle"
          class="tick"
        >
          {{ s }}
        </text>
      </g>
    </svg>

    <div v-if="hover" class="chart-tooltip" :style="{ left: `${hover.x}px`, top: `${hover.y}px` }">
      <strong>{{ labels[hover.i] }} × {{ labels[hover.j] }}</strong>
      <div>{{ hover.v == null ? 'Fewer than 3 paired observations' : `r = ${formatNumber(hover.v, 3)}` }}</div>
    </div>
  </div>
</template>

<style scoped>
.cell-value {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
</style>
