<script setup>
import { ref } from 'vue'
import { FormKit } from '@formkit/vue'

import { useDefinePositionQueries } from '@/composables/units/definePositionQueries'
import { useMoveUnits } from '@/composables/units/mutatePositions'
import { today } from '@/composables/units/unitPositions'

// Moves units to a position from a start: by id, or an arrival's ({ unitIds } or { arrival }, as unitsMoveUnits takes
// them). Each unit's position then ends at that start, and the position is added (breedgraph README, Position).
const props = defineProps({
  units: {
    type: Object,
    required: true
  },
  // what is moved, e.g. "the 12 units that arrived at Lab on 2025-03-25"
  description: {
    type: String,
    required: true
  },
  // where they go, if known, e.g. a location receiving units
  locationId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'moved'])

const { moveUnits, moveUnitsLoading } = useMoveUnits()

const formData = ref({
  locationId: props.locationId,
  layoutId: null,
  start: today(),
  end: null
})
const moveError = ref('')

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

const submit = async () => {
  moveError.value = ''
  const coordinates = layout.value?.axes?.map((_, index) => formData.value[`coordinate_${index}`] || '') ?? []
  const position = {
    locationId: formData.value.locationId,
    layoutId: formData.value.layoutId || null,
    coordinates: coordinates.length > 0 ? coordinates : null,
    start: formData.value.start || null,
    end: formData.value.end || null
  }
  const { status, errors, units } = await moveUnits({ units: props.units, position })
  if (status === 'SUCCESS') {
    emit('moved', { units, position, location: location.value })
    emit('close')
  } else {
    moveError.value = errors?.map((error) => error.message).join(', ') || 'The units could not be moved.'
  }
}
</script>

<template>
  <div class="modal modal-large" @click.stop>
    <div class="modal-header">
      <h4>Move {{ description }}</h4>
    </div>
    <FormKit
      v-model="formData"
      type="form"
      :actions="false"
      class="modal-content"
      @submit="submit"
    >
      <p class="move-help">
        Their positions end when they arrive there, and they stay in their unit graphs, below the units they came from.
      </p>
      <FormKit
        type="hierarchical-select"
        name="locationId"
        label="To:"
        help="The location they go to"
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
        help="A layout there, with the same coordinates for them all"
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
      <div class="date-inputs">
        <FormKit
          type="text"
          name="start"
          label="Arriving:"
          help="When they arrive: YYYY-MM-DD, or partial (YYYY-MM), or with a time (YYYY-MM-DDTHH:mm)"
          validation="required|partialDateTime"
        />
        <FormKit
          type="text"
          name="end"
          label="Until (optional):"
          help="If they leave again by a known time"
          validation="partialDateTime"
        />
      </div>

      <div v-if="moveError" class="error-message">{{ moveError }}</div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="moveUnitsLoading">
          {{ moveUnitsLoading ? 'Moving…' : 'Move' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="moveUnitsLoading" @click="emit('close')">
          Cancel
        </button>
      </div>
    </FormKit>
  </div>
</template>

<style scoped>
.move-help {
  margin: 0 0 12px;
  color: #666;
  font-size: 0.9rem;
}
</style>
