<script setup>
defineProps({
  isSubmitting: { type: Boolean, default: false },
  hasUnsavedChanges: { type: Boolean, default: false },
  allSubmitted: { type: Boolean, default: false }
})

const emit = defineEmits(['submit'])
</script>

<template>
  <div class="table-footer">
    <button
      class="btn btn-primary"
      @click="$emit('submit')"
      :disabled="isSubmitting || !hasUnsavedChanges || allSubmitted"
    >
      <span v-if="isSubmitting">Submitting...</span>
      <span v-else-if="allSubmitted">All Saved</span>
      <span v-else>Save Changes</span>
    </button>
  </div>
</template>

<style scoped>
.table-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.btn {
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
}
</style>