<script setup>
import { computed } from 'vue'
import RecordGroupingForm from './RecordGroupingForm.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  grouping: {
    type: Object,
    default: null
  },
  recordGroupTypes: {
    type: Array,
    required: true
  },
  studyId: {
    type: [String, Number],
    required: true
  },
  error: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'save'])

const title = computed(() => {
  return props.grouping ? 'Edit Record Grouping' : 'Create Record Grouping'
})

const handleSave = (formData) => {
  emit('save', formData)
}

const handleClose = () => {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container">
        <div class="modal-header">
          <h2>{{ title }}</h2>
          <button class="close-btn" @click="handleClose">&times;</button>
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <RecordGroupingForm
          :grouping="grouping"
          :record-group-types="recordGroupTypes"
          :study-id="studyId"
          @save="handleSave"
          @cancel="handleClose"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 8px;
  width: 90vw;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.3rem;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 4px 8px;
}

.close-btn:hover {
  color: #333;
}

.error-message {
  padding: 12px 24px;
  background: #ffebee;
  border-bottom: 1px solid #ef5350;
  color: #c62828;
  font-size: 0.9rem;
}
</style>