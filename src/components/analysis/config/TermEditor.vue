<script setup>
import { computed, ref } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { TERM_TYPE_LABELS, createEmptyBinning, sameTerm } from '@/composables/analysis/useAnalysisForm'
import {
  TRANSFORMATIONS,
  TRANSFORMATION_HINTS,
  allowedAggregations,
  allowedRepresentations,
  canBin,
  canOrderLevels,
  canTransform,
  defaultRepresentation,
  effectiveRepresentation,
  isConceptTerm,
  knownLevels,
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
const hasErrors = computed(() => messagesAt(path.value, { prefix: true }).length > 0)

const expanded = ref(hasErrors.value)

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
  }
}

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
  if (t.aggregation && t.aggregation !== 'NONE') parts.push(t.aggregation.toLowerCase())
  if (t.binning) parts.push(`${t.binning.labels.length} bins`)
  if (t.transformations.length) parts.push(t.transformations.join(' → ').toLowerCase())
  if (effectVisible.value) parts.push((t.effect ?? 'FIXED').toLowerCase())
  if (isResponse.value) parts.push('response')
  return parts.join(' · ')
})
</script>

<template>
  <div class="term box" :class="{ 'has-error': hasErrors }">
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
      <FieldErrors :path="path" />
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
          <template v-if="scaleType === 'ORDINAL'">Uses the scale's category rank.</template>
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
