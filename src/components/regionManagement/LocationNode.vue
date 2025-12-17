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

    <!-- Edit Modal -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click="closeEditModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h4>Update Location Details</h4>
          <button @click="closeEditModal" class="modal-close">&times;</button>
        </div>

        <FormKit
          v-model="updateFormData"
          type="form"
          @submit="submitUpdate"
          :actions="false"
          class="modal-content"
        >
          <FormKit
            type="text"
            name="name"
            label="Location Name:"
            :placeholder="displayedLocation?.name ?? 'Enter location name'"
          />

          <FormKit
            type="text"
            name="code"
            label="Code (optional):"
            :placeholder="displayedLocation.code ?? 'Enter location code'"
          />

          <FormKit
            type="text"
            name="address"
            label="Address:"
            :placeholder="displayedLocation.address ?? 'Enter address'"
          />

          <FormKit
            type="textarea"
            name="description"
            label="Description (optional):"
            :placeholder="displayedLocation.description ?? 'Enter a description'"
          />

          <FormKit v-if="displayedLocation.parent"
            type="select"
            name="typeId"
            label="Location Type:"
            :placeholder="displayedLocation.type.name ?? 'Select a location type'"
            :options="locationTypes.map(type => ({ value: type.id, label: type.name }))"
            validation="required"
          />

          <FormKit
              type="hierarchical-select"
              name="parentId"
              label="Parent Unit:"
              placeholder="Select a parent unit"
              :root-nodes="regionLocations"
              :get-children-fn="getCachedChildren"
              :exclude-node-id="props.locationId"
              :get-node-id-fn="(unit) => unit.id"
              :get-node-label-fn="(unit) => unit.name || `${unit.subject?.name} ${unit.id}`"
              :has-children-fn="(unit) => unit.children && unit.children.length > 0"
              validation="required"
          />

          <div v-if="editError" class="error-message">
            {{ editError }}
          </div>

          <div class="form-actions">
            <button
              :disabled="updateLocationLoading"
              type="submit"
              class="btn btn-primary"
            >
              Update
            </button>
            <button
              type="button"
              @click="closeEditModal"
              class="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>

    <!-- Delete Modal -->
    <div v-if="isDeleteModalOpen" class="modal-overlay" @click="closeDeleteModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h4>Delete Location</h4>
          <button @click="closeDeleteModal" class="modal-close">&times;</button>
        </div>

        <div class="modal-content">
          <div v-if="deleteError" class="error-message">
            {{ deleteError }}
          </div>

          <p class="delete-warning">
            Are you sure you want to delete <strong>{{ displayedLocation.name }}</strong>?
          </p>
          <p v-if="children.length > 0" class="delete-warning-children">
            ⚠️ This location has {{ children.length }} child location(s).
          </p>

          <div class="form-actions">
            <button
              @click="submitDelete"
              class="btn btn-danger"
              :disabled="deleteLoading"
            >
              {{ deleteLoading ? 'Deleting...' : 'Delete' }}
            </button>
            <button
              type="button"
              @click="closeDeleteModal"
              class="btn btn-secondary"
              :disabled="deleteLoading"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Child Modal -->
    <div v-if="isAddChildModalOpen" class="modal-overlay" @click="closeAddChildModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h4>Add Child Location</h4>
          <button @click="closeAddChildModal" class="modal-close" :disabled="addChildLoading">&times;</button>
        </div>

        <FormKit
          v-model="addChildFormData"
          type="form"
          @submit="submitAddChild"
          :actions="false"
          class="modal-content"
        >
          <FormKit
            type="text"
            name="parentName"
            label="Parent Location:"
            disabled
          />

          <FormKit
            type="select"
            name="typeId"
            label="Location Type:"
            placeholder="Select a location type"
            :options="locationTypes.map(type => ({ value: type.id, label: type.name }))"
            validation="required"
          />

          <FormKit
            type="text"
            name="name"
            label="Location Name:"
            placeholder="Enter location name"
            validation="required"
          />

          <FormKit
            type="text"
            name="code"
            label="Code (optional):"
            placeholder="e.g., zip code"
          />

          <FormKit
            type="text"
            name="address"
            label="Address (optional):"
            placeholder="Enter address"
          />

          <FormKit
            type="textarea"
            name="description"
            label="Description (optional):"
            placeholder="Enter description"
          />

          <div v-if="addChildError" class="error-message">
            {{ addChildError }}
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="addChildLoading">
              {{ addChildLoading ? 'Adding...' : 'Add Child' }}
            </button>
            <button
              type="button"
              @click="closeAddChildModal"
              class="btn btn-secondary"
              :disabled="addChildLoading"
            >
              Cancel
            </button>
          </div>
        </FormKit>
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
  </div>
</template>

<script setup>

import { ref, computed } from 'vue'
import { FormKit } from '@formkit/vue'

import ControllerBadge from '../ControllerBadge.vue'

import { useLocationNodeQueries } from "@/composables/regionManagement/locationNodeQueries";
import { useMutateLocations } from "@/composables/regionManagement/mutateLocations";

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
  regionRootLocation,
  getCachedChildren
}  = useLocationNodeQueries({
  locationId: props.locationId,
  regionId: props.regionId
})

// Prepare mutation handlers
const {
  createLocation, createLocationLoading,
  updateLocation, updateLocationLoading,
  deleteLocation, deleteLocationLoading
} = useMutateLocations()

const regionLocations = computed( () => {
  const regionLocation = regionRootLocation.value
  console.log('region location:', regionLocation)
  return regionLocation ? [regionLocation] : []
})

const children = computed( () => {
  if (!displayedLocation.value?.children) return []
  return displayedLocation.value.children
})

//const otherLocations = computed(() => {
//  if (!parent.value) return []
//  const locations = getChildLocations(props.regionId, props.locationId).value
//  return locations.filter(loc => loc.id !== props.locationId)
//})

// Edit Modal state
const isEditModalOpen = ref(false)
const updateFormData = ref({
  name: '',
  code: '',
  address: '',
  description: '',
  typeId: null,
  parentId: null
})
const editError = ref('')

// Add Child Modal state
const isAddChildModalOpen = ref(false)
const addChildFormData = ref({
  parentName: '',
  typeId: null,
  name: '',
  code: '',
  address: '',
  description: ''
})
const addChildError = ref('')
const addChildLoading = createLocationLoading

// Delete Modal state
const isDeleteModalOpen = ref(false)
const deleteError = ref('')
const deleteLoading = deleteLocationLoading

// Edit Modal functions
const openEditModal = () => {
  const location = displayedLocation.value
  updateFormData.value = {
    name: location.name || '',
    code: location.code || '',
    address: location.address || '',
    description: location.description || '',
    typeId: location.type?.id || null,
    parentId: location.parent?.id || null
  }
  editError.value = ''
  isEditModalOpen.value = true
}

const closeEditModal = () => {
  isEditModalOpen.value = false
}

const submitUpdate = async () => {
  try {
    editError.value = ''

    const updateData = {
        locationId: props.locationId,
        name: updateFormData.value.name || undefined,
        code: updateFormData.value.code || undefined,
        address: updateFormData.value.address || undefined,
        description: updateFormData.value.description || undefined,
        typeId: updateFormData.value.typeId || undefined,
        parentId: updateFormData.value.parentId || undefined
      }

    const { status, errors } = await updateLocation(updateData)
    if (status === 'SUCCESS') {
      closeEditModal()
    } else {
      // Handle server errors
      if (errors && errors.length > 0) {
        editError.value = errors.map(err => err.message).join(', ')
      } else {
        editError.value = 'Failed to update location. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error updating location:', error)
    editError.value = error.message || 'An unexpected error occurred while updating the location.'
  }
}

// Add Child Modal functions
const openAddChildModal = () => {
  addChildFormData.value = {
    parentName: displayedLocation.value.name,
    typeId: null,
    name: '',
    code: '',
    address: '',
    description: ''
  }
  addChildError.value = ''
  isAddChildModalOpen.value = true
}

const closeAddChildModal = () => {
  isAddChildModalOpen.value = false
}

const submitAddChild = async () => {
  try {
    addChildError.value = ''
    addChildLoading.value = true

    const locationData = {
        name: addChildFormData.value.name,
        code: addChildFormData.value.code || undefined,
        address: addChildFormData.value.address || undefined,
        description: addChildFormData.value.description || undefined,
        typeId: addChildFormData.value.typeId,
        parentId: props.locationId
    }

    const { status, errors } = await createLocation(locationData)
    if (status === 'SUCCESS') {
      closeAddChildModal()
    } else {
      // Handle server errors
      if (errors && errors.length > 0) {
        addChildError.value = errors.map(err => err.message).join(', ')
      } else {
        addChildError.value = 'Failed to add child location. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error adding child location:', error)
    addChildError.value = error.message || 'An unexpected error occurred while adding the child location.'
  }
}

// Delete Modal functions
const openDeleteModal = () => {
  deleteError.value = ''
  isDeleteModalOpen.value = true
}

const closeDeleteModal = () => {
  isDeleteModalOpen.value = false
  deleteError.value = ''
}

const submitDelete = async () => {
  try {
    deleteError.value = ''

    const { status, errors } = await deleteLocation(props.locationId)
    if (status === 'SUCCESS') {
        closeDeleteModal()
    } else {
      // Handle server errors
      if (errors && errors.length > 0) {
        deleteError.value = errors.map(err => err.message).join(', ')
      } else {
        deleteError.value = 'Failed to delete location. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error deleting location:', error)
    deleteError.value = error.message || 'An unexpected error occurred while deleting the location.'
  }
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

.btn-secondary:hover {
  background-color: #5a6268;
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

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}


</style>