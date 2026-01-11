<script setup>

import { ref } from 'vue'
import { useMutateLayouts } from "@/composables/arrangements/mutateLayouts";

const props = defineProps({
  layout: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'success'])

// Prepare mutation handlers
const {
  deleteLayout, deleteLayoutLoading, deleteLayoutError
} = useMutateLayouts()

const deleteError = ref('')

const submitDelete = async () => {
  try {
    deleteError.value = ''
    const { status, errors } = await deleteLayout(props.layout.id)
    if (status === 'SUCCESS') {
      emit('close')
    } else {
      if (errors && errors.length > 0) {
        deleteError.value = errors.map(err => err.message).join(', ')
      } else {
        deleteError.value = 'Failed to delete layout. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error deleting layout:', error)
    deleteError.value = error.message || 'An unexpected error occurred.'
  }
}

</script>

<template>
<div class="modal" @click.stop>
  <div class="modal-header">
  <h4>Delete Layout</h4>
  </div>

  <div class="modal-content">
    <p class="delete-warning">
      Are you sure you want to delete
      <strong>{{ props.layout.name || `${props.layout.type?.name} ${props.layout.id}` }}</strong>?
    </p>
    <div v-if="deleteLayoutError" class="error-message">
      {{ deleteLayoutError }}
    </div>
    <div v-if="deleteError" class="error-message">
      {{ deleteError }}
    </div>
    <p v-if="props.layout.children.length > 0" class="delete-warning-children">
      ⚠️ This layout has {{ props.layout.children.length }} child layout(s).
    </p>

    <div class="form-actions">
      <button
        @click="submitDelete"
        class="btn btn-danger"
        :disabled="deleteLayoutLoading"
      >
        {{ deleteLayoutLoading ? 'Deleting...' : 'Delete' }}
      </button>
      <button
        type="button"
        @click="$emit('close')"
        class="btn btn-secondary"
        :disabled="deleteLayoutLoading"
      >
        Cancel
      </button>
    </div>
  </div>
</div>
</template>

<style scoped>

</style>