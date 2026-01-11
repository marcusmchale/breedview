<script setup>

import { ref, computed, watch } from "vue";
import { FormKit } from "@formkit/vue";

import { useMutateLayouts } from "@/composables/arrangements/mutateLayouts";

const props = defineProps({
  layoutTypes: {
    type: Array,
    required: true
  },
  locationId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['success', 'close'])

const { createLayout, createLayoutLoading, createLayoutError } = useMutateLayouts()

const createFormData = ref({
  name: '',
  typeId: null
})
const addLayoutError = ref('')

// Get the selected layout type
const selectedLayoutType = computed(() => {
  if (!createFormData.value.typeId) {
    return null
  }
  return props.layoutTypes.find(type => type.id === createFormData.value.typeId)
})

// Watch for layout type changes and reset axis fields
watch(() => createFormData.value.typeId, (newTypeId, oldTypeId) => {
  if (newTypeId !== oldTypeId) {
    // Clear axis fields when layout type changes
    const currentFormData = { ...createFormData.value }
    Object.keys(currentFormData).forEach(key => {
      if (key.startsWith('axis_')) {
        delete currentFormData[key]
      }
    })
    createFormData.value = currentFormData
  }
})

const submitAddLayout = async () => {
  try {
    addLayoutError.value = ''

    // Collect axis names from form data
    const axes = []
    if (selectedLayoutType.value?.axes) {
      for (let i = 0; i < selectedLayoutType.value.axes.length; i++) {
        const axisName = createFormData.value[`axis_${i}`]
        if (axisName) {
          axes.push(axisName)
        }
      }
    }

    const layoutData = {
        locationId: props.locationId,
        name: createFormData.value.name,
        typeId: createFormData.value.typeId,
        axes: axes.length > 0 ? axes : undefined,
    }

    const { status, errors } = await createLayout(layoutData)

    if (status === 'SUCCESS') {
      emit('close')
      emit('success')
    } else {
      // Handle server errors
      if (errors && errors.length > 0) {
        addLayoutError.value = errors.map(err => err.message).join(', ')
      } else {
        addLayoutError.value = 'Failed to add layout. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error adding layout:', error)
    addLayoutError.value = error.message || 'An unexpected error occurred.'
  }
}

</script>

<template>
  <div class="modal" @click.stop>
    <div class="modal-header">
      <h4>Add layout</h4>
    </div>

    <FormKit
      v-model="createFormData"
      type="form"
      @submit="submitAddLayout"
      :actions="false"
      class="modal-content"
    >
      <FormKit
        type="text"
        name="name"
        label="Layout Name:"
        placeholder="Enter layout name (Optional)"
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
      <div v-if="selectedLayoutType && selectedLayoutType.axes && selectedLayoutType.axes.length > 0" class="axes-section">
        <h5>Axis Names</h5>
        <FormKit
          v-for="(axisType, index) in selectedLayoutType.axes"
          :key="index"
          type="text"
          :name="`axis_${index}`"
          :label="`${axisType} Axis:`"
          :placeholder="`Enter name for ${axisType.toLowerCase()} axis`"
          validation="required"
        />
      </div>

      <div v-if="createLayoutError" class="error-message">
        {{ createLayoutError }}
      </div>
      <div v-if="addLayoutError" class="error-message">
        {{ addLayoutError }}
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="createLayoutLoading">
          {{ createLayoutLoading ? 'Adding...' : 'Add Layout' }}
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
. h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

/* Axes section styling */
.axes-section {
  padding: 12px;
  background-color: #f0f8ff;
  border: 1px solid #d0e8ff;
  border-radius: 4px;
  margin-top: 8px;
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