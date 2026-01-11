<script setup>
import { ref, computed } from 'vue'

import ControllerBadge from "@/components/controls/ControllerBadge.vue";

import { useUnitNodeQueries } from "@/composables/blocks/unitNodeQueries";

import AddChildModal from "@/components/blocks/addChildModal.vue";
import UpdateUnitModal from "@/components/blocks/updateUnitModal.vue";
import DeleteModal from "@/components/blocks/deleteModal.vue";
import PositionDetails from "@/components/blocks/positionDetails.vue";

const props = defineProps({
  unitId: {
    type: Number,
    required: true
  },
  parentId: {
    type: Number,
    required: false
  },
  blockId: {
    type: Number,
    required: true
  },
  subjects: {
    type: Array,
    required: true
  },
  locationId: {
    type: Number,
    required: false  // only needed for root nodes to allow merging to other blocks at that location
  },
})

const emit = defineEmits(['close', 'reload-blocks']) // to close unitDetails modal if the last and is deleted

const {
  unit, 
  unitLoading,
  unitError, 
  refetchUnit,
  loadChildUnits,
  childUnitsLoading,
  childUnitsError
} = useUnitNodeQueries({unitId: props.unitId })


// expanded state for unit tree
const expanded = ref(false)
const toggleExpand = () => {
  expanded.value = !expanded.value
  if (expanded.value) {
    loadChildUnits(props.unitId)
  }
}

const positionExpanded = ref(false)
const toggleExpandPosition = () => {
  positionExpanded.value = !positionExpanded.value
}

const currentPosition = computed(() => {
  if (!unit.value?.positions?.length) return null
  // First try to find a position with no end date
  const activePosition = unit.value.positions.find(p => !p.end)
  if (activePosition) return activePosition
  // Otherwise return the position with the most recent start date
  return unit.value.positions.reduce((latest, current) => {
    if (!latest) return current
    const latestStart = latest.start ? new Date(latest.start) : new Date(0)
    const currentStart = current.start ? new Date(current.start) : new Date(0)
    return currentStart > latestStart ? current : latest
  }, null)
})

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
  refetchUnit()
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
    <div class="unit-node">
    <div v-if="unitLoading">Loading...</div>
    <div v-else-if="unitError">
      Error loading unit: {{ unitError.message }}
    </div>
    <!--
      Redacted units won't have subject, don't present all the other options for these as they won't work
      But we do want to see the security details so we know who to contact to gain access
      And we need to see that one exists to prevent duplication
    -->
    <div v-else-if="unit">
      <div v-if="!unit.subject">
        <div class="unit-info">
          <h6 class="unit-name">{{ unit.name || unit.id }}</h6>
          <ControllerBadge
            entity-label="UNIT"
            :entity-id="unitId"
          />
        </div>
      </div>

      <div v-else class="unit-header">
        <button
          v-if="unit.children && unit.children.length > 0"
          @click="toggleExpand"
          class="expand-btn"
          :class="{ expanded }"
        >
          ▶
        </button>
        <div v-else class="expand-placeholder"></div>

        <div class="unit-info">
          <h6 class="unit-name">{{ unit.name || `${unit.subject.name} ${unit.id}` }}</h6>
          <div class="unit-meta">
            <span class="subject-badge">{{ unit.subject.name }}</span>
            <span v-if="unit.germplasm" class="germplasm-badge">{{ unit.germplasm.name }}</span>
            <span class="position-badge"> ID: {{ unit.id }} </span>
            <span v-if="childUnitsLoading" class="position">Loading children...</span>
            <span v-else-if="childUnitsError">
              Error loading children: {{ childUnitsError.message }}
            </span>
            <span v-else-if="unit.children && unit.children.length >0 " class="position-badge">x{{
                unit.children.length
              }}</span>
            <span v-if="currentPosition" class="position-badge" @click="toggleExpandPosition">
              @{{ currentPosition.location.name }}
            </span>
            <p v-if="unit.description" class="unit-description">
              {{ unit.description }}
            </p>
          </div>

          <div v-if="positionExpanded && currentPosition" class="position-details">
            <PositionDetails
                :unitId="unitId"
                :positions="unit.positions"
            />
          </div>

        </div>


        <div class="actions" role="toolbar" aria-label="unit actions">
          <button
            @click="openEditModal"
            class="btn btn-xs btn-edit"
            title="Update unit details"
          >
            ✎ Edit
          </button>

          <button
            @click="openDeleteModal"
            class="btn btn-xs btn-danger"
            title="Delete unit"
          >
            Delete
          </button>

          <button
            @click="openAddChildModal"
            class="btn btn-xs btn-add-child"
            title="Add child unit"
          >
            + Add Child
          </button>

          <ControllerBadge
            entity-label="UNIT"
            :entity-id="unitId"
          />
        </div>
      </div>
    </div>

    <div v-if="expanded && unit?.children.length > 0" class="children">
      <div v-for="child in unit?.children" :key="child.id" class="child-item">
        <UnitNode
          :key="child.id"
          :unitId="child.id"
          :blockId="blockId"
          :locationId="locationId"
          :subjects="subjects"
          @reload-blocks="$emit('reload-blocks')"
        />
      </div>
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

    <div v-if="isEditModalOpen" class="modal-overlay" @click="closeEditModal">
      <UpdateUnitModal
          :subjects="subjects"
          :unit="unit"
          :blockId="blockId"
          :locationId="locationId"
          @close="closeEditModal"
          @success="handleUpdateSuccess"
          @reload-blocks="$emit('reload-blocks')"
      />
    </div>

    <div v-if="isDeleteModalOpen" class="modal-overlay" @click="closeDeleteModal">
      <DeleteModal
          :unit="unit"
          @close="closeDeleteModal"
          @success="closeDeleteModal"
      />
    </div>

  </div>
  
</template>

<style scoped>
.unit-node {
  display: flex;
  flex-direction: column;
}

.unit-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  justify-content: space-between;
}

.expand-btn,
.expand-placeholder {
  min-width: 24px;
  width: 24px;
  height: 24px;
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
  font-size: 12px;
  transition: transform 0.2s;
  margin-top: 4px;
}

.expand-btn.expanded {
  transform: rotate(90deg);
}

.expand-btn:hover {
  color: #333;
}

.expand-placeholder {
  background: none;
  border: none;
}

.unit-info {
  flex: 1;
}

.unit-name {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.unit-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
  flex-wrap: wrap;
}

.subject-badge {
  display: inline-block;
  background: #e8f5e9;
  color: #2e7d32;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.germplasm-badge {
  display: inline-block;
  background: #e8f5e9;
  color: #5f6ddd;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}


.position-badge {
  display: inline-block;
  background: #fff3e0;
  color: #e65100;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.unit-description {
  margin: 6px 0 0 0;
  font-size: 13px;
  color: #666;
}

.position-details {
  margin-top: 12px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.position-info {
  font-size: 13px;
}

.position-content {
  margin-top: 6px;
  padding-left: 12px;
}

.position-content > div {
  margin-bottom: 4px;
  color: #555;
}

.position-history {
  margin-top: 12px;
}

.history-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  padding: 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.history-item > div {
  margin-bottom: 3px;
  color: #555;
}

.history-item > div:last-child {
  margin-bottom: 0;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 12px;
  align-items: flex-end;
  flex-shrink: 0;
}

.actions .btn-sm {
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  padding: 4px 8px;
  font-size: 11px;
  white-space: nowrap;
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

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn-link {
  background: none;
  color: #007bff;
  text-decoration: underline;
  padding: 4px 0;
}

.btn-link:hover {
  color: #0056b3;
}

.btn-edit {
  background-color: #17a2b8;
  color: white;
}

.btn-edit:hover:not(:disabled) {
  background-color: #138496;
}

.btn-add-position {
  background-color: #ffc107;
  color: #333;
}

.btn-add-position:hover:not(:disabled) {
  background-color: #e0a800;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.btn-add-child {
  background-color: #28a745;
  color: white;
}

.btn-add-child:hover:not(:disabled) {
  background-color: #218838;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.children {
  margin-left: 36px;
  margin-top: 12px;
  padding-left: 12px;
  border-left: 2px solid #e0e0e0;
}

.child-item {
  margin-bottom: 12px;
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
  z-index: 1001;
}

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-large {
  max-width: 700px;
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
  border-radius: 50%;
}

.modal-close:hover:not(:disabled) {
  background-color: #e9ecef;
}

.modal-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-text {
  padding: 10px;
  background: #e3f2fd;
  border-radius: 4px;
  font-size: 14px;
  color: #333;
}

.form-section {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.form-section h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.coordinates-section {
  margin-top: 12px;
}

.coordinates-inputs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.date-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

.error-message {
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  font-size: 14px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
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
</style>