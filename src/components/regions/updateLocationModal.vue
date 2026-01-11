<script setup>
import { computed, ref } from "vue";

import {FormKit} from "@formkit/vue";

import { useLocationUpdateQueries } from "@/composables/regions/locationUpdateQueries";
import { useMutateLocations } from "@/composables/regions/mutateLocations";

const props = defineProps({
  locationTypes: {
    type: Array,
    required: true
  },
  location: {
    type: Object,
    required: true
  },
  regionId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['success', 'close'])

const updateFormData = ref({
  name: props.location?.name || '',
  code: props.location?.code || '',
  address: props.location?.address || '',
  description: props.location?.description || '',
  typeId: props.location?.type.id || '',
  parentId: props.location?.parent?.id || null
})

const {
  regionLocation,
  parentLocation,

  loadChildLocations,
  locationsLoading: childrenLoading,
  locations: currentChildren
} = useLocationUpdateQueries(
    {
      regionId: props.regionId,
      parentId: () => updateFormData.value.parentId
    }
)

const {
  updateLocation, updateLocationLoading, updateLocationError
} = useMutateLocations()


const regionLocations = computed( () => {
  return regionLocation.value ? [regionLocation.value] : []
})

const updateError = ref('')

const submitUpdate = async () => {
  try {
    updateError.value = ''
    const updateData = {
        locationId: props.location.id,
        name: updateFormData.value.name || undefined,
        code: updateFormData.value.code || undefined,
        address: updateFormData.value.address || undefined,
        description: updateFormData.value.description || undefined,
        typeId: updateFormData.value.typeId || undefined,
        parentId: updateFormData.value.parentId || undefined
      }

    const { status, errors } = await updateLocation(updateData)
    if (status === 'SUCCESS') {
      emit('success')
      emit('close')
    } else {
      // Handle server errors
      if (errors && errors.length > 0) {
        updateError.value = errors.map(err => err.message).join(', ')
      } else {
        updateError.value = 'Failed to update location. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error updating location:', error)
    updateError.value = error.message || 'An unexpected error occurred while updating the location.'
  }
}

</script>

<template>
<div class="modal" @click.stop>
  <div class="modal-header">
    <h4>Update Location Details</h4>
  </div>

  <FormKit
    v-model="updateFormData"
    type="form"
    @submit="submitUpdate"
    :actions="false"
    class="modal-content"
  >
    <FormKit
      type="text"
      name="name"
      label="Location Name:"
      :placeholder="location?.name ?? 'Enter location name'"
    />

    <FormKit
      type="text"
      name="code"
      label="Code (optional):"
      :placeholder="location.code ?? 'Enter location code'"
    />

    <FormKit
      type="text"
      name="address"
      label="Address:"
      :placeholder="location.address ?? 'Enter address'"
    />

    <FormKit
      type="textarea"
      name="description"
      label="Description (optional):"
      :placeholder="location.description ?? 'Enter a description'"
    />

    <FormKit
      type="select"
      name="typeId"
      label="Location Type:"
      :placeholder="location.type.name ?? 'Select a location type'"
      :options="locationTypes.map(type => ({ value: type.id, label: type.name }))"
      validation="required"
    />

    <FormKit v-if="location.parent"
        type="hierarchical-select"
        name="parentId"
        label="Parent Location:"
        placeholder="Select a parent location"
        :selected="parentLocation"
        :rootNodes="regionLocations"
        :loadChildrenFn="loadChildLocations"
        :childrenLoading="childrenLoading"
        :currentChildren="currentChildren"
        :exclude-node-id="location.id"
        :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
        validation="required"
    />
    <div v-if="updateLocationError" class="error-message">
      {{ updateLocationError }}
    </div>

    <div v-if="updateError" class="error-message">
      {{ updateError }}
    </div>

    <div class="form-actions">
      <button
        :disabled="updateLocationLoading"
        type="submit"
        class="btn btn-primary"
      >
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