<script setup>
import { ref } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import LocationLayoutSelect from '@/components/analysis/config/LocationLayoutSelect.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

const { form } = useAnalysisEditor()

const layout = ref(null)

const position = () => form.grouping.position

const setLayoutId = (id) => {
  position().layoutId = id
  position().axisIndexes = []
  position().positions = []
}

const toggleAxis = (index) => {
  const p = position()
  p.axisIndexes = p.axisIndexes.includes(index)
    ? p.axisIndexes.filter((i) => i !== index)
    : [...p.axisIndexes, index].sort((a, b) => a - b)
}

const addPosition = () => {
  const axes = layout.value?.axes ?? []
  position().positions.push({ locationId: null, layoutId: null, coordinates: axes.map(() => '') })
}

const removePosition = (i) => position().positions.splice(i, 1)

const setTime = (value) => {
  position().time = value ? value : null
}
</script>

<template>
  <div v-if="form.grouping.position">
    <LocationLayoutSelect
      :location-id="form.grouping.position.locationId"
      :layout-id="form.grouping.position.layoutId"
      @update:location-id="form.grouping.position.locationId = $event"
      @update:layout-id="setLayoutId"
      @layout="layout = $event"
    />
    <FieldErrors path="grouping.position.locationId" />
    <FieldErrors path="grouping.position.layoutId" />

    <template v-if="layout?.axes?.length">
      <div class="field">
        <span class="field-label">Group by layout axes</span>
        <div class="chip-list">
          <button
            v-for="(axis, i) in layout.axes"
            :key="i"
            type="button"
            class="chip"
            :class="{ selected: form.grouping.position.axisIndexes.includes(i) }"
            @click="toggleAxis(i)"
          >
            {{ axis }}
          </button>
        </div>
        <p class="hint">Units with equal values on the selected axes form a group, e.g. rows or columns.</p>
        <FieldErrors path="grouping.position.axisIndexes" prefix />
      </div>

      <div class="field">
        <span class="field-label">Explicit positions</span>
        <p class="hint">Each position forms its own group and takes precedence over the axes.</p>
        <div v-for="(pos, i) in form.grouping.position.positions" :key="i" class="position-row">
          <input
            v-for="(axis, a) in layout.axes"
            :key="a"
            v-model="pos.coordinates[a]"
            type="text"
            :placeholder="axis"
          />
          <button type="button" class="btn-link danger" @click="removePosition(i)">Remove</button>
          <FieldErrors :path="`grouping.position.positions.${i}`" prefix />
        </div>
        <button type="button" class="btn-link" @click="addPosition">+ Add position</button>
      </div>
    </template>

    <div class="field-row">
      <div class="field">
        <label>Evaluated at time (optional)</label>
        <input
          type="text"
          :value="form.grouping.position.time ?? ''"
          placeholder="ISO 8601, e.g. 2024-06-01"
          @change="setTime($event.target.value.trim())"
        />
        <p class="hint">
          Without a time, a unit matches if it was ever at the position; units that moved between groups are unassigned.
        </p>
        <FieldErrors path="grouping.position.time" />
      </div>
    </div>
    <p class="hint">
      Units are grouped by an explicit position if one matches, otherwise by their values on the selected axes,
      otherwise by the whole location.
    </p>
  </div>
</template>

<style scoped>
.position-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}

.position-row input {
  width: 100px;
}
</style>
