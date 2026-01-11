<template>
  <div class="modal" @click.stop>
    <div class="modal-header">
      <h4>Add Child Location</h4>
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
        label="Parent Location:"
        disabled
      />

      <FormKit
        type="select"
        name="typeId"
        label="Location Type:"
        placeholder="Select a location type"
        :options="locationTypes.map(type => ({ value: type.id, label: type.name }))"
        validation="required"
      />

      <FormKit
        type="text"
        name="name"
        label="Location Name:"
        placeholder="Enter location name"
        validation="required"
      />

      <FormKit
        type="text"
        name="code"
        label="Code (optional):"
        placeholder="e.g., zip code"
      />

      <FormKit
        type="text"
        name="address"
        label="Address (optional):"
        placeholder="Enter address"
      />

      <FormKit
        type="textarea"
        name="description"
        label="Description (optional):"
        placeholder="Enter description"
      />

      <div v-if="createLocationError" class="error-message">
        {{ createLocationError }}
      </div>
      <div v-if="addChildError" class="error-message">
        {{ addChildError }}
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="createLocationLoading">
          {{ createLocationLoading ? 'Adding...' : 'Add Child' }}
        </button>
        <button
          type="button"
          @click="$emit('close')"
          class="btn btn-secondary"
          :disabled="createLocationLoading"
        >
          Cancel
        </button>
      </div>
    </FormKit>
  </div>

</template>

<script setup>
import { ref } from "vue";
import { FormKit } from '@formkit/vue'

import { useMutateLocations } from "@/composables/regions/mutateLocations";

const props = defineProps({
  locationTypes: {
    type: Array,
    required: true
  },
  parentLocation: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['success', 'close'])

// Prepare mutation handlers
const {
  createLocation, createLocationLoading, createLocationError,
} = useMutateLocations()

const addChildFormData = ref({
  parentName: props.parentLocation?.name || '',
  typeId: null,
  name: '',
  code: '',
  address: '',
  description: ''
})
const addChildError = ref('')

const submitAddChild = async () => {
  try {

    const locationData = {
        name: addChildFormData.value.name,
        code: addChildFormData.value.code || undefined,
        address: addChildFormData.value.address || undefined,
        description: addChildFormData.value.description || undefined,
        typeId: addChildFormData.value.typeId,
        parentId: props.parentLocation.id
    }

    const { status, errors } = await createLocation(locationData)
    if (status === 'SUCCESS') {
      emit('success')
      emit('close')
    } else {
      // Handle server errors
      if (errors && errors.length > 0) {
        addChildError.value = errors.map(err => err.message).join(', ')
      } else {
        addChildError.value = 'Failed to add child location. Please try again.'
      }
    }
  } catch (error) {
    addChildError.value = error.message || 'An unexpected error occurred while adding the child location.'
  }
}

</script>


<style scoped>

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

.btn-secondary:hover {
  background-color: #5a6268;
}

</style>