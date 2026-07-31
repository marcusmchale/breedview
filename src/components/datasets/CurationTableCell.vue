<script setup>
import { ref } from 'vue'

const props = defineProps({
  rowIndex: { type: Number, required: true },
  columnId: { type: String, required: true },
  value: { type: [String, Number], default: '' },
  concept: { type: Object, default: null },
  conceptId: { type: String, default: null },
  inputType: { type: String, default: 'text' },
  categories: { type: Array, default: () => [] },
  isEditable: { type: Boolean, default: false },
  hasRecord: { type: Boolean, default: false },
  isMarkedForDeletion: { type: Boolean, default: false },
  hasValueChanged: { type: Boolean, default: false },
  isComplexScale: { type: Boolean, default: false },
  referenceCount: { type: Number, default: 0 },
  error: { type: Object, default: null }
})

const emit = defineEmits([
  'update',
  'open-controller',
  'open-file-reference',
  'mark-for-deletion',
  'unmark-for-deletion'
])

const isEditing = ref(false)
const editingValue = ref('')

const startEditing = () => {
  if (!props.isEditable) return
  isEditing.value = true
  editingValue.value = props.value || ''
}

const finishEditing = () => {
  if (isEditing.value) {
    emit('update', props.rowIndex, props.columnId, editingValue.value)
    isEditing.value = false
    editingValue.value = ''
  }
}

const cancelEditing = () => {
  isEditing.value = false
  editingValue.value = ''
}

const handleKeyDown = (event) => {
  if (event.key === 'Enter') finishEditing()
  else if (event.key === 'Escape') cancelEditing()
}
</script>

<template>
  <div class="concept-cell">
    <button
      v-if="hasRecord"
      class="controller-badge-mini"
      :class="{ 'can-edit': isEditable }"
      @click.stop="$emit('open-controller', rowIndex, conceptId)"
      title="View controller"
    >
      🔒
    </button>

    <!-- Complex scale cell -->
    <template v-if="isComplexScale">
      <div
        class="complex-cell"
        :class="{
          clickable: isEditable,
          'has-changes': hasValueChanged
        }"
        @click="isEditable && $emit('open-file-reference', rowIndex, conceptId)"
      >
        <span class="file-count">{{ referenceCount }} file(s)</span>
        <span v-if="isEditable" class="manage-link">Manage</span>
      </div>
    </template>

    <!-- Editable value -->
    <template v-else-if="isEditable">
      <template v-if="isEditing">
        <select
          v-if="inputType === 'categorical'"
          v-model="editingValue"
          class="cell-input"
          @blur="finishEditing"
          @keydown="handleKeyDown"
        >
          <option value="">-- Select --</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.name">
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

      <div v-else class="cell-value editable" @click="startEditing">
        {{ value || '' }}
      </div>

      <button
        v-if="hasRecord && !isMarkedForDeletion"
        class="action-btn delete"
        @click.stop="$emit('mark-for-deletion', rowIndex, conceptId)"
        title="Delete record"
      >
        🗑️
      </button>
      <button
        v-else-if="isMarkedForDeletion"
        class="action-btn undo"
        @click.stop="$emit('unmark-for-deletion', rowIndex, conceptId)"
        title="Undo delete"
      >
        ↩️
      </button>
    </template>

    <!-- Read-only value -->
    <template v-else>
      <div class="cell-value readonly">
        <template v-if="isComplexScale">{{ referenceCount }} file(s)</template>
        <template v-else>{{ value || '' }}</template>
      </div>
    </template>
  </div>
</template>

<style scoped>
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

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 2px;
  opacity: 0.6;
}

.action-btn:hover {
  opacity: 1;
}

.action-btn.undo:hover {
  background: #e3f2fd;
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