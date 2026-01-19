<script setup>
import { ref } from 'vue'
import { FormKit } from '@formkit/vue'

import { useMutatePrograms } from '@/composables/programs/mutatePrograms'

import ReferencesModal from '@/components/references/ReferencesModal.vue'

const emit = defineEmits(['close', 'success'])

const { createProgram, createProgramLoading } = useMutatePrograms()

const formData = ref({
  name: '',
  fullname: '',
  description: ''
})

const formError = ref('')

// References state
const selectedReferenceIds = ref([])
const selectedReferences = ref([])
const isReferencesModalOpen = ref(false)

// References handlers
const openReferencesModal = () => {
  isReferencesModalOpen.value = true
}

const closeReferencesModal = () => {
  isReferencesModalOpen.value = false
}

const handleReferencesSave = ({ referenceIds, references }) => {
  selectedReferenceIds.value = referenceIds
  selectedReferences.value = references
}

const submitForm = async (values) => {
  try {
    formError.value = ''

    const cleanValues = Object.fromEntries(
      Object.entries(values)
        .filter(([, value]) => value && value.toString().trim() !== '')
        .map(([key, value]) => [key, value.toString().trim()])
    )

    // Add reference IDs if any selected
    if (selectedReferenceIds.value.length > 0) {
      cleanValues.referenceIds = selectedReferenceIds.value
    }

    const { status, errors } = await createProgram(cleanValues)

    if (status === 'SUCCESS') {
      emit('success')
    } else {
      formError.value = errors?.[0]?.message || 'Failed to create program.'
    }
  } catch (error) {
    console.error('Create program error:', error)
    formError.value = error.message || 'An unexpected error occurred.'
  }
}
</script>

<template>
  <div class="modal" @click.stop>
    <div class="modal-header">
      <h2>Create Program</h2>
      <button @click="$emit('close')" class="modal-close">&times;</button>
    </div>

    <div class="modal-content">
      <div v-if="formError" class="error-message">
        {{ formError }}
      </div>

      <FormKit
        type="form"
        v-model="formData"
        @submit="submitForm"
        :actions="false"
      >
        <FormKit
          type="text"
          name="name"
          label="Name"
          validation="required"
          placeholder="Enter program name"
        />

        <FormKit
          type="text"
          name="fullname"
          label="Full Name"
          placeholder="Enter full program name"
        />

        <FormKit
          type="textarea"
          name="description"
          label="Description"
          placeholder="Enter program description"
          :input-attrs="{ rows: 4 }"
        />

        <!-- References Section -->
        <div class="reference-section">
          <label class="section-label">References</label>
          <div class="section-content">
            <div v-if="selectedReferences.length > 0" class="selected-summary">
              <span>{{ selectedReferences.length }} reference(s) selected</span>
              <button type="button" class="btn btn-sm btn-link" @click="openReferencesModal">
                Manage
              </button>
            </div>
            <button
              v-else
              type="button"
              class="btn btn-outline"
              @click="openReferencesModal"
            >
              + Add References
            </button>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="createProgramLoading">
            {{ createProgramLoading ? 'Creating...' : 'Create Program' }}
          </button>
          <button type="button" @click="$emit('close')" class="btn btn-secondary">
            Cancel
          </button>
        </div>
      </FormKit>
    </div>

    <!-- References Modal -->
    <ReferencesModal
      :visible="isReferencesModalOpen"
      :selectedReferenceIds="selectedReferenceIds"
      :initialReferences="selectedReferences"
      @close="closeReferencesModal"
      @save="handleReferencesSave"
    />
  </div>
</template>

<style scoped>
.modal {
  background: white;
  border-radius: 8px;
  max-width: 550px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
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
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: #333;
}

.modal-content {
  padding: 20px;
}

.reference-section {
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.section-label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.section-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.selected-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #333;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
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

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}

.btn-outline {
  background-color: transparent;
  color: #007bff;
  border: 1px solid #007bff;
}

.btn-outline:hover {
  background-color: #007bff;
  color: white;
}

.btn-link {
  background: none;
  color: #007bff;
  padding: 4px 8px;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>