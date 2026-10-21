<script setup>
import { ref } from 'vue'
import { FormKit } from '@formkit/vue'

import { useDefinePositionQueries } from '@/composables/units/definePositionQueries'
import { useSelectUnitsQuery } from '@/composables/datasets/selectUnitsQueries'
import { useCachedName } from '@/composables/queryBase/cachedName'
import { useMoveUnits } from '@/composables/units/mutatePositions'
import { today } from '@/composables/units/unitPositions'

// Units received at a location from where they are now, e.g. samples arriving at a lab: chosen from the unit graphs
// and arrivals there, as the dataset unit picker offers them, and moved here from when they arrive.
const props = defineProps({
  locationId: {
    type: String,
    required: true
  },
  locationName: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'moved'])

const { moveUnits, moveUnitsLoading } = useMoveUnits()

const formData = ref({ fromLocationId: null, unitIds: [], layoutId: null, start: today(), end: null })
const receiveError = ref('')

// where they are now
const {
  location: fromLocation,
  regions,
  loadChildLocations,
  childLocationsLoading,
  currentChildLocations
} = useDefinePositionQueries({ locationId: () => formData.value.fromLocationId, layoutId: () => null })

const {
  rootNodes: unitRootNodes,
  loadChildren: loadChildUnits,
  childrenLoading: childUnitsLoading,
  currentChildren: childUnits,
  isSelectable: isSelectableUnit,
  hasChildren: unitHasChildren,
  loadTypeGroups: loadUnitTypeGroups
} = useSelectUnitsQuery({
  locationIds: () => (formData.value.fromLocationId ? [formData.value.fromLocationId] : []),
  unitIds: () => formData.value.unitIds
})
const unitNameOf = useCachedName('Unit')

// where they go here: a layout of this location, if any
const {
  layout,
  arrangements,
  loadChildLayouts,
  childLayoutsLoading,
  currentChildLayouts
} = useDefinePositionQueries({ locationId: () => props.locationId, layoutId: () => formData.value.layoutId })

const submit = async () => {
  receiveError.value = ''
  const coordinates = layout.value?.axes?.map((_, index) => formData.value[`coordinate_${index}`] || '') ?? []
  const position = {
    locationId: props.locationId,
    layoutId: formData.value.layoutId || null,
    coordinates: coordinates.length > 0 ? coordinates : null,
    start: formData.value.start || null,
    end: formData.value.end || null
  }
  const { status, errors, units } = await moveUnits({ units: { unitIds: formData.value.unitIds }, position })
  if (status === 'SUCCESS') {
    emit('moved', { units, position })
    emit('close')
  } else {
    receiveError.value = errors?.map((error) => error.message).join(', ') || 'The units could not be moved here.'
  }
}
</script>

<template>
  <div class="modal modal-large" @click.stop>
    <div class="modal-header">
      <h4>Receive units at {{ locationName || 'this location' }}</h4>
    </div>
    <FormKit
      v-model="formData"
      type="form"
      :actions="false"
      class="modal-content"
      @submit="submit"
    >
      <FormKit
        type="hierarchical-select"
        name="fromLocationId"
        label="From:"
        help="Where the units are now"
        :selected="fromLocation"
        :rootNodes="regions"
        :loadChildrenFn="loadChildLocations"
        :childrenLoading="childLocationsLoading"
        :currentChildren="currentChildLocations"
        :get-node-label-fn="(node) => node.name || `${node.type?.name} ${node.id}`"
        validation="required"
      />
      <FormKit
        type="hierarchical-multiselect"
        name="unitIds"
        label="Units:"
        help="From the unit graphs and arrivals there"
        :disabled="!formData.fromLocationId"
        :label-fn="unitNameOf"
        :rootNodes="unitRootNodes"
        :loadChildrenFn="loadChildUnits"
        :childrenLoading="childUnitsLoading"
        :currentChildren="childUnits"
        :is-selectable-fn="isSelectableUnit"
        :has-children-fn="unitHasChildren"
        :get-node-label-fn="(unit) => unit.name || `${unit.subject?.name} ${unit.id}`"
        :load-type-groups-fn="loadUnitTypeGroups"
        validation="required"
      />
      <FormKit
        type="hierarchical-select"
        name="layoutId"
        label="Layout here (optional):"
        help="A layout of this location, with the same coordinates for them all"
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

      <div v-if="receiveError" class="error-message">{{ receiveError }}</div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="moveUnitsLoading">
          {{ moveUnitsLoading ? 'Moving…' : 'Receive' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="moveUnitsLoading" @click="emit('close')">
          Cancel
        </button>
      </div>
    </FormKit>
  </div>
</template>
