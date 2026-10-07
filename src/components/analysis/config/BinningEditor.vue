<script setup>
import { computed, ref } from 'vue'
import { useDatetimeUtils } from '@/composables/parsers/partialDatetime'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

/**
 * Edits a binning: N boundaries, N + 1 labels and the boundary side.
 * Labels are kept in step with boundaries as they are added and removed.
 */
const props = defineProps({
  modelValue: { type: Object, required: true },
  // 'date' for record times and date concepts, 'number' for numerical concepts
  valueKind: { type: String, default: 'date' },
  // records with start/end, for date suggestions
  records: { type: Array, default: () => [] },
  // numeric values, for quantile suggestions
  values: { type: Array, default: () => [] },
  path: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const { suggestBoundaries, validatePartialDatetime } = useDatetimeUtils()

const boundaries = computed(() => props.modelValue.boundaries ?? [])
const labels = computed(() => props.modelValue.labels ?? [])

const update = (patch) => emit('update:modelValue', { ...props.modelValue, ...patch })

const generateLabels = (bounds) => {
  if (bounds.length === 0) return ['All']
  return [
    `< ${bounds[0]}`,
    ...bounds.slice(1).map((b, i) => `${bounds[i]} – ${b}`),
    `≥ ${bounds[bounds.length - 1]}`
  ]
}

const setBoundary = (index, value) => {
  const next = [...boundaries.value]
  next[index] = value
  update({ boundaries: next })
}

const addBoundary = () => {
  const nextLabels = [...labels.value]
  nextLabels.splice(boundaries.value.length + 1, 0, '')
  update({ boundaries: [...boundaries.value, ''], labels: nextLabels })
}

const removeBoundary = (index) => {
  const next = boundaries.value.filter((_, i) => i !== index)
  const nextLabels = labels.value.filter((_, i) => i !== index + 1)
  update({ boundaries: next, labels: nextLabels.length ? nextLabels : [''] })
}

const setLabel = (index, value) => {
  const next = [...labels.value]
  next[index] = value
  update({ labels: next })
}

const autoLabel = () => update({ labels: generateLabels(boundaries.value) })

const invalidBoundary = (value) => {
  if (value === '' || value == null) return true
  if (props.valueKind === 'number') return Number.isNaN(Number(value))
  return !validatePartialDatetime(value)
}

/* ---------- suggestions ---------- */

const strategy = ref('year')
const binCount = ref(4)

// Expand partial dates so boundaries are unambiguous instants
const expandDate = (value) => {
  if (/^\d{4}$/.test(value)) return `${value}-01-01`
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`
  return value
}

const canSuggest = computed(() =>
  props.valueKind === 'number' ? props.values.length > 1 : props.records.some((r) => r.start || r.end)
)

const suggest = () => {
  let bounds = []
  if (props.valueKind === 'number') {
    const sorted = [...props.values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
    for (let i = 1; i < binCount.value; i++) {
      const v = sorted[Math.floor((i / binCount.value) * (sorted.length - 1))]
      bounds.push(String(Number(v.toPrecision(4))))
    }
    bounds = [...new Set(bounds)]
  } else {
    bounds = suggestBoundaries(props.records, strategy.value, binCount.value).map(expandDate)
  }
  update({ boundaries: bounds, labels: generateLabels(bounds) })
}
</script>

<template>
  <div class="binning-editor">
    <div class="field-row">
      <div class="field">
        <label>Value equal to a boundary goes to</label>
        <select :value="modelValue.boundary" @change="update({ boundary: $event.target.value })">
          <option value="LEFT">Lower bin (LEFT)</option>
          <option value="RIGHT">Upper bin (RIGHT)</option>
        </select>
      </div>
      <div v-if="canSuggest" class="field suggest">
        <label>Suggest boundaries</label>
        <div class="suggest-controls">
          <select v-if="valueKind !== 'number'" v-model="strategy">
            <option value="year">By year</option>
            <option value="month">By month</option>
            <option value="quartile">By quantile</option>
          </select>
          <input
            v-if="valueKind === 'number' || strategy === 'quartile'"
            v-model.number="binCount"
            type="number"
            min="2"
            max="20"
            title="Number of bins"
          />
          <button type="button" class="btn btn-sm btn-outline" @click="suggest">Suggest</button>
        </div>
      </div>
    </div>

    <table class="bins">
      <thead>
        <tr>
          <th>Bin label</th>
          <th>Upper boundary</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(label, i) in labels" :key="i">
          <td>
            <input type="text" :value="label" placeholder="Label" @input="setLabel(i, $event.target.value)" />
          </td>
          <td>
            <input
              v-if="i < boundaries.length"
              type="text"
              :class="{ invalid: invalidBoundary(boundaries[i]) }"
              :value="boundaries[i]"
              :placeholder="valueKind === 'number' ? 'e.g. 10' : 'e.g. 2024-06-01'"
              @input="setBoundary(i, $event.target.value)"
            />
            <span v-else class="muted">—</span>
          </td>
          <td>
            <button v-if="i < boundaries.length" type="button" class="btn-link danger" @click="removeBoundary(i)">
              Remove
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="actions">
      <button type="button" class="btn-link" @click="addBoundary">+ Add boundary</button>
      <button type="button" class="btn-link" @click="autoLabel">Generate labels</button>
    </div>
    <p class="hint">
      {{ boundaries.length }} boundar{{ boundaries.length === 1 ? 'y' : 'ies' }} make {{ boundaries.length + 1 }} bins.
      <template v-if="valueKind !== 'number'">Use ISO 8601 dates, e.g. 2024 or 2024-06-01T12:00.</template>
    </p>
    <FieldErrors v-if="path" :path="path" prefix />
  </div>
</template>

<style scoped>
.bins {
  border-collapse: collapse;
  margin: 4px 0;
}

.bins th {
  font-size: 0.75rem;
  text-align: left;
  color: #6b7280;
  font-weight: 600;
  padding: 2px 6px;
}

.bins td {
  padding: 2px 6px;
}

.bins input.invalid {
  border-color: #f59e0b;
}

.actions {
  display: flex;
  gap: 16px;
}

.suggest-controls {
  display: flex;
  gap: 6px;
  align-items: center;
}

.suggest-controls input {
  width: 60px;
}
</style>
