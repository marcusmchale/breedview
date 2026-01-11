<script setup>
import { useDefinePositionQueries } from "@/composables/blocks/definePositionQueries";
import { useMutatePositions } from "@/composables/blocks/mutatePositions";
import {FormKit} from "@formkit/vue";
import { ref } from "vue";

const props = defineProps({
  unitId: Number,
  currentPosition: {
    type: Object,
    required: false
  }
})

const {
  addPosition,
  addPositionLoading,
  addPositionError
} = useMutatePositions({unitId: props.unitId})

const positionFormData = ref({
  locationId: props.currentPosition?.location?.id,
  layoutId: props.currentPosition?.layout?.id,
  start: props.currentPosition?.end,
  end: null
})

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
    locationId: () => positionFormData.value.locationId,
    layoutId: () => positionFormData.value.layoutId
})

const emit = defineEmits(['close'])

const submitAddPosition = async () => {
  try {
    addPositionError.value = ''

    const coordinates = layout?.value?.axes?.map((_, index) => {
      return positionFormData.value[`coordinate_${index}`] || ''
    }) ?? []
    const position = {
      location: location.value,
      layout: layout.value,
      coordinates: coordinates.length > 0 ? coordinates : undefined ,
      start: positionFormData.value.start || undefined,
      end: positionFormData.value.end || undefined
    }
    const { status, errors } = await addPosition(position)

    if (status === 'SUCCESS') {
      emit('close')
    } else {
      if (errors && errors.length > 0) {
        addPositionError.value = errors.map(err => err.message).join(', ')
      } else {
        addPositionError.value = 'Failed to add position. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error adding position:', error)
    addPositionError.value = error.message || 'An unexpected error occurred.'
  }
}

</script>

<template>
<div class="modal modal-large" @click.stop>
  <div class="modal-header">
    <h4>Add Position</h4>
  </div>

    <FormKit
      v-model="positionFormData"
      type="form"
      @submit="submitAddPosition"
      :actions="false"
      class="modal-content"
    >
      <FormKit
        type="hierarchical-select"
        name="locationId"
        label="Location:"
        help="Select a location"
        :selected="location"
        :rootNodes="regions"
        :loadChildrenFn="loadChildLocations"
        :childrenLoading="childLocationsLoading"
        :currentChildren="currentChildLocations"
        :exclude-node-id=null
        :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
        validation="required"
      />
      <FormKit
        type="hierarchical-select"
        name="layoutId"
        label="Layout (optional):"
        help="Select a layout"
        :selected="layout"
        :rootNodes="arrangements"
        :loadChildrenFn="loadChildLayouts"
        :childrenLoading="childLayoutsLoading"
        :currentChildren="currentChildLayouts"
        :exclude-node-id=null
        :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
      />

      <div v-if="layout?.axes?.length > 0" class="coordinates-section">
        <label>Coordinates:</label>
        <div class="coordinates-inputs">
          <FormKit
            v-for="(axis, index) in layout?.axes"
            :key="index"
            type="text"
            :name="`coordinate_${index}`"
            :label="axis"
            :validation="`required`"
            :help="`Enter ${axis}`"
          />
        </div>
      </div>

      <div class="date-inputs">
        <FormKit
          type="text"
          name="start"
          label="Start Date/Time (optional):"
          help="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
          validation="partialDateTime"
        />

        <FormKit
          type="text"
          name="end"
          label="End Date/Time (optional):"
          help="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
          validation="partialDateTime"
        />
      </div>

      <div v-if="addPositionError" class="error-message">
        {{ addPositionError }}
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="addPositionLoading">
          {{ addPositionLoading ? 'Adding...' : 'Add Position' }}
        </button>
        <button
          type="button"
          @click="$emit('close')"
          class="btn btn-secondary"
          :disabled="addPositionLoading"
        >
          Cancel
        </button>
      </div>
    </FormKit>
</div>

</template>

<style scoped>

</style>