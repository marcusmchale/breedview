<script setup>
import { computed, ref } from 'vue'
import ControllerBadge from '@/components/controls/ControllerBadge.vue'
import UpdateUnitModal from '@/components/blocks/updateUnitModal.vue'
import DeleteModal from '@/components/blocks/deleteModal.vue'
import AddChildModal from '@/components/blocks/addChildModal.vue'
import AddPositionModal from '@/components/blocks/addPositionModal.vue'
import PositionDetails from '@/components/blocks/positionDetails.vue'

import { useUnitNodeQueries } from '@/composables/blocks/unitNodeQueries'

const props = defineProps({
  unitId: {
    type: String,
    default: null
  },
  parentId: {
    type: String,
    default: null
  },
  blockId: {
    type: String,
    required: true
  },
  locationId: {
    type: String,
    required: true
  },
  subjects: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['refresh-tree', 'node-deleted'])

const {
  unit,
  unitLoading,
  unitError,
  refetchUnit
} = useUnitNodeQueries({ unitId: () => props.unitId })

const hasData = computed(() => !!unit.value)
const isRedacted = computed(() => hasData.value && !unit.value.subject)

const displayFields = computed(() => {
  if (!unit.value) return []
  const u = unit.value
  return [
    { label: 'Name', value: u.name },
    { label: 'Subject', value: u.subject?.name },
    { label: 'Germplasm', value: u.germplasm?.name },
    { label: 'ID', value: u.id },
    { label: 'Description', value: u.description }
  ].filter(f => f.value !== null && f.value !== undefined)
})

const positionsList = computed(() => {
  if (!unit.value) return []
  return unit.value.positions ?? []
})

const childrenList = computed(() => {
  if (!unit.value) return []
  return unit.value.children ?? []
})

const parentsList = computed(() => {
  if (!unit.value) return []
  return unit.value.parents ?? []
})

const currentPosition = computed(() => {
  return positionsList.value?.[positionsList.value.length - 1]
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
  await refetchUnit()
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
  await refetchUnit()
  emit('refresh-tree')
}

// Add Position Modal state and events
const isAddPositionModalOpen = ref(false)
const openAddPositionModal = () => {
  isAddPositionModalOpen.value = true
}
const closeAddPositionModal = () => {
  isAddPositionModalOpen.value = false
}
const handleAddPositionSuccess = async () => {
  await refetchUnit()
}
</script>

<template>
  <div v-if="!unitId" class="card-empty">
    <p>Select a unit from the block tree to view its details</p>
  </div>

  <div v-else-if="unitLoading" class="card-loading">
    Loading unit details…
  </div>

  <div v-else-if="isRedacted" class="details-card redacted-card">
    <div class="card-header">
      <h2>Unit {{ unit.id }} - Access Restricted</h2>
      <div class="card-actions">
        <ControllerBadge entityLabel="UNIT" :entityId="unit.id" />
      </div>
    </div>
    <div class="card-content">
      <div class="section">
        <p class="redacted-message">
          You do not have permission to view the details of this unit.
          Contact the controlling team for access.
        </p>
      </div>
    </div>
  </div>

  <div v-else-if="hasData" class="details-card">
    <div class="card-header">
      <h2>{{ unit.name || `${unit.subject?.name || 'Unit'} ${unit.id}` }}</h2>
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
        <button @click="openAddPositionModal" class="btn btn-sm btn-add-position">
          📍 Add Position
        </button>
        <ControllerBadge entityLabel="UNIT" :entityId="unit.id" />
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

      <!-- Current Position -->
      <div v-if="currentPosition" class="section">
        <h3 class="section-title">Current Position</h3>
        <div class="position-info">
          <div><strong>Location:</strong> {{ currentPosition.location?.name }}</div>
          <div v-if="currentPosition.layout">
            <strong>Layout:</strong> {{ currentPosition.layout.name || currentPosition.layout.id }}
          </div>
          <div v-if="currentPosition.coordinates && currentPosition.coordinates.length > 0">
            <strong>Coordinates:</strong> {{ currentPosition.coordinates.join(', ') }}
          </div>
          <div v-if="currentPosition.start">
            <strong>Start:</strong> {{ currentPosition.start }}
          </div>
          <div v-if="currentPosition.end">
            <strong>End:</strong> {{ currentPosition.end }}
          </div>
        </div>
      </div>

      <!-- All Positions -->
      <div v-if="positionsList.length > 0" class="section">
        <h3 class="section-title">Position History ({{ positionsList.length }})</h3>
        <PositionDetails
          :unitId="unitId"
          :positions="positionsList"
          @position-updated="refetchUnit"
        />
      </div>

      <!-- Parents -->
      <div v-if="parentsList.length > 0" class="section">
        <h3 class="section-title">Parent Units</h3>
        <div class="tag-list">
          <span v-for="parent in parentsList" :key="parent.id" class="tag">
            {{ parent.name || `${parent.subject?.name || 'Unit'} ${parent.id}` }}
          </span>
        </div>
      </div>

      <!-- Children -->
      <div v-if="childrenList.length > 0" class="section">
        <h3 class="section-title">Child Units</h3>
        <div class="tag-list">
          <span v-for="child in childrenList" :key="child.id" class="tag">
            {{ child.name || `${child.subject?.name || 'Unit'} ${child.id}` }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="isDeleteModalOpen" class="modal-overlay" @click="closeDeleteModal">
      <DeleteModal
        :unit="unit"
        @close="closeDeleteModal"
        @success="handleDeleteSuccess"
      />
    </div>

    <div v-if="isEditModalOpen" class="modal-overlay" @click="closeEditModal">
      <UpdateUnitModal
        :subjects="subjects"
        :unit="unit"
        :blockId="blockId"
        :locationId="locationId"
        @close="closeEditModal"
        @success="handleUpdateSuccess"
        @reload-blocks="emit('refresh-tree')"
      />
    </div>

    <div v-if="isAddChildModalOpen" class="modal-overlay" @click="closeAddChildModal">
      <AddChildModal
        :subjects="subjects"
        :parentUnit="unit"
        :parentPosition="currentPosition"
        @close="closeAddChildModal"
        @success="handleAddChildSuccess"
      />
    </div>

    <div v-if="isAddPositionModalOpen" class="modal-overlay" @click="closeAddPositionModal">
      <AddPositionModal
        :unitId="unitId"
        :locationId="locationId"
        @close="closeAddPositionModal"
        @success="handleAddPositionSuccess"
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

.redacted-card {
  border-color: #ffb74d;
  background: #fff8e1;
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

.redacted-card .card-header {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
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

.redacted-message {
  padding: 16px;
  background: #ffebee;
  border: 1px solid #ef5350;
  border-radius: 4px;
  color: #c62828;
  font-size: 0.95rem;
  margin: 0;
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

.position-info {
  padding: 12px;
  background: #f9f9f9;
  border-left: 3px solid #42a5f5;
  border-radius: 4px;
  font-size: 0.9rem;
}

.position-info > div {
  margin-bottom: 6px;
  color: #333;
}

.position-info > div:last-child {
  margin-bottom: 0;
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

.btn-add-position {
  background-color: #ffc107;
  color: #333;
}

.btn-add-position:hover {
  background-color: #e0a800;
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