<script setup>
import { ref, computed, onMounted } from 'vue'
import { FormKit } from '@formkit/vue'

import { useMutateStudies } from '@/composables/programs/mutateStudies'
import { useDesignTypesQuery } from '@/composables/programs/designTypesQuery'

import ReferencesModal from '@/components/references/ReferencesModal.vue'
import LicenceModal from '@/components/references/LicenceModal.vue'

const props = defineProps({
  study: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'success'])

const { updateStudy, updateStudyLoading } = useMutateStudies()
const { designTypes, designTypesLoading } = useDesignTypesQuery()

const designOptions = computed(() => {
  return designTypes.value.map(design => ({
    value: design.id,
    label: design.name
  }))
})

const formData = ref({
  name: props.study.name || '',
  fullname: props.study.fullname || '',
  description: props.study.description || '',
  practices: props.study.practices || '',
  start: props.study.start || '',
  end: props.study.end || '',
  designId: props.study.design?.id || null
})

const formError = ref('')

// References state - initialize from study data
const selectedReferenceIds = ref(props.study.references?.map(r => r.id) || [])
const selectedReferences = ref(props.study.references || [])
const isReferencesModalOpen = ref(false)

// Licence state - initialize from study data
const selectedLicence = ref(props.study.licence || null)
const isLicenceModalOpen = ref(false)

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

// Licence handlers
const openLicenceModal = () => {
  isLicenceModalOpen.value = true
}

const closeLicenceModal = () => {
  isLicenceModalOpen.value = false
}

const handleLicenceSave = (licence) => {
  selectedLicence.value = licence
}

const submitForm = async (values) => {
  try {
    formError.value = ''

    const cleanValues = {
      studyId: props.study.id,
      name: values.name?.trim() || undefined,
      fullname: values.fullname?.trim() || undefined,
      description: values.description?.trim() || undefined,
      practices: values.practices?.trim() || undefined,
      start: values.start?.trim() || undefined,
      end: values.end?.trim() || undefined,
      designId: values.designId || undefined,
      referenceIds: selectedReferenceIds.value,
      licenceId: selectedLicence.value?.id || null
    }

    // Remove undefined values (except studyId and arrays)
    Object.keys(cleanValues).forEach(key => {
      if (cleanValues[key] === undefined && key !== 'studyId') {
        delete cleanValues[key]
      }
    })

    const { status, errors } = await updateStudy(cleanValues)

    if (status === 'SUCCESS') {
      emit('success')
    } else {
      formError.value = errors?.[0]?.message || 'Failed to update study.'
    }
  } catch (error) {
    console.error('Update study error:', error)
    formError.value = error.message || 'An unexpected error occurred.'
  }
}
</script>

<template>
  <div class="modal" @click.stop>
    <div class="modal-header">
      <h2>Edit Study</h2>
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
          label="Study Name"
          validation="required"
          placeholder="Enter study name"
        />

        <FormKit
          type="text"
          name="fullname"
          label="Full Name"
          placeholder="Enter full study name"
        />

        <FormKit
          type="textarea"
          name="description"
          label="Description"
          placeholder="Enter study description"
          :input-attrs="{ rows: 3 }"
        />

        <FormKit
          type="textarea"
          name="practices"
          label="Practices"
          placeholder="Describe study practices"
          :input-attrs="{ rows: 2 }"
        />

        <div class="date-inputs">
          <FormKit
            type="text"
            name="start"
            label="Start Date/Time"
            help="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
            validation="partialDateTime"
            placeholder="e.g. 2024-01-15"
          />

          <FormKit
            type="text"
            name="end"
            label="End Date/Time"
            help="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
            validation="partialDateTime"
            placeholder="e.g. 2024-12-31"
          />
        </div>

        <FormKit
          type="select"
          name="designId"
          label="Design"
          placeholder="Select a design (optional)"
          :options="designOptions"
          :disabled="designTypesLoading"
        />

        <!-- Licence Section -->
        <div class="reference-section">
          <label class="section-label">Licence</label>
          <div class="section-content">
            <div v-if="selectedLicence" class="selected-item">
              <span class="item-icon">⚖️</span>
              <span class="item-description">{{ selectedLicence.description || 'Legal Reference #' + selectedLicence.id }}</span>
              <button type="button" class="btn btn-sm btn-link" @click="openLicenceModal">
                Change
              </button>
            </div>
            <button
              v-else
              type="button"
              class="btn btn-outline"
              @click="openLicenceModal"
            >
              + Select Licence
            </button>
          </div>
        </div>

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
          <button type="submit" class="btn btn-primary" :disabled="updateStudyLoading">
            {{ updateStudyLoading ? 'Updating...' : 'Update Study' }}
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

    <!-- Licence Modal -->
    <LicenceModal
      :visible="isLicenceModalOpen"
      :currentLicence="selectedLicence"
      @close="closeLicenceModal"
      @save="handleLicenceSave"
    />
  </div>
</template>

<style scoped>
.modal {
  background: white;
  border-radius: 8px;
  max-width: 600px;
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
}

.modal-close:hover {
  color: #333;
}

.modal-content {
  padding: 20px;
}

.date-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
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

.selected-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.item-icon {
  font-size: 1.2em;
}

.item-description {
  flex: 1;
  color: #333;
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