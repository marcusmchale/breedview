<template>
  <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>Register New Region</h3>
      </div>

      <form @submit.prevent="submitRegion" class="modal-content">
        <div class="form-group">
          <label for="region-country">Country:</label>
          <div v-if="countriesError" class="error-message">
            Error loading countries!
          </div>
          <select
            id="region-country"
            v-model="selectedCountry"
            required
            :disabled="countriesLoading ||  createLocationLoading"
            class="form-control"
          >
            <option :value="null" disabled>Select a country...</option>
            <option v-for="country in countries" :key="country.id" :value="country">
              {{ country.name }}
            </option>
          </select>
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="createLocationLoading">
            {{ createLocationLoading ? 'Creating...' : 'Create Region' }}
          </button>
          <button type="button" @click="$emit('close')" class="btn btn-secondary" :disabled="createLocationLoading">
            Cancel
          </button>
        </div>
      </form>
    </div>
</template>

<script setup>

import { ref } from 'vue'
import { useMutateLocations } from "@/composables/regions/mutateLocations";

defineProps({
  countries: {
    type: Object,
    required: true
  },
  countriesLoading: {
    type: Boolean,
    required: true
  },
  countriesError: {
    type: [Object, null],
    required: true
  }
})

const emit = defineEmits(['success', 'close'])

const {
  createLocation,
  createLocationLoading
} = useMutateLocations()

const selectedCountry = ref(null)
const errorMessage = ref('')

const submitRegion = async () => {
    if (!selectedCountry.value) {
    errorMessage.value = 'Please select a country'
    return
  }
  errorMessage.value = ''
  try {
    const locationData = {
        name: selectedCountry.value.name,
        code: selectedCountry.value.code,
        typeId: selectedCountry.value.typeId
    }
    const { status, errors } = await createLocation(locationData)
    if (status === 'SUCCESS') {
      emit('success')
      emit('close')
    } else {
      // Handle server errors
      if (errors && errors.length > 0) {
        errorMessage.value = errors.map(err => err.message).join(', ')
      } else {
        errorMessage.value = 'Failed to create region. Please try again.'
      }
    }
  } catch (error) {
    console.error('Submit region failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

</script>

<style scoped>

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
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
  border-radius: 50%;
  transition: background-color 0.2s;
}

.modal-close:hover:not(:disabled) {
  background-color: #e9ecef;
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

.form-group {
  display: flex;
  flex-direction: column;
}


.form-control {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.form-control:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.error-message {
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  font-size: 14px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

</style>