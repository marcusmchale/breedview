<script setup>
import ControlTeamSelector from './ControlTeamSelector.vue'
import ReadReleaseSelector from './ReadReleaseSelector.vue'

const props = defineProps( {
  fixedRelease: String
})

const controlTeamId = defineModel('controlTeamId')
const readRelease = defineModel('readRelease')

const emit = defineEmits(['error', 'loading'])

const handleError = (error) => {
  emit('error', error)
}

const handleLoading = (isLoading) => {
  emit('loading', isLoading)
}
</script>

<template>
  <div class="control-selector">
    <div class="selector-item">
      <label>Control Team</label>
      <ControlTeamSelector
        v-model="controlTeamId"
        @error="handleError"
        @loading="handleLoading"
      />
    </div>

    <div class="selector-item">
      <label>Release</label>
      <ReadReleaseSelector v-model="readRelease" :fixedRelease=fixedRelease />
    </div>
  </div>
</template>

<style scoped>
.control-selector {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.selector-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.selector-item label {
  font-weight: 500;
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.selector-item select {
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 13px;
  background-color: white;
  cursor: pointer;
}

.selector-item select:hover {
  border-color: #999;
}

.selector-item select:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
}

.selector-item select:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>