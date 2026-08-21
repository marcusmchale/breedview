<script setup>
import { ref } from 'vue'
import ControllerModal from './ControllerModal.vue'
import { useControllerQuery } from '@/composables/controls/useControllerQuery'

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
    type: String,
    required: true
  }
})

const showModal = ref(false)
const { controller, loading, error, refetch } = useControllerQuery(
    {
      entityLabel: () => props.entityLabel,
      entityId: () => props.entityId
    }
)

const openModal = async () => {

  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const handleReleaseUpdated = async () => {
  await refetch()
}

</script>

<template>
  <div class="controller-badge-container" >
    <button
      @click="openModal"
      class="controller-badge"
      :title="'Click to view controller details'"
      :disabled="loading"

      :class="{
        'release-private': controller?.release === 'PRIVATE',
        'release-registered': controller?.release === 'REGISTERED',
        'release-public': controller?.release === 'PUBLIC'
      }"

    >
      🔒
      <span
          class="badge-text"
          :class="{
            'release-private': controller?.release === 'PRIVATE',
            'release-registered': controller?.release === 'REGISTERED',
            'release-public': controller?.release === 'PUBLIC'
          }"
      >{{ loading ? 'Loading...' : controller?.release }}</span>
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

<style scoped>
.controller-badge-container {
  display: inline-block;
}

.controller-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 12px;
  font-size: 0.75em;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.controller-badge:hover:not(:disabled) {
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

.release-private {
  background-color: #dc3545;
  color: white;
}

.release-registered {
  background-color: #ffc107;
  color: #333;
}

.release-public {
  background-color: #28a745;
  color: white;
}

</style>