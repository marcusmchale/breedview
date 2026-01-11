<script setup>

import { ref, computed } from "vue";
import { FormKit } from "@formkit/vue";

import { useDefinePositionQueries } from "@/composables/blocks/definePositionQueries";
import { useMutateUnits } from "@/composables/blocks/mutateUnits";
import { useSelectGermplasmQueries } from "@/composables/germplasm/selectGermplasmQueries";

const props = defineProps({
    subjects: {
        type: Array,
        required: true
    },
    locationId: {
        type: Number,
        required: true
    }
})

const emit = defineEmits(['success', 'close'])

const { createUnit, createUnitLoading, createUnitError } = useMutateUnits()

const createFormData = ref({
    subjectId: null,
    germplasmId: null,
    name: null,
    description: null,
    positionLocationId: props.locationId,
    positionLayoutId: null,
    positionStart: null,
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
    locationId: () => createFormData.value.positionLocationId,
    layoutId: () => createFormData.value.positionLayoutId
})

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


const {
    germplasm,
    crops,
    currentChildGermplasm,
    childGermplasmLoading,
    loadChildGermplasm,
    hasChildren
} = useSelectGermplasmQueries({germplasmId: () => createFormData.value.germplasmId })


const addUnitError = ref('')

const submitAddUnit = async () => {
  try {
    addUnitError.value = ''

    // Build coordinates array from individual inputs
    let coordinates = []
    if (layout.value) {
      coordinates = layout.value.axes.map((_, index) => {
        return createFormData.value[`coordinate_${index}`] || ''
      })
    }

    // Build position object
    const position = {
      locationId: createFormData.value.positionLocationId,
      layoutId: createFormData.value.positionLayoutId || undefined,
      coordinates: coordinates.length > 0 ? coordinates : undefined,
      start: createFormData.value.positionStart || undefined,
      end: createFormData.value.positionEnd || undefined
    }

    const unitData = {
        subjectId: createFormData.value.subjectId,
        germplasmId: createFormData.value.germplasmId || undefined,
        name: createFormData.value.name || undefined,
        description: createFormData.value.description || undefined,
        parentIds: [], // New block has no parents
        childrenIds: []
    }
    const { status, errors } = await createUnit(unitData, position)

    if (status === 'SUCCESS') {
      emit('close')
      emit('success')
    } else {
      // Handle server errors
      if (errors && errors.length > 0) {
        addUnitError.value = errors.map(err => err.message).join(', ')
      } else {
        addUnitError.value = 'Failed to add unit. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error adding unit:', error)
    addUnitError.value = error.message || 'An unexpected error occurred.'
  }
}

</script>

<template>
<div class="modal" @click.stop>
  <div class="modal-header">
    <h4>Create New Block</h4>
  </div>

  <FormKit
    v-model="createFormData"
    type="form"
    @submit="submitAddUnit"
    :actions="false"
    class="modal-content"
  >

    <FormKit
      type="select"
      name="subjectId"
      label="Subject:"
      help="Select a subject type"
      placeholder="Select a subject"
      :options="subjectsWithNull"
      validation="required"
    />

    <FormKit
      type="hierarchical-select"
      name="germplasmId"
      label="Germplasm:"
      help="Optionally define a germplasm entry for this block"
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
      help="Enter unit name (Optional)"
    />

    <FormKit
      type="text"
      name="description"
      label="Description:"
      help="Enter description (Optional)"
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
          :disabled=true
        />

        <FormKit
          type="hierarchical-select"
          name="positionLayoutId"
          label="Layout (optional):"
          help="Select a layout"
          :selected="createFormData.positionLayoutId ? layout : null"
          :rootNodes="arrangementsWithNull"
          :loadChildrenFn="loadChildLayouts"
          :childrenLoading="childLayoutsLoading"
          :currentChildren="currentChildLayouts"
          :exclude-node-id=null
          :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
        />

        <div v-if="createFormData.positionLayoutId && layout?.axes?.length > 0" class="coordinates-section">
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
    <div v-if="addUnitError" class="error-message">
      {{ addUnitError }}
    </div>

    <div class="form-actions">
      <button type="submit" class="btn btn-primary" :disabled="createUnitLoading">
        {{ createUnitLoading ? 'Adding...' : 'Add Unit' }}
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
. h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.axes-section h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  max-width: 450px;
  width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
}

.modal-header h4 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover:not(:disabled) {
  background-color: #e9ecef;
  border-radius: 50%;
}

.modal-close:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.modal-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-primary:disabled {
  background-color: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.error-message {
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  font-size: 14px;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}


</style>