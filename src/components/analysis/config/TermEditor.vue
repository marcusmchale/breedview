<script setup>
import { computed, ref, watch } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { TERM_TYPE_LABELS, createEmptyBinning, sameTerm } from '@/composables/analysis/useAnalysisForm'
import {
  REPLICATE_WINDOW_PRESETS,
  REPLICATE_WINDOW_UNITS,
  TRANSFORMATIONS,
  TRANSFORMATION_HINTS,
  allowedAggregations,
  allowedReplicateAggregations,
  allowedRepresentations,
  canBin,
  canOrderLevels,
  canTransform,
  defaultRepresentation,
  effectiveRepresentation,
  isConceptTerm,
  knownLevels,
  parseReplicateWindow,
  replicateWindowLabel,
  showsEffect
} from '@/composables/analysis/useTermRules'
import { termLabel } from '@/composables/analysis/useAnalysisNames'
import BinningEditor from '@/components/analysis/config/BinningEditor.vue'
import TermChecklist from '@/components/analysis/config/TermChecklist.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

const props = defineProps({
  index: { type: Number, required: true }
})

const emit = defineEmits(['remove'])

const { form, data, messagesAt } = useAnalysisEditor()

const term = computed(() => form.terms[props.index])
const path = computed(() => `terms.${props.index}`)
const concept = computed(() => (isConceptTerm(term.value) ? data.conceptsById[term.value.reference.conceptId] : null))
const scaleType = computed(() => concept.value?.scaleType ?? null)

const isResponse = computed(() => form.analysisType === 'ANOVA' && sameTerm(term.value.reference, form.response))
const representation = computed(() => effectiveRepresentation(term.value, scaleType.value))
const termMessages = computed(() => messagesAt(path.value, { prefix: true }))
// an error, or only warnings, about the term, for its border
const severity = computed(() => {
  if (termMessages.value.length === 0) return null
  return termMessages.value.some((m) => (m.severity ?? 'error') === 'error') ? 'error' : 'warning'
})

const expanded = ref(termMessages.value.length > 0)

/* ---------- representation and aggregation ---------- */

const representations = computed(() => allowedRepresentations(term.value, scaleType.value))
const aggregations = computed(() => allowedAggregations(term.value, scaleType.value))

const setAggregation = (value) => {
  const t = term.value
  t.aggregation = value || null
  if (value === 'COUNT') {
    t.binning = null
    t.representation = null
    t.levelOrder = null
    t.replicateAggregation = null
  }
}

/* ---------- replicate aggregation ---------- */

const replicateAggregations = computed(() => allowedReplicateAggregations(term.value, scaleType.value))

// Shown where the selected datasets' studies have a WITHIN_UNIT grouping, when already set (e.g. a loaded analysis),
// or when a message (e.g. DUPLICATE_OBSERVATION of replicates) points to it
const replicatesVisible = computed(
  () =>
    replicateAggregations.value.length > 0 &&
    (data.hasWithinUnitGroupings ||
      !!term.value.replicateAggregation ||
      messagesAt(`${path.value}.replicateAggregation`, { prefix: true }).length > 0)
)

const setReplicateAggregation = (value) => {
  const t = term.value
  t.replicateAggregation = value ? { aggregation: value, window: t.replicateAggregation?.window ?? null } : null
}

const isPresetWindow = (window) => REPLICATE_WINDOW_PRESETS.some((p) => p.value === (window ?? ''))
const customWindow = ref(!isPresetWindow(term.value.replicateAggregation?.window))
const customAmount = ref(parseReplicateWindow(term.value.replicateAggregation?.window)?.n ?? 10)
const customUnit = ref(parseReplicateWindow(term.value.replicateAggregation?.window)?.unit ?? 'M')

watch(
  () => term.value.replicateAggregation?.window,
  (window) => {
    if (!isPresetWindow(window)) customWindow.value = true
    const parsed = parseReplicateWindow(window)
    if (parsed) {
      customAmount.value = parsed.n
      customUnit.value = parsed.unit
    }
  }
)

const setWindowChoice = (value) => {
  if (value === 'custom') {
    customWindow.value = true
    applyCustomWindow()
  } else {
    customWindow.value = false
    term.value.replicateAggregation.window = value || null
  }
}

const applyCustomWindow = () => {
  const n = Math.floor(Number(customAmount.value))
  const unit = REPLICATE_WINDOW_UNITS.find((u) => u.value === customUnit.value)
  // A window must be longer than zero
  term.value.replicateAggregation.window = n > 0 && unit ? unit.toIso(n) : null
}

// With a variable term, factor records describe the observations rather than forming them
const factorDescribesVariables = computed(
  () =>
    concept.value?.kind === 'Factor' &&
    form.terms.some((t) => isConceptTerm(t) && data.conceptsById[t.reference.conceptId]?.kind === 'Variable')
)

/* ---------- binning ---------- */

const binnable = computed(() => canBin(term.value, scaleType.value))
const binValueKind = computed(() => (scaleType.value === 'NUMERICAL' ? 'number' : 'date'))

// The values of the concept's datasets at each percentile stand in for the records themselves
const conceptValues = computed(() => (concept.value ? data.valueSamples(concept.value.datasetIds) : []))
const numericValues = computed(() => conceptValues.value.map(Number).filter(Number.isFinite))
// For date concepts the record value is the date to bin
const dateValues = computed(() => conceptValues.value.map((value) => ({ start: value, end: null })))

const toggleBinning = (enabled) => {
  const t = term.value
  t.binning = enabled ? createEmptyBinning() : null
  t.representation = null
  t.levelOrder = null
  t.transformations = []
}

/* ---------- level order ---------- */

const orderable = computed(() => canOrderLevels(term.value, scaleType.value))
const levels = computed(() => knownLevels(term.value, concept.value, form.grouping))
const levelText = ref((term.value.levelOrder ?? []).join(', '))

const enableLevelOrder = () => {
  term.value.levelOrder = levels.value.length ? [...levels.value] : []
  levelText.value = term.value.levelOrder.join(', ')
}

const moveLevel = (i, delta) => {
  const order = [...term.value.levelOrder]
  const j = i + delta
  if (j < 0 || j >= order.length) return
  ;[order[i], order[j]] = [order[j], order[i]]
  term.value.levelOrder = order
}

const removeLevel = (i) => {
  term.value.levelOrder = term.value.levelOrder.filter((_, k) => k !== i)
}

const missingLevels = computed(() => levels.value.filter((l) => !(term.value.levelOrder ?? []).includes(l)))

const addLevel = (level) => {
  term.value.levelOrder = [...term.value.levelOrder, level]
}

const setLevelText = (value) => {
  levelText.value = value
  term.value.levelOrder = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/* ---------- transformations ---------- */

const transformable = computed(() => canTransform(term.value, scaleType.value))

const addTransformation = (value) => {
  if (value) term.value.transformations = [...term.value.transformations, value]
}

const removeTransformation = (i) => {
  term.value.transformations = term.value.transformations.filter((_, k) => k !== i)
}

/* ---------- effects ---------- */

const effectVisible = computed(() => showsEffect(form.analysisType) && !isResponse.value)

const slopeOptions = computed(() =>
  form.terms.filter((t) => !sameTerm(t.reference, term.value.reference) && !sameTerm(t.reference, form.response))
)

const setEffect = (value) => {
  term.value.effect = value || null
  if (value !== 'RANDOM') term.value.randomSlopeTerms = []
}

/* ---------- summary ---------- */

const summary = computed(() => {
  const t = term.value
  const parts = [representation.value.toLowerCase()]
  const ra = t.replicateAggregation
  if (ra?.aggregation) {
    const window = ra.window ? ` ${replicateWindowLabel(ra.window)}` : ''
    parts.push(`${ra.aggregation.toLowerCase()} of replicates${window}`)
  }
  if (t.aggregation && t.aggregation !== 'NONE') parts.push(`${ra?.aggregation ? 'then ' : ''}${t.aggregation.toLowerCase()}`)
  if (t.binning) parts.push(`${t.binning.labels.length} bins`)
  if (t.transformations.length) parts.push(t.transformations.join(' → ').toLowerCase())
  if (effectVisible.value) parts.push((t.effect ?? 'FIXED').toLowerCase())
  if (isResponse.value) parts.push('response')
  return parts.join(' · ')
})
</script>

<template>
  <div class="term box" :class="{ 'has-error': severity === 'error', 'has-warning': severity === 'warning' }">
    <div class="term-header">
      <button type="button" class="expand" :title="expanded ? 'Collapse' : 'Expand'" @click="expanded = !expanded">
        {{ expanded ? '▾' : '▸' }}
      </button>
      <span class="term-type">{{ TERM_TYPE_LABELS[term.reference.type] }}</span>
      <strong>{{ termLabel(term.reference) }}</strong>
      <span v-if="concept" class="muted">{{ concept.scaleType?.toLowerCase() }}</span>
      <span class="summary">{{ summary }}</span>
      <button type="button" class="btn-link danger" @click="emit('remove')">Remove</button>
    </div>
    <FieldErrors v-if="!expanded" :path="path" prefix />

    <div v-if="expanded" class="term-body">
      <!-- the term's messages, and those about fields it doesn't show -->
      <FieldErrors :path="path" fallback />
      <FieldErrors :path="`${path}.reference`" prefix />

      <div class="field-row">
        <div class="field">
          <label>Representation</label>
          <select
            :value="term.representation ?? ''"
            :disabled="representations.length < 2"
            @change="term.representation = $event.target.value || null"
          >
            <option value="">Default ({{ defaultRepresentation(term, scaleType).toLowerCase() }})</option>
            <option v-for="r in representations" :key="r" :value="r">{{ r.toLowerCase() }}</option>
          </select>
          <FieldErrors :path="`${path}.representation`" />
        </div>

        <div v-if="aggregations.length" class="field">
          <label>Aggregation</label>
          <select :value="term.aggregation ?? ''" @change="setAggregation($event.target.value)">
            <option value="">None (one value per observation)</option>
            <option v-for="a in aggregations.filter((a) => a !== 'NONE')" :key="a" :value="a">{{ a.toLowerCase() }}</option>
          </select>
          <p v-if="term.aggregation === 'COUNT'" class="hint">Count is always continuous.</p>
          <p v-if="term.aggregation === 'MODE'" class="hint">Ties are broken by the lowest value.</p>
          <FieldErrors :path="`${path}.aggregation`" />
        </div>

        <div v-if="replicatesVisible" :id="`${path}.replicateAggregation`" class="field">
          <label>Replicates</label>
          <select
            :value="term.replicateAggregation?.aggregation ?? ''"
            @change="setReplicateAggregation($event.target.value)"
          >
            <option value="">None (each replicate is a value)</option>
            <option v-for="a in replicateAggregations" :key="a" :value="a">{{ a.toLowerCase() }}</option>
          </select>
          <template v-if="term.replicateAggregation">
            <select
              class="window-select"
              :value="customWindow ? 'custom' : term.replicateAggregation.window ?? ''"
              @change="setWindowChoice($event.target.value)"
            >
              <option v-for="p in REPLICATE_WINDOW_PRESETS" :key="p.value" :value="p.value">{{ p.label }}</option>
              <option value="custom">Custom window…</option>
            </select>
            <div v-if="customWindow" class="window-custom">
              <span>Within</span>
              <input v-model.number="customAmount" type="number" min="1" step="1" @change="applyCustomWindow" />
              <select v-model="customUnit" @change="applyCustomWindow">
                <option v-for="u in REPLICATE_WINDOW_UNITS" :key="u.value" :value="u.value">{{ u.label }}</option>
              </select>
            </div>
          </template>
          <p class="hint">
            Combines the replicate readings of each unit (codes of within-unit groupings) into one value before the
            aggregation, so units and dates count once however many replicates they have.
            <template v-if="term.replicateAggregation?.window">
              A reading starts at its first record and takes in records up to the window later; time bins still split
              readings.
            </template>
          </p>
          <FieldErrors :path="`${path}.replicateAggregation`" prefix />
        </div>

        <div v-if="effectVisible" class="field">
          <label>Effect</label>
          <select :value="term.effect ?? ''" @change="setEffect($event.target.value)">
            <option value="">Fixed (default)</option>
            <option value="FIXED">Fixed</option>
            <option value="RANDOM">Random</option>
          </select>
          <p v-if="term.effect === 'RANDOM'" class="hint">
            Random terms must be categorical and can't be in interactions. For nested random effects, use a unit or
            record group dimension.
          </p>
          <FieldErrors :path="`${path}.effect`" />
        </div>
      </div>

      <p v-if="factorDescribesVariables" class="hint">
        Factors apply to the units they were recorded on and their descendants, and, without a date, to every time bin.
      </p>

      <div v-if="effectVisible && term.effect === 'RANDOM'" class="field">
        <span class="field-label">Random slopes</span>
        <TermChecklist v-model="term.randomSlopeTerms" :options="slopeOptions" />
        <FieldErrors :path="`${path}.randomSlopeTerms`" prefix />
      </div>

      <div v-if="binnable" class="field">
        <label class="inline">
          <input type="checkbox" :checked="!!term.binning" @change="toggleBinning($event.target.checked)" />
          Bin values
        </label>
        <BinningEditor
          v-if="term.binning"
          :model-value="term.binning"
          :value-kind="binValueKind"
          :values="numericValues"
          :records="dateValues"
          :path="`${path}.binning`"
          @update:model-value="term.binning = $event"
        />
      </div>

      <div v-if="orderable" class="field">
        <span class="field-label">Level order</span>
        <p v-if="term.levelOrder == null" class="hint">
          <template v-if="scaleType === 'ORDINAL'">Uses the order of the scale's categories.</template>
          <template v-else>Levels are ordered by the server.</template>
          <button type="button" class="btn-link" @click="enableLevelOrder">Set an explicit order</button>
        </p>
        <template v-else>
          <template v-if="levels.length">
            <ol class="level-list">
              <li v-for="(level, i) in term.levelOrder" :key="level">
                <span>{{ level }}</span>
                <button type="button" class="btn-link" :disabled="i === 0" @click="moveLevel(i, -1)">↑</button>
                <button type="button" class="btn-link" :disabled="i === term.levelOrder.length - 1" @click="moveLevel(i, 1)">↓</button>
                <button type="button" class="btn-link danger" @click="removeLevel(i)">×</button>
              </li>
            </ol>
            <div v-if="missingLevels.length" class="chip-list">
              <span class="hint">Not included:</span>
              <button v-for="l in missingLevels" :key="l" type="button" class="chip" @click="addLevel(l)">+ {{ l }}</button>
            </div>
          </template>
          <input
            v-else
            type="text"
            :value="levelText"
            placeholder="Levels in order, separated by commas"
            @change="setLevelText($event.target.value)"
          />
          <p class="hint">
            <template v-if="isConceptTerm(term)">Values not in the list become missing.</template>
            <button type="button" class="btn-link" @click="term.levelOrder = null">Use default order</button>
          </p>
        </template>
        <FieldErrors :path="`${path}.levelOrder`" prefix />
      </div>

      <div v-if="transformable" class="field">
        <span class="field-label">Transformations (applied in order, after aggregation)</span>
        <div class="chip-list">
          <span v-for="(tr, i) in term.transformations" :key="i" class="chip" :title="TRANSFORMATION_HINTS[tr]">
            {{ i + 1 }}. {{ tr.toLowerCase() }}
            <button type="button" class="chip-remove" @click="removeTransformation(i)">×</button>
          </span>
          <select value="" @change="addTransformation($event.target.value); $event.target.value = ''">
            <option value="">+ Add</option>
            <option v-for="tr in TRANSFORMATIONS" :key="tr" :value="tr">{{ tr.toLowerCase() }} — {{ TRANSFORMATION_HINTS[tr] }}</option>
          </select>
        </div>
        <FieldErrors :path="`${path}.transformations`" prefix />
      </div>
    </div>
  </div>
</template>

<style scoped>
.term {
  background: white;
}

.term-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.expand {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.9rem;
  width: 20px;
}

.term-type {
  font-size: 0.7rem;
  text-transform: uppercase;
  background: #eef2ff;
  color: #3730a3;
  padding: 1px 6px;
  border-radius: 4px;
}

.summary {
  color: #6b7280;
  font-size: 0.8rem;
  margin-left: auto;
}

.term-body {
  margin-top: 12px;
  padding-left: 28px;
}

.inline {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.85rem;
}

.window-select {
  margin-top: 4px;
}

.window-custom {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 0.85rem;
}

.window-custom input {
  width: 70px;
}

.level-list {
  margin: 4px 0;
  padding-left: 20px;
  font-size: 0.85rem;
}

.level-list li span {
  display: inline-block;
  min-width: 120px;
}

.level-list .btn-link {
  margin-left: 6px;
}
</style>
