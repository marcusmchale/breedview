<script setup>
import { computed, ref } from 'vue'
import { scaleBand, scaleLinear } from 'd3'
import { INK, SERIES, markerPath } from '@/components/analysis/charts/chartPalette'
import { formatInterval, formatNumber } from '@/components/analysis/results/format'

/**
 * Estimated means with confidence intervals, one small multiple per level of the
 * conditioning terms. Every panel shares the y scale so panels can be compared.
 */
const props = defineProps({
  // [{ label, points: [{ label, mean, lower, upper, standardError }] }]
  facets: { type: Array, required: true },
  yLabel: { type: String, default: 'Estimated mean' }
})

const MARGIN = { top: 28, right: 12, bottom: 72, left: 64 }
const HEIGHT = 260
const STEP = 44

const allPoints = computed(() => props.facets.flatMap((f) => f.points))

const yScale = computed(() => {
  const values = allPoints.value.flatMap((p) => [p.mean, p.lower, p.upper]).filter((v) => v != null && !Number.isNaN(v))
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.08
  return scaleLinear()
    .domain([lo - pad, hi + pad])
    .range([HEIGHT - MARGIN.bottom, MARGIN.top])
    .nice()
})

const ticks = computed(() => yScale.value.ticks(5))

const panels = computed(() => {
  let x = MARGIN.left
  return props.facets.map((facet) => {
    const width = Math.max(120, facet.points.length * STEP)
    const band = scaleBand()
      .domain(facet.points.map((_, i) => i))
      .range([0, width])
      .padding(0.3)
    const panel = { ...facet, x, width, band }
    x += width + 24
    return panel
  })
})

const totalWidth = computed(() => {
  const last = panels.value[panels.value.length - 1]
  return last ? last.x + last.width + MARGIN.right : 0
})

const rotateLabels = computed(() => allPoints.value.some((p) => String(p.label).length > 6))

const truncate = (text, n = 18) => (String(text).length > n ? `${String(text).slice(0, n - 1)}…` : String(text))

/* ---------- hover ---------- */

const hover = ref(null)
const show = (panel, point, i) => {
  hover.value = {
    x: panel.x + panel.band(i) + panel.band.bandwidth() / 2,
    y: yScale.value(point.mean),
    facet: panel.label,
    point
  }
}
</script>

<template>
  <div class="chart-wrapper">
    <svg :width="totalWidth" :height="HEIGHT" role="img" :aria-label="`${yLabel} with confidence intervals`">
      <!-- grid and y axis -->
      <g>
        <line
          v-for="t in ticks"
          :key="t"
          :x1="MARGIN.left"
          :x2="totalWidth - MARGIN.right"
          :y1="yScale(t)"
          :y2="yScale(t)"
          :stroke="INK.grid"
          stroke-width="1"
        />
        <text
          v-for="t in ticks"
          :key="`l${t}`"
          :x="MARGIN.left - 8"
          :y="yScale(t)"
          text-anchor="end"
          dominant-baseline="middle"
          class="tick"
        >
          {{ formatNumber(t, 3) }}
        </text>
        <text
          :transform="`translate(14, ${(MARGIN.top + HEIGHT - MARGIN.bottom) / 2}) rotate(-90)`"
          text-anchor="middle"
          class="axis-label"
        >
          {{ truncate(yLabel, 32) }}
        </text>
      </g>

      <g v-for="(panel, pi) in panels" :key="pi" :transform="`translate(${panel.x}, 0)`">
        <text v-if="panel.label" :x="panel.width / 2" :y="MARGIN.top - 12" text-anchor="middle" class="facet-label">
          {{ truncate(panel.label, 28) }}
        </text>
        <line
          :x1="0"
          :x2="panel.width"
          :y1="HEIGHT - MARGIN.bottom"
          :y2="HEIGHT - MARGIN.bottom"
          :stroke="INK.axis"
        />
        <g
          v-for="(p, i) in panel.points"
          :key="i"
          :transform="`translate(${panel.band(i) + panel.band.bandwidth() / 2}, 0)`"
        >
          <template v-if="p.mean != null">
            <line
              v-if="p.lower != null && p.upper != null"
              x1="0"
              x2="0"
              :y1="yScale(p.lower)"
              :y2="yScale(p.upper)"
              :stroke="SERIES[0]"
              stroke-width="2"
              stroke-linecap="round"
            />
            <line
              v-for="v in [p.lower, p.upper].filter((v) => v != null)"
              :key="v"
              x1="-5"
              x2="5"
              :y1="yScale(v)"
              :y2="yScale(v)"
              :stroke="SERIES[0]"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              :d="markerPath('circle', 9)"
              :transform="`translate(0, ${yScale(p.mean)})`"
              :fill="SERIES[0]"
              :stroke="INK.surface"
              stroke-width="2"
            />
          </template>
          <!-- hit target larger than the mark -->
          <rect
            :x="-panel.band.step() / 2"
            :y="MARGIN.top"
            :width="panel.band.step()"
            :height="HEIGHT - MARGIN.top - MARGIN.bottom"
            fill="transparent"
            @mouseenter="show(panel, p, i)"
            @mouseleave="hover = null"
          />
          <text
            :transform="`translate(0, ${HEIGHT - MARGIN.bottom + 12})${rotateLabels ? ' rotate(-35)' : ''}`"
            :text-anchor="rotateLabels ? 'end' : 'middle'"
            dominant-baseline="hanging"
            class="tick"
          >
            {{ truncate(p.label) }}
            <title>{{ p.label }}</title>
          </text>
        </g>
      </g>
    </svg>

    <div v-if="hover" class="chart-tooltip" :style="{ left: `${hover.x}px`, top: `${hover.y}px` }">
      <strong>{{ hover.point.label }}</strong>
      <div v-if="hover.facet" class="muted">{{ hover.facet }}</div>
      <div>Mean {{ formatNumber(hover.point.mean) }}</div>
      <div>CI {{ formatInterval(hover.point.lower, hover.point.upper) }}</div>
      <div v-if="hover.point.standardError != null">SE {{ formatNumber(hover.point.standardError) }}</div>
    </div>
  </div>
</template>
