<script setup>
import { ref, watch } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import { FormKit } from "@formkit/vue";


import ReferencesModal from '@/components/references/ReferencesModal.vue'
import { REFERENCE_TYPE_CONFIGS } from '@/composables/references/referenceTypes'

import COMMIT_VERSION from '@/graphql/ontology/commitVersion.graphql'

const props = defineProps({
  // the latest commit: the new version keeps its licence and copyright unless they are changed here
  latestCommit: { type: Object, default: null }
})
const emit = defineEmits(['success', 'cancel'])

const { mutate: commitVersion } = useMutation(COMMIT_VERSION)

const formData = ref({})

// Licence state
const selectedLicence = ref(null)
const isLicenceModalOpen = ref(false)

// Copyright state
const selectedCopyright = ref(null)
const isCopyrightModalOpen = ref(false)

// The latest commit's licence and copyright, as they load: the form can open before they have, and then takes them
// when they do, unless one is being chosen here, or was (its chooser opened), so nothing changes under the chooser
const chosen = { licence: false, copyright: false }
watch(() => props.latestCommit, (commit) => {
  if (!chosen.licence) selectedLicence.value = commit?.licence ?? null
  if (!chosen.copyright) selectedCopyright.value = commit?.copyright ?? null
}, { immediate: true })
watch(isLicenceModalOpen, (open) => { if (open) chosen.licence = true })
watch(isCopyrightModalOpen, (open) => { if (open) chosen.copyright = true })

const legalReferenceTypes = [REFERENCE_TYPE_CONFIGS.LEGAL]
// the ontology is shared, so the API refuses a licence or copyright that isn't public
const PUBLIC_ONLY = 'The ontology is shared, so its licence and copyright must be public references.'

// Licence handlers
const handleLicenceSave = ({ references }) => {
  selectedLicence.value = references[0] ?? null
}

// the version without the copyright the form started with: the chooser can't untick its one choice. The licence can't
// be removed: a version without one keeps the latest's (breedgraph docs/licences.md §6)
const clearCopyright = () => {
  chosen.copyright = true
  selectedCopyright.value = null
}

// Copyright handlers
const handleCopyrightSave = ({ references }) => {
  selectedCopyright.value = references[0] ?? null
}

const handleSubmit = async (formDataValues) => {
  try {
    const result = await commitVersion({
      versionChange: formDataValues.versionChange,
      comment: formDataValues.comment,
      licenceId: selectedLicence.value?.id ?? null,
      copyrightId: selectedCopyright.value?.id ?? null,
    })

    const response = result.data?.ontologyCommitVersion

    if (response?.errors?.length) {
      alert('Error: ' + response.errors.map(e => e.message).join(', '))
      return
    }

    if (response?.status === 'SUCCESS' || response?.status === 'success') {
      emit('success')
    }
  } catch (error) {
    console.error('Commit version mutation error:', error)
    alert('An error occurred: ' + error.message)
  }
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<template>
  <div class="form-modal">
    <div class="form-container">
      <h2>Commit Ontology Version</h2>
      <FormKit
        type="form"
        @submit="handleSubmit"
        :actions="false"
        v-model="formData"
      >
        <FormKit
          type="select"
          name="versionChange"
          label="Version Change Type"
          validation="required"
          placeholder="Select version change type"
          :options="['MAJOR', 'MINOR', 'PATCH']"
        />

        <FormKit
          type="textarea"
          name="comment"
          label="Version Comment"
          validation="required"
          placeholder="Enter version comment"
        />

        <p class="reference-help">
          The licence and copyright must be public references, as the ontology is shared. They start as the current
          version's.
        </p>

        <!-- Licence Section -->
        <div class="reference-section">
          <label class="section-label">Licence</label>
          <p class="reference-help licence-note">
            The ontology is published under CC BY 4.0 unless changed here, and the new version keeps the current
            licence unless another is chosen; it can't be removed. Entries contributed under CC BY 4.0, and the CRediT
            roles from NISO, stay under CC BY 4.0 with their attribution, whatever licence a new version names, so
            choose one that allows this.
          </p>
          <div class="section-content">
            <div v-if="selectedLicence" class="selected-item">
              <span class="item-icon">⚖️</span>
              <span class="item-description">{{ selectedLicence.description || 'Legal Reference #' + selectedLicence.id }}</span>
              <button type="button" class="btn-link" @click="isLicenceModalOpen = true">Change</button>
            </div>
            <button
              v-else
              type="button"
              class="btn-outline"
              @click="isLicenceModalOpen = true"
            >
              + Select Licence
            </button>
          </div>
        </div>

        <!-- Copyright Section -->
        <div class="reference-section">
          <label class="section-label">Copyright (Optional)</label>
          <div class="section-content">
            <div v-if="selectedCopyright" class="selected-item">
              <span class="item-icon">©️</span>
              <span class="item-description">{{ selectedCopyright.description || 'Legal Reference #' + selectedCopyright.id }}</span>
              <button type="button" class="btn-link" @click="isCopyrightModalOpen = true">Change</button>
              <button type="button" class="btn-link" @click="clearCopyright">Remove</button>
            </div>
            <button
              v-else
              type="button"
              class="btn-outline"
              @click="isCopyrightModalOpen = true"
            >
              + Select Copyright
            </button>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-version">Commit</button>
          <button type="button" class="btn-cancel" @click="handleCancel">Cancel</button>
        </div>
      </FormKit>
    </div>
  </div>

  <!-- Licence Modal -->
  <ReferencesModal
    :visible="isLicenceModalOpen"
    :referenceTypes="legalReferenceTypes"
    :selectedReferenceIds="selectedLicence ? [selectedLicence.id] : []"
    :initialReferences="selectedLicence ? [selectedLicence] : []"
    selectionMode="single"
    title="Select Licence"
    public-only
    offer-standard-licences
    :notice="PUBLIC_ONLY"
    @close="isLicenceModalOpen = false"
    @save="handleLicenceSave"
  />

  <!-- Copyright Modal -->
  <ReferencesModal
    :visible="isCopyrightModalOpen"
    :referenceTypes="legalReferenceTypes"
    :selectedReferenceIds="selectedCopyright ? [selectedCopyright.id] : []"
    :initialReferences="selectedCopyright ? [selectedCopyright] : []"
    selectionMode="single"
    title="Select Copyright"
    public-only
    :notice="PUBLIC_ONLY"
    @close="isCopyrightModalOpen = false"
    @save="handleCopyrightSave"
  />
</template>

<style scoped>
.form-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.form-container {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  min-width: 400px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  justify-content: flex-end;
}

.btn-cancel {
  background-color: #f44336;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-cancel:hover {
  background-color: #da190b;
}

.btn-version {
  background-color: #4caf50;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-version:hover {
  background-color: #45a049;
}

.reference-help {
  margin: 16px 0 0;
  color: #666;
  font-size: 0.9rem;
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

.btn-outline {
  background-color: transparent;
  color: #4caf50;
  border: 1px solid #4caf50;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.btn-outline:hover {
  background-color: #4caf50;
  color: white;
}

.btn-link {
  background: none;
  border: none;
  color: var(--brand-accent);
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
}

.btn-link:hover {
  text-decoration: underline;
}
</style>