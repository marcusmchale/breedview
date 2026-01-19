<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  FlexRender,
} from '@tanstack/vue-table';

import { useDatasetTable } from '@/composables/datasets/useDatasetTable';
import DataFileReferenceModal from '@/components/references/DataFileReferenceModal.vue';

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
});

const emit = defineEmits(['close', 'submitted']);


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
  cleanupSubmissions
} = useDatasetTable({
  selectedStudy: () => props.selectedStudy,
  selectedUnits: () => props.selectedUnits,
  selectedConcepts: () => props.selectedConcepts,
  rowsPerUnit: () => props.rowsPerUnit,
});

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

// Initialize table when modal becomes visible
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      initializeTable();
    }
  },
  { immediate: true }
);

// Build table columns
const columns = computed(() => {
  // Guard: return empty array if no concepts yet
  if (!props.selectedConcepts || props.selectedConcepts.length === 0) {
    console.log('No concepts selected, returning empty columns array');
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
  await submitAllColumns();
  if (allSubmitted.value) {
    emit('submitted');
  }
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
const handleFileReferenceUpdate = (newReferenceIds) => {
  if (editingFileReferenceCell.value) {
    const { rowIndex, columnId } = editingFileReferenceCell.value;
    // Store as JSON string array of IDs
    const value = JSON.stringify(newReferenceIds);
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
          <div class="table-wrapper">
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

                      <!-- Dataset ID display -->
                      <span
                        v-if="columnStatus[header.column.columnDef.meta?.conceptId]?.datasetId"
                        class="dataset-id"
                      >
                        ID: {{ columnStatus[header.column.columnDef.meta.conceptId].datasetId }}
                      </span>

                      <!-- Bulk fill button -->
                      <button
                        v-if="header.column.columnDef.meta?.editable && !header.column.columnDef.meta?.isActions"
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
                <tr v-for="row in rows" :key="row.id">
                  <td
                    v-for="cell in row.getVisibleCells()"
                    :key="cell.id"
                    :class="{
                      'sticky-col': cell.column.columnDef.meta?.frozen,
                      'editable-cell': cell.column.columnDef.meta?.editable,
                      'error-cell': getCellError(row.index, cell.column.id),
                      'warning-cell': getCellError(row.index, cell.column.id)?.isWarning,
                      'disabled-cell': isColumnDisabled(cell.column.columnDef.meta?.conceptId),
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
                    <template v-else-if="cell.column.columnDef.meta?.editable && !isColumnDisabled(cell.column.columnDef.meta?.conceptId)">
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
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="handleClose" :disabled="isSubmitting">
            Close
          </button>
          <button
            class="btn btn-primary"
            @click="handleSubmit"
            :disabled="isSubmitting || allSubmitted"
          >
            <span v-if="isSubmitting">Submitting...</span>
            <span v-else-if="allSubmitted">All Submitted</span>
            <span v-else>Submit All Datasets</span>
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

    <DataFileReferenceModal
      :visible="showFileReferenceModal"
      :selected-reference-ids="editingFileReferenceCell?.referenceIds || []"
      @close="showFileReferenceModal = false"
      @update:selected-reference-ids="handleFileReferenceUpdate"
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


</style>