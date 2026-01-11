<template>
  <div v-if="displayedLocation" class="location-node">
    <div class="location-header" :class="{ selected: isSelected }">
      <button
        v-if="children && children.length > 0"
        @click="$emit('toggle-expand', props.locationId)"
        class="expand-btn"
        :class="{ expanded: isExpandedFn(props.locationId) }"
      >
        ▶
      </button>
      <div v-else class="expand-placeholder"></div>

      <div class="location-info">
        <h4
            class="location-name"
            @click="$emit('select-location', props.locationId)"
        >{{ displayedLocation.name }}</h4>
        <p v-if="displayedLocation.description" class="location-description">{{ displayedLocation.description }}</p>
        <div class="location-meta">
          <span v-if="displayedLocation.id" class="address">{{ displayedLocation.id }}</span>
          <span v-if="displayedLocation.type" class="type-badge">{{ displayedLocation.type.name }}</span>
          <span v-if="displayedLocation.address" class="address">{{ displayedLocation.address }}</span>
        </div>
      </div>
        <!-- Actions column placed to the right of the node -->
        <div v-if="showEdit" class="actions" role="toolbar" aria-label="location actions">
          <button
            @click="openEditModal"
            class="btn btn-sm btn-edit"
            title="Update location details"
          >
            ✎ Edit
          </button>

          <button
            @click="openDeleteModal"
            class="btn btn-sm btn-danger"
            title="Delete location"
          >
            Delete
          </button>

          <button
            @click="openAddChildModal"
            class="btn btn-sm btn-add-child"
            title="Add child location"
          >
            + Add Child
          </button>

          <ControllerBadge
            entity-label="LOCATION"
            :entity-id="displayedLocation.id"
          />
      </div>
    </div>

    <div v-if="isExpandedFn(props.locationId) && children.length > 0" class="children">
      <div v-for="child in children" :key="`locationNode_${child.id}`" class="child-item">
        <LocationNode
          :regionId="props.regionId"
          :locationId="child.id"
          :isExpandedFn="isExpandedFn"
          :locationTypes="locationTypes"
          :selectedLocationId="selectedLocationId"
          :showEdit="showEdit"
          @toggle-expand="$emit('toggle-expand', $event)"
          @select-location="$emit('select-location', $event)"
        />

      </div>
    </div>

    <div v-if="isAddChildModalOpen" class="modal-overlay" @click="closeAddChildModal">
      <AddChildModal
          :locationTypes="locationTypes"
          :parentLocation="displayedLocation"
          @close="closeAddChildModal"
          @success="handleAddChildSuccess"
      />
    </div>

    <div v-if="isEditModalOpen" class="modal-overlay" @click="closeEditModal">
      <UpdateModal
        :locationTypes="locationTypes"
        :location="displayedLocation"
        :regionId="regionId"
        @close="closeEditModal"
        @success="handleUpdateSuccess"
      />
    </div>

    <div v-if="isDeleteModalOpen" class="modal-overlay" @click="closeDeleteModal">
      <DeleteModal
          :locationTypes="locationTypes"
          :location="displayedLocation"
          @close="closeDeleteModal"
      />
    </div>

  </div>
</template>

<script setup>

import { ref, computed } from 'vue'

import ControllerBadge from '../controls/ControllerBadge.vue'

import { useLocationNodeQueries } from "@/composables/regions/locationNodeQueries";

import AddChildModal from "@/components/regions/addChildModal.vue";
import DeleteModal from "@/components/regions/deleteModal.vue";
import UpdateModal from "@/components/regions/updateLocationModal.vue";

const props = defineProps({
  regionId: {
    type: Number,
    required: true
  },
  locationId: {
    type: Number,
    required: true
  },
  isExpandedFn: {
    type: Function,
    required: true
  },
  locationTypes: {
    type: Array,
    required: false,
    default: () => []
  },
  selectedLocationId: {
    type: Number,
    default: null
  },
  showEdit: {
    type: Boolean,
    default: false
  }
})

const $emit = defineEmits([
  'toggle-expand',
  'select-location',
])

const isSelected = computed(() => {
  return props.selectedLocationId === props.locationId
})

const {
  displayedLocation,
  refetchLocation
}  = useLocationNodeQueries({
  locationId: props.locationId
})

const children = computed( () => {
  if (!displayedLocation.value?.children) return []
  return [...displayedLocation.value.children].sort((a,b) => a?.name?.localeCompare(b?.name) )
})


// Add Child Modal state and events
const isAddChildModalOpen = ref(false)
const openAddChildModal = () => {
  isAddChildModalOpen.value = true
}
const closeAddChildModal = () => {
  isAddChildModalOpen.value = false
}
const handleAddChildSuccess = async () => {
  await refetchLocation()
}

//Delete modal state and events
const isDeleteModalOpen = ref(false)
const openDeleteModal = () => {
  isDeleteModalOpen.value = true
}
const closeDeleteModal = () => {
  isDeleteModalOpen.value = false
}

// Edit Modal state and events
const isEditModalOpen = ref(false)
const openEditModal = () => {
  isEditModalOpen.value = true
}
const closeEditModal = () => {
  isEditModalOpen.value = false
}
const handleUpdateSuccess = () => {
  closeEditModal()
}

</script>

<style scoped>
.btn-edit {
  white-space: nowrap;
  background-color: #17a2b8;
  color: white;
}

.btn-edit:hover:not(:disabled) {
  background-color: #138496;
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

.modal-header h4 {
  margin: 0;
  color: #333;
  font-size: 18px;
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


.btn-add-child,
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.location-node {
  display: flex;
  flex-direction: column;
}

.location-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  /* Spread main content and actions to opposite sides */
  justify-content: space-between;
  transition: background-color 0.2s ease;
}

.location-header.selected {
  background-color: #e3f2fd;
  border-left: 4px solid #007bff;
  padding-left: 12px;
}

.location-header.selected:hover {
  background-color: #bbdefb;
}

/* Actions column aligned on the right, stacked vertically */
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 12px;
  align-items: flex-end;
  /* keep actions from shrinking so they remain visible on narrow panels */
  flex-shrink: 0;
}

/* Make small buttons full width within the actions column for easier tapping */
.actions .btn-sm {
  width: 100%;
  box-sizing: border-box;
  text-align: center;
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

.location-info {
  flex: 1;
}

.location-name {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.location-description {
  margin: 4px 0;
  font-size: 14px;
  color: #666;
}

.location-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  flex-wrap: wrap;
}

.type-badge {
  display: inline-block;
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.address {
  font-size: 12px;
  color: #999;
}

.btn-add-child {
  white-space: nowrap;
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

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}


.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}


</style>