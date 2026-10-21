<script setup>
import { computed, ref } from 'vue'
import { FormKit } from '@formkit/vue'

import { useDefinePositionQueries } from '@/composables/units/definePositionQueries'
import { useMoveUnits } from '@/composables/units/mutatePositions'
import { today } from '@/composables/units/unitPositions'

// Changes one position of each unit, the one matching at (unitsChangePositions): ends it ("end"), or corrects its
// place and times ("correct"). Only what differs from the position as it is goes in the change.
const props = defineProps({
  // { unitIds } or { arrival }, as unitsChangePositions takes them
  units: {
    type: Object,
    required: true
  },
  // what changes, e.g. "the arrival of 2025-03-25 at Lab"
  description: {
    type: String,
    required: true
  },
  // the values that find the position of each unit (PositionMatchInput)
  at: {
    type: Object,
    required: true
  },
  // the position as it is: { location, layout, coordinates, start, end }, for an arrival the place and start it shares
  current: {
    type: Object,
    required: true
  },
  mode: {
    type: String,
    default: 'correct',
    validator: (mode) => ['end', 'correct'].includes(mode)
  }
})

const emit = defineEmits(['close', 'changed'])

const { changePositions, changePositionsLoading } = useMoveUnits()

const coordinatesOf = (position) => position?.coordinates ?? []
const formData = ref({
  locationId: props.current.location?.id ?? null,
  layoutId: props.current.layout?.id ?? null,
  ...Object.fromEntries(coordinatesOf(props.current).map((value, index) => [`coordinate_${index}`, value])),
  start: props.current.start ?? '',
  end: props.mode === 'end' ? (props.current.end ?? today()) : (props.current.end ?? '')
})
const changeError = ref('')

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

const title = computed(() => (props.mode === 'end' ? `End ${props.description}` : `Correct ${props.description}`))

// what differs from the position as it is: the place as a whole, and each time (empty removes it)
const change = () => {
  const changed = {}
  const coordinates = layout.value?.axes?.map((_, index) => formData.value[`coordinate_${index}`] || '') ?? []
  const place = {
    locationId: formData.value.locationId,
    layoutId: formData.value.layoutId || null,
    coordinates: coordinates.length > 0 ? coordinates : null
  }
  const samePlace = String(place.locationId) === String(props.current.location?.id ?? '')
    && String(place.layoutId ?? '') === String(props.current.layout?.id ?? '')
    && JSON.stringify((place.coordinates ?? []).map(String)) === JSON.stringify(coordinatesOf(props.current).map(String))
  if (props.mode === 'correct' && !samePlace) Object.assign(changed, place)
  if (props.mode === 'correct' && (formData.value.start || '') !== (props.current.start ?? '')) {
    changed.start = formData.value.start || null
  }
  if ((formData.value.end || '') !== (props.current.end ?? '')) changed.end = formData.value.end || null
  return changed
}

const submit = async () => {
  changeError.value = ''
  const changed = change()
  if (Object.keys(changed).length === 0) {
    changeError.value = 'Nothing is different from the position as it is.'
    return
  }
  const { status, errors, units } = await changePositions({ units: props.units, at: props.at, change: changed })
  if (status === 'SUCCESS') {
    emit('changed', { units, change: changed })
    emit('close')
  } else {
    changeError.value = errors?.map((error) => error.message).join(', ') || 'The positions could not be changed.'
  }
}
</script>

<template>
  <div class="modal modal-large" @click.stop>
    <div class="modal-header">
      <h4>{{ title }}</h4>
    </div>
    <FormKit
      v-model="formData"
      type="form"
      :actions="false"
      class="modal-content"
      @submit="submit"
    >
      <template v-if="mode === 'correct'">
        <p class="change-help">Correct what was entered: this changes the record of where they were, not a move.</p>
        <FormKit
          type="hierarchical-select"
          name="locationId"
          label="Location:"
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
          name="layoutId"
          label="Layout (optional):"
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
      </template>
      <p v-else class="change-help">
        When they left {{ current.location?.name }}, e.g. used up or discarded. To record where they went, move them instead.
      </p>
      <div class="date-inputs">
        <FormKit
          v-if="mode === 'correct'"
          type="text"
          name="start"
          label="Start:"
          help="As entered: YYYY-MM-DD, partial (YYYY-MM), or with a time (YYYY-MM-DDTHH:mm); empty for none"
          validation="partialDateTime"
        />
        <FormKit
          type="text"
          name="end"
          :label="mode === 'end' ? 'Ended:' : 'End:'"
          help="An end covers its whole period: an end of 2021-05-03 includes that day; empty for none"
          :validation="mode === 'end' ? 'required|partialDateTime' : 'partialDateTime'"
        />
      </div>

      <div v-if="changeError" class="error-message">{{ changeError }}</div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="changePositionsLoading">
          {{ changePositionsLoading ? 'Saving…' : (mode === 'end' ? 'End' : 'Save') }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="changePositionsLoading" @click="emit('close')">
          Cancel
        </button>
      </div>
    </FormKit>
  </div>
</template>

<style scoped>
.change-help {
  margin: 0 0 12px;
  color: #666;
  font-size: 0.9rem;
}
</style>
