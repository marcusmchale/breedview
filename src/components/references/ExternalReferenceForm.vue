<script setup>
import { ref, computed, watch } from 'vue'
import { FormKit } from '@formkit/vue'
import { useMutateReferences } from '@/composables/references/mutateReferences'
import ControllerBadge from '@/components/controls/ControllerBadge.vue'

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

const {
    createExternalReference,
    createExternalReferenceLoading,
    updateExternalReference,
    updateExternalReferenceLoading
} = useMutateReferences()

const formData = ref({
    description: props.reference?.description || '',
    url: props.reference?.url || '',
    externalId: props.reference?.externalId || ''
})

const formError = ref('')
const createdReferenceId = ref(null)

const isEditing = computed(() => props.mode === 'edit' && props.reference?.id)
const isLoading = computed(() => createExternalReferenceLoading.value || updateExternalReferenceLoading.value)

watch(() => props.reference, (newRef) => {
    if (newRef) {
        formData.value = {
            description: newRef.description || '',
            url: newRef.url || '',
            externalId: newRef.externalId || ''
        }
    }
}, { immediate: true })

const submitForm = async () => {
    formError.value = ''

    try {
        const referenceData = {
            description: formData.value.description?.trim() || null,
            url: formData.value.url.trim(),
            externalId: formData.value.externalId?.trim() || null
        }

        if (isEditing.value) {
            const { status, errors } = await updateExternalReference({
                referenceId: props.reference.id,
                ...referenceData
            })

            if (status === 'SUCCESS') {
                emit('success', { id: props.reference.id, ...referenceData })
            } else {
                formError.value = errors?.[0]?.message || 'Failed to update reference'
            }
        } else {
            const { result, status, errors } = await createExternalReference(referenceData)

            if (status === 'SUCCESS') {
                createdReferenceId.value = result
                emit('created', {
                    id: result,
                    __typename: 'ExternalReference',
                    ...referenceData
                })
                formData.value = { description: '', url: '', externalId: '' }
            } else {
                formError.value = errors?.[0]?.message || 'Failed to create reference'
            }
        }
    } catch (error) {
        console.error('External reference error:', error)
        formError.value = error.message || 'An unexpected error occurred'
    }
}

const resetForm = () => {
    formData.value = { description: '', url: '', externalId: '' }
    formError.value = ''
    createdReferenceId.value = null
}
</script>

<template>
    <div class="external-reference-form">
        <div v-if="isEditing && reference?.id" class="reference-header">
            <span class="reference-id">Reference #{{ reference.id }}</span>
            <ControllerBadge
                entity-label="REFERENCE"
                :entity-id="reference.id"
            />
        </div>

        <div v-if="formError" class="error-message">
            {{ formError }}
        </div>

        <div v-if="createdReferenceId" class="success-message">
            <span>✓ Reference #{{ createdReferenceId }} created successfully!</span>
            <ControllerBadge
                entity-label="REFERENCE"
                :entity-id="createdReferenceId"
            />
        </div>

        <FormKit
            type="form"
            v-model="formData"
            @submit="submitForm"
            :actions="false"
        >
            <FormKit
                type="textarea"
                name="description"
                label="Description"
                placeholder="Brief description of this external reference"
                :input-attrs="{ rows: 2 }"
            />

            <FormKit
                type="url"
                name="url"
                label="URL"
                placeholder="https://example.com/resource"
                validation="required|url"
            />

            <FormKit
                type="text"
                name="externalId"
                label="External ID (optional)"
                placeholder="e.g., DOI, accession number"
            />

            <div class="form-actions">
                <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="isLoading"
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
        </FormKit>
    </div>
</template>

<style scoped>
.external-reference-form {
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