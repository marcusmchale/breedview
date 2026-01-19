<!-- src/components/references/LicenceModal.vue -->
<script setup>
import { ref, computed, watch } from 'vue'
import { useReferencesSearchQuery } from '@/composables/references/referencesSearchQuery'
import { getReferenceType } from '@/composables/references/referenceTypes'

import LegalReferenceForm from './LegalReferenceForm.vue'
import ReferenceItem from './ReferenceItem.vue'

const props = defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    currentLicence: {
        type: Object,
        default: null
    }
})

const emit = defineEmits(['close', 'save'])

const searchQuery = ref('')
const { searchResults, searchLoading, searchError } = useReferencesSearchQuery(searchQuery)

// State
const activeTab = ref('create')
const selectedLicence = ref(props.currentLicence)


const handleSearchInput = (value) => {
    console.log('search value:', value)
    searchQuery.value = value
}

// Watch for prop changes
watch(() => props.currentLicence, (newLicence) => {
    selectedLicence.value = newLicence
})


// Filter to only show legal references in search
const legalSearchResults = computed(() => {
    return searchResults.value.filter(ref => getReferenceType(ref) === 'LegalReference')
})

// Handlers
const handleLicenceCreated = (licence) => {
    selectedLicence.value = licence
}

const selectLicence = (licence) => {
    selectedLicence.value = licence
}

const clearLicence = () => {
    selectedLicence.value = null
}

const handleSave = () => {
    emit('save', selectedLicence.value)
    emit('close')
}

const handleClose = () => {
    selectedLicence.value = props.currentLicence
    emit('close')
}
</script>

<template>
    <Teleport to="body">
        <div v-if="visible" class="modal-overlay" @click.self="handleClose">
            <div class="modal-container">
                <div class="modal-header">
                    <h2>Select Study Licence</h2>
                    <button class="close-btn" @click="handleClose">&times;</button>
                </div>

                <!-- Current Selection -->
                <div v-if="selectedLicence" class="current-selection">
                    <div class="selection-header">
                        <strong>Selected Licence:</strong>
                        <button class="btn btn-sm btn-warning" @click="clearLicence">
                            Clear
                        </button>
                    </div>
                    <ReferenceItem
                        :reference="selectedLicence"
                        :selectable="false"
                        :expanded="true"
                    />
                </div>

                <div class="tabs">
                    <button
                        :class="['tab', { active: activeTab === 'create' }]"
                        @click="activeTab = 'create'"
                    >
                        ⚖️ Create New
                    </button>
                    <button
                        :class="['tab', { active: activeTab === 'search' }]"
                        @click="activeTab = 'search'"
                    >
                        🔍 Search Existing
                    </button>
                </div>

                <div class="modal-content">
                    <!-- Create Tab -->
                    <div v-if="activeTab === 'create'" class="tab-content">
                        <LegalReferenceForm
                            mode="create"
                            @created="handleLicenceCreated"
                        />
                    </div>

                    <!-- Search Tab -->
                    <div v-if="activeTab === 'search'" class="tab-content">
                        <div class="search-section">
                            <div class="search-input-container">
                                <input
                                    type="text"
                                    :value="searchQuery"
                                    @input="handleSearchInput($event.target.value)"
                                    placeholder="Search legal references by description..."
                                    class="search-input"
                                />
                                <span v-if="searchLoading" class="search-spinner">⏳</span>
                            </div>

                            <div v-if="searchError" class="error-message">
                                {{ searchError }}
                            </div>

                            <div v-if="searchQuery.length < 2" class="search-hint">
                                Enter at least 2 characters to search for existing legal references
                            </div>

                            <div v-else-if="legalSearchResults.length === 0 && !searchLoading" class="empty-state">
                                No legal references found matching "{{ searchQuery }}"
                            </div>

                            <div v-else class="reference-list">
                                <div
                                    v-for="ref in legalSearchResults"
                                    :key="ref.id"
                                    class="selectable-item"
                                    :class="{ selected: selectedLicence?.id === ref.id }"
                                    @click="selectLicence(ref)"
                                >
                                    <ReferenceItem
                                        :reference="ref"
                                        :selectable="false"
                                    />
                                    <div class="select-overlay">
                                        <span v-if="selectedLicence?.id === ref.id">✓ Selected</span>
                                        <span v-else>Click to select</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn btn-secondary" @click="handleClose">
                        Cancel
                    </button>
                    <button class="btn btn-primary" @click="handleSave">
                        {{ selectedLicence ? 'Save Licence' : 'Save (No Licence)' }}
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
    z-index: 1001;
}

.modal-container {
    background: white;
    border-radius: 8px;
    width: 90vw;
    max-width: 700px;
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
    font-size: 1.4rem;
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

.current-selection {
    padding: 16px 24px;
    background: #e8f5e9;
    border-bottom: 1px solid #c8e6c9;
}

.selection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.tabs {
    display: flex;
    border-bottom: 1px solid #e0e0e0;
    padding: 0 24px;
}

.tab {
    padding: 12px 20px;
    background: none;
    border: none;
    cursor: pointer;
    color: #666;
    font-size: 14px;
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
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

.search-hint, .empty-state {
    text-align: center;
    color: #999;
    padding: 20px;
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

.selectable-item {
    position: relative;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
}

.selectable-item:hover .select-overlay {
    opacity: 1;
}

.selectable-item.selected {
    outline: 2px solid #4caf50;
}

.select-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(33, 150, 243, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
    border-radius: 4px;
}

.selectable-item.selected .select-overlay {
    opacity: 1;
    background: rgba(76, 175, 80, 0.1);
}

.select-overlay span {
    background: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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

.btn-primary {
    background: #2196f3;
    color: white;
}

.btn-primary:hover {
    background: #1976d2;
}

.btn-secondary {
    background: #f5f5f5;
    color: #333;
    border: 1px solid #ddd;
}

.btn-secondary:hover {
    background: #eee;
}

.btn-sm {
    padding: 6px 12px;
    font-size: 12px;
}

.btn-warning {
    background: #ff9800;
    color: white;
}

.btn-warning:hover {
    background: #f57c00;
}
</style>