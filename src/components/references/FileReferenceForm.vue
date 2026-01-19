<script setup>
import { ref, computed, watch, markRaw } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'
import { useMutateReferences } from '@/composables/references/mutateReferences'
import { pollFileSubmission } from '@/composables/references/fileSubmissionQuery'
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
    }
})

const emit = defineEmits(['success', 'cancel', 'created'])

const { resolveClient } = useApolloClient()
const {
    createFileReference,
    createFileReferenceLoading,
    updateFileReference,
    updateFileReferenceLoading
} = useMutateReferences()

const formData = ref({
    description: props.reference?.description || '',
    file: null
})

const formError = ref('')
const uploadStatus = ref(null)
const uploadProgress = ref(0)
const uploadErrors = ref([])
const createdReferenceId = ref(null)

const isEditing = computed(() => props.mode === 'edit' && props.reference?.id)
const isLoading = computed(() =>
    createFileReferenceLoading.value ||
    updateFileReferenceLoading.value ||
    uploadStatus.value === 'uploading'
)

const canSubmit = computed(() => {
    if (isEditing.value) {
        return !isLoading.value
    }
    return formData.value.file && !isLoading.value
})

watch(() => props.reference, (newRef) => {
    if (newRef) {
        formData.value = {
            description: newRef.description || '',
            file: null
        }
    }
}, { immediate: true })

const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
        formData.value.file = markRaw(file)
    }
}

const handleFileInputClick = (event) => {
    event.target.value = ''
}

const startFilePolling = (fileId) => {
    const client = resolveClient()
    const { startPolling } = pollFileSubmission({
        client,
        fileId,
        onUpdate: ({ status, progress }) => {
            if (status) uploadStatus.value = status.toLowerCase()
            if (progress !== undefined) uploadProgress.value = progress
        },
        onComplete: ({ referenceId, status, errors }) => {
            if (status === 'COMPLETED') {
                uploadStatus.value = 'success'
                createdReferenceId.value = referenceId

                emit('created', {
                    id: referenceId,
                    __typename: 'FileReference',
                    description: formData.value.description?.trim() || null,
                    filename: formData.value.file?.name
                })

                setTimeout(() => {
                    resetForm()
                }, 2000)
            } else {
                uploadStatus.value = 'error'
                uploadErrors.value = errors || ['Upload failed']
            }
        }
    })

    startPolling()
}

const submitForm = async () => {
    formError.value = ''
    uploadErrors.value = []

    try {
        if (isEditing.value) {
            uploadStatus.value = 'uploading'

            const { result: fileId, status, errors } = await updateFileReference({
                referenceId: props.reference.id,
                description: formData.value.description?.trim() || null,
                file: formData.value.file || null
            })

            if (status === 'SUCCESS') {
                if (fileId && formData.value.file) {
                    // File was uploaded, need to poll
                    startFilePolling(fileId)
                } else {
                    // No file upload, just metadata update
                    uploadStatus.value = 'success'
                    emit('success', {
                        id: props.reference.id,
                        description: formData.value.description?.trim() || null
                    })
                }
            } else {
                uploadStatus.value = 'error'
                uploadErrors.value = errors?.map(e => e.message) || ['Update failed']
            }
        } else {
            uploadStatus.value = 'uploading'

            const { result: fileId, status, errors } = await createFileReference({
                description: formData.value.description?.trim() || null,
                file: formData.value.file
            })

            if (status === 'SUCCESS') {
                startFilePolling(fileId)
            } else {
                uploadStatus.value = 'error'
                uploadErrors.value = errors?.map(e => e.message) || ['Upload failed']
            }
        }
    } catch (error) {
        console.error('File reference error:', error)
        uploadStatus.value = 'error'
        uploadErrors.value = [error.message || 'An unexpected error occurred']
    }
}

const resetForm = () => {
    formData.value = { description: '', file: null }
    formError.value = ''
    uploadStatus.value = null
    uploadProgress.value = 0
    uploadErrors.value = []
    createdReferenceId.value = null
}
</script>

<template>
    <div class="file-reference-form">
        <div v-if="isEditing && reference?.id" class="reference-header">
            <div class="reference-info">
                <span class="reference-id">Reference #{{ reference.id }}</span>
                <span v-if="reference.filename" class="current-file">
                    Current file: {{ reference.filename }}
                </span>
            </div>
            <ControllerBadge
                entity-label="REFERENCE"
                :entity-id="reference.id"
            />
        </div>

        <div v-if="formError" class="error-message">
            {{ formError }}
        </div>

        <div class="form-group">
            <label>Description</label>
            <textarea
                v-model="formData.description"
                rows="2"
                placeholder="Brief description of this file"
                :disabled="isLoading"
            />
        </div>

        <div class="form-group">
            <label>{{ isEditing ? 'Replace File (optional)' : 'File' }} {{ !isEditing ? '*' : '' }}</label>
            <input
                type="file"
                @click="handleFileInputClick"
                @change="handleFileSelect"
                :disabled="isLoading"
            />
            <span v-if="formData.file" class="file-name">
                Selected: {{ formData.file.name }}
            </span>
        </div>

        <UploadStatus
            :uploadStatus="uploadStatus"
            :uploadProgress="uploadProgress"
            :uploadedReferenceId="createdReferenceId"
            :uploadErrors="uploadErrors"
        />

        <div v-if="createdReferenceId && uploadStatus === 'success'" class="success-badge">
            <ControllerBadge
                entity-label="REFERENCE"
                :entity-id="createdReferenceId"
            />
        </div>

        <div class="form-actions">
            <button
                type="button"
                class="btn btn-primary"
                @click="submitForm"
                :disabled="!canSubmit"
            >
                {{ isLoading ? 'Uploading...' : (isEditing ? 'Update' : 'Upload') }}
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
.file-reference-form {
    padding: 16px;
}

.reference-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e0e0e0;
}

.reference-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.reference-id {
    font-weight: 600;
    color: #333;
}

.current-file {
    font-size: 0.85em;
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

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #333;
}

.form-group textarea,
.form-group input[type="file"] {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
}

.form-group textarea {
    resize: vertical;
}

.file-name {
    display: block;
    margin-top: 8px;
    font-size: 13px;
    color: #666;
}

.success-badge {
    margin: 12px 0;
    display: flex;
    justify-content: flex-end;
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

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
</style>