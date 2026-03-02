<script setup>
import { ref, computed } from 'vue'
import {
  getReferenceType,
  getReferenceTypeLabel,
  getReferenceTypeIcon,
  isDataReference,
  REFERENCE_TYPES
} from '@/composables/references/referenceTypes'
import { useReferencesFileDownloadLazy } from '@/composables/references/referencesFileDownloadLazyQuery'
import ControllerBadge from '@/components/controls/ControllerBadge.vue'
import FileDownloadButton from '@/components/references/FileDownloadButton.vue'

const props = defineProps({
    reference: {
        type: Object,
        required: true
    },
    expanded: {
        type: Boolean,
        default: false
    },
    selectable: {
        type: Boolean,
        default: false
    },
    selected: {
        type: Boolean,
        default: false
    },
    disabled: {
        type: Boolean,
        default: false
    },
    showActions: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['toggle-expand', 'toggle-select', 'edit', 'remove'])

const isExpanded = ref(props.expanded)

const referenceType = computed(() => getReferenceType(props.reference))
const typeLabel = computed(() => getReferenceTypeLabel(props.reference))
const typeIcon = computed(() => getReferenceTypeIcon(props.reference))
const isData = computed(() => isDataReference(props.reference))

const toggleExpand = () => {
    isExpanded.value = !isExpanded.value
    emit('toggle-expand', isExpanded.value)
}

const { fetchDownloadUrl, getDownloadData, loadingFileId, loading: downloadLoading } = useReferencesFileDownloadLazy()

const hasFileDownload = computed(() => {
    const type = referenceType.value
    return (type === REFERENCE_TYPES.FILE || type === REFERENCE_TYPES.DATA_FILE) && props.reference.fileId
})

const downloadInfo = computed(() => {
    if (!props.reference.fileId) return null
    return getDownloadData(props.reference.fileId)
})

const isDownloading = computed(() => {
    return downloadLoading.value && loadingFileId.value === props.reference.fileId
})

const handleFetchDownloadUrl = () => {
    if (props.reference.fileId && !isDownloading.value) {
        fetchDownloadUrl(props.reference.fileId)
    }
}
</script>

<template>
    <div
        class="reference-item"
        :class="{
            expanded: isExpanded,
            selected: selected,
            disabled: disabled || isData,
            'data-reference': isData
        }"
    >
        <div class="reference-header" @click="toggleExpand">
            <div class="reference-main">
                <span v-if="selectable && !isData" class="select-checkbox">
                    <input
                        type="checkbox"
                        :checked="selected"
                        :disabled="disabled"
                        @click.stop
                        @change="$emit('toggle-select', reference.id)"
                    />
                </span>
                <span class="type-icon">{{ typeIcon }}</span>
                <span class="type-label">{{ typeLabel }}</span>
                <span class="reference-description">
                    {{ reference.description || 'No description' }}
                </span>
                <span v-if="isData" class="data-badge">Data Only</span>
            </div>
            <div class="reference-actions-header">
                <FileDownloadButton
                    v-if="hasFileDownload"
                    :file-id="reference.fileId"
                    :filename="reference.filename"
                    size="small"
                    icon-only
                />
                <span class="expand-icon">{{ isExpanded ? '▼' : '►' }}</span>
            </div>
        </div>

        <div v-if="isExpanded" class="reference-details">
            <div class="detail-row">
                <strong>ID:</strong> {{ reference.id }}
                <ControllerBadge
                    entity-label="REFERENCE"
                    :entity-id="reference.id"
                />
            </div>

            <!-- Legal Reference details -->
            <template v-if="referenceType === 'LegalReference'">
                <div v-if="reference.text" class="detail-row">
                    <strong>Text:</strong>
                    <div class="text-content">{{ reference.text }}</div>
                </div>
            </template>

            <!-- External Reference details -->
            <template v-if="referenceType === 'ExternalReference'">
                <div v-if="reference.url" class="detail-row">
                    <strong>URL:</strong>
                    <a :href="reference.url" target="_blank" rel="noopener">{{ reference.url }}</a>
                </div>
                <div v-if="reference.externalId" class="detail-row">
                    <strong>External ID:</strong> {{ reference.externalId }}
                </div>
            </template>

            <!-- File Reference details -->
            <template v-if="referenceType === 'FileReference'">
                <div v-if="reference.filename" class="detail-row">
                    <strong>Filename:</strong> {{ reference.filename }}
                </div>
                <div v-if="reference.contentType" class="detail-row">
                    <strong>Content Type:</strong> {{ reference.contentType }}
                </div>
            </template>

            <!-- External Data Reference details -->
            <template v-if="referenceType === 'ExternalDataReference'">
                <div v-if="reference.url" class="detail-row">
                    <strong>URL:</strong>
                    <a :href="reference.url" target="_blank" rel="noopener">{{ reference.url }}</a>
                </div>
                <div v-if="reference.format" class="detail-row">
                    <strong>Format:</strong> {{ reference.format }}
                </div>
                <div v-if="reference.schema" class="detail-row">
                    <strong>Schema:</strong>
                    <code class="schema-content">{{ reference.schema }}</code>
                </div>
            </template>

            <!-- Data File Reference details -->
            <template v-if="referenceType === 'DataFileReference'">
                <div v-if="reference.filename" class="detail-row">
                    <strong>Filename:</strong> {{ reference.filename }}
                </div>
                <div v-if="reference.format" class="detail-row">
                    <strong>Format:</strong> {{ reference.format }}
                </div>
                <div v-if="reference.contentType" class="detail-row">
                    <strong>Content Type:</strong> {{ reference.contentType }}
                </div>
                <div v-if="reference.schema" class="detail-row">
                    <strong>Schema:</strong>
                    <code class="schema-content">{{ reference.schema }}</code>
                </div>
            </template>

            <div v-if="showActions && !isData" class="reference-actions">
                <button class="btn btn-sm btn-outline" @click="$emit('edit', reference)">
                    Edit
                </button>
                <button class="btn btn-sm btn-warning" @click="$emit('remove', reference.id)">
                    Remove
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.reference-item {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    margin-bottom: 8px;
    background: white;
    transition: all 0.2s;
}

.reference-item:hover {
    border-color: #2196f3;
}

.reference-item.selected {
    background: #e3f2fd;
    border-color: #2196f3;
}

.reference-item.disabled {
    opacity: 0.6;
}

.reference-item.data-reference {
    background: #f5f5f5;
    border-style: dashed;
}

.reference-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    cursor: pointer;
}

.reference-main {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
}

.select-checkbox input {
    width: 18px;
    height: 18px;
    cursor: pointer;
}

.type-icon {
    font-size: 1.2em;
}

.type-label {
    font-weight: 500;
    color: #666;
    font-size: 0.85em;
    white-space: nowrap;
}

.reference-description {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #333;
}

.data-badge {
    background: #ff9800;
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.75em;
    white-space: nowrap;
}

.expand-icon {
    color: #666;
    font-size: 0.8em;
}

.reference-details {
    padding: 12px;
    border-top: 1px solid #e0e0e0;
    background: #fafafa;
}

.detail-row {
    margin-bottom: 8px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    flex-wrap: wrap;
}

.detail-row strong {
    color: #333;
    min-width: 100px;
}

.detail-row a {
    color: #2196f3;
    word-break: break-all;
}

.text-content {
    white-space: pre-wrap;
    background: white;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
    width: 100%;
    margin-top: 4px;
    font-size: 0.9em;
}

.schema-content {
    background: #263238;
    color: #aed581;
    padding: 8px;
    border-radius: 4px;
    display: block;
    width: 100%;
    margin-top: 4px;
    font-size: 0.85em;
    overflow-x: auto;
}

.reference-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
}

.btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
}

.btn-sm {
    padding: 4px 10px;
    font-size: 11px;
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

.btn-warning {
    background-color: #ff9800;
    color: white;
}

.btn-warning:hover {
    background-color: #f57c00;
}

.reference-actions-header {
    display: flex;
    align-items: center;
    gap: 8px;
}

</style>