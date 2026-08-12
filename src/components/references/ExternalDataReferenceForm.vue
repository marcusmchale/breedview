<script setup>
import { ref, computed, watch } from 'vue'
import { FormKit } from '@formkit/vue'
import { useMutateReferences } from '@/composables/references/mutateReferences'
import { useReferenceSchema } from '@/composables/references/useReferenceSchema'

import ControlSelector from "@/components/controls/ControlSelector.vue"
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
    createExternalDataReference,
    createExternalDataReferenceLoading,
    updateExternalDataReference,
    updateExternalDataReferenceLoading
} = useMutateReferences()

const { dataFormats } = useReferenceSchema()

const formData = ref({
    description: props.reference?.description || '',
    url: props.reference?.url || '',
    externalId: props.reference?.externalId || '',
    format: props.reference?.format || '',
    schema: props.reference?.schema || ''
})

const formError = ref(null)
const schemaError = ref(null)
const createdReferenceId = ref(null)
const selectedControlTeamId = ref(null)
const selectedRelease = ref(null)

const handleControlTeamError = (errorMessage) => {
    formError.value = errorMessage
}

const isEditing = computed(() => props.mode === 'edit' && props.reference?.id)
const isLoading = computed(() => createExternalDataReferenceLoading.value || updateExternalDataReferenceLoading.value)

const formatOptions = computed(() => {
    return dataFormats.value.map(fmt => ({
        value: fmt.name,
        label: fmt.name,
        description: fmt.description,
    }))
})

watch(() => props.reference, (newRef) => {
    if (newRef) {
        formData.value = {
            description: newRef.description || '',
            url: newRef.url || '',
            externalId: newRef.externalId || '',
            format: newRef.format || '',
            schema: newRef.schema || ''
        }
    }
}, { immediate: true })

const validateSchema = (schemaText) => {
    if (!schemaText || schemaText.trim() === '') {
        schemaError.value = null
        return true
    }

    try {
        JSON.parse(schemaText)
        schemaError.value = null
        return true
    } catch (e) {
        schemaError.value = 'Invalid JSON format'
        return false
    }
}

const handleSchemaInput = (value) => {
    formData.value.schema = value
    validateSchema(value)
}

const submitForm = async () => {
    formError.value = null

    if (!validateSchema(formData.value.schema)) {
        return
    }

    try {
        const referenceData = {
            description: formData.value.description?.trim() || null,
            url: formData.value.url.trim(),
            externalId: formData.value.externalId || null,
            format: formData.value.format,
            schema: formData.value.schema?.trim() || null
        }

        if (isEditing.value) {
            const { status, errors } = await updateExternalDataReference({
                id: props.reference.id,
                ...referenceData
            })

            if (status === 'SUCCESS') {
                emit('success', { id: props.reference.id, ...referenceData })
            } else {
                formError.value = errors?.[0]?.message || 'Failed to update reference'
            }
        } else {
            const { result, status, errors } = await createExternalDataReference({
              reference: referenceData,
              controlTeamId: selectedControlTeamId,
              release: selectedRelease
            })

            if (status === 'SUCCESS') {
                createdReferenceId.value = result
                emit('created', {
                    id: result,
                    __typename: 'ExternalDataReference',
                    ...referenceData
                })
                formData.value = { description: '', url: '', format: '', schema: '' }
            } else {
                formError.value = errors?.[0]?.message || 'Failed to create reference'
            }
        }
    } catch (error) {
        console.error('External data reference error:', error)
        formError.value = error.message || 'An unexpected error occurred'
    }
}

const resetForm = () => {
    formData.value = { description: '', url: '', format: '', schema: '' }
    formError.value = null
    schemaError.value = null
    createdReferenceId.value = null
}

</script>

<template>
    <div class="external-data-reference-form">
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
                placeholder="Brief description of this external data reference"
                :input-attrs="{ rows: 2 }"
            />

            <FormKit
                type="url"
                name="url"
                label="URL"
                placeholder="https://example.com/data"
                validation="required|url"
            />

            <FormKit
                type="text"
                name="externalId"
                label="External Identifier"
                placeholder="GCF_036785885.1"
            />

            <FormKit
                type="select"
                name="format"
                label="Format"
                placeholder="-- Select Format --"
                :options="formatOptions"
                validation="required"
            />

            <div class="form-group">
                <label>Schema (JSON)</label>
                <textarea
                    :value="formData.schema"
                    @input="handleSchemaInput($event.target.value)"
                    rows="4"
                    placeholder='Optional JSON schema, e.g. {"type": "object", ...}'
                    :disabled="isLoading"
                    :class="{ error: schemaError }"
                />
                <span v-if="schemaError" class="error-text">{{ schemaError }}</span>
            </div>

            <div class="form-actions">
                <ControlSelector
                    v-if="!isEditing"
                    v-model:controlTeamId="selectedControlTeamId"
                    v-model:readRelease="selectedRelease"
                    class="form-control"
                    @error="handleControlTeamError"
                />
                <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="isLoading || schemaError"
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
.external-data-reference-form {
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

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: #333;
}

.form-group textarea {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    font-family: monospace;
    resize: vertical;
}

.form-group textarea.error {
    border-color: #f44336;
}

.error-text {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    color: #f44336;
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