<script setup>

const props = defineProps({
  columnVisibility: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['back', 'export', 'update:columnVisibility'])

const updateVisibility = (key, value) => {
  emit('update:columnVisibility', { ...props.columnVisibility, [key]: value })
}
</script>

<template>
  <div class="toolbar">
    <button class="btn btn-secondary btn-sm" @click="$emit('back')">
      ← Back to Selection
    </button>

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