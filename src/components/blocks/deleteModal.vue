<script setup>

import { ref } from 'vue'
import { useMutateUnits } from "@/composables/blocks/mutateUnits";

const props = defineProps({
  unit: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'success'])

// Prepare mutation handlers
const {
  deleteUnit, deleteUnitLoading, deleteUnitError
} = useMutateUnits()

const deleteError = ref('')

const submitDelete = async () => {
  try {
    deleteError.value = ''
    const { status, errors } = await deleteUnit(props.unit.id)
    if (status === 'SUCCESS') {
      emit('close')
    } else {
      if (errors && errors.length > 0) {
        deleteError.value = errors.map(err => err.message).join(', ')
      } else {
        deleteError.value = 'Failed to delete unit. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error deleting unit:', error)
    deleteError.value = error.message || 'An unexpected error occurred.'
  }
}

</script>

<template>
<div class="modal" @click.stop>
  <div class="modal-header">
  <h4>Delete Unit</h4>
  </div>

  <div class="modal-content">
    <p class="delete-warning">
      Are you sure you want to delete
      <strong>{{ props.unit.name || `${props.unit.subject?.name} ${props.unit.id}` }}</strong>?
    </p>
    <div v-if="deleteUnitError" class="error-message">
      {{ deleteUnitError }}
    </div>
    <div v-if="deleteError" class="error-message">
      {{ deleteError }}
    </div>
    <p v-if="props.unit.children.length > 0" class="delete-warning-children">
      ⚠️ This unit has {{ props.unit.children.length }} child unit(s).
    </p>

    <div class="form-actions">
      <button
        @click="submitDelete"
        class="btn btn-danger"
        :disabled="deleteUnitLoading"
      >
        {{ deleteUnitLoading ? 'Deleting...' : 'Delete' }}
      </button>
      <button
        type="button"
        @click="$emit('close')"
        class="btn btn-secondary"
        :disabled="deleteUnitLoading"
      >
        Cancel
      </button>
    </div>
  </div>
</div>
</template>

<style scoped>

</style>