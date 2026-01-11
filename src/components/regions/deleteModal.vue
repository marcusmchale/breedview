<script setup>

import { ref } from 'vue'
import { useMutateLocations } from "@/composables/regions/mutateLocations";

const props = defineProps({
  location: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close','success'])

// Prepare mutation handlers
const {
  deleteLocation, deleteLocationLoading, deleteLocationError,
} = useMutateLocations()

const deleteError = ref('')

const submitDelete = async () => {
  try {
    deleteError.value = ''

    const { status, errors } = await deleteLocation(props.location.id)
    if (status === 'SUCCESS') {
      emit('success')
      emit('close')
    } else {
      // Handle server errors
      if (errors && errors.length > 0) {
        deleteError.value = errors.map(err => err.message).join(', ')
      } else {
        deleteError.value = 'Failed to delete location. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error deleting location:', error)
    deleteError.value = error.message || 'An unexpected error occurred while deleting the location.'
  }
}
</script>

<template>
  <div class="modal" @click.stop>
    <div class="modal-header">
      <h4>Delete Location</h4>
    </div>
    <div class="modal-content">
      <p class="delete-warning">
        Are you sure you want to delete <strong>{{ location.name }}</strong>?
      </p>
      <p v-if="location.children.length > 0" class="delete-warning-children">
        ⚠️ This location has {{ location.children.length }} child location(s).
      </p>
      <div v-if="deleteLocationError" class="error-message">
        {{ deleteLocationError }}
      </div>
      <div v-if="deleteError" class="error-message">
        {{ deleteError }}
      </div>
      <div class="form-actions">
        <button
          @click="submitDelete"
          class="btn btn-danger"
          :disabled="deleteLocationLoading"
        >
          {{ deleteLocationLoading ? 'Deleting...' : 'Delete' }}
        </button>
        <button
          type="button"
          @click="$emit('close')"
          class="btn btn-secondary"
          :disabled="deleteLocationLoading"
        >
          Cancel
        </button>
      </div>
    </div>
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

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #5a6268;
}


 .delete-warning {
      margin: 0 0 12px 0;
      color: #333;
      font-size: 14px;
    }

.delete-warning-children {
  margin: 8px 0 16px 0;
  color: #d9534f;
  font-size: 13px;
  padding: 8px 12px;
  background-color: #f5e6e6;
  border-radius: 4px;
}

</style>