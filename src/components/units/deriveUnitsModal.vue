<script setup>
import { computed, ref } from 'vue'
import { FormKit } from '@formkit/vue'

import ControlSelector from '@/components/controls/ControlSelector.vue'

import { useDefinePositionQueries } from '@/composables/units/definePositionQueries'
import { useUnitRootsQuery } from '@/composables/units/unitRootsQuery'
import { useUnitsLazyQuery } from '@/composables/units/unitsLazyQuery'
import { useUnitQuery } from '@/composables/units/unitQuery'
import { SOURCE_TYPES, useDeriveUnits } from '@/composables/units/derivations'
import { today } from '@/composables/units/unitPositions'

// Derives a unit from each of the units, by id or an arrival's ({ unitIds } or { arrival }, as unitsDeriveUnits takes
// them): material that starts a context of its own, e.g. plantlets grown from microcuttings that arrived from a lab.
// Each new unit goes under a unit at the location (e.g. a field-season unit), or is the root of a unit graph of its
// own there, in the team chosen. It takes its source's name, subject (unless one is chosen) and germplasm; the units
// derived from are left as they are (breedgraph README, Unit).
const props = defineProps({
  units: {
    type: Object,
    required: true
  },
  // what is derived from, e.g. "the 12 units that arrived at Lab on 2025-03-25"
  description: {
    type: String,
    required: true
  },
  subjects: {
    type: Array,
    default: () => []
  },
  // where the new units go, at first
  locationId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'derived'])

const { deriveUnits, deriveUnitsLoading } = useDeriveUnits()

const formData = ref({
  locationId: props.locationId,
  parentId: null,
  layoutId: null,
  start: today(),
  subjectId: null,
  sourceType: 'UNKNOWN',
  description: null
})
const controlTeamId = ref(null)
const release = ref(null)
const deriveError = ref('')

const {
  location,
  regions,
  loadChildLocations,
  childLocationsLoading,
  currentChildLocations,
  layout,
  arrangements,
  loadChildLayouts,
  childLayoutsLoading,
  currentChildLayouts
} = useDefinePositionQueries({
  locationId: () => formData.value.locationId,
  layoutId: () => formData.value.layoutId
})

// the unit they go under: a unit graph at the location, or a unit below one
const { blocks } = useUnitRootsQuery({
  locationIds: computed(() => (formData.value.locationId ? [formData.value.locationId] : []))
})
const { units: childUnits, unitsLoading: childUnitsLoading, loadChildUnits } = useUnitsLazyQuery()
const { unit: parent } = useUnitQuery(() => formData.value.parentId)

const subjectOptions = computed(() => [
  { value: null, label: '-- The subject of each unit derived from --' },
  ...props.subjects.map((subject) => ({ value: subject.id, label: subject.name }))
])

const submit = async () => {
  deriveError.value = ''
  const coordinates = layout.value?.axes?.map((_, index) => formData.value[`coordinate_${index}`] || '') ?? []
  const parentIds = formData.value.parentId ? [formData.value.parentId] : []
  // under a unit, a position of their own only gives when they were established, or where in a layout
  const position = !parentIds.length || formData.value.layoutId || formData.value.start ? {
    locationId: formData.value.locationId,
    layoutId: formData.value.layoutId || null,
    coordinates: coordinates.length > 0 ? coordinates : null,
    start: formData.value.start || null
  } : null
  const { status, errors, units } = await deriveUnits({
    units: props.units,
    parentIds,
    position,
    subjectId: formData.value.subjectId,
    sourceType: formData.value.sourceType,
    description: formData.value.description,
    controlTeamId,
    release
  })
  if (status === 'SUCCESS') {
    emit('derived', { units, location: location.value, parent: parent.value })
    emit('close')
  } else {
    deriveError.value = errors?.map((error) => error.message).join(', ') || 'The units could not be derived.'
  }
}
</script>

<template>
  <div class="modal modal-large" @click.stop>
    <div class="modal-header">
      <h4>Derive units from {{ description }}</h4>
    </div>
    <FormKit
      v-model="formData"
      type="form"
      :actions="false"
      class="modal-content"
      @submit="submit"
    >
      <p class="derive-help">
        A new unit for each, in a unit graph of your team's, so what is recorded of them starts there: each takes the
        germplasm of the unit it came from, and nothing else comes down from it. Those units stay as they are; end or
        move them on afterwards. Keep samples taken for analysis as children instead: their results describe the unit
        they came from.
      </p>
      <FormKit
        type="hierarchical-select"
        name="locationId"
        label="At:"
        help="Where the new units are"
        :selected="location"
        :rootNodes="regions"
        :loadChildrenFn="loadChildLocations"
        :childrenLoading="childLocationsLoading"
        :currentChildren="currentChildLocations"
        :get-node-label-fn="(node) => node.name || `${node.type?.name} ${node.id}`"
        validation="required"
      />
      <FormKit
        type="hierarchical-select"
        name="parentId"
        label="Under (optional):"
        help="A unit there they belong to, e.g. a field and season; without one, each is the root of a unit graph"
        :disabled="!formData.locationId"
        :selected="parent"
        :rootNodes="blocks"
        :loadChildrenFn="loadChildUnits"
        :childrenLoading="childUnitsLoading"
        :currentChildren="childUnits"
        :get-node-label-fn="(unit) => unit.name || `${unit.subject?.name} ${unit.id}`"
        :clearable="true"
      />
      <FormKit
        type="hierarchical-select"
        name="layoutId"
        label="Layout (optional):"
        help="A layout there, with the same coordinates for them all; set each one's afterwards"
        :selected="layout"
        :rootNodes="arrangements"
        :loadChildrenFn="loadChildLayouts"
        :childrenLoading="childLayoutsLoading"
        :currentChildren="currentChildLayouts"
        :get-node-label-fn="(node) => node.name || `${node.type?.name} ${node.id}`"
      />
      <div v-if="layout?.axes?.length > 0" class="coordinates-section">
        <label>Coordinates:</label>
        <div class="coordinates-inputs">
          <FormKit
            v-for="(axis, index) in layout.axes"
            :key="index"
            type="text"
            :name="`coordinate_${index}`"
            :label="axis"
            validation="required"
          />
        </div>
      </div>
      <FormKit
        type="text"
        name="start"
        label="From:"
        help="When they were established there: YYYY-MM-DD, or partial (YYYY-MM), or with a time (YYYY-MM-DDTHH:mm)"
        :validation="formData.parentId ? 'partialDateTime' : 'required|partialDateTime'"
      />
      <FormKit
        type="select"
        name="subjectId"
        label="Subject:"
        help="What the new units are, e.g. plantlets"
        :options="subjectOptions"
      />
      <FormKit
        type="select"
        name="sourceType"
        label="Derived as:"
        :options="SOURCE_TYPES"
      />
      <FormKit
        type="text"
        name="description"
        label="How (optional):"
        help="e.g. micropropagation, then hardening off"
      />

      <div v-if="deriveError" class="error-message">{{ deriveError }}</div>

      <div class="form-actions">
        <ControlSelector
          v-model:controlTeamId="controlTeamId"
          v-model:readRelease="release"
          class="form-control"
          @error="deriveError = $event"
        />
        <button type="submit" class="btn btn-primary" :disabled="deriveUnitsLoading">
          {{ deriveUnitsLoading ? 'Deriving…' : 'Derive' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="deriveUnitsLoading" @click="emit('close')">
          Cancel
        </button>
      </div>
    </FormKit>
  </div>
</template>

<style scoped>
.derive-help {
  margin: 0 0 12px;
  color: #666;
  font-size: 0.9rem;
}
</style>
