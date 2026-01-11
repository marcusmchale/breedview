<script setup>
import { ref } from 'vue'

import ControllerBadge from '../controls/ControllerBadge.vue'
import { useLayoutNodeQueries } from "@/composables/arrangements/layoutNodeQueries";

import AddChildModal from "@/components/arrangements/addChildModal.vue";
import UpdateLayoutModal from "@/components/arrangements/updateLayoutModal.vue";
import DeleteModal from "@/components/arrangements/deleteModal.vue";

const props = defineProps({
  layoutId: {
    type: Number,
    required: true
  },
  parentId: {
    type: Number,
    required: false
  },
  arrangementId: {
    type: Number,
    required: true
  },
  layoutTypes: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['close']) // to close layoutDetails modal if the last and is deleted

const {
  layout,
  layoutLoading,
  layoutError,
  refetchLayout,
  loadChildLayouts,
  childLayoutsLoading,
  childLayoutsError
} = useLayoutNodeQueries({ layoutId: props.layoutId})


// expanded state for layout tree
const expanded = ref(false)
const toggleExpand = () => {
  expanded.value = !expanded.value
  if (expanded.value) {
    loadChildLayouts(props.layoutId)
  }
}

// Modal states
const isEditModalOpen = ref(false)
const isDeleteModalOpen = ref(false)


// Edit Modal
const openEditModal = () => {
  isEditModalOpen.value = true
}
const closeEditModal = () => {
  isEditModalOpen.value = false
}
const handleUpdateSuccess = () => {
  closeEditModal()
}


// Add Child Modal functions
const isAddChildModalOpen = ref(false)
const openAddChildModal = () => {
  isAddChildModalOpen.value = true
}
const closeAddChildModal = () => {
  isAddChildModalOpen.value = false
}
const handleAddChildSuccess = () => {
  refetchLayout()
}

// Delete Modal functions
const openDeleteModal = () => {
  isDeleteModalOpen.value = true
}

const closeDeleteModal = () => {
  isDeleteModalOpen.value = false
  emit('close')
}

</script>

<template>
  <div class="layout-node">
    <div v-if="layoutLoading">Loading...</div>
    <div v-else-if="layoutError">
      Error loading layout: {{ layoutError.message }}
    </div>
    <!--
      Redacted layouts won't have type, don't present all the other options for these as they won't work
      But we do want to see the security details so we know who to contact to gain access
      And we need to see that one exists to prevent duplication
    -->
    <div v-else-if="layout">
      <div v-if="!layout.type">
        <div class="layout-info">
          <h6 class="layout-name">{{ layout.name || layout.id }}</h6>
          <ControllerBadge
            entity-label="LAYOUT"
            :entity-id="layoutId"
          />
        </div>
      </div>

      <div v-else class="layout-header">
        <button
          v-if="layout.children && layout.children.length > 0"
          @click="toggleExpand"
          class="expand-btn"
          :class="{ expanded }"
        >
          ▶
        </button>
        <div v-else class="expand-placeholder"></div>

        <div class="layout-info">
          <h6 class="layout-name">{{ layout.name || `${layout.type.name} ${layout.id}` }}</h6>
          <div class="layout-meta">
            <span class="type-badge">{{ layout.type.name }}</span>
            <span class="position"> ID: {{ layout.id }} </span>
            <span v-if="childLayoutsLoading" class="position">Loading children...</span>
            <span v-else-if="childLayoutsError">
              Error loading children: {{ childLayoutsError.message }}
            </span>
            <span v-else-if="layout.children && layout.children.length >0 " class="position">x{{
                layout.children.length
              }}</span>
            <span v-if="layout.position !== null && layout.position !== undefined" class="position">
              Pos: {{ layout.position }}
            </span>
            <span v-if="layout.location !== null && layout.location !== undefined" class="position">
              Loc: {{ layout.location.name }}
            </span>

          </div>
        </div>

        <div class="actions" role="toolbar" aria-label="layout actions">
          <button
            @click="openEditModal"
            class="btn btn-xs btn-edit"
            title="Update layout details"
          >
            ✎ Edit
          </button>

          <button
            @click="openDeleteModal"
            class="btn btn-xs btn-danger"
            title="Delete layout"
          >
            Delete
          </button>

          <button
            @click="openAddChildModal"
            class="btn btn-xs btn-add-child"
            title="Add child layout"
          >
            + Add Child
          </button>

          <ControllerBadge
            entity-label="LAYOUT"
            :entity-id="layoutId"
          />
        </div>
      </div>

    </div>

    <div v-if="expanded && layout?.children.length > 0" class="children">
      <div v-for="child in layout?.children" :key="child.id" class="child-item">
        <LayoutNode
          :layoutId="child.id"
          :parentId="layoutId"
          :arrangementId="arrangementId"
          :layoutTypes="layoutTypes"
        />
      </div>
    </div>

    <div v-if="isAddChildModalOpen" class="modal-overlay" @click="closeAddChildModal">
      <AddChildModal
        :layoutTypes="layoutTypes"
        :parentLayout="layout"
        @close="closeAddChildModal"
        @success="handleAddChildSuccess"
      />
    </div>

    <div v-if="isEditModalOpen" class="modal-overlay" @click="closeEditModal">
      <UpdateLayoutModal
          :layout="layout"
          :layoutTypes="layoutTypes"
          :arrangementId="arrangementId"
          @close="closeEditModal"
          @success="handleUpdateSuccess"
      />
    </div>

    <div v-if="isDeleteModalOpen" class="modal-overlay" @click="closeDeleteModal">
      <DeleteModal
          :layout="layout"
          @close="closeDeleteModal"
          @success="closeDeleteModal"
      />

    </div>

  </div>
</template>

<style scoped>
.layout-node {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.layout-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  justify-content: space-between;
}

.expand-btn,
.expand-placeholder {
  min-width: 20px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: #666;
  font-size: 10px;
  transition: transform 0.2s;
}

.expand-btn.expanded {
  transform: rotate(90deg);
}

.expand-btn:hover {
  color: #333;
}

.layout-info {
  flex: 1;
}

.layout-name {
  margin: 0 0 4px 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.layout-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.type-badge {
  display: inline-block;
  background: #e8f5e9;
  color: #2e7d32;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.position {
  font-size: 11px;
  color: #999;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
  flex-shrink: 0;
}

.actions .btn-xs {
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.btn-xs {
  padding: 4px 8px;
  font-size: 11px;
}

.btn-edit {
  white-space: nowrap;
  background-color: #17a2b8;
  color: white;
}

.btn-edit:hover:not(:disabled) {
  background-color: #138496;
}

.btn-add-child {
  background-color: #28a745;
  color: white;
  white-space: nowrap;
}

.btn-add-child:hover:not(:disabled) {
  background-color: #218838;
}

.children {
  margin-left: 28px;
  margin-top: 8px;
  padding-left: 8px;
  border-left: 2px solid #e0e0e0;
}

.child-item {
  margin-bottom: 8px;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1002;
}

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  max-width: 450px;
  width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
}

.modal-header h4 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background-color: #e9ecef;
  border-radius: 50%;
}

.modal-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-primary:disabled {
  background-color: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.delete-warning {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 14px;
}

.delete-warning-children {
  margin: 8px 0 16px 0;
  color: #d9534f;
  font-size: 13px;
  padding: 8px 12px;
  background-color: #f5e6e6;
  border-radius: 4px;
}

.error-message {
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  font-size: 14px;
}

.position {
  font-size: 11px;
  color: #999;
}

.axes-section {
  padding: 12px;
  background-color: #f0f8ff;
  border: 1px solid #d0e8ff;
  border-radius: 4px;
  margin-top: 8px;
}

.axes-section h5 {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
  flex-shrink: 0;
}

</style>