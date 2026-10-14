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
  pagingLocked: { type: Boolean, default: false }
})

const emit = defineEmits(['back', 'export', 'update:columnVisibility', 'update:page'])

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

    <div class="column-toggles">
      <label>
        <input
          type="checkbox"
          :checked="columnVisibility.unitId"
          @change="updateVisibility('unitId', $event.target.checked)"
        /> Unit ID
      </label>
      <label>
        <input
          type="checkbox"
          :checked="columnVisibility.startTime"
          @change="updateVisibility('startTime', $event.target.checked)"
        /> Start
      </label>
      <label>
        <input
          type="checkbox"
          :checked="columnVisibility.endTime"
          @change="updateVisibility('endTime', $event.target.checked)"
        /> End
      </label>
    </div>

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
  background: #e3f2fd;
  color: #1565c0;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
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
