<script setup>
import { ref, computed, watch } from 'vue'
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  FlexRender,
} from '@tanstack/vue-table'

import { useDatasetsQuery } from '@/composables/datasets/datasetsQuery'
import { useDatasetCurationTable } from '@/composables/datasets/useDatasetCurationTable'

import CurationTableToolbar from './CurationTableToolbar.vue'
import CurationTableCell from './CurationTableCell.vue'
import CurationTableFooter from './CurationTableFooter.vue'
import LoadingOverlay from '@/components/datasets/LoadingOverlay.vue'
import ControllerModal from '@/components/controls/ControllerModal.vue'

import ReferencesModal from '@/components/references/ReferencesModal.vue'
import { DATA_REFERENCE_TYPE_CONFIGS } from '@/composables/references/referenceTypes'


const props = defineProps({
  datasetIds: { type: Array, required: true },
  curateTeamIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['back', 'submit', 'has-unsaved-changes'])

// Datasets query
const { datasets, datasetsLoading, datasetsError } = useDatasetsQuery({
  studyIds: () => null,
  conceptIds: () => null,
  datasetIds: () => props.datasetIds
})

// Curation table composable
const {
  tableData, conceptData, isLoading: tableLoading, isSubmitting,
  hasUnsavedChanges, hasValueChanged, allSubmitted, getConcepts,
  initializeFromDatasets, isCellEditable, cellHasRecord, getCellInfo,
  updateCell, getCellError, markRecordForDeletion, unmarkRecordForDeletion,
  isMarkedForDeletion, getCellReferences, updateCellReferences,
  submitAllChanges, exportToCSV, getDatasetStatus, cleanup,
  getCategories, isComplexScale, isCategoricalScale, isNumericScale
} = useDatasetCurationTable()

// Initialize table when datasets are loaded
watch(datasets, async (newDatasets) => {
  if (newDatasets?.length > 0) {
    await initializeFromDatasets(newDatasets, props.curateTeamIds)
  }
}, { immediate: true })

// Emit unsaved changes status
watch(hasUnsavedChanges, (value) => {
  emit('has-unsaved-changes', value)
}, { immediate: true })

// Table configuration
const sorting = ref([])
const columnVisibility = ref({
  unitLabel: true, unitId: true, startTime: true, endTime: true
})

const getInputType = (concept) => {
  if (isComplexScale(concept)) return 'complex'
  if (isCategoricalScale(concept)) return 'categorical'
  if (isNumericScale(concept)) return 'numeric'
  return 'text'
}

// Build table columns
const columns = computed(() => {
  if (getConcepts.value.length === 0) return []

  const cols = []
  const columnHelper = createColumnHelper()

  cols.push(columnHelper.accessor('unitLabel', {
    id: 'unitLabel', header: 'Unit', meta: { frozen: true, width: '150px' }
  }))
  cols.push(columnHelper.accessor('unitId', {
    id: 'unitId', header: 'Unit ID', meta: { width: '80px' }
  }))
  cols.push(columnHelper.accessor('startTime', {
    id: 'startTime', header: 'Start', meta: { editable: true, type: 'datetime', width: '160px' }
  }))
  cols.push(columnHelper.accessor('endTime', {
    id: 'endTime', header: 'End', meta: { editable: true, type: 'datetime', width: '160px' }
  }))

  getConcepts.value.forEach(concept => {
    const columnKey = `concept_${concept.id}`
    cols.push(columnHelper.accessor(columnKey, {
      id: columnKey,
      header: () => concept.name || `Concept ${concept.id}`,
      meta: {
        editable: !isComplexScale(concept),
        type: getInputType(concept),
        concept, conceptId: concept.id, width: '150px'
      }
    }))
  })

  cols.push(columnHelper.display({
    id: 'actions', header: '', meta: { isActions: true, width: '60px' }
  }))

  return cols
})

// TanStack table instance
const table = computed(() => {
  if (columns.value.length === 0) return null
  return useVueTable({
    data: tableData,
    columns: columns.value,
    state: { sorting: sorting.value, columnVisibility: columnVisibility.value },
    onSortingChange: (updater) => {
      sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })
})

const rows = computed(() => table.value?.getRowModel().rows ?? [])

// Controller modal state
const showControllerModal = ref(false)
const selectedController = ref(null)
const selectedDatasetId = ref(null)

const openControllerModal = (rowIndex, conceptId) => {
  const info = getCellInfo(rowIndex, conceptId)
  if (info?.controller) {
    selectedController.value = info.controller
    selectedDatasetId.value = info.datasetId
    showControllerModal.value = true
  }
}

// File reference modal state
const showFileReferenceModal = ref(false)
const fileReferenceRowIndex = ref(null)
const fileReferenceConceptId = ref(null)

const openFileReferenceModal = (rowIndex, conceptId) => {
  if (!isCellEditable(rowIndex, conceptId)) return
  fileReferenceRowIndex.value = rowIndex
  fileReferenceConceptId.value = conceptId
  showFileReferenceModal.value = true
}

const getSelectedReferenceIds = () => {
  if (fileReferenceRowIndex.value === null || fileReferenceConceptId.value === null) return []
  return getCellReferences(fileReferenceRowIndex.value, fileReferenceConceptId.value)
}

const handleFileReferenceSave = (references) => {
  if (fileReferenceRowIndex.value !== null && fileReferenceConceptId.value !== null) {
    updateCellReferences(fileReferenceRowIndex.value, fileReferenceConceptId.value, references)
  }
  closeFileReferenceModal()
}

const closeFileReferenceModal = () => {
  showFileReferenceModal.value = false
  fileReferenceRowIndex.value = null
  fileReferenceConceptId.value = null
}

// Status display helpers
const getConceptStatus = (conceptId) => {
  const datasetIds = conceptData.value[conceptId]?.datasetIds || []
  const statuses = datasetIds.map(id => getDatasetStatus(id))
  if (statuses.some(s => s.status === 'error')) return { icon: '❌', class: 'status-error' }
  if (statuses.some(s => s.status === 'submitting')) return { icon: '⏳', class: 'status-submitting' }
  if (statuses.every(s => s.status === 'success')) return { icon: '✅', class: 'status-success' }
  return null
}

// Event handlers
const handleBack = () => emit('back')

const handleSubmit = async () => {
  await submitAllChanges()
  if (allSubmitted.value) emit('submit')
}

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

const performCleanup = () => cleanup()

defineExpose({ cleanup: performCleanup, hasUnsavedChanges, isSubmitting, allSubmitted })
</script>

<template>
  <div class="curation-table-container">
    <CurationTableToolbar
      :column-visibility="columnVisibility"
      @back="handleBack"
      @export="handleExport"
      @update:column-visibility="columnVisibility = $event"
    />

    <div v-if="tableLoading || datasetsLoading" class="loading-state">
      Loading datasets...
    </div>

    <div v-else-if="datasetsError" class="error-state">
      Error loading datasets: {{ datasetsError }}
    </div>

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
                  <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                </span>
                <span v-if="header.column.getIsSorted()" class="sort-indicator">
                  {{ header.column.getIsSorted() === 'asc' ? '↑' : '↓' }}
                </span>
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
                'marked-for-deletion': isMarkedForDeletion(row.index, cell.column.columnDef.meta?.conceptId)
              }"
              :title="getCellError(row.index, cell.column.id)?.message"
              :style="{ width: cell.column.columnDef.meta?.width }"
            >
              <template v-if="cell.column.columnDef.meta?.isActions">
                <div class="cell-actions"></div>
              </template>

              <CurationTableCell
                v-else-if="cell.column.columnDef.meta?.conceptId"
                :row-index="row.index"
                :column-id="cell.column.id"
                :value="cell.getValue()"
                :concept="cell.column.columnDef.meta.concept"
                :concept-id="cell.column.columnDef.meta.conceptId"
                :input-type="cell.column.columnDef.meta.type"
                :categories="getCategories(cell.column.columnDef.meta.concept)"
                :is-editable="isCellEditable(row.index, cell.column.columnDef.meta.conceptId)"
                :has-record="cellHasRecord(row.index, cell.column.columnDef.meta.conceptId)"
                :is-marked-for-deletion="isMarkedForDeletion(row.index, cell.column.columnDef.meta.conceptId)"
                :has-value-changed="hasValueChanged(row.index, cell.column.columnDef.meta.conceptId)"
                :is-complex-scale="isComplexScale(cell.column.columnDef.meta.concept)"
                :reference-count="getCellReferences(row.index, cell.column.columnDef.meta.conceptId).length"
                :error="getCellError(row.index, cell.column.id)"
                @update="updateCell"
                @open-controller="openControllerModal"
                @open-file-reference="openFileReferenceModal"
                @mark-for-deletion="markRecordForDeletion"
                @unmark-for-deletion="unmarkRecordForDeletion"
              />

              <template v-else>{{ cell.getValue() }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="empty-state">No data to display</div>

    <CurationTableFooter
      :is-submitting="isSubmitting"
      :has-unsaved-changes="hasUnsavedChanges"
      :all-submitted="allSubmitted"
      @submit="handleSubmit"
    />

    <LoadingOverlay v-if="isSubmitting" message="Saving changes..." />

    <ControllerModal
      :is-visible="showControllerModal"
      :controller="selectedController"
      :loading="false"
      :error="''"
      entity-label="DATASET"
      :entity-id="selectedDatasetId"
      @close="showControllerModal = false"
    />

    <ReferencesModal
      :visible="showFileReferenceModal"
      :referenceTypes="DATA_REFERENCE_TYPE_CONFIGS"
      :selectedReferenceIds="getSelectedReferenceIds()"
      @close="closeFileReferenceModal"
      @save="handleFileReferenceSave"
    />
  </div>
</template>

<style scoped>
.curation-table-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  position: relative;
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

.sortable { cursor: pointer; }
.sortable:hover { background: #eaeaea; }

.header-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-text { flex: 1; }
.sort-indicator { font-size: 11px; }
.status-indicator { font-size: 12px; }

.locked-cell { background: #f9f9f9; }
.empty-cell { background: #fafafa; color: #999; }
.deleted-cell { background: #ffebee; text-decoration: line-through; color: #999; }
.error-cell { background: #ffebee !important; border-color: #f44336 !important; }
.warning-cell { background: #fff3e0 !important; border-color: #ff9800 !important; }
.marked-for-deletion { background: #ffebee !important; text-decoration: line-through; color: #999; }

.loading-state, .error-state, .empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #666;
  font-style: italic;
}

.error-state { color: #d32f2f; }
</style>