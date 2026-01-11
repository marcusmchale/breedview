<script setup>

import {computed, ref} from "vue";
import { FormKit } from "@formkit/vue";

import { useDefinePositionQueries } from "@/composables/blocks/definePositionQueries"
import { useSelectGermplasmQueries } from "@/composables/germplasm/selectGermplasmQueries"
import { useMutateUnits } from "@/composables/blocks/mutateUnits";


const props = defineProps({
  subjects: {
    type: Array,
    required: true
  },
  parentUnit: {
    type: Object,
    required: false
  },
  parentPosition: {
    type: Object,
    required: false
  }
})

const emit = defineEmits(['close', 'success']) // to close unitDetails modal if the last and is deleted

const { createUnit, createUnitLoading, createUnitError } = useMutateUnits()

const addChildFormData = ref({
  parentName: props.parentUnit?.name || `${props.parentUnit?.subject?.name} ${props.parentUnit?.id}`,
  subjectId: null,
  germplasmId: null,
  name: '',
  description: '',
  positionLocationId: props.parentPosition?.location?.id,
  positionLayoutId: props.parentPosition?.layout?.id,
  positionStart: props.parentPosition?.end,
  positionEnd: null
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
    locationId: () => addChildFormData.value.positionLocationId,
    layoutId: () => addChildFormData.value.positionLayoutId
})

const {
    germplasm,
    crops,
    currentChildGermplasm,
    childGermplasmLoading,
    loadChildGermplasm,
    hasChildren
} = useSelectGermplasmQueries({germplasmId: () => addChildFormData.value.germplasmId })

const arrangementsWithNull = computed(() => {
  return [
    { id: null, name: '-- None --' },
    ...arrangements.value
  ]
})

const subjectsWithNull = computed( () => {
   return [
       { value: null, label: "-- Select a subject --" },
       ...props.subjects.map(subject => ({ value: subject.id, label: subject.name }))
   ]
})

const addChildError = ref('')

const submitAddChild = async () => {
  try {
    addChildError.value = ''

    // Build coordinates array from individual inputs
    let coordinates = []
    if (layout.value) {
      coordinates = layout.value.axes.map((_, index) => {
        return addChildFormData.value[`coordinate_${index}`] || ''
      })
    }

    // Build position object
    const position = {
      locationId: addChildFormData.value.positionLocationId,
      layoutId: addChildFormData.value.positionLayoutId || undefined,
      coordinates: coordinates.length > 0 ? coordinates : undefined,
      start: addChildFormData.value.positionStart || undefined,
      end: addChildFormData.value.positionEnd || undefined
    }

    const unitData = {
      subjectId: addChildFormData.value.subjectId,
      germplasmId: addChildFormData.value.germplasmId || undefined,
      name: addChildFormData.value.name || undefined,
      description: addChildFormData.value.description || undefined,
      parentIds: [props.parentUnit.id],
      childrenIds: []
    }

    const { status, errors } = await createUnit(unitData, position)
    if (status === 'SUCCESS') {
      emit('close')
      emit('success')
    } else {
      if (errors && errors.length > 0) {
        addChildError.value = errors.map(err => err.message).join(', ')
      } else {
        addChildError.value = 'Failed to add child unit. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error adding child unit:', error)
    addChildError.value = error.message || 'An unexpected error occurred. '
  }
}



</script>

<template>
<div class="modal" @click.stop>
  <div class="modal-header">
    <h4>Add Child Unit</h4>
  </div>

  <FormKit
    v-model="addChildFormData"
    type="form"
    @submit="submitAddChild"
    :actions="false"
    class="modal-content"
  >
    <FormKit
      type="text"
      name="parentName"
      label="Parent Unit:"
      disabled
    />

    <FormKit
      type="select"
      name="subjectId"
      label="Subject:"
      help="Select a subject type"
      :options="subjectsWithNull"
      validation="required"
    />

    <FormKit
      type="hierarchical-select"
      name="germplasmId"
      label="Germplasm:"
      help="Optionally define a germplasm entry for this unit"
      :selected="germplasm"
      :rootNodes="crops"
      :hasChildrenFn="hasChildren"
      :loadChildrenFn="loadChildGermplasm"
      :childrenLoading="childGermplasmLoading"
      :currentChildren="currentChildGermplasm"
      :exclude-node-id=null
      :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
      validation="optional"
    />

    <FormKit
      type="text"
      name="name"
      label="Unit Name:"
      help="Enter unit name (optional)"
    />

     <div class="form-section">
        <h5>Initial Position</h5>

        <FormKit
          type="hierarchical-select"
          name="positionLocationId"
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
          name="positionLayoutId"
          label="Layout (optional):"
          help="Select a layout"
          :selected="addChildFormData.positionLayoutId ? layout : null"
          :rootNodes="arrangementsWithNull"
          :loadChildrenFn="loadChildLayouts"
          :childrenLoading="childLayoutsLoading"
          :currentChildren="currentChildLayouts"
          :exclude-node-id=null
          :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
        />

        <div v-if="addChildFormData.positionLayoutId && layout?.axes?.length > 0" class="coordinates-section">
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
            name="positionStart"
            label="Start Date/Time (optional):"
            help="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
            validation="partialDateTime"
          />

          <FormKit
            type="text"
            name="positionEnd"
            label="End Date/Time (optional):"
            help="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
            validation="partialDateTime"
          />
        </div>
      </div>

    <div v-if="createUnitError" class="error-message">
      {{ createUnitError }}
    </div>
    <div v-if="addChildError" class="error-message">
      {{ addChildError }}
    </div>

    <div class="form-actions">
      <button type="submit" class="btn btn-primary" :disabled="createUnitLoading">
        {{ createUnitLoading ? 'Adding...' : 'Add Child' }}
      </button>
      <button
        type="button"
        @click="$emit('close')"
        class="btn btn-secondary"
        :disabled="createUnitLoading"
      >
        Cancel
      </button>
    </div>
  </FormKit>
</div>
</template>

<style scoped>

</style>