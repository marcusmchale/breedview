<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  FlexRender,
} from '@tanstack/vue-table';

import { useDatasetTable } from '@/composables/datasets/useDatasetTable';
import { useDatasetSubmissionWithGroupings } from '@/composables/datasets/useDatasetSubmissionWithGroupings';

import ReferencesModal from '@/components/references/ReferencesModal.vue'
import { DATA_REFERENCE_TYPE_CONFIGS } from '@/composables/references/referenceTypes'

import ControlSelector from "@/components/controls/ControlSelector.vue";
import PersonPicker from "@/components/people/PersonPicker.vue";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  selectedStudy: {
    type: Object,
    required: true
  },
  selectedUnits: {
    type: Array,
    required: true
  },
  selectedConcepts: {
    type: Array,
    required: true
  },
  rowsPerUnit: {
    type: Number,
    default: 1,
  },
  selectedGroupings: {
    type: Array,
    default: () => [],
  },
  mergeConfig: {
    type: Array,
    default: () => [],
  }
});

const emit = defineEmits(['close', 'submitted']);

const selectedControlTeamId = ref(null)
const selectedRelease = ref(null)
const errorMessage = ref('')

// Persons credited as contributors on every dataset submitted from this table
const selectedContributorIds = ref([])
const showContributors = ref(false)

const handleControlTeamError = (error) => {
  errorMessage.value = error
}


const {
  tableData,
  columnStatus,
  initializeTable,
  determineCoordinateColumns,
  addRow,
  removeRow,
  rowHasData,
  updateCell,
  bulkFillColumn,
  getCategories,
  isComplexScale,
  isCategoricalScale,
  isNumericScale,
  getCellError,
  isColumnDisabled,
  submitAllColumns,
  isSubmitting,
  allSubmitted,
  hasUnsavedChanges,
  cleanupSubmissions,
  groupingKey,
  isGroupingLocked,
  getGroupingValueOptions,
  rowSplitGroups
} = useDatasetTable({
  selectedStudy: () => props.selectedStudy,
  selectedUnits: () => props.selectedUnits,
  selectedConcepts: () => props.selectedConcepts,
  rowsPerUnit: () => props.rowsPerUnit,
  selectedGroupings: () => props.selectedGroupings
});


const {
  submittedDatasetIds,
  pendingMergeCalls,
  executePendingMerges,
  mergeStatus,
  mergeErrors,
  failedMerges,
  isMerging,
  resetMerges,
} = useDatasetSubmissionWithGroupings({
  columnStatus,
  mergeConfig: () => props.mergeConfig,
});

const hasAttemptedSubmit = ref(false);

// Grouping cells lock once data is submitted; concept cells lock per column
const isCellLocked = (meta) => {
  if (meta?.groupingId !== undefined) return isGroupingLocked.value;
  return isColumnDisabled(meta?.conceptId);
};

// Visual row splitting: mark rows where DATASET_SCOPED values change
const datasetScopedKeys = computed(() =>
  props.selectedGroupings
    .filter((g) => g.scope === 'DATASET_SCOPED')
    .map((g) => groupingKey(g.id))
);

const isGroupBoundary = (rowIdx) => {
  if (rowIdx === 0 || datasetScopedKeys.value.length === 0) return false;
  const prev = rows.value[rowIdx - 1]?.original;
  const cur = rows.value[rowIdx]?.original;
  if (!prev || !cur) return false;
  return datasetScopedKeys.value.some((k) => (prev[k] || '').trim() !== (cur[k] || '').trim());
};

const mergeStatusLabel = (status) => ({
  merging: '⏳ merging',
  success: '✅ merged',
  failed: '❌ failed',
}[status] || 'pending');

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      initializeTable();
      resetMerges();
      hasAttemptedSubmit.value = false;
    }
  },
  { immediate: true }
);

// Sorting state
const sorting = ref([]);

// Bulk fill state
const bulkFillColumnId = ref(null);
const bulkFillValue = ref('');
const showBulkFillPopover = ref(false);

// Delete confirmation state
const deleteConfirmRow = ref(null);
const showDeleteConfirm = ref(false);

// Close confirmation state
const showCloseConfirm = ref(false);

// Build table columns
const columns = computed(() => {
  // Guard: return empty array if no concepts yet
  if (!props.selectedConcepts || props.selectedConcepts.length === 0) {
    console.debug('No concepts selected, returning empty columns array');
    return [];
  }

  const cols = [];
  const columnHelper = createColumnHelper();


  // Define all unit-related columns (visibility handled by table state)
  cols.push(columnHelper.accessor('unitLabel', { id: 'unitLabel', header: 'Unit Name', meta: { frozen: true, width: '150px' } }));
  cols.push(columnHelper.accessor('unitId', { id: 'unitId', header: 'Unit ID', meta: { width: '80px' } }));
  cols.push(columnHelper.accessor('germplasmName', { id: 'germplasmName', header: 'Germplasm', meta: { width: '150px' } }));
  cols.push(columnHelper.accessor('germplasmId', { id: 'germplasmId', header: 'Germplasm ID', meta: { width: '100px' } }));
  cols.push(columnHelper.accessor('locationName', { id: 'locationName', header: 'Location', meta: { width: '150px' } }));
  cols.push(columnHelper.accessor('locationId', { id: 'locationId', header: 'Location ID', meta: { width: '100px' } }));
  cols.push(columnHelper.accessor('layoutName', { id: 'layoutName', header: 'Layout', meta: { width: '120px' } }));

  // Add dynamic coordinate columns
  coordinateColumns.value.forEach(coord => {
    cols.push(columnHelper.accessor(coord.key, {
      id: coord.key,
      header: coord.header,
      meta: { width: '80px' }
    }));
  });

  // Start Time column
  cols.push(
    columnHelper.accessor('startTime', {
      id: 'startTime',
      header: 'Start Time',
      cell: (info) => info.getValue(),
      enableSorting: true,
      meta: { editable: true, type: 'datetime', width: '180px' },
    })
  );

  // End Time column
  cols.push(
    columnHelper.accessor('endTime', {
      id: 'endTime',
      header: 'End Time',
      cell: (info) => info.getValue(),
      enableSorting: true,
      meta: { editable: true, type: 'datetime', width: '180px' },
    })
  );


  // Record grouping columns (shared value per row, like start/end)
  props.selectedGroupings.forEach((grouping) => {
    const key = groupingKey(grouping.id);
    cols.push(
      columnHelper.accessor(key, {
        id: key,
        header: () => grouping.name,
        cell: (info) => info.getValue(),
        enableSorting: true,
        meta: {
          editable: true,
          type: 'grouping',
          grouping,
          groupingId: grouping.id,
          width: '140px',
        },
      })
    );
  });

  // Concept columns
  props.selectedConcepts.forEach((concept) => {
    const columnKey = `concept_${concept.id}`;
    cols.push(
      columnHelper.accessor(columnKey, {
        id: columnKey,
        header: () => concept.name || `Concept ${concept.id}`,
        cell: (info) => info.getValue(),
        enableSorting: true,
        meta: {
          editable: !isComplexScale(concept),
          type: getInputType(concept),
          concept,
          conceptId: concept.id,
          width: '150px',
        },
      })
    );
  });

  // Actions column
  cols.push(
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: () => null,
      meta: { isActions: true, width: '80px' },
    })
  );

  return cols;
});

// Determine input type for a concept
const getInputType = (concept) => {
  if (isComplexScale(concept)) return 'complex';
  if (isCategoricalScale(concept)) return 'categorical';
  if (isNumericScale(concept)) return 'numeric';
  return 'text';
};

// Create table instance - recreate whenever columns, sorting, or visibility changes
const table = computed(() => {
  // Force dependency tracking by accessing these values
  const cols = columns.value;
  const vis = { ...columnVisibility.value };  // Spread to ensure deep tracking
  const sort = [...sorting.value];  // Spread to ensure deep tracking

  if (cols.length === 0) {
    return null;
  }

  return useVueTable({
    data: tableData,
    columns: cols,
    state: {
      sorting: sort,
      columnVisibility: vis,
    },
    onSortingChange: (updaterOrValue) => {
      sorting.value =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(sorting.value)
          : updaterOrValue;
    },
    onColumnVisibilityChange: (updaterOrValue) => {
      columnVisibility.value = typeof updaterOrValue === 'function' ? updaterOrValue(columnVisibility.value) : updaterOrValue;
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
});

const rows = computed(() => {
  return table.value?.getRowModel().rows ?? [];
});

// Only the rows in view are rendered; a selection can run to thousands of units
const ROW_HEIGHT = 37
const tableWrapperRef = ref(null)
const rowVirtualizer = useVirtualizer(computed(() => ({
  count: rows.value.length,
  getScrollElement: () => tableWrapperRef.value,
  estimateSize: () => ROW_HEIGHT,
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

// Dynamically determine coordinate columns from units
const coordinateColumns = computed(() => {
  return determineCoordinateColumns();
});

// Base column visibility
const columnVisibility = ref({
  unitLabel: true,
  unitId: true,
  germplasmName: false,
  germplasmId: false,
  locationName: false,
  locationId: false,
  layoutName: false,
});

// Watch coordinate columns and add their visibility settings
watch(coordinateColumns, (coords) => {
  coords.forEach(coord => {
    if (!(coord.key in columnVisibility.value)) {
      columnVisibility.value[coord.key] = false;
    }
  });
}, { immediate: true });


// Handle cell editing
const editingCell = ref(null);
const editingValue = ref('');

const startEditing = (rowIndex, columnId, currentValue) => {
  editingCell.value = { rowIndex, columnId };
  editingValue.value = currentValue || '';
  // Focus the input after Vue renders it
  nextTick(() => {
    const input = document.querySelector('.cell-input');
    if (input) {
      input.focus();
      // Only call select() on elements that support it (text inputs, not <select>)
      if (typeof input.select === 'function') {
        input.select();
      }
    }
  });
};

const finishEditing = () => {
  if (editingCell.value) {
    updateCell(editingCell.value.rowIndex, editingCell.value.columnId, editingValue.value);
    editingCell.value = null;
    editingValue.value = '';
  }
};

const cancelEditing = () => {
  editingCell.value = null;
  editingValue.value = '';
};

// Handle keyboard navigation
const handleKeyDown = (event) => {
  if (event.key === 'Tab') {
    event.preventDefault();
    finishEditing();
    // Move to next cell logic would go here
  } else if (event.key === 'Enter') {
    finishEditing();
  } else if (event.key === 'Escape') {
    cancelEditing();
  }
};

// Handle paste from clipboard
const handlePaste = async (event, rowIndex, columnId) => {
  event.preventDefault();
  const pastedText = event.clipboardData.getData('text');

  // Handle multi-cell paste
  const rows = pastedText.split('\n').filter(r => r.trim());
  const cols = columns.value.filter(c => c.meta?.editable);
  const startColIndex = cols.findIndex(c => c.id === columnId);

  if (startColIndex === -1) return;

  rows.forEach((row, rOffset) => {
    const cells = row.split('\t');
    cells.forEach((cell, cOffset) => {
      const targetRow = rowIndex + rOffset;
      const targetCol = cols[startColIndex + cOffset];
      if (targetRow < tableData.value.length && targetCol) {
        updateCell(targetRow, targetCol.id, cell.trim());
      }
    });
  });

  cancelEditing()

};

// Bulk fill handlers
const openBulkFill = (columnId) => {
  bulkFillColumnId.value = columnId;
  bulkFillValue.value = '';
  showBulkFillPopover.value = true;
};

const applyBulkFill = () => {
  cancelEditing();
  if (bulkFillColumnId.value) {
    const result = bulkFillColumn(bulkFillColumnId.value, bulkFillValue.value);
    if (result.success) {
      showBulkFillPopover.value = false;
      bulkFillColumnId.value = null;
      bulkFillValue.value = '';
    }
  }
};

// Row actions
const duplicateRow = (index) => {
  addRow(index, index);
};

const confirmDeleteRow = (index) => {
  if (rowHasData(index)) {
    deleteConfirmRow.value = index;
    showDeleteConfirm.value = true;
  } else {
    removeRow(index);
  }
};

const executeDeleteRow = () => {
  if (deleteConfirmRow.value !== null) {
    removeRow(deleteConfirmRow.value);
    deleteConfirmRow.value = null;
    showDeleteConfirm.value = false;
  }
};

// Close handlers
const handleClose = () => {
  if (hasUnsavedChanges.value) {
    showCloseConfirm.value = true;
  } else {
    cleanupSubmissions();
    emit('close');
  }
};

const confirmClose = () => {
  showCloseConfirm.value = false;
  cleanupSubmissions();
  emit('close');
};

// Submit handler
const handleSubmit = async () => {
  hasAttemptedSubmit.value = true;
  await submitAllColumns(selectedControlTeamId, selectedRelease, selectedContributorIds.value)
};

// Submission completes asynchronously via polling - react when all columns succeed
watch(allSubmitted, async (done) => {
  if (done && hasAttemptedSubmit.value) {
    await runMerges();
  }
});


const runMerges = async () => {
  if (pendingMergeCalls.value.length > 0) {
    await executePendingMerges();
  }
  emit('submitted', {
    datasetIds: submittedDatasetIds.value,
    failedMerges: failedMerges.value,
  });
};

// Get column status indicator
const getStatusIcon = (conceptId) => {
  const status = columnStatus.value[conceptId];
  if (!status) return null;

  switch (status.status) {
    case 'submitting':
      return '⏳';
    case 'success':
      return '✅';
    case 'error':
      return '❌';
    default:
      return null;
  }
};

// Get column status tooltip
const getStatusTooltip = (conceptId) => {
  const status = columnStatus.value[conceptId];
  if (!status) return '';

  switch (status.status) {
    case 'submitting':
      return 'Submitting...';
    case 'success':
      return `Dataset ID: ${status.datasetId || 'N/A'}`;
    case 'error':
      return status.error || 'Submission failed';
    default:
      return '';
  }
};

// Add state for file reference modal
const showFileReferenceModal = ref(false);
const editingFileReferenceCell = ref(null);


// Add method to open file reference modal
const openFileReferenceModal = (rowIndex, columnId) => {
  const currentValue = tableData.value[rowIndex][columnId];
  // Parse the value as an array of reference IDs
  const referenceIds = currentValue ? JSON.parse(currentValue) : [];

  editingFileReferenceCell.value = { rowIndex, columnId, referenceIds };
  showFileReferenceModal.value = true;
};

// Add method to handle file reference update
const handleFileReferenceUpdate = (references) => {
  if (editingFileReferenceCell.value) {
    const { rowIndex, columnId } = editingFileReferenceCell.value;
    const value = JSON.stringify(references.map(({id, __typename}) => ({id, __typename})));
    updateCell(rowIndex, columnId, value);
    editingFileReferenceCell.value = null;
  }
};

// Add method to display file references
const getFileReferenceDisplay = (value) => {
  if (!value) return 'No files';
  try {
    const ids = JSON.parse(value);
    return ids.length === 1 ? '1 file' : `${ids.length} files`;
  } catch {
    return 'Invalid data';
  }
};
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container">
        <!-- Header -->
        <div class="modal-header">
          <h2>Submit Datasets for {{ props.selectedStudy.name }}</h2>
          <button class="close-btn" @click="handleClose">&times;</button>
        </div>

        <!-- Content -->
        <div class="modal-content">
          <div class="column-config">
            <p><strong>Include Unit Details:</strong></p>
            <div class="checkbox-group">
              <label><input type="checkbox" v-model="columnVisibility.unitLabel" /> Name </label>
              <label><input type="checkbox" v-model="columnVisibility.unitId" /> ID</label>
              <label><input type="checkbox" v-model="columnVisibility.germplasmName" /> Germplasm</label>
              <label><input type="checkbox" v-model="columnVisibility.germplasmId" /> G. ID</label>
              <label><input type="checkbox" v-model="columnVisibility.locationName" /> Location</label>
              <label><input type="checkbox" v-model="columnVisibility.locationId" /> L. ID</label>
              <label><input type="checkbox" v-model="columnVisibility.layoutName" /> Layout</label>
              <label v-for="coord in coordinateColumns" :key="coord.key">
                <input type="checkbox" v-model="columnVisibility[coord.key]" /> {{ coord.header }}
              </label>
            </div>
          </div>

          <div v-if="!table" class="loading-state">
              Initializing table...
          </div>

          <!-- Row split summary for DATASET_SCOPED groupings -->
          <div v-if="rowSplitGroups.length" class="split-summary">
            <strong>Dataset-scoped groups:</strong>
            <span
              v-for="grp in rowSplitGroups"
              :key="grp.key"
              class="split-chip"
              :class="{ unassigned: grp.unassigned }"
            >
              {{ grp.label }} ({{ grp.rowIndices.length }} rows)
            </span>
          </div>

          <div ref="tableWrapperRef" class="table-wrapper">
            <table class="dataset-table">
              <thead>
                <tr>
                  <th
                    v-for="header in table.getFlatHeaders()"
                    :key="header.id"
                    :class="{
                      'sticky-col': header.column.columnDef.meta?.frozen,
                      'sortable': header.column.getCanSort(),
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

                      <!-- Sort indicator -->
                      <span v-if="header.column.getIsSorted()" class="sort-indicator">
                        {{ header.column.getIsSorted() === 'asc' ? '↑' : '↓' }}
                      </span>

                      <!-- Status indicator for concept columns -->
                      <span
                        v-if="header.column.columnDef.meta?.conceptId"
                        class="status-indicator"
                        :title="getStatusTooltip(header.column.columnDef.meta.conceptId)"
                      >
                        {{ getStatusIcon(header.column.columnDef.meta.conceptId) }}
                      </span>

                      <!-- Scope badge for grouping columns -->
                      <span
                        v-if="header.column.columnDef.meta?.type === 'grouping'"
                        class="grouping-badge"
                        :class="header.column.columnDef.meta.grouping.scope"
                        :title="isGroupingLocked ? 'Locked after submission' : header.column.columnDef.meta.grouping.scope"
                      >
                        {{ header.column.columnDef.meta.grouping.scope === 'DATASET_SCOPED' ? 'DS' : 'SW' }}
                        <template v-if="isGroupingLocked">🔒</template>
                      </span>

                      <!-- Dataset ID display -->
                      <span
                        v-if="columnStatus[header.column.columnDef.meta?.conceptId]?.datasetId"
                        class="dataset-id"
                      >
                        ID: {{ columnStatus[header.column.columnDef.meta.conceptId].datasetId }}
                      </span>

                      <!-- Bulk fill button -->
                      <button
                        v-if="header.column.columnDef.meta?.editable && !header.column.columnDef.meta?.isActions && !isCellLocked(header.column.columnDef.meta)"
                        class="bulk-fill-btn"
                        @click.stop="openBulkFill(header.column.id)"
                        title="Bulk fill column"
                      >
                        📋
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="paddingTop > 0" class="spacer-row" aria-hidden="true">
                  <td :colspan="columnCount" :style="{ height: paddingTop + 'px' }"></td>
                </tr>
                <tr
                  v-for="{ key, rIdx, row } in virtualItems"
                  :key="key"
                  :class="{ 'group-boundary': isGroupBoundary(rIdx) }"
                >
                  <td
                    v-for="cell in row.getVisibleCells()"
                    :key="cell.id"
                    :class="{
                      'sticky-col': cell.column.columnDef.meta?.frozen,
                      'editable-cell': cell.column.columnDef.meta?.editable,
                      'error-cell': getCellError(row.index, cell.column.id),
                      'warning-cell': getCellError(row.index, cell.column.id)?.isWarning,
                      'disabled-cell': isCellLocked(cell.column.columnDef.meta),
                      'grouping-cell': cell.column.columnDef.meta?.type === 'grouping',
                    }"
                    :title="getCellError(row.index, cell.column.id)?.message"
                    :style="{ width: cell.column.columnDef.meta?.width }"
                  >
                    <!-- Actions column -->
                    <template v-if="cell.column.columnDef.meta?.isActions">
                      <div class="row-actions">
                        <button
                          class="action-btn duplicate"
                          @click="duplicateRow(row.index)"
                          title="Duplicate row"
                        >
                          📄
                        </button>
                        <button
                          class="action-btn delete"
                          @click="confirmDeleteRow(row.index)"
                          title="Delete row"
                        >
                          🗑️
                        </button>
                      </div>
                    </template>

                    <!-- Complex scale cell -->
                    <template v-else-if="cell.column.columnDef.meta?.type === 'complex'">
                      <div v-if="isColumnDisabled(cell.column.columnDef.meta?.conceptId)">
                        <span class="file-count">
                          📎 {{ getFileReferenceDisplay(cell.getValue()) }}
                        </span>
                      </div>
                      <div v-else
                        class="complex-cell clickable"
                          @click="openFileReferenceModal(row.index, cell.column.id)"
                          title="Click to manage file references"
                        >
                        <span class="file-count">
                          📎 {{ getFileReferenceDisplay(cell.getValue()) }}
                        </span>
                        <span class="manage-link">Manage</span>
                      </div>
                    </template>

                    <!-- Editable cells -->
                    <template v-else-if="cell.column.columnDef.meta?.editable && !isCellLocked(cell.column.columnDef.meta)">
                      <!-- Editing mode -->
                      <template v-if="editingCell?.rowIndex === row.index && editingCell?.columnId === cell.column.id">
                        <!-- Categorical input -->
                        <select
                          v-if="cell.column.columnDef.meta?.type === 'categorical'"
                          v-model="editingValue"
                          class="cell-input cell-select"
                          @blur="finishEditing"
                          @keydown="handleKeyDown"
                        >
                          <option value="">-- Select --</option>
                          <option
                            v-for="cat in getCategories(cell.column.columnDef.meta.concept)"
                            :key="cat.id || cat.name"
                            :value="cat.name || cat.id"
                          >
                            {{ cat.name || cat.abbreviation }}
                          </option>
                        </select>

                        <!-- Grouping input: free text with suggestions from existing values -->
                        <template v-else-if="cell.column.columnDef.meta?.type === 'grouping'">
                          <input
                            v-model="editingValue"
                            type="text"
                            class="cell-input"
                            :list="`grouping-options-${cell.column.id}`"
                            placeholder="e.g. R1, Batch A"
                            @blur="finishEditing"
                            @keydown="handleKeyDown"
                            @paste="handlePaste($event, row.index, cell.column.id)"
                          />
                          <datalist :id="`grouping-options-${cell.column.id}`">
                            <option
                              v-for="opt in getGroupingValueOptions(cell.column.columnDef.meta.groupingId)"
                              :key="opt"
                              :value="opt"
                            />
                          </datalist>
                        </template>


                        <!-- Text/numeric/datetime input -->
                        <input
                          v-else
                          v-model="editingValue"
                          type="text"
                          class="cell-input"
                          :placeholder="cell.column.columnDef.meta?.type === 'datetime' ? 'YYYY-MM-DD' : ''"
                          @blur="finishEditing"
                          @keydown="handleKeyDown"
                          @paste="handlePaste($event, row.index, cell.column.id)"
                        />

                      </template>

                      <!-- Display mode - read directly from tableData -->
                      <div
                        v-else
                        class="cell-display"
                        @click="startEditing(row.index, cell.column.id, cell.getValue())"
                        @paste="handlePaste($event, row.index, cell.column.id)"
                        tabindex="0"
                      >
                        {{ cell.getValue() }}
                      </div>
                    </template>

                    <!-- Read-only cell -->
                    <template v-else>
                      {{ cell.getValue() }}
                    </template>
                  </td>
                </tr>
                <tr v-if="paddingBottom > 0" class="spacer-row" aria-hidden="true">
                  <td :colspan="columnCount" :style="{ height: paddingBottom + 'px' }"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <div v-if="hasAttemptedSubmit && mergeConfig.length" class="merge-status">
            <span class="merge-status-title">Scope merge:</span>
            <span
              v-for="c in mergeConfig"
              :key="c.groupingId"
              class="merge-chip"
              :class="`merge-${mergeStatus[c.groupingId] || 'pending'}`"
              :title="mergeErrors[c.groupingId] || ''"
            >
              {{ c.groupingName }}: {{ mergeStatusLabel(mergeStatus[c.groupingId]) }}
            </span>
            <button
              v-if="failedMerges.length && !isMerging"
              class="btn btn-secondary btn-small"
              @click="runMerges"
            >
              Retry merge
            </button>
            <div v-if="failedMerges.length" class="merge-warning">
              ⚠ Datasets submitted but scope merge failed for:
              {{ failedMerges.map((f) => f.groupingName).join(', ') }}.
              Retry, or resolve the scope configuration on the Study Panel.
            </div>
          </div>
          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          <div class="contributors-control">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="isSubmitting || allSubmitted"
              @click="showContributors = !showContributors"
            >
              Contributors ({{ selectedContributorIds.length }})
            </button>
            <div v-if="showContributors" class="contributors-panel">
              <p class="contributors-help">
                People credited for these datasets. Only person records you can read are listed;
                add new people on the People page.
              </p>
              <PersonPicker
                v-model="selectedContributorIds"
                :disabled="isSubmitting || allSubmitted"
                empty-text="No person records available to credit."
              />
            </div>
          </div>
          <ControlSelector
            v-model:controlTeamId="selectedControlTeamId"
            v-model:readRelease="selectedRelease"
            class="form-control"
            @error="handleControlTeamError"
          />
          <button
            class="btn btn-primary"
            @click="handleSubmit"
            :disabled="isSubmitting || allSubmitted"
          >
            <span v-if="isSubmitting">Submitting...</span>
            <span v-else-if="allSubmitted">All Submitted</span>
            <span v-else>Submit All Datasets</span>
          </button>
          <button class="btn btn-secondary" @click="handleClose" :disabled="isSubmitting">
            Close
          </button>
        </div>

        <!-- Loading overlay -->
        <div v-if="isSubmitting" class="loading-overlay">
          <div class="spinner"></div>
          <p>Submitting datasets...</p>
        </div>
      </div>

      <!-- Bulk Fill Popover -->
      <div v-if="showBulkFillPopover" class="popover-overlay" @click.self="showBulkFillPopover = false">
        <div class="popover-content">
          <h4>Bulk Fill Column</h4>
          <input
            v-model="bulkFillValue"
            type="text"
            class="bulk-fill-input"
            placeholder="Enter value for all cells"
            @keydown.enter="applyBulkFill"
          />
          <div class="popover-actions">
            <button class="btn btn-secondary" @click="showBulkFillPopover = false">Cancel</button>
            <button class="btn btn-primary" @click="applyBulkFill">Apply</button>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteConfirm" class="popover-overlay" @click.self="showDeleteConfirm = false">
        <div class="popover-content">
          <h4>Confirm Delete</h4>
          <p>This row contains data. Are you sure you want to delete it?</p>
          <div class="popover-actions">
            <button class="btn btn-secondary" @click="showDeleteConfirm = false">Cancel</button>
            <button class="btn btn-danger" @click="executeDeleteRow">Delete</button>
          </div>
        </div>
      </div>

      <!-- Close Confirmation Modal -->
      <div v-if="showCloseConfirm" class="popover-overlay" @click.self="showCloseConfirm = false">
        <div class="popover-content">
          <h4>Unsaved Changes</h4>
          <p>You have unsaved data. Are you sure you want to close?</p>
          <div class="popover-actions">
            <button class="btn btn-secondary" @click="showCloseConfirm = false">Cancel</button>
            <button class="btn btn-danger" @click="confirmClose">Close Anyway</button>
          </div>
        </div>
      </div>
    </div>

    <ReferencesModal
      :visible="showFileReferenceModal"
      :referenceTypes="DATA_REFERENCE_TYPE_CONFIGS"
      :selectedReferenceIds="editingFileReferenceCell?.referenceIds || []"
      @close="showFileReferenceModal = false"
      @save="handleFileReferenceUpdate"

    />
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
  height: 85vh;
  max-width: 1600px;
  display: flex;
  flex-direction: column;
  position: relative;
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

.modal-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.table-wrapper {
  overflow: auto;
  max-height: calc(85vh - 180px);
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.dataset-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.dataset-table th,
.dataset-table td {
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  text-align: left;
}

.dataset-table th {
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

.dataset-table tbody .sticky-col {
  background: white;
  /* below the sticky header, so scrolled rows don't draw over it; the header's own frozen cell sits above both */
  z-index: 9;
}

.dataset-table thead .sticky-col {
  z-index: 12;
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
  gap: 8px;
  flex-wrap: wrap;
}

.header-text {
  flex: 1;
}

.sort-indicator {
  font-size: 12px;
}

.status-indicator {
  font-size: 14px;
}

.dataset-id {
  font-size: 11px;
  color: #666;
  background: #e8f5e9;
  padding: 2px 6px;
  border-radius: 4px;
}

.bulk-fill-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 12px;
  opacity: 0.6;
}

.bulk-fill-btn:hover {
  opacity: 1;
}

.editable-cell {
  cursor: text;
}

.error-cell {
  background: #ffebee !important;
  border-color: #f44336 !important;
}

.warning-cell {
  background: #fff3e0 !important;
  border-color: #ff9800 !important;
}

.disabled-cell {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.cell-display {
  min-height: 20px;
  padding: 2px;
  cursor: text;
}

.cell-display:hover {
  border-color: #2196f3;
  background: #f0f8ff;
}
.cell-display:focus {
  outline: 2px solid #2196f3;
  outline-offset: -2px;
}

.cell-input {
  width: 100%;
  padding: 4px;
  border: 1px solid #2196f3;
  border-radius: 2px;
  font-size: 14px;
}

.cell-select {
  width: 100%;
}

.complex-cell {
  color: #999;
  font-style: italic;
  font-size: 12px;
}

.row-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

tr:hover .row-actions {
  opacity: 1;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  font-size: 14px;
  border-radius: 4px;
}

.action-btn:hover {
  background: #f0f0f0;
}

.action-btn.delete:hover {
  background: #ffebee;
}

.add-row-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px dashed #ccc;
  border-radius: 4px;
  cursor: pointer;
  width: 100%;
  color: #666;
}

.add-row-btn:hover {
  background: #eee;
  border-color: #999;
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

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #d32f2f;
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
  margin: 0 0 16px 0;
}

.popover-content p {
  margin: 0 0 16px 0;
  color: #666;
}

.bulk-fill-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 14px;
}

.popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #666;
  font-style: italic;
}


.complex-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px;
}

.complex-cell.clickable {
  cursor: pointer;
  transition: background-color 0.2s;
}

.complex-cell.clickable:hover {
  background-color: #e3f2fd;
}

.file-count {
  flex: 1;
  font-size: 13px;
  color: #666;
}

.manage-link {
  font-size: 12px;
  color: #2196f3;
  text-decoration: underline;
}


.split-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 13px;
}

.split-chip {
  padding: 2px 8px;
  border-radius: 10px;
  background: #fff3e0;
  color: #e65100;
}

.split-chip.unassigned {
  background: #ffebee;
  color: #c62828;
}

.grouping-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
  background: #e3f2fd;
  color: #1565c0;
}

.grouping-badge.DATASET_SCOPED {
  background: #fff3e0;
  color: #e65100;
}

.grouping-cell {
  background: #fcfcf5;
}

tr.group-boundary td {
  border-top: 2px solid #ff9800;
}

.merge-status {
  margin-right: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.merge-status-title {
  font-weight: 600;
}

.merge-chip {
  padding: 2px 8px;
  border-radius: 10px;
  background: #f5f5f5;
}

.merge-success { background: #e8f5e9; color: #2e7d32; }
.merge-failed { background: #ffebee; color: #c62828; }
.merge-merging { background: #e3f2fd; color: #1565c0; }

.merge-warning {
  flex-basis: 100%;
  color: #e65100;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
}

.contributors-control {
  position: relative;
}

.contributors-panel {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 20;
  width: 420px;
  max-width: 90vw;
  padding: 12px;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.contributors-help {
  margin: 0 0 8px;
  font-size: 0.85rem;
  color: #666;
}

/* Fixed row heights, so the virtualised rows line up with the scroll position without measuring */
.dataset-table tbody tr {
  height: 37px;
}

.dataset-table tbody td {
  box-sizing: border-box;
  height: 37px;
  padding-top: 0;
  padding-bottom: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dataset-table tbody tr.spacer-row {
  height: auto;
}

.dataset-table tbody tr.spacer-row td {
  height: auto;
  padding: 0;
  border: none;
}
</style>