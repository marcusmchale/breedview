<script setup>
defineProps({
  isSubmitting: { type: Boolean, default: false },
  hasUnsavedChanges: { type: Boolean, default: false },
  allSubmitted: { type: Boolean, default: false },
  // when changes were last saved, shown until the next change
  savedAt: { type: Date, default: null }
})

const timeOf = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

defineEmits(['submit'])
</script>

<template>
  <div class="table-footer">
    <span v-if="savedAt && !hasUnsavedChanges && !isSubmitting" class="saved-note">✓ Saved at {{ timeOf(savedAt) }}</span>
    <!-- the table stays open after a save, and a change made since can be saved in turn -->
    <button
      class="btn btn-primary"
      @click="$emit('submit')"
      :disabled="isSubmitting || !hasUnsavedChanges"
    >
      <span v-if="isSubmitting">Submitting...</span>
      <span v-else-if="allSubmitted && !hasUnsavedChanges">All Saved</span>
      <span v-else>Save Changes</span>
    </button>
  </div>
</template>

<style scoped>
.table-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
}

.saved-note {
  color: #2e7d32;
  font-size: 14px;
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
  background: var(--brand-accent);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--brand-accent-dark);
}
</style>