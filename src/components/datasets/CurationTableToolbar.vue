<script setup>
import { computed } from 'vue'

const props = defineProps({
  columnVisibility: {
    type: Object,
    required: true
  },
  // paging through the records of the loaded datasets
  page: { type: Number, default: 1 },
  pageCount: { type: Number, default: 1 },
  pageSummary: { type: String, default: '' },
  filterSummary: { type: String, default: '' },
  // true while the table holds unsaved changes, which a new page would discard
  pagingLocked: { type: Boolean, default: false },
  // more optional columns of the loaded datasets, [{ key, label }], shown until hidden
  extraColumns: { type: Array, default: () => [] },
  // how records are laid out in rows, from rowModes ([{ value, label }]); locked while changes are unsaved
  rowMode: { type: String, default: null },
  rowModes: { type: Array, default: () => [] },
  rowModeLocked: { type: Boolean, default: false }
})

const emit = defineEmits(['back', 'export', 'update:columnVisibility', 'update:page', 'update:rowMode'])

// The optional columns, chosen under one Columns menu
const OPTIONAL_COLUMNS = [
  { key: 'unitId', label: 'Unit ID' },
  { key: 'startTime', label: 'Start' },
  { key: 'endTime', label: 'End' },
  { key: 'germplasmName', label: 'Germplasm' },
  { key: 'germplasmId', label: 'G. ID' },
  { key: 'locationName', label: 'Location' },
  { key: 'locationId', label: 'L. ID' }
]

const columnsOffered = computed(() => [...OPTIONAL_COLUMNS, ...props.extraColumns])

const updateVisibility = (key, value) => {
  emit('update:columnVisibility', { ...props.columnVisibility, [key]: value })
}

const lockTitle = 'Save or discard your changes before changing page'
const canPrev = computed(() => !props.pagingLocked && props.page > 1)
const canNext = computed(() => !props.pagingLocked && props.page < props.pageCount)
</script>

<template>
  <div class="toolbar">
    <button class="btn btn-secondary btn-sm" @click="$emit('back')">
      ← Back to Selection
    </button>

    <div v-if="pageSummary" class="paging">
      <template v-if="pageCount > 1">
        <button
          class="btn btn-secondary btn-sm"
          :disabled="!canPrev"
          :title="pagingLocked ? lockTitle : ''"
          @click="emit('update:page', page - 1)"
        >
          ◀ Prev
        </button>
        <span class="page-label">Page {{ page }} of {{ pageCount }}</span>
        <button
          class="btn btn-secondary btn-sm"
          :disabled="!canNext"
          :title="pagingLocked ? lockTitle : ''"
          @click="emit('update:page', page + 1)"
        >
          Next ▶
        </button>
      </template>
      <span class="page-summary">{{ pageSummary }}</span>
      <span v-if="filterSummary" class="filter-summary">{{ filterSummary }}</span>
    </div>

    <div class="toolbar-spacer"></div>

    <label v-if="rowModes.length" class="row-mode" title="Records of a unit that share a row; a row by period shows each value's own time when you point at it">
      Rows
      <select
        name="rowMode"
        :value="rowMode"
        :disabled="rowModeLocked"
        :title="rowModeLocked ? 'Save or discard your changes before laying out the rows again' : ''"
        @change="emit('update:rowMode', $event.target.value)"
      >
        <option v-for="mode in rowModes" :key="mode.value" :value="mode.value">{{ mode.label }}</option>
      </select>
    </label>

    <details class="column-toggles">
      <summary class="btn btn-secondary btn-sm">Columns</summary>
      <div class="column-menu">
        <label v-for="c in columnsOffered" :key="c.key">
          <input
            type="checkbox"
            :checked="columnVisibility[c.key] !== false"
            @change="updateVisibility(c.key, $event.target.checked)"
          /> {{ c.label }}
        </label>
      </div>
    </details>

    <button class="btn btn-secondary btn-sm" @click="$emit('export')">
      📥 Export CSV
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.toolbar-spacer {
  flex: 1;
}

.paging {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #555;
  flex-wrap: wrap;
}

.page-label {
  font-weight: 500;
  color: #333;
}

.filter-summary {
  background: var(--brand-accent-light);
  color: var(--brand-accent-darker);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.row-mode {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #555;
}

.row-mode select {
  font-size: 13px;
  padding: 3px 6px;
}

.column-toggles {
  position: relative;
  font-size: 13px;
}

.column-toggles summary {
  list-style: none;
}

.column-toggles summary::-webkit-details-marker {
  display: none;
}

.column-toggles summary::after {
  content: ' ▾';
}

.column-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 140px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.column-menu label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  white-space: nowrap;
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
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) {
  background: #eee;
}
</style>
