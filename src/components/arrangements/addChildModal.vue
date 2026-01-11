<script setup>

import { ref, computed, watch} from "vue";
import { useMutateLayouts } from "@/composables/arrangements/mutateLayouts";
import { FormKit } from "@formkit/vue";

const props = defineProps({
  parentLayout: {
    type: Object,
    required: false
  },
  layoutTypes: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['close', 'success']) // to close layoutDetails modal if the last and is deleted

// Prepare mutation handlers
const {
  createLayout, createLayoutLoading, createLayoutError
} = useMutateLayouts()

const addChildFormData = ref({
  parentName: props.parentLayout?.name || `${props.parentLayout?.subject?.name} ${props.parentLayout?.id}`,
  name: '',
  typeId: null,
  position: null
})

const addChildError = ref('')

// Get the selected layout type for form axis name fields
const selectedAddChildLayoutType = computed(() => {
  if (!addChildFormData.value.typeId) {
    return null
  }
  return props.layoutTypes.find(type => type.id === addChildFormData.value.typeId)
})

const submitAddChild = async () => {
  try {
    addChildError.value = ''

    // Collect axis names from form data
    const axes = []
    if (selectedAddChildLayoutType.value?.axes) {
      for (let i = 0; i < selectedAddChildLayoutType.value.axes.length; i++) {
        const axisName = addChildFormData.value[`axis_${i}`]
        if (axisName) {
          axes.push(axisName)
        }
      }
    }

    // Collect position values from form data
    const positions = []
    if (props.parentLayout) {
      for (let i = 0; i < props.parentLayout.axes.length; i++) {
        const axisPosition = addChildFormData.value[`position_${i}`]
        if (axisPosition) {
          positions.push(axisPosition)
        }
      }
    }
    const layoutData = {
        locationId: props.parentLayout.location.id,
        name: addChildFormData.value.name,
        typeId: addChildFormData.value.typeId,
        parentId: props.parentLayout.id,
        position: positions.length > 0 ? positions: undefined,
        axes: axes.length > 0 ? axes : undefined
    }
    const { status, errors } = await createLayout(layoutData)
    if (status === 'SUCCESS') {
      emit('close')
      emit('success')
    } else {
      if (errors && errors.length > 0) {
        addChildError.value = errors.map(err => err.message).join(', ')
      } else {
        addChildError.value = 'Failed to add child layout. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error adding child layout:', error)
    addChildError.value = error.message || 'An unexpected error occurred. '
  }
}


// Watch for layout type changes in add child form and reset axis fields
watch(() => addChildFormData.value.typeId, (newTypeId, oldTypeId) => {
  if (newTypeId !== oldTypeId) {
    // Clear axis fields when layout-type changes
    const currentFormData = { ...addChildFormData.value }
    Object.keys(currentFormData).forEach(key => {
      if (key.startsWith('axis_')) {
        delete currentFormData[key]
      }
    })
    addChildFormData.value = currentFormData
  }
})

</script>

<template>
<div class="modal" @click.stop>
  <div class="modal-header">
    <h4>Add Child Layout</h4>
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
      label="Parent Layout:"
      disabled
    />

    <!-- Dynamic axis position inputs based on parent layout axes -->
    <div v-if="parentLayout" class="axes-section">
      <h5>Position</h5>
      <FormKit
        v-for="(axisName, index) in parentLayout.axes"
        :key="index"
        type="text"
        :name="`position_${index}`"
        :label="`${axisName} Axis:`"
        :placeholder="`Enter position for ${axisName.toLowerCase()} axis`"
        validation="required"
      />
    </div>

    <FormKit
      type="text"
      name="name"
      label="Layout Name:"
      placeholder="Enter layout name (optional)"
    />

    <FormKit
      type="select"
      name="typeId"
      label="Layout Type:"
      placeholder="Select a layout type"
      :options="layoutTypes.map(type => ({ value: type.id, label: type.name }))"
      validation="required"
    />

    <!-- Dynamic axis name inputs based on selected layout type -->
    <div v-if="selectedAddChildLayoutType && selectedAddChildLayoutType.axes && selectedAddChildLayoutType.axes.length > 0" class="axes-section">
      <h5>Axis Names</h5>
      <FormKit
        v-for="(axisType, index) in selectedAddChildLayoutType.axes"
        :key="index"
        type="text"
        :name="`axis_${index}`"
        :label="`${axisType} Axis:`"
        :placeholder="`Enter name for ${axisType.toLowerCase()} axis`"
        v-model="addChildFormData[`axis_${index}`]"
        validation="required"
      />
    </div>

    <div v-if="createLayoutError" class="error-message">
      {{ createLayoutError }}
    </div>
    <div v-if="addChildError" class="error-message">
      {{ addChildError }}
    </div>

    <div class="form-actions">
      <button type="submit" class="btn btn-primary" :disabled="createLayoutLoading">
        {{ createLayoutLoading ? 'Adding...' : 'Add Child' }}
      </button>
      <button
        type="button"
        @click="$emit('close')"
        class="btn btn-secondary"
        :disabled="createLayoutLoading"
      >
        Cancel
      </button>
    </div>
  </FormKit>
</div>
</template>

<style scoped>

</style>