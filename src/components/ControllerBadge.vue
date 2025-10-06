
<template>
  <div class="controller-badge-container">
    <button 
      v-if="controller"
      @click="showModal = true"
      class="controller-badge"
      :title="'Click to view controller details'"
    >
      🔒
      <span class="badge-text">Security</span>
    </button>
    
    <ControllerModal 
      :is-visible="showModal"
      :controller="controller"
      @close="showModal = false"
    />
  </div>
</template>

<script setup>
import { ref, defineProps } from 'vue'
import ControllerModal from './ControllerModal.vue'

defineProps({
  controller: {
    type: Object,
    default: null
  }
})

const showModal = ref(false)
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

.controller-badge:hover {
  background-color: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}

.controller-badge:active {
  transform: translateY(0);
}

.badge-text {
  font-weight: 500;
  white-space: nowrap;
}
</style>