<!-- src/components/references/LegalReferenceForm.vue: a legal reference, such as a licence, given as typed text or as a
     .txt, .md or .pdf file whose text breedgraph reads on upload. Changing the text changes what accepting it agrees to,
     so those who accepted it are asked again. -->
<script setup>
import { ref, computed, watch, markRaw } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'
import { useMutateReferences } from '@/composables/references/mutateReferences'
import { pollFileSubmission } from '@/composables/references/fileSubmissionQuery'

import ControlSelector from "@/components/controls/ControlSelector.vue";
import ControllerBadge from '@/components/controls/ControllerBadge.vue'
import UploadStatus from '@/components/references/UploadStatus.vue'

const props = defineProps({
    reference: {
        type: Object,
        default: null
    },
    mode: {
        type: String,
        default: 'create',
        validator: (v) => ['create', 'edit'].includes(v)
    },
    // the release a new reference must have, e.g. PUBLIC where only public references can be chosen
    fixedRelease: {
        type: String,
        default: undefined
    }
})

const emit = defineEmits(['success', 'cancel', 'created'])

const FORMATS = [
    { value: 'PLAIN', label: 'Plain text' },
    { value: 'MARKDOWN', label: 'Markdown' }
]
// the formats breedgraph reads, by extension
const ACCEPTED_FILES = '.txt,.md,.pdf'

const { resolveClient } = useApolloClient()
const {
    createLegalReference,
    createLegalReferenceLoading,
    updateLegalReference,
    updateLegalReferenceLoading,
    createLegalFileReference,
    createLegalFileReferenceLoading,
    updateLegalFileReference,
    updateLegalFileReferenceLoading,
    refetchLegalReference
} = useMutateReferences()

const givenAsFile = (reference) => Boolean(reference?.filename || reference?.fileId)
const emptyForm = () => ({ description: '', text: '', textFormat: 'PLAIN' })

// typed text, or a file: a reference given as a file is edited by uploading a new one, or by typing its text instead
const source = ref(givenAsFile(props.reference) ? 'file' : 'text')
const formData = ref(emptyForm())
const file = ref(null)

const formError = ref('')
// the team selector's own message, apart from the form's: it clears it on each result, which would hide the form's
const teamError = ref('')
const uploadStatus = ref(null)
const uploadProgress = ref(0)
const uploadErrors = ref([])
const createdReferenceId = ref(null)
const selectedControlTeamId = ref(null)
const selectedRelease = ref(null)

const handleControlTeamError = (errorMessage) => {
  teamError.value = errorMessage || ''
}

const isEditing = computed(() => props.mode === 'edit' && props.reference?.id)
const isLoading = computed(() =>
    createLegalReferenceLoading.value ||
    updateLegalReferenceLoading.value ||
    createLegalFileReferenceLoading.value ||
    updateLegalFileReferenceLoading.value ||
    uploadStatus.value === 'uploading'
)
const canSubmit = computed(() => {
    if (isLoading.value) return false
    if (source.value === 'text') return Boolean(formData.value.text.trim())
    // editing a reference given as a file, a new file is optional: without one, only its description changes
    return Boolean(file.value) || (isEditing.value && givenAsFile(props.reference))
})

watch(() => props.reference, (newRef) => {
    if (newRef) {
        formData.value = {
            description: newRef.description || '',
            text: givenAsFile(newRef) ? '' : (newRef.text || ''),
            textFormat: newRef.textFormat || 'PLAIN'
        }
        source.value = givenAsFile(newRef) ? 'file' : 'text'
    }
}, { immediate: true })

const handleFileSelect = (event) => {
    const selected = event.target.files[0]
    file.value = selected ? markRaw(selected) : null
}

const handleFileInputClick = (event) => {
    event.target.value = ''
}

const description = () => formData.value.description?.trim() || null

const followUpload = (key, onSaved) => {
    uploadStatus.value = 'uploading'
    const { startPolling } = pollFileSubmission({
        client: resolveClient(),
        fileId: key,
        onUpdate: ({ status, progress }) => {
            if (status) uploadStatus.value = status.toLowerCase()
            if (progress !== undefined) uploadProgress.value = progress
        },
        onComplete: ({ referenceId, status, errors }) => {
            if (status === 'COMPLETED') {
                uploadStatus.value = 'success'
                onSaved(referenceId)
            } else {
                uploadStatus.value = 'error'
                uploadErrors.value = errors || ['Upload failed']
            }
        }
    })
    startPolling()
}

const createFromText = async () => {
    const reference = { description: description(), text: formData.value.text.trim(), textFormat: formData.value.textFormat }
    const { result, status, errors } = await createLegalReference({
        reference,
        controlTeamId: selectedControlTeamId,
        release: selectedRelease
    })
    if (status !== 'SUCCESS') {
        formError.value = errors?.[0]?.message || 'Failed to create reference'
        return
    }
    createdReferenceId.value = result
    emit('created', { id: result, __typename: 'LegalReference', ...reference })
    formData.value = emptyForm()
}

const createFromFile = async () => {
    const filename = file.value.name
    const { result: key, status, errors } = await createLegalFileReference({
        reference: { description: description(), file: file.value },
        controlTeamId: selectedControlTeamId,
        release: selectedRelease
    })
    if (status !== 'SUCCESS') {
        // a file breedgraph can't read is refused at once, saying why
        formError.value = errors?.[0]?.message || 'Failed to create reference'
        return
    }
    followUpload(key, (referenceId) => {
        createdReferenceId.value = referenceId
        emit('created', {
            id: referenceId,
            __typename: 'LegalReference',
            description: description() || filename,
            filename
        })
        file.value = null
        formData.value = emptyForm()
    })
}

const update = async () => {
    const id = props.reference.id
    if (source.value === 'file' && file.value) {
        const { result: key, status, errors } = await updateLegalFileReference({ id, description: description(), file: file.value })
        if (status !== 'SUCCESS') {
            formError.value = errors?.[0]?.message || 'Failed to update reference'
            return
        }
        followUpload(key, () => {
            refetchLegalReference(id, ['text', 'textFormat', 'contentHash', 'filename', 'contentType', 'fileId'])
            file.value = null
            emit('success', { id, description: description() })
        })
        return
    }
    // typed text replaces a file the reference was read from; without text, only the description changes
    const reference = source.value === 'text'
        ? { id, description: description(), text: formData.value.text.trim(), textFormat: formData.value.textFormat }
        : { id, description: description() }
    const { status, errors } = await updateLegalReference(reference)
    if (status === 'SUCCESS') {
        emit('success', reference)
    } else {
        formError.value = errors?.[0]?.message || 'Failed to update reference'
    }
}

const submitForm = async () => {
    formError.value = ''
    uploadErrors.value = []
    try {
        if (isEditing.value) {
            await update()
        } else if (source.value === 'file') {
            await createFromFile()
        } else {
            await createFromText()
        }
    } catch (error) {
        console.error('Legal reference error:', error)
        formError.value = error.message || 'An unexpected error occurred'
    }
}

const resetForm = () => {
    formData.value = emptyForm()
    file.value = null
    formError.value = ''
    uploadStatus.value = null
    uploadProgress.value = 0
    uploadErrors.value = []
    createdReferenceId.value = null
}
</script>

<template>
    <div class="legal-reference-form">
        <div v-if="isEditing && reference?.id" class="reference-header">
            <span class="reference-id">Reference #{{ reference.id }}</span>
            <ControllerBadge
                entity-label="REFERENCE"
                :entity-id="reference.id"
            />
        </div>

        <div v-if="formError || teamError" class="error-message">
            {{ formError || teamError }}
        </div>

        <div v-if="createdReferenceId && uploadStatus !== 'uploading'" class="success-message">
            <span>✓ Reference #{{ createdReferenceId }} created successfully!</span>
            <ControllerBadge
                entity-label="REFERENCE"
                :entity-id="createdReferenceId"
            />
        </div>

        <div class="form-group">
            <label for="legal-description">Description</label>
            <textarea
                id="legal-description"
                v-model="formData.description"
                rows="2"
                placeholder="Brief description of this legal reference, such as the licence's name"
                :disabled="isLoading"
            />
        </div>

        <fieldset class="source-choice" :disabled="isLoading">
            <legend>Text</legend>
            <label><input v-model="source" type="radio" value="text" name="legal-source" /> Type it</label>
            <label><input v-model="source" type="radio" value="file" name="legal-source" /> From a file (.txt, .md or .pdf)</label>
        </fieldset>

        <template v-if="source === 'text'">
            <div class="form-group">
                <label for="legal-format">Written as</label>
                <select id="legal-format" v-model="formData.textFormat" :disabled="isLoading">
                    <option v-for="option in FORMATS" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
            </div>
            <div class="form-group">
                <label for="legal-text">Legal text *</label>
                <textarea
                    id="legal-text"
                    v-model="formData.text"
                    rows="8"
                    placeholder="Enter the legal text (e.g., licence terms, copyright notice)"
                    :disabled="isLoading"
                />
                <p v-if="isEditing && givenAsFile(reference)" class="hint">
                    Typed text replaces the file {{ reference.filename }}.
                </p>
            </div>
        </template>

        <div v-else class="form-group">
            <label for="legal-file">{{ isEditing ? 'Replace the file (optional)' : 'File *' }}</label>
            <span v-if="isEditing && reference?.filename" class="current-file">Current file: {{ reference.filename }}</span>
            <input
                id="legal-file"
                type="file"
                :accept="ACCEPTED_FILES"
                @click="handleFileInputClick"
                @change="handleFileSelect"
                :disabled="isLoading"
            />
            <span v-if="file" class="file-name">Selected: {{ file.name }}</span>
            <p class="hint">
                The text is read from the file to be shown with it: a .txt or .md file as UTF-8 text, and a PDF only if it
                has text, which a scan does not. The file is kept for download.
            </p>
        </div>

        <UploadStatus
            :uploadStatus="uploadStatus"
            :uploadProgress="uploadProgress"
            :uploadedReferenceId="createdReferenceId"
            :uploadErrors="uploadErrors"
        />

        <div class="form-actions">
            <ControlSelector
              v-if="!isEditing"
              v-model:controlTeamId="selectedControlTeamId"
              v-model:readRelease="selectedRelease"
              :fixed-release="fixedRelease"
              class="form-control"
              @error="handleControlTeamError"
            />
            <button
                type="button"
                class="btn btn-primary"
                @click="submitForm"
                :disabled="!canSubmit"
            >
                {{ isLoading ? 'Saving...' : (isEditing ? 'Update' : 'Create') }}
            </button>
            <button
                v-if="!isEditing"
                type="button"
                class="btn btn-secondary"
                @click="resetForm"
                :disabled="isLoading"
            >
                Clear
            </button>
            <button
                v-if="isEditing"
                type="button"
                class="btn btn-secondary"
                @click="$emit('cancel')"
                :disabled="isLoading"
            >
                Cancel
            </button>
        </div>
    </div>
</template>

<style scoped>
.legal-reference-form {
    padding: 16px;
}

.reference-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e0e0e0;
}

.reference-id {
    font-weight: 600;
    color: #333;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
}

.form-group label,
.source-choice legend {
    font-weight: 600;
    font-size: 14px;
}

.form-group textarea,
.form-group select {
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font: inherit;
}

.source-choice {
    border: none;
    padding: 0;
    margin: 0 0 12px;
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
}

.source-choice label {
    display: flex;
    align-items: center;
    gap: 6px;
}

.current-file,
.file-name {
    font-size: 13px;
    color: #555;
}

.hint {
    margin: 4px 0 0;
    font-size: 12px;
    color: #666;
}

.error-message {
    background-color: #f8d7da;
    color: #721c24;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 16px;
    border: 1px solid #f5c6cb;
}

.success-message {
    background-color: #d4edda;
    color: #155724;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 16px;
    border: 1px solid #c3e6cb;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.form-actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
}

.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
}

.btn-primary {
    background-color: var(--brand-primary);
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background-color: var(--brand-primary-dark);
}

.btn-secondary {
    background-color: #6c757d;
    color: white;
}

.btn-secondary:hover:not(:disabled) {
    background-color: #545b62;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>
