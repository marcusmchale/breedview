<script setup>
import { itemKey, useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { createEmptyBinning, removeTermReferences } from '@/composables/analysis/useAnalysisForm'
import BinningEditor from '@/components/analysis/config/BinningEditor.vue'
import GermplasmPicker from '@/components/analysis/config/GermplasmPicker.vue'
import PositionGroupingEditor from '@/components/analysis/config/PositionGroupingEditor.vue'
import RecordGroupDimensionEditor from '@/components/analysis/config/RecordGroupDimensionEditor.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'
import SubjectChips from '@/components/analysis/config/SubjectChips.vue'

const { form, data } = useAnalysisEditor()

// The dimensions, in the order the editor shows them, each saying what it does to observations: gives each unit one
// level, or splits a unit's records (breedgraph docs/analysis.md §2). Record group dimensions come last.
const DIMENSIONS = {
  germplasm: {
    label: 'Germplasm',
    termTypes: () => [{ type: 'GERMPLASM' }],
    description:
      "Gives each unit one level: its germplasm, its own or inherited, or the closest selected germplasm above it. " +
      'Units of the same germplasm stay separate observations, its replicates.',
    create: () => ({ germplasmIds: [] })
  },
  position: {
    label: 'Position',
    // the location term and a term for each axis
    termTypes: (position) => [
      { type: 'LOCATION' },
      ...(position?.axes ?? []).map((axis) => ({ type: 'LAYOUT_AXIS', layoutAxis: axis }))
    ],
    description:
      'Gives each unit one level, where it was: at locations of chosen types, and by layout axes. A unit that moved ' +
      'has its records split by the position each falls in.',
    create: () => ({ locationTypeIds: [], subjectIds: [], axes: [], time: null })
  },
  time: {
    label: 'Time',
    termTypes: () => [{ type: 'TIME' }],
    description: "Splits a unit's records into bins by their start or end time, e.g. to separate repeated measurements.",
    create: () => ({ assignment: 'MIDPOINT', binning: createEmptyBinning() })
  }
}

// The observation unit isn't a dimension: it has no levels or term, and merges units, rolling each up into its nearest
// unit of a chosen subject (breedgraph docs/analysis.md §3)
const setObservationUnit = (bySubject) => {
  form.grouping.unit = bySubject ? { subjectIds: [] } : null
}

const toggle = (key, enabled) => {
  if (enabled) {
    form.grouping[key] = DIMENSIONS[key].create()
  } else {
    const references = DIMENSIONS[key].termTypes(form.grouping[key])
    form.grouping[key] = null
    references.forEach((ref) => removeTermReferences(form, ref))
  }
}

const addDimension = () => {
  const names = new Set(form.grouping.recordGroups.map((d) => d.name))
  let n = form.grouping.recordGroups.length + 1
  while (names.has(`Record group ${n}`)) n++
  form.grouping.recordGroups.push({ name: `Record group ${n}`, groupingIds: [], subjectIds: [], levels: [] })
}

const removeDimension = (i) => {
  const [dim] = form.grouping.recordGroups.splice(i, 1)
  removeTermReferences(form, { type: 'RECORD_GROUP', recordGroupDimension: dim.name })
}
</script>

<template>
  <div>
    <p class="hint intro">
      An observation is a unit at one level of each configured dimension, and a concept's values are taken once per
      observation. Records that can't be assigned are dropped and reported.
    </p>

    <h4 class="subsection-title">Observation unit</h4>
    <div class="box observation-unit" :class="{ active: form.grouping.unit }">
      <label class="toggle">
        <input type="radio" name="observationUnit" :checked="!form.grouping.unit" @change="setObservationUnit(false)" />
        Each record's unit
      </label>
      <label class="toggle">
        <input type="radio" name="observationUnit" :checked="!!form.grouping.unit" @change="setObservationUnit(true)" />
        The nearest unit of one of these subjects
      </label>
      <p class="hint">
        Merges units: each record's unit is rolled up into its nearest unit of a chosen subject, the unit itself or an
        ancestor, e.g. the trees of a plot into one observation of the plot, their values aggregated. A unit with none,
        or whose nearest lie on separate lineages (a sample from the trees of two plots), is unassigned. The units
        recorded are still reported in results.
      </p>
      <template v-if="form.grouping.unit">
        <SubjectChips v-model="form.grouping.unit.subjectIds" />
        <FieldErrors path="grouping.unit" prefix />
      </template>
    </div>

    <h4 class="subsection-title">Dimensions</h4>
    <p class="hint">
      Germplasm and units of a subject give each unit one level, so units of the same germplasm stay separate
      observations: its replicates. Time bins, record group codes and a unit's moves can split a unit's records into
      several observations, even when no term uses them.
    </p>

    <div v-for="(dim, key) in DIMENSIONS" :key="key" class="box" :class="{ active: form.grouping[key] }">
      <div class="box-header">
        <label class="toggle">
          <input type="checkbox" :checked="!!form.grouping[key]" @change="toggle(key, $event.target.checked)" />
          <h4>{{ dim.label }}</h4>
        </label>
      </div>
      <p class="hint">{{ dim.description }}</p>

      <template v-if="key === 'time' && form.grouping.time">
        <div class="field-row">
          <div class="field">
            <label>Assign records by</label>
            <select v-model="form.grouping.time.assignment">
              <option value="START">Start time (or end if missing)</option>
              <option value="END">End time (or start if missing)</option>
              <option value="MIDPOINT">Midpoint (or whichever time is present)</option>
            </select>
          </div>
        </div>
        <BinningEditor
          :model-value="form.grouping.time.binning"
          value-kind="date"
          :records="data.timeSamples"
          path="grouping.time.binning"
          @update:model-value="form.grouping.time.binning = $event"
        />
        <p class="hint">
          A time stands for its whole period: by end, a record ending 2021-05-03 counts at the end of that day, and by
          midpoint a record dated 2021 counts in July. Records with no time are unassigned.
        </p>
      </template>

      <template v-if="key === 'germplasm' && form.grouping.germplasm">
        <GermplasmPicker v-model="form.grouping.germplasm.germplasmIds" />
        <p v-if="!form.grouping.germplasm.germplasmIds.length" class="hint">
          None selected: each unit's own germplasm is a level. Select germplasm to group the germplasm below it with it.
        </p>
        <p v-else class="hint">
          A germplasm whose selected ancestors lie on separate lineages (e.g. a cross of two selected parents) is
          unassigned.
        </p>
        <FieldErrors path="grouping.germplasm" prefix />
      </template>

      <PositionGroupingEditor v-if="key === 'position' && form.grouping.position" />

      <FieldErrors v-if="form.grouping[key] && key !== 'germplasm'" :path="`grouping.${key}`" fallback />
    </div>

    <h4 class="subsection-title">Record group dimensions</h4>
    <p class="hint">
      Group records by study record groupings such as block, batch or replicate, whose codes can split a unit's records
      (replicate codes always do), or by units of a subject such as the plots of a field, which give each unit one level.
      Terms refer to a dimension by its name.
    </p>
    <RecordGroupDimensionEditor
      v-for="(dim, i) in form.grouping.recordGroups"
      :key="itemKey(dim)"
      :index="i"
      @remove="removeDimension(i)"
    />
    <button type="button" class="btn btn-sm btn-outline" @click="addDimension">+ Add record group dimension</button>
    <FieldErrors path="grouping.recordGroups" />
  </div>
</template>

<style scoped>
.intro {
  margin-bottom: 12px;
}

.box.active {
  background: white;
  border-color: #bfdbfe;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.observation-unit .toggle {
  margin-bottom: 4px;
}
</style>
