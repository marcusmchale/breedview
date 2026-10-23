<script setup>
import { computed, ref } from 'vue'
import { plural } from '@/composables/system/counts'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { removeTermReferences } from '@/composables/analysis/useAnalysisForm'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

/**
 * Where the units of records were (breedgraph docs/analysis.md §3): the location types whose nearest location places
 * each record, optional subjects whose units place the units below them, layout axes by name, each a term of its own,
 * and an optional time standing in for each record's when a unit has several positions.
 */
const { form, data } = useAnalysisEditor()

const position = () => form.grouping.position

const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

const toggleLocationType = (id) => (position().locationTypeIds = toggle(position().locationTypeIds, id))
const toggleSubject = (id) => (position().subjectIds = toggle(position().subjectIds, id))

// Ids selected in a loaded analysis that the ontology doesn't list
const unknownLocationTypeIds = computed(() =>
  position().locationTypeIds.filter((id) => !data.locationTypesById[id])
)
const unknownSubjectIds = computed(() => position().subjectIds.filter((id) => !data.subjectsById[id]))

/* ---------- axes ---------- */

// The axis names the layouts at the places give, then any chosen that the places don't
const axisOptions = computed(() => {
  const found = data.places.flatMap((place) => place.layouts.flatMap((layout) => layout.axes))
  return [...new Set([...found, ...position().axes])]
})

const toggleAxis = (axis) => {
  const p = position()
  if (p.axes.includes(axis)) {
    p.axes = p.axes.filter((a) => a !== axis)
    removeTermReferences(form, { type: 'LAYOUT_AXIS', layoutAxis: axis })
  } else {
    p.axes = [...p.axes, axis]
  }
}

const otherAxis = ref('')
const addOtherAxis = () => {
  const axis = otherAxis.value.trim()
  if (axis && !position().axes.includes(axis)) position().axes = [...position().axes, axis]
  otherAxis.value = ''
}

const setTime = (value) => {
  position().time = value ? value : null
}
</script>

<template>
  <div v-if="form.grouping.position">
    <div class="field">
      <span class="field-label">Location types</span>
      <p class="hint">
        Each record is placed at the nearest location of one of these, at or above where its unit was: pick Field to
        compare fields, or Country to compare countries.
      </p>
      <p v-if="data.locationTypes.length === 0" class="hint">
        {{ data.locationTypesLoading ? 'Loading location types…' : 'No location types are defined in the ontology.' }}
      </p>
      <div v-else class="chip-list">
        <button
          v-for="t in data.locationTypes"
          :key="t.id"
          type="button"
          class="chip"
          :class="{ selected: form.grouping.position.locationTypeIds.includes(t.id) }"
          @click="toggleLocationType(t.id)"
        >
          {{ t.name }}
        </button>
        <span v-for="id in unknownLocationTypeIds" :key="id" class="chip selected">
          Location type {{ id }}
          <button type="button" class="chip-remove" title="Remove" @click="toggleLocationType(id)">×</button>
        </span>
      </div>
      <FieldErrors path="grouping.position.locationTypeIds" prefix />
    </div>

    <div class="field">
      <span class="field-label">Place by (optional)</span>
      <p class="hint">
        A unit below a unit of these subjects is placed where that unit was, e.g. a sample analysed in a lab abroad
        by the tree it came from. Without them, a sample's own position counts first.
      </p>
      <div class="chip-list">
        <button
          v-for="s in data.subjects"
          :key="s.id"
          type="button"
          class="chip"
          :class="{ selected: form.grouping.position.subjectIds.includes(s.id) }"
          @click="toggleSubject(s.id)"
        >
          {{ s.name }}
        </button>
        <span v-for="id in unknownSubjectIds" :key="id" class="chip selected">
          Subject {{ id }}
          <button type="button" class="chip-remove" title="Remove" @click="toggleSubject(id)">×</button>
        </span>
      </div>
      <FieldErrors path="grouping.position.subjectIds" prefix />
    </div>

    <div v-if="form.grouping.position.locationTypeIds.length" class="field">
      <span class="field-label">In the selected datasets</span>
      <p v-if="data.placesLoading" class="hint">Finding where the records are…</p>
      <p v-else-if="!form.datasetIds.length" class="hint">Select datasets to see where their records are.</p>
      <p v-else-if="!data.places.length" class="hint">
        No unit of the selected datasets, nor any unit above them, has a position at a location of these types.
      </p>
      <ul v-else class="places">
        <li v-for="place in data.places" :key="place.location.id" class="place">
          <span class="place-name">{{ place.location.name }}</span>
          <span class="muted"> · {{ plural(place.unitCount, 'unit') }}</span>
          <ul v-if="place.layouts.length" class="layouts">
            <li v-for="l in place.layouts" :key="l.layout.id">
              {{ l.layout.name }}<span class="muted"> · {{ plural(l.unitCount, 'unit') }}</span>
              <span v-if="l.axes.length" class="muted"> · axes {{ l.axes.join(', ') }}</span>
            </li>
          </ul>
        </li>
      </ul>
      <p v-if="data.places.length" class="hint">
        Units may be counted at more than one location here: the analysis places each record once, by the nearest
        unit with a position there, at the record's time.
      </p>
    </div>

    <div class="field">
      <span class="field-label">Layout axes (optional)</span>
      <p class="hint">
        Each axis is a term of its own, e.g. Row. Its values are nested in the layout that has the axis, so row 3 of
        one field is not row 3 of another. A record whose place has no value on a chosen axis is unassigned.
      </p>
      <div class="chip-list">
        <button
          v-for="axis in axisOptions"
          :key="axis"
          type="button"
          class="chip"
          :class="{ selected: form.grouping.position.axes.includes(axis) }"
          @click="toggleAxis(axis)"
        >
          {{ axis }}
        </button>
      </div>
      <div class="other-axis">
        <input v-model="otherAxis" type="text" placeholder="Another axis name" @keydown.enter.prevent="addOtherAxis" />
        <button type="button" class="btn btn-sm btn-outline" :disabled="!otherAxis.trim()" @click="addOtherAxis">
          Add
        </button>
      </div>
      <FieldErrors path="grouping.position.axes" prefix />
    </div>

    <div class="field-row">
      <div class="field">
        <label>At a set time (optional)</label>
        <input
          type="text"
          :value="form.grouping.position.time ?? ''"
          placeholder="ISO 8601, e.g. 2024-06-01"
          @change="setTime($event.target.value.trim())"
        />
        <p class="hint">
          A unit's positions count at any time. Where it has several, because it moved or was rotated between benches,
          the one holding at each record's time places the record; a set time stands in for every record's time.
        </p>
        <FieldErrors path="grouping.position.time" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.places {
  margin: 4px 0;
  padding-left: 18px;
  font-size: 0.85rem;
}

.place-name {
  font-weight: 500;
}

.layouts {
  margin: 2px 0 6px;
  padding-left: 18px;
}

.other-axis {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.other-axis input {
  width: 180px;
}
</style>
