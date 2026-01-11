<template>
  <div class="controller-badge-container">
    <button
      @click="fetchAndShowModal"
      class="controller-badge"
      :title="'Click to view controller details'"
      :disabled="loading"
    >
      🔒
      <span class="badge-text">{{ loading ? 'Loading...' : 'Security' }}</span>
    </button>

    <ControllerModal
      :is-visible="showModal"
      :controller="controller"
      :loading="loading"
      :error="error"
      :entity-label="entityLabel"
      :entity-id="entityId"
      @close="closeModal"
      @release-updated="handleReleaseUpdated"
    />
  </div>
</template>

<script setup>
import { ref, defineProps } from 'vue'
import ControllerModal from './ControllerModal.vue'
import { useControllerData } from '../../composables/controls/useControllerData'

const props = defineProps({
  entityLabel: {
    type: String,
    required: true,
    validator: (value) => [
      'PROGRAM', 'TRIAL', 'STUDY', 'GERMPLASM', 'UNIT',
      'PERSON', 'RECORD', 'DATASET', 'LAYOUT', 'LOCATION', 'REFERENCE'
    ].includes(value)
  },
  entityId: {
    type: Number,
    required: true
  }
})

const showModal = ref(false)
const { controller, loading, error, fetchController, refetchController } = useControllerData()

const fetchAndShowModal = async () => {
  showModal.value = true

  // If we already have data, just show the modal
  if (controller.value) {
    return
  }

  // Otherwise, load the data
  await fetchController(props.entityLabel, props.entityId)
}

const closeModal = () => {
  showModal.value = false
}

const handleReleaseUpdated = async () => {
  await refetchController()
}
</script>

<style scoped>
.controller-badge-container {
  display: inline-block;
}

.controller-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 0.75em;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.controller-badge:hover:not(:disabled) {
  background-color: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}

.controller-badge:active:not(:disabled) {
  transform: translateY(0);
}

.controller-badge:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.badge-text {
  font-weight: 500;
  white-space: nowrap;
}
</style>