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
    createLegalReference,
    createLegalReferenceLoading,
    updateLegalReference,
    updateLegalReferenceLoading
} = useMutateReferences()

const formData = ref({
    description: props.reference?.description || '',
    text: props.reference?.text || ''
})

const formError = ref('')
const createdReferenceId = ref(null)

const isEditing = computed(() => props.mode === 'edit' && props.reference?.id)
const isLoading = computed(() => createLegalReferenceLoading.value || updateLegalReferenceLoading.value)

watch(() => props.reference, (newRef) => {
    if (newRef) {
        formData.value = {
            description: newRef.description || '',
            text: newRef.text || ''
        }
    }
}, { immediate: true })

const submitForm = async () => {
    formError.value = ''

    try {
        if (isEditing.value) {
            const { status, errors } = await updateLegalReference({
                referenceId: props.reference.id,
                description: formData.value.description?.trim() || null,
                text: formData.value.text.trim()
            })

            if (status === 'SUCCESS') {
                emit('success', { id: props.reference.id, ...formData.value })
            } else {
                formError.value = errors?.[0]?.message || 'Failed to update reference'
            }
        } else {
            const { result, status, errors } = await createLegalReference({
                description: formData.value.description?.trim() || null,
                text: formData.value.text.trim()
            })

            if (status === 'SUCCESS') {
                createdReferenceId.value = result
                emit('created', {
                    id: result,
                    __typename: 'LegalReference',
                    description: formData.value.description?.trim() || null,
                    text: formData.value.text.trim()
                })
                // Reset form for next entry
                formData.value = { description: '', text: '' }
            } else {
                formError.value = errors?.[0]?.message || 'Failed to create reference'
            }
        }
    } catch (error) {
        console.error('Legal reference error:', error)
        formError.value = error.message || 'An unexpected error occurred'
    }
}

const resetForm = () => {
    formData.value = { description: '', text: '' }
    formError.value = ''
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
                placeholder="Brief description of this legal reference"
                :input-attrs="{ rows: 2 }"
            />

            <FormKit
                type="textarea"
                name="text"
                label="Legal Text"
                placeholder="Enter the legal text (e.g., licence terms, copyright notice)"
                validation="required"
                :input-attrs="{ rows: 6 }"
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