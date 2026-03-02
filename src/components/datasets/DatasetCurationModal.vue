<!-- src/components/datasets/DatasetCurationModal.vue -->
<script setup>
import { ref, computed, watch } from 'vue'
import { FormKit } from '@formkit/vue'
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  FlexRender,
} from '@tanstack/vue-table'

import { useSelectStudyQueries } from '@/composables/datasets/selectStudyQueries'
import { useDatasetSummariesMultiQuery } from '@/composables/datasets/datasetSummariesMultiQuery'
import { useDatasetsQuery } from '@/composables/datasets/datasetsQuery'
import { useDatasetCurationTable } from '@/composables/datasets/useDatasetCurationTable'
import { useUserAccess } from '@/composables/user/useUserAccess'
import ControllerModal from '@/components/controls/ControllerModal.vue'
import DataFileReferenceModal from '@/components/references/DataFileReferenceModal.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'updated'])

// Phase management: 'selection' or 'table'
const phase = ref('selection')

// Selection state
const selectedProgram = ref(null)
const selectedTrial = ref(null)
const selectionData = ref({
  studyIds: [],
  conceptIds: []
})

// Study selection queries
const {
  programs,
  programsLoading,
  trials,
  trialsLoading,
  studies,
  studiesLoading,
} = useSelectStudyQueries({
  programId: selectedProgram,
  trialId: selectedTrial,
  studyId: () => null // We don't need single study lookup here
})

// Multi-study summaries
const {
  loading: summariesLoading,
  fetchSummaries,
  availableConcepts,
  getDatasetIdsForConcepts
} = useDatasetSummariesMultiQuery()

// User access for determining curate permissions
const { curateTeamIds } = useUserAccess()

// Watch study selection and fetch summaries
watch(() => selectionData.value.studyIds, async (newStudyIds) => {
  if (newStudyIds && newStudyIds.length > 0) {
    await fetchSummaries(newStudyIds)
  }
}, { immediate: true })

// Datasets query (for table phase)
const selectedDatasetIds = computed(() => {
  return getDatasetIdsForConcepts(selectionData.value.conceptIds)
})

const {
  datasets,
  datasetsLoading,
  datasetsError
} = useDatasetsQuery({
  studyIds: () => null,
  conceptIds: () => null,
  datasetIds: () => phase.value === 'table' ? selectedDatasetIds.value : null
})

// Curation table composable
const {
  tableData,
  conceptData,
  datasetControllers,
  columnStatus,
  cellErrors,
  isLoading: tableLoading,
  isSubmitting,
  hasUnsavedChanges,
  hasValueChanged,
  allSubmitted,
  getConcepts,
  initializeFromDatasets,
  isCellEditable,
  cellHasRecord,
  getCellInfo,
  getDatasetIdForCell,
  updateCell,
  getCellError,
  markRecordForDeletion,
  unmarkRecordForDeletion,
  isMarkedForDeletion,
  getCellReferences,
  updateCellReferences,
  submitAllChanges,
  exportToCSV,
  getDatasetStatus,
  cleanup,
  getCategories,
  isComplexScale,
  isCategoricalScale,
  isNumericScale
} = useDatasetCurationTable()

// Initialize table when datasets are loaded
watch([datasets, () => phase.value], async ([newDatasets, newPhase]) => {
  if (newPhase === 'table' && newDatasets && newDatasets.length > 0) {
    await initializeFromDatasets(newDatasets, curateTeamIds.value)
  }
})

// Concept options for multiselect
const conceptOptions = computed(() => {
  return availableConcepts.value.map(concept => ({
    label: concept.name || `Concept ${concept.id}`,
    value: concept.id
  }))
})

// Can proceed to table
const canLoadTable = computed(() => {
  return selectionData.value.studyIds.length > 0 &&
         selectionData.value.conceptIds.length > 0
})

// Table configuration
const sorting = ref([])
const columnVisibility = ref({
  unitLabel: true,
  unitId: true,
  startTime: true,
  endTime: true
})

// Build table columns
const columns = computed(() => {
  if (phase.value !== 'table' || getConcepts.value.length === 0) {
    return []
  }

  const cols = []
  const columnHelper = createColumnHelper()

  // Unit columns
  cols.push(columnHelper.accessor('unitLabel', {
    id: 'unitLabel',
    header: 'Unit',
    meta: { frozen: true, width: '150px' }
  }))

  cols.push(columnHelper.accessor('unitId', {
    id: 'unitId',
    header: 'Unit ID',
    meta: { width: '80px' }
  }))

  // Time columns
  cols.push(columnHelper.accessor('startTime', {
    id: 'startTime',
    header: 'Start',
    meta: { editable: true, type: 'datetime', width: '160px' }
  }))

  cols.push(columnHelper.accessor('endTime', {
    id: 'endTime',
    header: 'End',
    meta: { editable: true, type: 'datetime', width: '160px' }
  }))

  // Concept columns
  getConcepts.value.forEach(concept => {
    const columnKey = `concept_${concept.id}`
    cols.push(columnHelper.accessor(columnKey, {
      id: columnKey,
      header: () => concept.name || `Concept ${concept.id}`,
      meta: {
        editable: !isComplexScale(concept),
        type: getInputType(concept),
        concept,
        conceptId: concept.id,
        width: '150px'
      }
    }))
  })

  // Actions column
  cols.push(columnHelper.display({
    id: 'actions',
    header: '',
    meta: { isActions: true, width: '60px' }
  }))

  return cols
})

const getInputType = (concept) => {
  if (isComplexScale(concept)) return 'complex'
  if (isCategoricalScale(concept)) return 'categorical'
  if (isNumericScale(concept)) return 'numeric'
  return 'text'
}

// TanStack table instance
const table = computed(() => {
  if (columns.value.length === 0) return null

  return useVueTable({
    data: tableData,
    columns: columns.value,
    state: {
      sorting: sorting.value,
      columnVisibility: columnVisibility.value
    },
    onSortingChange: (updater) => {
      sorting.value = typeof updater === 'function'
        ? updater(sorting.value)
        : updater
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })
})

const rows = computed(() => table.value?.getRowModel().rows ?? [])

// Cell editing state
const editingCell = ref(null)
const editingValue = ref('')

const startEditing = (rowIndex, columnId, currentValue, conceptId) => {
  // Check if cell is editable
  if (conceptId && !isCellEditable(rowIndex, conceptId)) return

  editingCell.value = { rowIndex, columnId }
  editingValue.value = currentValue || ''
}

const finishEditing = () => {
  if (editingCell.value) {
    updateCell(editingCell.value.rowIndex, editingCell.value.columnId, editingValue.value)
    editingCell.value = null
    editingValue.value = ''
  }
}

const cancelEditing = () => {
  editingCell.value = null
  editingValue.value = ''
}

const handleKeyDown = (event) => {
  if (event.key === 'Enter') finishEditing()
  else if (event.key === 'Escape') cancelEditing()
}

// Controller modal state
const showControllerModal = ref(false)
const selectedController = ref(null)
const selectedDatasetId = ref(null)

const openControllerModal = (rowIndex, conceptId) => {
  const info = getCellInfo(rowIndex, conceptId)
  if (info && info.controller) {
    selectedController.value = info.controller
    selectedDatasetId.value = info.datasetId
    showControllerModal.value = true
  }
}

// File reference modal state for complex scale cells
const showFileReferenceModal = ref(false)
const fileReferenceRowIndex = ref(null)
const fileReferenceConceptId = ref(null)


const openFileReferenceModal = (rowIndex, conceptId) => {
  // Check if cell is editable
  if (!isCellEditable(rowIndex, conceptId)) return

  fileReferenceRowIndex.value = rowIndex
  fileReferenceConceptId.value = conceptId
  showFileReferenceModal.value = true
}

const getSelectedReferenceIds = () => {
  if (fileReferenceRowIndex.value === null || fileReferenceConceptId.value === null) {
    return []
  }
  return getCellReferences(fileReferenceRowIndex.value, fileReferenceConceptId.value)
}

const handleFileReferenceSave = (referenceIds) => {
  if (fileReferenceRowIndex.value !== null && fileReferenceConceptId.value !== null) {
    updateCellReferences(fileReferenceRowIndex.value, fileReferenceConceptId.value, referenceIds)
  }
  showFileReferenceModal.value = false
  fileReferenceRowIndex.value = null
  fileReferenceConceptId.value = null
}

const closeFileReferenceModal = () => {
  showFileReferenceModal.value = false
  fileReferenceRowIndex.value = null
  fileReferenceConceptId.value = null
}

// Helper to get reference count for display in complex cells
const getReferenceCount = (rowIndex, conceptId) => {
  const refs = getCellReferences(rowIndex, conceptId)
  return refs.length
}

// Close confirmation
const showCloseConfirm = ref(false)

const handleClose = () => {
  if (hasUnsavedChanges.value) {
    showCloseConfirm.value = true
  } else {
    confirmClose()
  }
}

const confirmClose = () => {
  showCloseConfirm.value = false
  cleanup()
  phase.value = 'selection'
  selectionData.value = { studyIds: [], conceptIds: [] }
  emit('close')
}

// Load table phase
const loadTable = () => {
  if (canLoadTable.value) {
    phase.value = 'table'
  }
}

// Back to selection
const backToSelection = () => {
  if (hasUnsavedChanges.value) {
    showCloseConfirm.value = true
  } else {
    cleanup()
    phase.value = 'selection'
  }
}

// Submit changes
const handleSubmit = async () => {
  await submitAllChanges()
  if (allSubmitted.value) {
    emit('updated')
  }
}

// Export CSV
const handleExport = () => {
  const visibleCols = table.value?.getVisibleFlatColumns() || []
  const colDefs = visibleCols
    .filter(col => col.id !== 'actions')
    .map(col => ({
      id: col.id,
      header: typeof col.columnDef.header === 'function'
        ? col.columnDef.header()
        : col.columnDef.header
    }))
  exportToCSV(colDefs)
}

// Study hierarchy navigation
const loadChildren = (nodeId, node) => {
  const typeName = node?.__typename
  if (typeName === 'Program') {
    selectedProgram.value = nodeId
    selectedTrial.value = null
  } else if (typeName === 'Trial') {
    selectedTrial.value = nodeId
  }
}

const childrenLoading = computed(() => studiesLoading || trialsLoading || programsLoading)

const currentChildren = computed(() => {
  if (selectedProgram.value) {
    return selectedTrial.value ? studies : trials
  }
  return []
})

const hasChildren = (node) => {
  if (node.__typename === 'Study') {
    return false
  } else if (node.__typename === 'Trial') {
    return node.studies ? node.studies?.length > 0 : true
  } else if (node.__typename === 'Program') {
    return node.trials ? node.trials?.length > 0 : true
  }
  console.error("unrecognised typename to hasChildren")
  return false
}


const isSelectable = (node) => {
  return node.__typename === 'Study'
}

// Get status display for concept column
const getConceptStatus = (conceptId) => {
  const datasetIds = conceptData.value[conceptId]?.datasetIds || []
  const statuses = datasetIds.map(id => getDatasetStatus(id))

  if (statuses.some(s => s.status === 'error')) return { icon: '❌', class: 'status-error' }
  if (statuses.some(s => s.status === 'submitting')) return { icon: '⏳', class: 'status-submitting' }
  if (statuses.every(s => s.status === 'success')) return { icon: '✅', class: 'status-success' }
  return null
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container" :class="{ 'modal-large': phase === 'table' }">
        <!-- Header -->
        <div class="modal-header">
          <h2>
            <span v-if="phase === 'selection'">View & Curate Datasets</span>
            <span v-else>Curate Datasets</span>
          </h2>
          <button class="close-btn" @click="handleClose">&times;</button>
        </div>

        <!-- Selection Phase -->
        <div v-if="phase === 'selection'" class="modal-content selection-phase">
          <FormKit
            v-model="selectionData"
            type="form"
            :actions="false"
          >
            <!-- Study Multi-Select -->
            <FormKit
              type="hierarchical-multiselect"
              name="studyIds"
              label="Studies:"
              help="Select one or more studies"
              :value="selectionData.studyIds"
              :selected-nodes="[]"
              :rootNodes="programs"
              :loadChildrenFn="loadChildren"
              :childrenLoading="childrenLoading"
              :currentChildren="currentChildren"
              :hasChildrenFn="hasChildren"
              :isSelectableFn="isSelectable"
              :get-node-label-fn="(node) => node.name || `${node.id}`"
              :max-selections="10"
              validation="required"
            />

            <!-- Concept Multi-Select -->
            <FormKit
              type="select"
              name="conceptIds"
              label="Concepts:"
              help="Select concepts to display (based on available datasets)"
              :options="conceptOptions"
              :disabled="summariesLoading || conceptOptions.length === 0"
              multiple
              validation="required"
            />

            <p v-if="selectionData.studyIds.length > 0 && conceptOptions.length === 0 && !summariesLoading" class="no-concepts-msg">
              No datasets found for the selected studies.
            </p>
          </FormKit>

          <div class="selection-actions">
            <button
              class="btn btn-primary"
              :disabled="!canLoadTable || datasetsLoading"
              @click="loadTable"
            >
              {{ datasetsLoading ? 'Loading...' : 'Load Table' }}
            </button>
          </div>
        </div>

        <!-- Table Phase -->
        <div v-else class="modal-content table-phase">
          <!-- Toolbar -->
          <div class="toolbar">
            <button class="btn btn-secondary btn-sm" @click="backToSelection">
              ← Back to Selection
            </button>

            <div class="toolbar-spacer"></div>

            <div class="column-toggles">
              <label><input type="checkbox" v-model="columnVisibility.unitId" /> Unit ID</label>
              <label><input type="checkbox" v-model="columnVisibility.startTime" /> Start</label>
              <label><input type="checkbox" v-model="columnVisibility.endTime" /> End</label>
            </div>

            <button class="btn btn-secondary btn-sm" @click="handleExport">
              📥 Export CSV
            </button>
          </div>

          <!-- Loading state -->
          <div v-if="tableLoading || datasetsLoading" class="loading-state">
            Loading datasets...
          </div>

          <!-- Error state -->
          <div v-else-if="datasetsError" class="error-state">
            Error loading datasets: {{ datasetsError }}
          </div>

          <!-- Table -->
          <div v-else-if="table" class="table-wrapper">
            <table class="curation-table">
              <thead>
                <tr>
                  <th
                    v-for="header in table.getFlatHeaders()"
                    :key="header.id"
                    :class="{
                      'sticky-col': header.column.columnDef.meta?.frozen,
                      'sortable': header.column.getCanSort()
                    }"
                    :style="{ width: header.column.columnDef.meta?.width }"
                    @click="header.column.getToggleSortingHandler()?.($event)"
                  >
                    <div class="header-content">
                      <span class="header-text">
                        <FlexRender
                          :render="header.column.columnDef.header"
                          :props="header.getContext()"
                        />
                      </span>

                      <span v-if="header.column.getIsSorted()" class="sort-indicator">
                        {{ header.column.getIsSorted() === 'asc' ? '↑' : '↓' }}
                      </span>

                      <!-- Concept status -->
                      <span
                        v-if="header.column.columnDef.meta?.conceptId && getConceptStatus(header.column.columnDef.meta.conceptId)"
                        class="status-indicator"
                        :class="getConceptStatus(header.column.columnDef.meta.conceptId).class"
                      >
                        {{ getConceptStatus(header.column.columnDef.meta.conceptId).icon }}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.id">
                  <td
                    v-for="cell in row.getVisibleCells()"
                    :key="cell.id"
                    :class="{
                      'sticky-col': cell.column.columnDef.meta?.frozen,
                      'editable-cell': cell.column.columnDef.meta?.editable,
                      'locked-cell': cell.column.columnDef.meta?.conceptId && !isCellEditable(row.index, cell.column.columnDef.meta.conceptId),
                      'empty-cell': cell.column.columnDef.meta?.conceptId && !cellHasRecord(row.index, cell.column.columnDef.meta.conceptId),
                      'deleted-cell': cell.column.columnDef.meta?.conceptId && isMarkedForDeletion(row.index, cell.column.columnDef.meta.conceptId),
                      'error-cell': getCellError(row.index, cell.column.id),
                      'warning-cell': getCellError(row.index, cell.column.id)?.isWarning,
                      'marked-for-deletion': isMarkedForDeletion(row.index, cell.column.columnDef.meta.conceptId)
                    }"
                    :title="getCellError(row.index, cell.column.id)?.message"
                    :style="{ width: cell.column.columnDef.meta?.width }"
                  >
                    <!-- Actions column -->
                    <template v-if="cell.column.columnDef.meta?.isActions">
                      <div class="cell-actions">
                        <!-- Delete button would go here for each concept -->
                      </div>
                    </template>

                    <!-- Concept cells -->
                    <template v-else-if="cell.column.columnDef.meta?.conceptId">
                      <div class="concept-cell">
                        <!-- Controller badge -->
                        <button
                          v-if="cellHasRecord(row.index, cell.column.columnDef.meta.conceptId)"
                          class="controller-badge-mini"
                          :class="{ 'can-edit': isCellEditable(row.index, cell.column.columnDef.meta.conceptId) }"
                          @click.stop="openControllerModal(row.index, cell.column.columnDef.meta.conceptId)"
                          title="View controller"
                        >
                          🔒
                        </button>

                        <!-- Complex scale cell (file references) -->
                        <template v-if="isComplexScale(cell.column.columnDef.meta.concept)">
                          <div
                            class="complex-cell"
                            :class="{
                              clickable: isCellEditable(row.index, cell.column.columnDef.meta.conceptId),
                              'has-changes': hasValueChanged(row.index, cell.column.columnDef.meta.conceptId)
                            }"
                            @click="isCellEditable(row.index, cell.column.columnDef.meta.conceptId) && openFileReferenceModal(row.index, cell.column.columnDef.meta.conceptId)"
                          >
                            <span class="file-count">
                              {{ getReferenceCount(row.index, cell.column.columnDef.meta.conceptId) }} file(s)
                            </span>
                            <span v-if="isCellEditable(row.index, cell.column.columnDef.meta.conceptId)" class="manage-link">
                              Manage
                            </span>
                          </div>
                        </template>

                        <!-- Editable value (non-complex) -->
                        <template v-else-if="isCellEditable(row.index, cell.column.columnDef.meta.conceptId)">
                          <!-- Editing mode -->
                          <template v-if="editingCell?.rowIndex === row.index && editingCell?.columnId === cell.column.id">
                            <select
                              v-if="cell.column.columnDef.meta?.type === 'categorical'"
                              v-model="editingValue"
                              class="cell-input"
                              @blur="finishEditing"
                              @keydown="handleKeyDown"
                            >
                              <option value="">-- Select --</option>
                              <option
                                v-for="cat in getCategories(cell.column.columnDef.meta.concept)"
                                :key="cat.id"
                                :value="cat.name"
                              >
                                {{ cat.name }}
                              </option>
                            </select>
                            <input
                              v-else
                              v-model="editingValue"
                              type="text"
                              class="cell-input"
                              @blur="finishEditing"
                              @keydown="handleKeyDown"
                            />
                          </template>

                          <!-- Display mode -->
                          <div
                            v-else
                            class="cell-value editable"
                            @click="startEditing(row.index, cell.column.id, cell.getValue(), cell.column.columnDef.meta.conceptId)"
                          >
                            {{ cell.getValue() || '' }}
                          </div>

                          <!-- Delete button -->
                          <button
                            v-if="cellHasRecord(row.index, cell.column.columnDef.meta.conceptId) && !isMarkedForDeletion(row.index, cell.column.columnDef.meta.conceptId)"
                            class="action-btn delete"
                            @click.stop="markRecordForDeletion(row.index, cell.column.columnDef.meta.conceptId)"
                            title="Delete record"
                          >
                            🗑️
                          </button>
                          <button
                            v-else-if="isMarkedForDeletion(row.index, cell.column.columnDef.meta.conceptId)"
                            class="action-btn undo"
                            @click.stop="unmarkRecordForDeletion(row.index, cell.column.columnDef.meta.conceptId)"
                            title="Undo delete"
                          >
                            ↩️
                          </button>

                        </template>

                        <!-- Read-only value -->
                        <template v-else>
                          <div class="cell-value readonly">
                            <template v-if="isComplexScale(cell.column.columnDef.meta.concept)">
                              {{ getReferenceCount(row.index, cell.column.columnDef.meta.conceptId) }} file(s)
                            </template>
                            <template v-else>
                              {{ cell.getValue() || '' }}
                            </template>
                          </div>
                        </template>
                      </div>
                    </template>

                    <!-- Time columns (editable based on row permissions) -->
                    <template v-else-if="cell.column.columnDef.meta?.type === 'datetime'">
                      <template v-if="editingCell?.rowIndex === row.index && editingCell?.columnId === cell.column.id">
                        <input
                          v-model="editingValue"
                          type="text"
                          class="cell-input"
                          placeholder="YYYY-MM-DD"
                          @blur="finishEditing"
                          @keydown="handleKeyDown"
                        />
                      </template>
                      <div
                        v-else
                        class="cell-value editable"
                        @click="startEditing(row.index, cell.column.id, cell.getValue(), null)"
                      >
                        {{ cell.getValue() || '' }}
                      </div>
                    </template>

                    <!-- Regular cells -->
                    <template v-else>
                      {{ cell.getValue() }}
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="empty-state">
            No data to display
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="handleClose" :disabled="isSubmitting">
            Close
          </button>
          <button
            v-if="phase === 'table'"
            class="btn btn-primary"
            @click="handleSubmit"
            :disabled="isSubmitting || !hasUnsavedChanges || allSubmitted"
          >
            <span v-if="isSubmitting">Submitting...</span>
            <span v-else-if="allSubmitted">All Saved</span>
            <span v-else>Save Changes</span>
          </button>
        </div>

        <!-- Loading overlay -->
        <div v-if="isSubmitting" class="loading-overlay">
          <div class="spinner"></div>
          <p>Saving changes...</p>
        </div>
      </div>

      <!-- Controller Modal -->
      <ControllerModal
        :is-visible="showControllerModal"
        :controller="selectedController"
        :loading="false"
        :error="''"
        entity-label="DATASET"
        :entity-id="selectedDatasetId"
        @close="showControllerModal = false"
      />

      <!-- Close Confirmation -->
      <div v-if="showCloseConfirm" class="popover-overlay" @click.self="showCloseConfirm = false">
        <div class="popover-content">
          <h4>Unsaved Changes</h4>
          <p>You have unsaved changes. Are you sure you want to close?</p>
          <div class="popover-actions">
            <button class="btn btn-secondary" @click="showCloseConfirm = false">Cancel</button>
            <button class="btn btn-danger" @click="confirmClose">Close Anyway</button>
          </div>
        </div>
      </div>

      <!-- File Reference Modal for Complex Scales -->
      <DataFileReferenceModal
        :visible="showFileReferenceModal"
        :selected-reference-ids="getSelectedReferenceIds()"
        @close="closeFileReferenceModal"
        @update:selected-reference-ids="handleFileReferenceSave"
      />

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
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-container.modal-large {
  max-width: 95vw;
  width: 95vw;
  height: 90vh;
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
  font-size: 1.25rem;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.modal-content {
  flex: 1;
  overflow: auto;
  padding: 20px 24px;
}

.selection-phase {
  max-width: 600px;
  margin: 0 auto;
}

.selection-actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

.no-concepts-msg {
  color: #666;
  font-style: italic;
  margin-top: 12px;
}

.table-phase {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-spacer {
  flex: 1;
}

.column-toggles {
  display: flex;
  gap: 12px;
  font-size: 13px;
}

.column-toggles label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.curation-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.curation-table th,
.curation-table td {
  padding: 8px 10px;
  border: 1px solid #e0e0e0;
  text-align: left;
}

.curation-table th {
  background: #f5f5f5;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
}

.sticky-col {
  position: sticky;
  left: 0;
  background: #f5f5f5;
  z-index: 11;
}

.curation-table tbody .sticky-col {
  background: white;
}

.sortable {
  cursor: pointer;
}

.sortable:hover {
  background: #eaeaea;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-text {
  flex: 1;
}

.sort-indicator {
  font-size: 11px;
}

.status-indicator {
  font-size: 12px;
}

.concept-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.controller-badge-mini {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 10px;
  opacity: 0.5;
  padding: 2px;
}

.controller-badge-mini.can-edit {
  opacity: 0.8;
}

.controller-badge-mini:hover {
  opacity: 1;
}

.cell-value {
  flex: 1;
  min-height: 20px;
  padding: 2px 4px;
}

.cell-value.editable {
  cursor: text;
  border-radius: 2px;
}

.cell-value.editable:hover {
  background: #f0f8ff;
}

.cell-value.readonly {
  color: #666;
}

.cell-input {
  width: 100%;
  padding: 4px;
  border: 1px solid #2196f3;
  border-radius: 2px;
  font-size: 13px;
}


.concept-cell:hover .delete-record-btn {
  opacity: 0.6;
}

/* Style for cells marked for deletion */
.marked-for-deletion {
  background: #ffebee !important;
  text-decoration: line-through;
  color: #999;
}

.action-btn.undo:hover {
  background: #e3f2fd;
}

.locked-cell {
  background: #f9f9f9;
}

.empty-cell {
  background: #fafafa;
  color: #999;
}

.deleted-cell {
  background: #ffebee;
  text-decoration: line-through;
  color: #999;
}

.error-cell {
  background: #ffebee !important;
  border-color: #f44336 !important;
}

.warning-cell {
  background: #fff3e0 !important;
  border-color: #ff9800 !important;
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

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
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

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #d32f2f;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #666;
  font-style: italic;
}

.error-state {
  color: #d32f2f;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #2196f3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.popover-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
}

.popover-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  min-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.popover-content h4 {
  margin: 0 0 12px 0;
}

.popover-content p {
  margin: 0 0 16px 0;
  color: #666;
}

.popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}


.complex-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px;
  flex: 1;
}

.complex-cell.clickable {
  cursor: pointer;
  transition: background-color 0.2s;
  border-radius: 2px;
}

.complex-cell.clickable:hover {
  background-color: #e3f2fd;
}

.complex-cell.has-changes {
  background-color: #fff3e0;
}

.file-count {
  font-size: 13px;
  color: #666;
}

.manage-link {
  font-size: 12px;
  color: #2196f3;
  text-decoration: underline;
}

</style>