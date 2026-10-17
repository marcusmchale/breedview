<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  FlexRender,
} from '@tanstack/vue-table'

import { useDatasetRecordPages, DEFAULT_UNITS_PAGE_SIZE } from '@/composables/datasets/useDatasetRecordPages'
import { useDatasetCurationTable } from '@/composables/datasets/useDatasetCurationTable'
import { useStudiesGroupings } from '@/composables/programs/studiesGroupingsQuery'

import CurationTableToolbar from './CurationTableToolbar.vue'
import CurationContributorsPanel from './CurationContributorsPanel.vue'
import CurationTableCell from './CurationTableCell.vue'
import CurationTableFooter from './CurationTableFooter.vue'
import LoadingOverlay from '@/components/datasets/LoadingOverlay.vue'
import ControllerModal from '@/components/controls/ControllerModal.vue'

import ReferencesModal from '@/components/references/ReferencesModal.vue'
import { DATA_REFERENCE_TYPE_CONFIGS } from '@/composables/references/referenceTypes'


const props = defineProps({
  datasetIds: { type: Array, required: true },
  // { [datasetId]: studyId }
  datasetStudyIds: { type: Object, default: () => ({}) },
  // narrowing of the records: { unitIds, start, end }, each optional
  filters: { type: Object, default: () => ({}) },
  // units loaded per page, with every record of those units from every dataset
  pageSize: { type: Number, default: DEFAULT_UNITS_PAGE_SIZE }
})

const emit = defineEmits(['back', 'submit', 'has-unsaved-changes'])

// Datasets with their records, a page of units at a time under the selection's narrowing, so every row is complete
const { page, pageCount, pageSummary, datasets, unitsById, datasetsLoading, datasetsError } = useDatasetRecordPages({
  datasetIds: () => props.datasetIds,
  filters: () => props.filters,
  pageSize: () => props.pageSize
})
const filterSummary = computed(() => {
  const parts = []
  const { start, end, unitIds } = props.filters ?? {}
  if (start && end) parts.push(`${start} to ${end}`)
  else if (start) parts.push(`from ${start}`)
  else if (end) parts.push(`to ${end}`)
  if (unitIds?.length) parts.push(`${unitIds.length} unit${unitIds.length === 1 ? '' : 's'} and what they contain`)
  return parts.join(' · ')
})

// Curation table composable
const {
  tableData, conceptData, columnStatus, isLoading: tableLoading, isSubmitting,
  hasUnsavedChanges, hasValueChanged, allSubmitted, getConcepts,
  datasetContributors, hasContributorsChanged, canEditContributors, setContributors,
  initializeFromDatasets, isCellEditable, cellHasRecord, getCellInfo,
  updateCell, getCellError, markRecordForDeletion, unmarkRecordForDeletion,
  isMarkedForDeletion, getCellReferences, updateCellReferences,
  submitAllChanges, exportToCSV, getDatasetStatus, cleanup,
  getCategories, isComplexScale, isCategoricalScale, isNumericScale,
  groupingColumns, rowSections, isGroupCellEditable, hasRowGroupsChanged,
  getGroupValueOptions, getRowSectionKey, getRowSectionLabel, setUnitDetails, lastSavedAt
} = useDatasetCurationTable()

// The units' germplasm and location fill their columns whenever the page's units arrive
watch(unitsById, (units) => setUnitDetails(units), { immediate: true })

// Study groupings (studies derived from the selected datasets)
const { fetchGroupings, loading: groupingsLoading } = useStudiesGroupings()

const studyIds = computed(() =>
  [...new Set(Object.values(props.datasetStudyIds).filter((id) => id != null))]
)

// Initialize table when datasets are loaded (groupings first, so rows split correctly)
watch(datasets, async (newDatasets) => {
  if (newDatasets?.length > 0) {
    const groupingsByStudy = await fetchGroupings(studyIds.value)
    await initializeFromDatasets(newDatasets, {
      groupingsByStudy,
      datasetStudyIds: props.datasetStudyIds
    })
  }
}, { immediate: true })

// Contributors of every loaded dataset, for the panel above the table
const datasetLabel = (datasetId) => {
  const entry = Object.values(conceptData.value).find((cd) => cd.datasetIds.includes(datasetId))
  return entry ? `${entry.concept.name} (#${datasetId})` : `Dataset #${datasetId}`
}
const contributorRows = computed(() =>
  Object.entries(datasetContributors.value).map(([datasetId, entry]) => ({
    id: datasetId,
    label: datasetLabel(datasetId),
    ids: entry.ids,
    people: entry.people,
    canEdit: canEditContributors(datasetId),
    changed: hasContributorsChanged(datasetId)
  }))
)

// Emit unsaved changes status
watch(hasUnsavedChanges, (value) => {
  emit('has-unsaved-changes', value)
}, { immediate: true })

// Table configuration
const sorting = ref([])
const columnVisibility = ref({
  unitLabel: true, unitId: true, startTime: true, endTime: true,
  germplasmName: false, germplasmId: false, locationName: false, locationId: false
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
  // the unit's germplasm, and its location at the row's time (hidden until chosen under Columns)
  cols.push(columnHelper.accessor('germplasmName', {
    id: 'germplasmName', header: 'Germplasm', meta: { width: '150px' }
  }))
  cols.push(columnHelper.accessor('germplasmId', {
    id: 'germplasmId', header: 'G. ID', meta: { width: '80px' }
  }))
  cols.push(columnHelper.accessor('locationName', {
    id: 'locationName', header: 'Location', meta: { width: '150px' }
  }))
  cols.push(columnHelper.accessor('locationId', {
    id: 'locationId', header: 'L. ID', meta: { width: '80px' }
  }))
  cols.push(columnHelper.accessor('startTime', {
    id: 'startTime', header: 'Start', meta: { width: '160px' }
  }))
  cols.push(columnHelper.accessor('endTime', {
    id: 'endTime', header: 'End', meta: { width: '160px' }
  }))

  // Record grouping columns (shared value per row)
  groupingColumns.value.forEach(g => {
    cols.push(columnHelper.accessor(g.key, {
      id: g.key,
      header: () => g.name,
      meta: { editable: true, type: 'grouping', grouping: g, width: '140px' }
    }))
  })

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

// Only the rows in view are rendered: a study's datasets can hold tens of thousands of rows.
// Row heights are fixed in CSS so the virtualiser needs no measuring; a section header adds to its row.
const ROW_HEIGHT = 37
const SECTION_HEIGHT = 33
const tableWrapperRef = ref(null)
const rowVirtualizer = useVirtualizer(computed(() => ({
  count: rows.value.length,
  getScrollElement: () => tableWrapperRef.value,
  estimateSize: (index) => ROW_HEIGHT + (isSectionStart(index) ? SECTION_HEIGHT : 0),
  overscan: 15
})))
const virtualItems = computed(() => rowVirtualizer.value.getVirtualItems().map((item) => ({
  key: item.key,
  rIdx: item.index,
  row: rows.value[item.index]
})))
const paddingTop = computed(() => rowVirtualizer.value.getVirtualItems()[0]?.start ?? 0)
const paddingBottom = computed(() => {
  const items = rowVirtualizer.value.getVirtualItems()
  return items.length ? rowVirtualizer.value.getTotalSize() - items[items.length - 1].end : 0
})
const columnCount = computed(() => table.value?.getFlatHeaders().length ?? 1)

// ---- Grouping cell editing ----
const editingGroupCell = ref(null) // { rowIndex, columnId }
const editingGroupValue = ref('')

const isGroupingColumn = (cell) => cell.column.columnDef.meta?.type === 'grouping'
const TIME_COLUMNS = new Set(['startTime', 'endTime'])

const isEditingGroupCell = (rowIndex, columnId) =>
  editingGroupCell.value?.rowIndex === rowIndex && editingGroupCell.value?.columnId === columnId

const startGroupEdit = (rowIndex, columnId, value) => {
  if (!isGroupCellEditable(rowIndex, columnId)) return
  editingGroupCell.value = { rowIndex, columnId }
  editingGroupValue.value = value ?? ''
  nextTick(() => document.querySelector('.group-cell-input')?.focus())
}

const commitGroupEdit = () => {
  if (!editingGroupCell.value) return
  const { rowIndex, columnId } = editingGroupCell.value
  updateCell(rowIndex, columnId, editingGroupValue.value.trim())
  editingGroupCell.value = null
  editingGroupValue.value = ''
}

const cancelGroupEdit = () => {
  editingGroupCell.value = null
  editingGroupValue.value = ''
}

// ---- DATASET_SCOPED row sections ----
const isSectionStart = (rIdx) => {
  if (rowSections.value.length === 0) return false
  if (rIdx === 0) return true
  return getRowSectionKey(rows.value[rIdx - 1]?.original) !== getRowSectionKey(rows.value[rIdx]?.original)
}

const sectionCount = (row) =>
  rowSections.value.find((s) => s.key === getRowSectionKey(row))?.rowIndices.length ?? 0

// ---- Cell classes ----
const getCellClasses = (row, cell) => {
  const meta = cell.column.columnDef.meta
  const conceptId = meta?.conceptId
  const error = getCellError(row.index, cell.column.id)
  return {
    'sticky-col': meta?.frozen,
    'editable-cell': meta?.editable,
    'grouping-cell': meta?.type === 'grouping',
    'locked-cell':
      (conceptId && !isCellEditable(row.index, conceptId))
      || (meta?.type === 'grouping' && !isGroupCellEditable(row.index, cell.column.id)),
    'empty-cell': conceptId && !cellHasRecord(row.index, conceptId),
    'deleted-cell': conceptId && isMarkedForDeletion(row.index, conceptId),
    'error-cell': error,
    'warning-cell': error?.isWarning,
    'marked-for-deletion': conceptId && isMarkedForDeletion(row.index, conceptId)
  }
}

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

// ---- Submission ----
const hasAttemptedSubmit = ref(false)

// Settled: nothing still polling, nothing failed, at least one dataset saved
const submissionSucceeded = computed(() => {
  const statuses = Object.values(columnStatus.value).map(s => s.status)
  return statuses.length > 0
    && !statuses.includes('submitting')
    && !statuses.includes('error')
    && statuses.includes('success')
})

const handleSubmit = async () => {
  cancelGroupEdit()
  hasAttemptedSubmit.value = true
  await submitAllChanges()
}

// Updates complete asynchronously via polling
watch(submissionSucceeded, (done) => {
  if (done && hasAttemptedSubmit.value) {
    hasAttemptedSubmit.value = false
    emit('submit')
  }
})

// Event handlers
const handleBack = () => emit('back')

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

const performCleanup = () => {
  cancelGroupEdit()
  hasAttemptedSubmit.value = false
  cleanup()
}

defineExpose({ cleanup: performCleanup, hasUnsavedChanges, isSubmitting, allSubmitted })
</script>

<template>
  <div class="curation-table-container">
    <CurationTableToolbar
      :column-visibility="columnVisibility"
      :page="page"
      :page-count="pageCount"
      :page-summary="pageSummary"
      :filter-summary="filterSummary"
      :paging-locked="hasUnsavedChanges || isSubmitting"
      @back="handleBack"
      @export="handleExport"
      @update:column-visibility="columnVisibility = $event"
      @update:page="page = $event"
    />

    <CurationContributorsPanel
      v-if="!tableLoading && !datasetsLoading && contributorRows.length"
      :datasets="contributorRows"
      :disabled="isSubmitting"
      @update="setContributors($event.datasetId, $event.ids)"
    />

    <div v-if="tableLoading || datasetsLoading || groupingsLoading" class="loading-state">
      Loading datasets...
    </div>

    <div v-else-if="datasetsError" class="error-state">
      Error loading datasets: {{ datasetsError }}
    </div>

    <div v-else-if="table" ref="tableWrapperRef" class="table-wrapper">
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
                <span
                  v-if="header.column.columnDef.meta?.type === 'grouping' && header.column.columnDef.meta.grouping.scope"
                  class="grouping-badge"
                  :class="header.column.columnDef.meta.grouping.scope"
                  :title="header.column.columnDef.meta.grouping.scope"
                >
                  {{ header.column.columnDef.meta.grouping.scope === 'DATASET_SCOPED' ? 'DS' : 'SW' }}
                </span>
                <span
                  v-if="header.column.columnDef.meta?.type === 'grouping' && header.column.columnDef.meta.grouping.extent === 'WITHIN_UNIT'"
                  class="grouping-badge WITHIN_UNIT"
                  title="Within unit: codes tell apart the readings of one unit, e.g. replicates"
                >
                  WU
                </span>
                <span
                  v-if="header.column.columnDef.meta?.type === 'grouping' && header.column.columnDef.meta.grouping.extent === 'WITHIN_GRAPH'"
                  class="grouping-badge WITHIN_GRAPH"
                  title="Within unit graph: codes group the units of one unit graph, e.g. the design blocks of a field"
                >
                  WG
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="paddingTop > 0" class="spacer-row" aria-hidden="true">
            <td :colspan="columnCount" :style="{ height: paddingTop + 'px' }"></td>
          </tr>
          <template v-for="{ key, rIdx, row } in virtualItems" :key="key">
            <!-- Section header for DATASET_SCOPED grouping values -->
            <tr v-if="isSectionStart(rIdx)" class="section-header">
              <td :colspan="row.getVisibleCells().length">
                {{ getRowSectionLabel(row.original) }} ({{ sectionCount(row.original) }} rows)
              </td>
            </tr>

            <tr :class="{ 'row-groups-changed': hasRowGroupsChanged(row.index) }">
              <td
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                :class="getCellClasses(row, cell)"
                :title="getCellError(row.index, cell.column.id)?.message"
                :style="{ width: cell.column.columnDef.meta?.width }"
              >
                <template v-if="cell.column.columnDef.meta?.isActions">
                  <div class="cell-actions"></div>
                </template>

                <!-- Grouping cell -->
                <template v-else-if="isGroupingColumn(cell)">
                  <template v-if="isEditingGroupCell(row.index, cell.column.id)">
                    <input
                      v-model="editingGroupValue"
                      type="text"
                      class="group-cell-input"
                      placeholder="e.g. R1, Batch A"
                      :list="`group-options-${cell.column.id}`"
                      @blur="commitGroupEdit"
                      @keydown.enter="commitGroupEdit"
                      @keydown.esc="cancelGroupEdit"
                    />
                    <datalist :id="`group-options-${cell.column.id}`">
                      <option
                        v-for="opt in getGroupValueOptions(cell.column.id)"
                        :key="opt"
                        :value="opt"
                      />
                    </datalist>
                  </template>
                  <div
                    v-else
                    class="group-cell-display"
                    @click="startGroupEdit(row.index, cell.column.id, cell.getValue())"
                  >
                    <template v-if="cell.getValue()">{{ cell.getValue() }}</template>
                    <!-- a factor record without a code describes every level of the grouping -->
                    <span v-else-if="row.original._kind === 'factor'" class="applies-to-all">all levels</span>
                  </div>
                </template>

                <!-- Concept cell -->
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

                <!-- a factor record without a start or end describes every time -->
                <span
                  v-else-if="row.original._kind === 'factor' && TIME_COLUMNS.has(cell.column.id) && !cell.getValue()"
                  class="applies-to-all"
                >all times</span>
                <template v-else>{{ cell.getValue() }}</template>
              </td>
            </tr>
          </template>
          <tr v-if="paddingBottom > 0" class="spacer-row" aria-hidden="true">
            <td :colspan="columnCount" :style="{ height: paddingBottom + 'px' }"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="empty-state">No data to display</div>

    <CurationTableFooter
      :is-submitting="isSubmitting"
      :has-unsaved-changes="hasUnsavedChanges"
      :all-submitted="allSubmitted"
      :saved-at="lastSavedAt"
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

/* Fixed row heights, so the virtualised rows line up with the scroll position without measuring */
.curation-table tbody tr {
  height: 37px;
}

.curation-table tbody td {
  box-sizing: border-box;
  height: 37px;
  padding-top: 0;
  padding-bottom: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.curation-table tbody tr.section-header {
  height: 33px;
}

.curation-table tbody tr.applies-to-all {
  color: #999;
  font-style: italic;
}

.section-header td {
  height: 33px;
}

.curation-table tbody tr.spacer-row {
  height: auto;
}

.curation-table tbody tr.spacer-row td {
  height: auto;
  padding: 0;
  border: none;
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
  /* below the sticky header, so scrolled rows don't draw over it; the header's own frozen cell sits above both */
  z-index: 9;
}

.curation-table thead .sticky-col {
  z-index: 12;
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

/* Grouping cells */
.grouping-cell { background: #fcfcf5; }
.group-cell-display { min-height: 18px; cursor: text; }
.locked-cell .group-cell-display { cursor: not-allowed; color: #888; }
.group-cell-input {
  width: 100%;
  padding: 3px;
  border: 1px solid #2196f3;
  border-radius: 2px;
  font-size: 13px;
  box-sizing: border-box;
}
.row-groups-changed td.grouping-cell { background: #e3f2fd; }

.grouping-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
  background: #e3f2fd;
  color: #1565c0;
}
.grouping-badge.DATASET_SCOPED { background: #fff3e0; color: #e65100; }
.grouping-badge.WITHIN_UNIT { background: #f3e5f5; color: #6a1b9a; }
.grouping-badge.WITHIN_GRAPH { background: #efebe9; color: #5d4037; }

/* DATASET_SCOPED section headers */
.section-header td {
  background: #fff3e0;
  color: #e65100;
  font-weight: 600;
  border-top: 2px solid #ff9800;
}

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