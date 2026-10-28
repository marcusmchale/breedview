<script setup>
import { itemKey, useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { createEmptyBinning, removeTermReferences } from '@/composables/analysis/useAnalysisForm'
import BinningEditor from '@/components/analysis/config/BinningEditor.vue'
import GermplasmPicker from '@/components/analysis/config/GermplasmPicker.vue'
import UnitPicker from '@/components/analysis/config/UnitPicker.vue'
import PositionGroupingEditor from '@/components/analysis/config/PositionGroupingEditor.vue'
import RecordGroupDimensionEditor from '@/components/analysis/config/RecordGroupDimensionEditor.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

const { form, data } = useAnalysisEditor()

const DIMENSIONS = {
  time: {
    label: 'Time',
    termTypes: () => [{ type: 'TIME' }],
    description: 'Bins records by their start/end time, e.g. to separate repeated measurements.',
    create: () => ({ assignment: 'MIDPOINT', binning: createEmptyBinning() })
  },
  germplasm: {
    label: 'Germplasm',
    termTypes: () => [{ type: 'GERMPLASM' }],
    description: "Groups records by each unit's germplasm, or by the closest selected germplasm above it.",
    create: () => ({ germplasmIds: [] })
  },
  unit: {
    label: 'Parent unit',
    termTypes: () => [],
    description: 'Replaces each base unit with its closest selected parent unit, e.g. plants to plots.',
    create: () => ({ unitIds: [] })
  },
  position: {
    label: 'Position',
    // the location term and a term for each axis
    termTypes: (position) => [
      { type: 'LOCATION' },
      ...(position?.axes ?? []).map((axis) => ({ type: 'LAYOUT_AXIS', layoutAxis: axis }))
    ],
    description: 'Groups records by where their units were: at locations of chosen types, and by layout axes.',
    create: () => ({ locationTypeIds: [], subjectIds: [], axes: [], time: null })
  }
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
      An observation is a unit together with the level of every configured dimension. Values of a concept are taken
      once per observation, so configuring a dimension changes what counts as one observation even if no term uses it.
      Records that can't be assigned to a configured dimension are dropped and reported.
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

      <template v-if="key === 'unit' && form.grouping.unit">
        <UnitPicker v-model="form.grouping.unit.unitIds" :block-ids="data.blockIds" />
        <p class="hint">Base units are still reported in results.</p>
        <FieldErrors path="grouping.unit" prefix />
      </template>

      <PositionGroupingEditor v-if="key === 'position' && form.grouping.position" />

      <FieldErrors v-if="form.grouping[key] && key !== 'germplasm' && key !== 'unit'" :path="`grouping.${key}`" />
    </div>

    <h4 class="subsection-title">Record group dimensions</h4>
    <p class="hint">
      Group records by study record groupings such as replicate or batch, or by units such as the plots of a field.
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
</style>
