<script setup>

import { computed, ref, watch } from "vue"
import { FormKit } from "@formkit/vue"

import { useLayoutUpdateQueries } from "@/composables/arrangements/layoutUpdateQueries"
import { useMutateLayouts } from "@/composables/arrangements/mutateLayouts"

const props = defineProps({
  layoutTypes: {
    type: Array,
    required: true
  },
  layout: {
    type: Object,
    required: true
  },
  arrangementId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['success', 'close'])

// Form data
const updateFormData = ref({
  name: props.layout.name,
  typeId: props.layout.type.id,
  parentId: props.layout.parent?.id,
  position: props.layout.position,
  locationId: props.layout.location.id
})

const {
  arrangementLayout,
  parentLayout,

  loadChildLayouts,
  layoutsLoading: childLayoutsLoading,
  layouts: currentChildLayouts,

  regions,
  location,

  loadChildLocations,
  childLocationsLoading,
  currentChildLocations
} = useLayoutUpdateQueries({
  arrangementId: props.arrangementId,
  parentId: () => updateFormData.value.parentId,
  locationId: () => updateFormData.value.locationId
})

const {
  updateLayout, updateLayoutLoading, updateLayoutError
} = useMutateLayouts()


const arrangementLayouts = computed( () => {
  return arrangementLayout.value ? [arrangementLayout.value] : []
})

const updateError = ref('')

const submitUpdate = async () => {
  try {
    updateError.value = ''

     // Collect axis names from form data
    const axes = []
    if (selectedEditLayoutType.value?.axes) {
      for (let i = 0; i < selectedEditLayoutType.value.axes.length; i++) {
        const axisName = updateFormData.value[`axis_${i}`]
        if (axisName) {
          axes.push(axisName)
        }
      }
    }
    // Collect positions from form data
    const positions = []
    if (parentLayout.value?.axes) {
      for (let i = 0; i < parentLayout.value.axes.length; i++) {
        const axisPosition = updateFormData.value[`position_${i}`]
        if (axisPosition) {
          positions.push(axisPosition)
        }
      }
    }

    const layoutData = {
        layoutId: props.layout.id,
        locationId: updateFormData.value.locationId || undefined,
        name: updateFormData.value.name || undefined,
        typeId: updateFormData.value.typeId || undefined,
        parentId: updateFormData.value.parentId || undefined,
        position: positions.length > 0 ? positions : undefined,
        axes: axes.length > 0 ? axes : undefined
      }
    const { status, errors } = await updateLayout(layoutData)
    if (status === 'SUCCESS') {
      emit('success')
      emit('close')
    } else {
      if (errors && errors.length > 0) {
        updateError.value = errors.map(err => err.message).join(', ')
      } else {
        updateError.value = 'Failed to update layout. Please try again.'
      }
    }

  } catch (error) {
    console.error('Error updating layout:', error)
    updateError.value = error.message || 'An unexpected error occurred.'
  }
}


// Dynamic fields in forms
watch(parentLayout, (newParentLayout) => {
  if (!newParentLayout) return;

  // Dynamically add or remove position fields in updateFormData.value
  newParentLayout.axes.forEach((axisName, index) => {
    const positionField = `position_${index}`;
    // If the position field doesn't exist, add it with an empty string
    if (!Object.prototype.hasOwnProperty.call(updateFormData.value, positionField)) {
      if (props.layout.position) {
        updateFormData.value[positionField] = props.layout.position[index];  // Initialize axis with value
      }
    }
  });

  // Remove unused position fields if the number of axes has decreased
  const maxPositions = Object.keys(updateFormData.value).filter(key => key.startsWith('position_')).length;
  for (let i = newParentLayout.axes.length; i < maxPositions; i++) {
    const positionField = `position_${i}`;

    // Safely delete the axis field if it no longer exists
    if (Object.prototype.hasOwnProperty.call(updateFormData.value, positionField)) {
      delete updateFormData.value[positionField];
    }
  }
});

// Compute the selected layout type from form data
const selectedEditLayoutType = computed(() => {
  return props.layoutTypes.find(type => type.id === updateFormData.value.typeId)
})
// Update the form accordingly
watch(selectedEditLayoutType, (newLayoutType) => {
  if (!newLayoutType) return;
  // Dynamically add or remove axis fields in updateFormData.value
  newLayoutType.axes.forEach((axisType, index) => {
    const axisField = `axis_${index}`;

    // If the axis field doesn't exist, add it with an empty string
    if (!Object.prototype.hasOwnProperty.call(updateFormData.value, axisField)) {
      updateFormData.value[axisField] = props.layout.axes[index] || '';  // Initialize axis with an empty string
    }

    // Add a name for the axis if it's not already set
    if (updateFormData.value[axisField] === '') {
      updateFormData.value[axisField] = `${axisType} ${index + 1}`;  // Initialize name with the axisType and index (like 'ORDINAL 1')
    }
  });

  // Remove unused axis fields if the number of axes has decreased
  const maxAxes = Object.keys(updateFormData.value).filter(key => key.startsWith('axis_')).length;
  for (let i = newLayoutType.axes.length; i < maxAxes; i++) {
    const axisField = `axis_${i}`;

    // Safely delete the axis field if it no longer exists
    if (Object.prototype.hasOwnProperty.call(updateFormData.value, axisField)) {
      delete updateFormData.value[axisField];
    }
  }
},{immediate: true});

</script>

<template>
<div class="modal" @click.stop>
  <div class="modal-header">
    <h4>Update Layout Details</h4>
  </div>

  <FormKit
    v-model="updateFormData"
    type="form"
    @submit="submitUpdate"
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
      :excludeNodeId=null
      :getNodeLabelFn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
      validation="required"
  />

    <FormKit
      type="text"
      name="name"
      label="Layout Name (optional):"
    />

    <FormKit
      type="select"
      name="typeId"
      label="Layout Type:"
      :options="layoutTypes.map(type => ({ value: type.id, label: type.name }))"
      validation="required"
    />

    <!-- Dynamic axis name inputs based on selected layout type -->
    <div v-if="selectedEditLayoutType && selectedEditLayoutType.axes && selectedEditLayoutType.axes.length > 0" class="axes-section">
      <h5>Axis Names</h5>
      <FormKit
        v-for="(axisType, index) in selectedEditLayoutType.axes"
        :key="index"
        type="text"
        :name="`axis_${index}`"
        :label="`${axisType} Axis:`"
        :help="`Enter name for ${axisType.toLowerCase()} axis`"
        v-model="updateFormData[`axis_${index}`]"
        validation="required"
      />
    </div>

    <FormKit v-if="layout?.parent"
      type="hierarchical-select"
      name="parentId"
      label="Parent Layout:"
      help="Select a parent layout"
      :selected="parentLayout"
      :rootNodes="arrangementLayouts"
      :loadChildrenFn="loadChildLayouts"
      :childrenLoading="childLayoutsLoading"
      :currentChildren="currentChildLayouts"
      :excludeNodeId="layout.id"
      :getNodeLabelFn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
      validation="required"
    />

    <!-- Dynamic axis position inputs based on parent layout axes -->
    <div v-if="updateFormData.parentId" class="axes-section">
      <h5>Position</h5>
      <FormKit
        v-for="(axisName, index) in parentLayout.axes"
        :key="index"
        type="text"
        :name="`position_${index}`"
        :label="`${axisName} Axis:`"
        :help="`Enter position for ${axisName.toLowerCase()} axis`"
        v-model="updateFormData[`position_${index}`]"
        validation="required"
      />
    </div>
    <div v-if="updateLayoutError" class="error-message">
      {{ updateLayoutError }}
    </div>
    <div v-if="updateError" class="error-message">
      {{ updateError }}
    </div>

    <div class="form-actions">
      <button
          :disabled="updateLayoutLoading"
          type="submit"
          class="btn btn-primary">
        Update
      </button>
      <button
          type="button"
          @click="$emit('close')"
          class="btn btn-secondary"
      >
        Cancel
      </button>
    </div>
  </FormKit>
</div>
</template>

<style scoped>

</style>