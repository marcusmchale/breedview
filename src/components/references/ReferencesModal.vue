<script setup>
import { ref, computed, watch } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'
import { useReferencesSearchQuery } from '@/composables/references/referencesSearchQuery'
import { useRecentFileReferencesQuery } from '@/composables/references/recentFileReferencesQuery'
import { useReferencesQuery } from '@/composables/references/referencesQuery'
import { useReferencesModalConfig } from '@/composables/references/useReferencesModalConfig'
import { RELEASE_LABELS } from '@/composables/controls/releases'
import CONTROLLER_RELEASE_QUERY from '@/graphql/controls/controllerRelease.graphql'

import ReferenceItem from './ReferenceItem.vue'
import LegalReferenceForm from './LegalReferenceForm.vue'
import ExternalReferenceForm from './ExternalReferenceForm.vue'
import FileReferenceForm from './FileReferenceForm.vue'
import ExternalDataReferenceForm from './ExternalDataReferenceForm.vue'
import DataFileReferenceForm from './DataFileReferenceForm.vue'

const FORM_COMPONENTS = {
  LEGAL: LegalReferenceForm,
  EXTERNAL: ExternalReferenceForm,
  FILE: FileReferenceForm,
  EXTERNAL_DATA: ExternalDataReferenceForm,
  DATA_FILE: DataFileReferenceForm,
}

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  referenceTypes: {
    type: Array,
    required: true
  },
  selectedReferenceIds: {
    type: Array,
    default: () => []
  },
  initialReferences: {
    type: Array,
    default: () => []
  },
  selectionMode: {
    type: String,
    enum: ['single', 'multiple'],
    default: 'multiple'
  },
  allowCreate: {
    type: Boolean,
    default: true
  },
  allowSearch: {
    type: Boolean,
    default: true
  },
  showRecent: {
    type: Boolean,
    default: true
  },
  title: {
    type: String,
    default: 'Manage References'
  },
  // only public references can be chosen, e.g. for the ontology, which is shared: others are shown but can't be
  // chosen, and those made here are public. Those chosen already stay until removed, as the API lets them.
  publicOnly: {
    type: Boolean,
    default: false
  },
  // a note above the tabs, e.g. why only public references can be chosen
  notice: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'update:selectedReferenceIds', 'save'])

// Modal configuration
const { orderedTabs, defaultActiveTab, hasType } = useReferencesModalConfig(props.referenceTypes)

// State
const searchQuery = ref('')
const activeTab = ref(defaultActiveTab.value)
const selectedIds = ref([...props.selectedReferenceIds])
const selectedReferencesData = ref([...props.initialReferences])
const editingReference = ref(null)
// a reference chosen to edit before it was read in full, edited once it is
const pendingEditId = ref(null)

// Queries
const { searchResults, searchLoading, searchError } = useReferencesSearchQuery({
  description: searchQuery,
  referenceTypes: props.referenceTypes.map(({ key }) => key)
})

const { recentFileReferences, refetchRecentFiles } = useRecentFileReferencesQuery(
  props.referenceTypes
    .filter(type => ['FILE', 'DATA_FILE'].includes(type.key))
    .map(({ key }) => key)
)

// The references selected may be given by id alone, as a dataset's records read them: those are read in full, to be
// shown while the modal is open
const undescribedIds = computed(() => props.visible
  ? selectedReferencesData.value.filter(ref => ref.description === undefined).map(ref => ref.id)
  : []
)
const { references: describedReferences } = useReferencesQuery(undescribedIds)

// Computed
const filteredSearchResults = computed(() => {
  return searchResults.value.filter(ref => !selectedIds.value.includes(ref.id))
})

const filteredRecentFiles = computed(() => {
  if (!recentFileReferences.value) return []
  return recentFileReferences.value.filter(ref =>
    !selectedIds.value.includes(ref.id)
  )
})

// The recent files of a tab's type, shown under that tab
const recentFilesOf = (tab) => filteredRecentFiles.value.filter(ref => ref.__typename === tab.typename)

// Only public references can be chosen: the releases of those offered, by id, read as they are offered (null when
// they couldn't be read), and again each time the modal opens
const { resolveClient } = useApolloClient()
const releases = ref({})
const offeredIds = computed(() => props.visible && props.publicOnly
  ? [...new Set([...filteredSearchResults.value, ...filteredRecentFiles.value].map(ref => ref.id))]
  : []
)
watch(offeredIds, async (ids) => {
  if (ids.length === 0) {
    releases.value = {}
    return
  }
  const unread = ids.filter(id => !(id in releases.value))
  if (unread.length === 0) return
  let controllers = []
  try {
    const { data } = await resolveClient().query({
      query: CONTROLLER_RELEASE_QUERY,
      variables: { entityLabel: 'REFERENCE', entityIds: unread },
      fetchPolicy: 'network-only'
    })
    controllers = data?.controlsControllers?.result ?? []
  } catch (error) {
    console.error('Reading the releases of references failed:', error)
  }
  // the controllers come in the order of the ids
  releases.value = { ...releases.value, ...Object.fromEntries(unread.map((id, i) => [id, controllers[i]?.release ?? null])) }
}, { immediate: true })

const choosable = (reference) => !props.publicOnly || releases.value[reference.id] === 'PUBLIC'
// why a reference can't be chosen
const unchoosableNote = (reference) => {
  if (choosable(reference)) return null
  if (!(reference.id in releases.value)) return 'Checking its release…'
  const release = releases.value[reference.id]
  return release ? `${RELEASE_LABELS[release]}: only public references can be chosen` : 'Its release could not be read'
}

const selectedReferences = computed(() => {
  return selectedReferencesData.value.filter(ref => selectedIds.value.includes(ref.id))
})

const isSingleMode = computed(() => props.selectionMode === 'single')

const modalTitle = computed(() => {
  if (props.title) return props.title
  if (isSingleMode.value) return 'Select Reference'
  return 'Manage References'
})

// Watchers
watch(() => props.selectedReferenceIds, (newIds) => {
  selectedIds.value = [...newIds]
})

watch(() => props.initialReferences, (newRefs) => {
  selectedReferencesData.value = [...newRefs]
})

watch(describedReferences, (described) => {
  if (described.length === 0) return
  const byId = new Map(described.map(ref => [ref.id, ref]))
  selectedReferencesData.value = selectedReferencesData.value.map(ref => byId.get(ref.id) ?? ref)
  if (byId.has(pendingEditId.value)) startEditing(byId.get(pendingEditId.value))
})

watch(() => props.visible, (visible) => {
  if (visible) {
    if (props.showRecent) {
      refetchRecentFiles()
    }
    searchQuery.value = ''
    editingReference.value = null
    pendingEditId.value = null
    activeTab.value = defaultActiveTab.value
  }
})

watch(() => defaultActiveTab.value, (newTab) => {
  activeTab.value = newTab
})

// Handlers
const handleSearchInput = (value) => {
  searchQuery.value = value
}

const handleReferenceCreated = (reference) => {
  if (isSingleMode.value) {
    // in single mode the new reference replaces the selection, and is saved at once
    selectedIds.value = [reference.id]
    selectedReferencesData.value = [reference]
    handleSave()
    return
  }
  selectedIds.value.push(reference.id)
  selectedReferencesData.value.push(reference)
}

const handleReferenceUpdated = (reference) => {
  const index = selectedReferencesData.value.findIndex(r => r.id === reference.id)
  if (index !== -1) {
    selectedReferencesData.value[index] = { ...selectedReferencesData.value[index], ...reference }
  }
  editingReference.value = null
}

const toggleSelection = (referenceId, reference = null) => {
  // one that can't be chosen isn't added, though one chosen already can be let go
  if (reference && !selectedIds.value.includes(referenceId) && !choosable(reference)) return
  if (isSingleMode.value) {
    // In single mode, replace selection
    selectedIds.value = [referenceId]
    if (reference && !selectedReferencesData.value.find(r => r.id === referenceId)) {
      selectedReferencesData.value = [reference]
    }
    handleSave()
  } else {
    // In multi mode, toggle
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
}

const removeFromSelection = (referenceId) => {
  const index = selectedIds.value.indexOf(referenceId)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  }
}

// A reference given by id alone is edited once read in full: its form would start blank, and saving it would clear
// the description and the rest
const startEditing = (reference) => {
  if (reference.description === undefined) {
    pendingEditId.value = reference.id
    return
  }
  pendingEditId.value = null
  editingReference.value = reference
  // Switch to appropriate tab based on reference type
  const typeKey = Object.keys(FORM_COMPONENTS).find(
    key => reference.__typename === props.referenceTypes.find(rt => rt.key === key)?.typename
  )
  if (typeKey && hasType(typeKey)) {
    activeTab.value = typeKey
  }
}

const cancelEditing = () => {
  editingReference.value = null
  pendingEditId.value = null
}

const handleSave = () => {
  emit('update:selectedReferenceIds', selectedIds.value)
  emit('save', {
    referenceIds: selectedIds.value,
    references: selectedReferences.value
  })
  emit('close')
}

const handleClose = () => {
  selectedIds.value = [...props.selectedReferenceIds]
  emit('close')
}

const getFormComponent = (typeKey) => {
  return FORM_COMPONENTS[typeKey] || null
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container">
        <!-- Header -->
        <div class="modal-header">
          <h2>{{ modalTitle }}</h2>
          <button class="close-btn" @click="handleClose">&times;</button>
        </div>

        <p v-if="notice" class="modal-notice">{{ notice }}</p>

        <!-- Tabs (only if multiple types) -->
        <div v-if="orderedTabs.length > 1 || allowSearch" class="tabs">
          <button
            v-for="tab in orderedTabs"
            :key="tab.id"
            :class="['tab', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id; editingReference = null"
          >
            {{ tab.icon }} {{ tab.label }}
          </button>

          <button
            v-if="allowSearch"
            :class="['tab', { active: activeTab === 'search' }]"
            @click="activeTab = 'search'; editingReference = null"
          >
            🔍 Search
          </button>

          <button
            v-if="!isSingleMode"
            :class="['tab', { active: activeTab === 'selected' }]"
            @click="activeTab = 'selected'"
          >
            ✓ Selected ({{ selectedIds.length }})
          </button>
        </div>

        <!-- Content -->
        <div class="modal-content">
          <!-- Dynamic Type Tabs -->
          <template v-for="tab in orderedTabs" :key="tab.id">
            <div v-if="activeTab === tab.id" class="tab-content">
              <component
                v-if="getFormComponent(tab.id)"
                :is="getFormComponent(tab.id)"
                :reference="editingReference?.__typename === tab.typename ? editingReference : null"
                :mode="editingReference?.__typename === tab.typename ? 'edit' : 'create'"
                :fixed-release="publicOnly ? 'PUBLIC' : undefined"
                @created="handleReferenceCreated"
                @success="handleReferenceUpdated"
                @cancel="cancelEditing"
              />

              <!-- Recent section for file-like types -->
              <div
                v-if="showRecent && (tab.id === 'FILE' || tab.id === 'DATA_FILE') && recentFilesOf(tab).length > 0 && !editingReference"
                class="recent-section"
              >
                <h4>Recent References</h4>
                <div class="reference-list">
                  <ReferenceItem
                    v-for="ref in recentFilesOf(tab)"
                    :key="ref.id"
                    :reference="ref"
                    :selectable="true"
                    :selected="selectedIds.includes(ref.id)"
                    :disabled="!choosable(ref)"
                    :note="unchoosableNote(ref)"
                    @toggle-select="toggleSelection(ref.id, ref)"
                  />
                </div>
              </div>
            </div>
          </template>

          <!-- Search Tab -->
          <div v-if="allowSearch && activeTab === 'search'" class="tab-content">
            <div class="search-section">
              <div class="search-input-container">
                <input
                  type="text"
                  :value="searchQuery"
                  @input="handleSearchInput($event.target.value)"
                  placeholder="Search references by description..."
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
                No references found matching "{{ searchQuery }}"
              </div>

              <div v-else class="reference-list">
                <ReferenceItem
                  v-for="ref in filteredSearchResults"
                  :key="ref.id"
                  :reference="ref"
                  :selectable="true"
                  :selected="selectedIds.includes(ref.id)"
                  :disabled="!choosable(ref)"
                  :note="unchoosableNote(ref)"
                  @toggle-select="toggleSelection(ref.id, ref)"
                />
              </div>
            </div>
          </div>

          <!-- Selected Tab (multi-mode only) -->
          <div v-if="!isSingleMode && activeTab === 'selected'" class="tab-content">
            <div v-if="selectedReferences.length === 0" class="empty-state">
              No references selected. Create new references or search for existing ones.
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

            <div v-if="pendingEditId" class="editing-notice">
              <p>Reading reference #{{ pendingEditId }} before editing it…</p>
              <button class="btn btn-secondary btn-sm" @click="cancelEditing">
                Cancel Edit
              </button>
            </div>
            <div v-if="editingReference" class="editing-notice">
              <p>Editing reference #{{ editingReference.id }} - switch to the appropriate tab to modify</p>
              <button class="btn btn-secondary btn-sm" @click="cancelEditing">
                Cancel Edit
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="handleClose">
            Cancel
          </button>
          <button v-if="!isSingleMode" class="btn btn-primary" @click="handleSave">
            {{ isSingleMode ? 'Select' : `Save (${selectedIds.length})` }}
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

.modal-notice {
  margin: 0;
  padding: 10px 24px;
  background: #fff8e1;
  color: #6d4c00;
  border-bottom: 1px solid #e0e0e0;
  font-size: 14px;
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
  padding: 16px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.search-section {
  padding: 0;
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

.search-hint,
.empty-state {
  text-align: center;
  color: #999;
  padding: 20px;
  font-style: italic;
}

.empty-state {
  padding: 40px;
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
  margin: 0 0 16px 0;
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