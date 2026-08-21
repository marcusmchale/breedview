<script setup>
import { computed, ref } from 'vue'
import ControllerBadge from '@/components/controls/ControllerBadge.vue'
import UpdateModal from "@/components/arrangements/updateLayoutModal.vue"
import DeleteModal from "@/components/arrangements/deleteModal.vue"
import AddChildModal from "@/components/arrangements/addChildModal.vue"

import { useLayoutNodeQueries } from "@/composables/arrangements/layoutNodeQueries"

const props = defineProps({
  layoutId: {
    type: String,
    default: null
  },
  parentId: {
    type: String,
    default: null
  },
  arrangementId: {
    type: String,
    required: true
  },
  layoutTypes: {
    type: Array,
    required: false,
    default: () => []
  }
})

const emit = defineEmits(['refresh-tree', 'node-deleted'])

const {
  layout,
  layoutLoading,
  layoutError,
  refetchLayout
} = useLayoutNodeQueries({ layoutId: () => props.layoutId })

const {
  layout: parent,
  layoutLoading: parentLoading,
  layoutError: parentError
} = useLayoutNodeQueries({ layoutId: () => props.parentId })

const hasData = computed(() => !!layout.value)

const layoutType = computed(() =>
    props.layoutTypes?.find((layoutType) => layoutType.id === layout.value?.type?.id)
)
const parentlayoutType = computed(() =>
    props.layoutTypes?.find((layoutType) => layoutType.id === parent.value?.type?.id)
)

const position = computed(() =>
  parent.value?.axes.map((name, index) => ({
    "label": name,
    "pos": layout.value?.position?.[index],
    "type": parentlayoutType.value?.axes[index]
  })) || null
)

const displayFields = computed(() => {
  if (!layout.value) return []
  const l = layout.value
  return [
    { label: 'Name', value: l.name },
    { label: 'Type', value: l.type?.name },
    { label: 'ID', value: l.id },
    { label: 'Location', value: l.location?.name },
    { label: 'Description', value: l.description }
  ].filter(f => f.value !== null && f.value !== undefined)
})

const childrenList = computed(() => {
  if (!layout.value) return []
  return layout.value.children ?? []
})

const axesList = computed(() => {
  if (!layout.value) return []
  return layout.value.axes.map((axis, index) => (
      {'name': axis, 'type': layoutType.value?.axes[index]})
  ) ?? []
})

// Edit Modal state and events
const isEditModalOpen = ref(false)
const openEditModal = () => {
  isEditModalOpen.value = true
}
const closeEditModal = () => {
  isEditModalOpen.value = false
}
const handleUpdateSuccess = async () => {
  closeEditModal()
  await refetchLayout()
  emit('refresh-tree')
}

// Delete modal state and events
const isDeleteModalOpen = ref(false)
const openDeleteModal = () => {
  isDeleteModalOpen.value = true
}
const closeDeleteModal = () => {
  isDeleteModalOpen.value = false
}
const handleDeleteSuccess = () => {
  closeDeleteModal()
  emit('node-deleted')
}

// Add Child Modal state and events
const isAddChildModalOpen = ref(false)
const openAddChildModal = () => {
  isAddChildModalOpen.value = true
}
const closeAddChildModal = () => {
  isAddChildModalOpen.value = false
}
const handleAddChildSuccess = async () => {
  await refetchLayout()
  emit('refresh-tree')
}
</script>

<template>
  <div v-if="!layoutId" class="card-empty">
    <p>Select a node from the arrangement tree to view its details</p>
  </div>

  <div v-else-if="layoutLoading" class="card-loading">
    Loading arrangement details…
  </div>

  <div v-else-if="hasData" class="details-card">
    <div class="card-header">
      <h2>{{ layout.name || `${layout.type?.name || 'Layout'} ${layout.id}` }}</h2>
      <div class="card-actions">
        <button @click="openEditModal" class="btn btn-sm btn-outline">
          ✏️ Edit
        </button>
        <button @click="openDeleteModal" class="btn btn-sm btn-danger">
          🗑️ Delete
        </button>
        <button @click="openAddChildModal" class="btn btn-sm btn-add-child">
          + Add Child
        </button>
        <ControllerBadge entityLabel="LAYOUT" :entityId="layout.id" />
      </div>
    </div>

    <div class="card-content">
      <!-- Basic Fields -->
      <div class="section">
        <h3 class="section-title">Information</h3>
        <div class="fields-grid">
          <div v-for="field in displayFields" :key="field.label" class="field">
            <label class="field-label">{{ field.label }}</label>
            <p class="field-value">{{ field.value }}</p>
          </div>
        </div>
      </div>

      <!-- Position -->
      <div v-if="position" class="section">
        <h3 class="section-title">Position</h3>
        <div class="fields-grid">
          <div v-for="pos in position" :key="pos.label" class="field">
            <label class="field-label">{{ pos.label }} (  {{ pos.type}} )</label>
            <p class="field-value">{{ pos.pos }}</p>

          </div>
        </div>
      </div>

      <!-- Axes -->
      <div v-if="axesList.length > 0" class="section">
        <h3 class="section-title">Axes</h3>
        <div class="list">
          <div v-for="axis in axesList" class="list-item">
            <span class="axis-name">{{ axis.name }} ( {{ axis.type }} )</span>
          </div>
        </div>
      </div>

      <!-- Children -->
      <div v-if="childrenList.length > 0" class="section">
        <h3 class="section-title">Child Layouts</h3>
        <div class="tag-list">
          <span v-for="child in childrenList" :key="child.id" class="tag">
            {{ child.name || `${child.type?.name || 'Layout'} ${child.id}` }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="isDeleteModalOpen" class="modal-overlay" @click="closeDeleteModal">
      <DeleteModal
        :layout="layout"
        @close="closeDeleteModal"
        @success="handleDeleteSuccess"
      />
    </div>

    <div v-if="isEditModalOpen" class="modal-overlay" @click="closeEditModal">
      <UpdateModal
        :layoutTypes="layoutTypes"
        :layout="layout"
        :arrangementId="arrangementId"
        @close="closeEditModal"
        @success="handleUpdateSuccess"
      />
    </div>

    <div v-if="isAddChildModalOpen" class="modal-overlay" @click="closeAddChildModal">
      <AddChildModal
        :layoutTypes="layoutTypes"
        :parentLayout="layout"
        @close="closeAddChildModal"
        @success="handleAddChildSuccess"
      />
    </div>
  </div>
</template>

<style scoped>
.card-empty {
  padding: 40px 20px;
  color: #999;
  font-style: italic;
  text-align: center;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-loading {
  padding: 20px;
  color: #999;
  font-style: italic;
  text-align: center;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.details-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 2px solid #f0f0f0;
  background: linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%);
}

.card-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
  flex: 1;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.card-content {
  padding: 20px;
  max-height: 500px;
  overflow-y: auto;
}

.section {
  margin-bottom: 24px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.fields-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 600px) {
  .fields-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.field {
  display: flex;
  flex-direction: column;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 4px;
}

.field-value {
  margin: 0;
  color: #333;
  font-size: 0.95rem;
  line-height: 1.4;
  word-break: break-word;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  padding: 8px 12px;
  background: #f9f9f9;
  border-left: 3px solid #42a5f5;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #333;
}

.axis-name {
  font-weight: 500;
}

.axis-meta {
  font-size: 0.82rem;
  color: #666;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  display: inline-block;
  background: #e8f5e9;
  color: #2e7d32;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 500;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-sm {
  padding: 6px 10px;
  font-size: 0.8rem;
}

.btn-outline {
  background: white;
  color: #2196f3;
  border: 1px solid #2196f3;
}

.btn-outline:hover {
  background: #e3f2fd;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-add-child {
  background-color: #28a745;
  color: white;
}

.btn-add-child:hover {
  background-color: #218838;
}

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
</style>