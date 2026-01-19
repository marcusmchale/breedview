<script setup>
import { ref } from 'vue'

import { useMutateTrials } from '@/composables/programs/mutateTrials'

const props = defineProps({
  trial: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'success'])

const { deleteTrial, deleteTrialLoading } = useMutateTrials()

const deleteError = ref('')

const submitDelete = async () => {
  try {
    deleteError.value = ''

    const { status, errors } = await deleteTrial(props.trial.id)

    if (status === 'SUCCESS') {
      emit('success')
    } else {
      deleteError.value = errors?.[0]?.message || 'Failed to delete trial.'
    }
  } catch (error) {
    console.error('Delete trial error:', error)
    deleteError.value = error.message || 'An unexpected error occurred.'
  }
}
</script>

<template>
  <div class="modal" @click.stop>
    <div class="modal-header">
      <h2>Delete Trial</h2>
      <button @click="$emit('close')" class="modal-close">&times;</button>
    </div>

    <div class="modal-content">
      <p class="delete-warning">
        Are you sure you want to delete <strong>{{ trial.name }}</strong>?
      </p>
      <p class="delete-info">This action cannot be undone.</p>

      <div v-if="deleteError" class="error-message">
        {{ deleteError }}
      </div>

      <div class="form-actions">
        <button
          @click="submitDelete"
          class="btn btn-danger"
          :disabled="deleteTrialLoading"
        >
          {{ deleteTrialLoading ? 'Deleting...' : 'Delete' }}
        </button>
        <button
          type="button"
          @click="$emit('close')"
          class="btn btn-secondary"
          :disabled="deleteTrialLoading"
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
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 10px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.modal-close:hover {
  color: #333;
}

.modal-content {
  padding: 20px;
}

.delete-warning {
  margin: 0 0 8px 0;
  color: #333;
}

.delete-info {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 0.9em;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  border: 1px solid #f5c6cb;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>