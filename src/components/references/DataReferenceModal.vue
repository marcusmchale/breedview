<!-- src/components/references/DataReferenceModal.vue -->
<script setup>
import { ref, computed, watch } from 'vue'
import { useMutateReferences } from '@/composables/references/mutateReferences'
import { useReferencesSearchQuery } from '@/composables/references/referencesSearchQuery'
import { useRecentFileReferencesQuery } from '@/composables/references/recentFileReferencesQuery'
import {
    DATA_REFERENCE_TYPE_CONFIGS,
    isDataReference,
    REFERENCE_TYPE_CONFIGS
} from '@/composables/references/referenceTypes'

import ExternalDataReferenceForm from './ExternalDataReferenceForm.vue'
import DataFileReferenceForm from './DataFileReferenceForm.vue'
import ReferenceItem from './ReferenceItem.vue'

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    selectedReferenceIds: {
        type: Array,
        default: () => []
    },
    initialReferences: {
        type: Array,
        default: () => []
    }
})

const emit = defineEmits(['close', 'save'])

const searchQuery = ref('')

const { deleteReferences, deleteReferencesLoading } = useMutateReferences()

const { searchResults, searchLoading, searchError } = useReferencesSearchQuery({
    description: searchQuery,
    referenceTypes: DATA_REFERENCE_TYPE_CONFIGS.map(({ key }) => key)
})

const { recentFileReferences, refetchRecentFiles } = useRecentFileReferencesQuery(
    DATA_REFERENCE_TYPE_CONFIGS.map(({ key }) => key)
)

// State
const activeTab = ref('external_data')
const selectedIds = ref([...props.selectedReferenceIds])
const selectedReferencesData = ref([...props.initialReferences])
const editingReference = ref(null)

const handleSearchInput = (value) => {
    searchQuery.value = value
}

// Watch for prop changes
watch(() => props.selectedReferenceIds, (newIds) => {
    selectedIds.value = [...newIds]
})

watch(() => props.initialReferences, (newRefs) => {
    selectedReferencesData.value = [...newRefs]
})

watch(() => props.visible, (visible) => {
    if (visible) {
        refetchRecentFiles()
        searchQuery.value = ''
        editingReference.value = null
    }
})

// Computed
const filteredSearchResults = computed(() => {
    return searchResults.value.filter(ref => !selectedIds.value.includes(ref.id))
})

const filteredRecentFiles = computed(() => {
    if (!recentFileReferences.value) return []
    return recentFileReferences.value.filter(ref =>
        !selectedIds.value.includes(ref.id) && isDataReference(ref)
    )
})

const selectedReferences = computed(() => {
    return selectedReferencesData.value.filter(ref => selectedIds.value.includes(ref.id))
})

// Handlers
const handleReferenceCreated = (reference) => {
    if (isDataReference(reference)) {
        selectedIds.value.push(reference.id)
        selectedReferencesData.value.push(reference)
    }
}

const handleReferenceUpdated = (reference) => {
    const index = selectedReferencesData.value.findIndex(r => r.id === reference.id)
    if (index !== -1) {
        selectedReferencesData.value[index] = { ...selectedReferencesData.value[index], ...reference }
    }
    editingReference.value = null
}

const toggleSelection = (referenceId, reference = null) => {
    const index = selectedIds.value.indexOf(referenceId)
    if (index > -1) {
        selectedIds.value.splice(index, 1)
    } else {
        selectedIds.value.push(referenceId)
        if (reference && !selectedReferencesData.value.find(r => r.id === referenceId)) {
            selectedReferencesData.value.push(reference)
        }
    }
}

const removeFromSelection = (referenceId) => {
    const index = selectedIds.value.indexOf(referenceId)
    if (index > -1) {
        selectedIds.value.splice(index, 1)
    }
}

const startEditing = (reference) => {
    editingReference.value = reference
    // Switch to appropriate tab based on reference type
    switch (reference.__typename) {
        case 'ExternalDataReference':
            activeTab.value = 'external_data'
            break
        case 'DataFileReference':
            activeTab.value = 'data_file'
            break
    }
}

const cancelEditing = () => {
    editingReference.value = null
}

const handleDeleteReference = async (referenceId) => {
    if (!confirm('Are you sure you want to delete this reference? This cannot be undone.')) {
        return
    }

    try {
        const { status, errors } = await deleteReferences([referenceId])
        if (status === 'SUCCESS') {
            removeFromSelection(referenceId)
            selectedReferencesData.value = selectedReferencesData.value.filter(r => r.id !== referenceId)
        } else {
            alert(errors?.[0]?.message || 'Failed to delete reference')
        }
    } catch (error) {
        console.error('Delete error:', error)
        alert(error.message || 'Failed to delete reference')
    }
}

const handleSave = () => {
    emit('save', selectedReferences.value)
    emit('close')
}

const handleClose = () => {
    selectedIds.value = [...props.selectedReferenceIds]
    emit('close')
}
</script>

<template>
    <Teleport to="body">
        <div v-if="visible" class="modal-overlay" @click.self="handleClose">
            <div class="modal-container">
                <div class="modal-header">
                    <h2>Manage Data References</h2>
                    <button class="close-btn" @click="handleClose">&times;</button>
                </div>

                <div class="tabs">
                    <button
                        :class="['tab', { active: activeTab === 'external_data' }]"
                        @click="activeTab = 'external_data'; editingReference = null"
                    >
                        📊 External Data
                    </button>
                    <button
                        :class="['tab', { active: activeTab === 'data_file' }]"
                        @click="activeTab = 'data_file'; editingReference = null"
                    >
                        📁 Data File
                    </button>
                    <button
                        :class="['tab', { active: activeTab === 'search' }]"
                        @click="activeTab = 'search'; editingReference = null"
                    >
                        🔍 Search
                    </button>
                    <button
                        :class="['tab', { active: activeTab === 'selected' }]"
                        @click="activeTab = 'selected'"
                    >
                        ✓ Selected ({{ selectedIds.length }})
                    </button>
                </div>

                <div class="modal-content">
                    <!-- External Data Tab -->
                    <div v-if="activeTab === 'external_data'" class="tab-content">
                        <ExternalDataReferenceForm
                            :reference="editingReference?.__typename === 'ExternalDataReference' ? editingReference : null"
                            :mode="editingReference?.__typename === 'ExternalDataReference' ? 'edit' : 'create'"
                            @created="handleReferenceCreated"
                            @success="handleReferenceUpdated"
                            @cancel="cancelEditing"
                        />
                    </div>

                    <!-- Data File Tab -->
                    <div v-if="activeTab === 'data_file'" class="tab-content">
                        <DataFileReferenceForm
                            :reference="editingReference?.__typename === 'DataFileReference' ? editingReference : null"
                            :mode="editingReference?.__typename === 'DataFileReference' ? 'edit' : 'create'"
                            @created="handleReferenceCreated"
                            @success="handleReferenceUpdated"
                            @cancel="cancelEditing"
                        />

                        <!-- Recent Files Section -->
                        <div v-if="filteredRecentFiles.length > 0 && !editingReference" class="recent-section">
                            <h4>Recent Data File References</h4>
                            <div class="reference-list">
                                <ReferenceItem
                                    v-for="ref in filteredRecentFiles"
                                    :key="ref.id"
                                    :reference="ref"
                                    :selectable="true"
                                    :selected="selectedIds.includes(ref.id)"
                                    :disabled="!isDataReference(ref)"
                                    @toggle-select="toggleSelection(ref.id, ref)"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Search Tab -->
                    <div v-if="activeTab === 'search'" class="tab-content">
                        <div class="search-section">
                            <div class="search-input-container">
                                <input
                                    type="text"
                                    :value="searchQuery"
                                    @input="handleSearchInput($event.target.value)"
                                    placeholder="Search data references by description..."
                                    class="search-input"
                                />
                                <span v-if="searchLoading" class="search-spinner">⏳</span>
                            </div>

                            <div v-if="searchError" class="error-message">
                                {{ searchError }}
                            </div>

                            <div v-if="searchQuery.length < 2" class="search-hint">
                                Enter at least 2 characters to search
                            </div>

                            <div v-else-if="filteredSearchResults.length === 0 && !searchLoading" class="empty-state">
                                No data references found matching "{{ searchQuery }}"
                            </div>

                            <div v-else class="reference-list">
                                <ReferenceItem
                                    v-for="ref in filteredSearchResults"
                                    :key="ref.id"
                                    :reference="ref"
                                    :selectable="true"
                                    :selected="selectedIds.includes(ref.id)"
                                    :disabled="!isDataReference(ref)"
                                    @toggle-select="toggleSelection(ref.id, ref)"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Selected Tab -->
                    <div v-if="activeTab === 'selected'" class="tab-content">
                        <div v-if="selectedReferences.length === 0" class="empty-state">
                            No data references selected. Create new references or search for existing ones.
                        </div>

                        <div v-else class="reference-list">
                            <ReferenceItem
                                v-for="ref in selectedReferences"
                                :key="ref.id"
                                :reference="ref"
                                :selectable="false"
                                :show-actions="true"
                                @edit="startEditing"
                                @remove="removeFromSelection"
                            />
                        </div>

                        <div v-if="editingReference" class="editing-notice">
                            <p>Editing reference #{{ editingReference.id }} - switch to the appropriate tab to modify</p>
                            <button class="btn btn-secondary btn-sm" @click="cancelEditing">
                                Cancel Edit
                            </button>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-secondary" @click="handleClose">
                        Cancel
                    </button>
                    <button class="btn btn-primary" @click="handleSave">
                        Save Selection ({{ selectedIds.length }})
                    </button>
                </div>
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
    max-width: 900px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
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
    font-size: 1.5rem;
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

.tabs {
    display: flex;
    border-bottom: 1px solid #e0e0e0;
    padding: 0 24px;
    flex-wrap: wrap;
}

.tab {
    padding: 12px 16px;
    background: none;
    border: none;
    cursor: pointer;
    color: #666;
    font-size: 14px;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    white-space: nowrap;
}

.tab:hover {
    color: #333;
}

.tab.active {
    color: #2196f3;
    border-bottom-color: #2196f3;
}

.modal-content {
    flex: 1;
    overflow: auto;
    padding: 0;
}

.tab-content {
    animation: fadeIn 0.2s;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.search-section {
    padding: 16px;
}

.search-input-container {
    position: relative;
    margin-bottom: 16px;
}

.search-input {
    width: 100%;
    padding: 12px 40px 12px 16px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
}

.search-input:focus {
    outline: none;
    border-color: #2196f3;
}

.search-spinner {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
}

.search-hint {
    text-align: center;
    color: #999;
    padding: 20px;
    font-style: italic;
}

.empty-state {
    text-align: center;
    padding: 40px;
    color: #999;
    font-style: italic;
}

.error-message {
    background-color: #f8d7da;
    color: #721c24;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 16px;
}

.reference-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.recent-section {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 2px solid #e0e0e0;
}

.recent-section h4 {
    margin: 0 0 16px 16px;
    color: #333;
}

.editing-notice {
    margin-top: 16px;
    padding: 16px;
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.editing-notice p {
    margin: 0;
    color: #856404;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid #e0e0e0;
}

.btn {
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    border: none;
    font-weight: 500;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-primary {
    background: #2196f3;
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background: #1976d2;
}

.btn-secondary {
    background: #f5f5f5;
    color: #333;
    border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) {
    background: #eee;
}

.btn-sm {
    padding: 6px 12px;
    font-size: 12px;
}
</style>