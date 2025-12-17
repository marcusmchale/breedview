<template>
  <div class="layout-node">
    <div v-if="!cachedLayout">Loading...</div>
    <!--
      Redacted layouts won't have type, don't present all the other options for these as they won't work
      But we do want to see the security details so we know who to contact to gain access
      And we need to see that one exists to prevent duplication
    -->
    <div v-else-if="!cachedLayout.type">
      <div class="layout-info">
        <h6 class="layout-name">{{ cachedLayout.name || cachedLayout.id }}</h6>
        <ControllerBadge
          entity-label="LAYOUT"
          :entity-id="layoutId"
        />
      </div>
    </div>

    <div v-else class="layout-header">
      <button
        v-if="cachedLayout.children && cachedLayout.children.length > 0"
        @click="toggleExpand"
        class="expand-btn"
        :class="{ expanded }"
      >
        ▶
      </button>
      <div v-else class="expand-placeholder"></div>

      <div class="layout-info">
        <h6 class="layout-name">{{ cachedLayout.name || `${cachedLayout.type.name} ${cachedLayout.id}` }}</h6>
        <div class="layout-meta">
          <span class="type-badge">{{ cachedLayout.type.name }}</span>
          <span class="position"> ID: {{ cachedLayout.id }} </span>
          <span v-if="cachedLayout.children && cachedLayout.children.length >0 " class="position">x{{
              cachedLayout.children.length
            }}</span>
          <span v-if="cachedLayout.position !== null && cachedLayout.position !== undefined" class="position">
            Pos: {{ cachedLayout.position }}
          </span>
          <span v-if="cachedLayout.location !== null && cachedLayout.location !== undefined" class="position">
            Loc: {{ cachedLayout.location.name }}
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

    <!-- Edit Modal -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click="closeEditModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h4>Update Layout Details</h4>
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
            type="select"
            name="locationId"
            label="Location:"
            placeholder="Select a location"
            :options="locationOptions"
          />

          <FormKit
            type="text"
            name="name"
            label="Layout Name (optional):"
          />

          <FormKit
            type="select"
            name="typeId"
            label="Layout Type:"
            :options="layoutTypes.map(type => ({ value: type.id, label: type.name }))"
            validation="required"
          />

          <!-- Dynamic axis name inputs based on selected layout type -->
          <div v-if="selectedEditLayoutType && selectedEditLayoutType.axes && selectedEditLayoutType.axes.length > 0" class="axes-section">
            <h5>Axis Names</h5>
            <FormKit
              v-for="(axisType, index) in selectedEditLayoutType.axes"
              :key="index"
              type="text"
              :name="`axis_${index}`"
              :label="`${axisType} Axis:`"
              :placeholder="`Enter name for ${axisType.toLowerCase()} axis`"
              v-model="updateFormData[`axis_${index}`]"
              validation="required"
            />
          </div>

          <FormKit
            type="select"
            name="parentId"
            label="Parent Layout:"
            placeholder="Select a parent layout"
            :options="parentOptions"
          />


          <!-- Dynamic axis position inputs based on parent layout axes -->
          <div v-if="updateFormData.parentId" class="axes-section">
            <h5>Position</h5>
            <FormKit
              v-for="(axisName, index) in parentLayout.axes"
              :key="index"
              type="text"
              :name="`position_${index}`"
              :label="`${axisName} Axis:`"
              :placeholder="`Enter position for ${axisName.toLowerCase()} axis`"
              v-model="updateFormData[`position_${index}`]"
              validation="required"
            />
          </div>

          <div v-if="editError" class="error-message">
            {{ editError }}
          </div>

          <div class="form-actions">
            <button
                :disabled="updateLayoutLoading"
                type="submit"
                class="btn btn-primary">
              Update
            </button>
            <button type="button" @click="closeEditModal" class="btn btn-secondary">
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
          <h4>Delete Layout</h4>
          <button @click="closeDeleteModal" class="modal-close">&times;</button>
        </div>

        <div class="modal-content">
          <div v-if="deleteError" class="error-message">
            {{ deleteError }}
          </div>

          <p class="delete-warning">
            Are you sure you want to delete <strong>{{ cachedLayout.name }}</strong>?
          </p>
          <p v-if="cachedLayout.children.length > 0" class="delete-warning-children">
            ⚠️ This layout has {{ cachedLayout.children.length }} child layout(s).
          </p>

          <div class="form-actions">
            <button
              @click="submitDelete"
              class="btn btn-danger"
              :disabled="deleteLayoutLoading"
            >
              {{ deleteLayoutLoading ? 'Deleting...' : 'Delete' }}
            </button>
            <button
              type="button"
              @click="closeDeleteModal"
              class="btn btn-secondary"
              :disabled="deleteLayoutLoading"
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
          <h4>Add Child Layout</h4>
          <button @click="closeAddChildModal" class="modal-close" :disabled="createLayoutLoading">&times;</button>
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
            :model-value="cachedLayout.name"
            label="Parent Layout:"
            disabled
          />

          <!-- Dynamic axis position inputs based on parent layout axes -->
          <div v-if="cachedLayout" class="axes-section">
            <h5>Position</h5>
            <FormKit
              v-for="(axisName, index) in cachedLayout.axes"
              :key="index"
              type="text"
              :name="`position_${index}`"
              :label="`${axisName} Axis:`"
              :placeholder="`Enter position for ${axisName.toLowerCase()} axis`"
              validation="required"
            />
          </div>

          <FormKit
            type="text"
            name="name"
            label="Layout Name:"
            placeholder="Enter layout name (optional)"
          />

          <FormKit
            type="select"
            name="typeId"
            label="Layout Type:"
            placeholder="Select a layout type"
            :options="layoutTypes.map(type => ({ value: type.id, label: type.name }))"
            validation="required"
          />

          <!-- Dynamic axis name inputs based on selected layout type -->
          <div v-if="selectedAddChildLayoutType && selectedAddChildLayoutType.axes && selectedAddChildLayoutType.axes.length > 0" class="axes-section">
            <h5>Axis Names</h5>
            <FormKit
              v-for="(axisType, index) in selectedAddChildLayoutType.axes"
              :key="index"
              type="text"
              :name="`axis_${index}`"
              :label="`${axisType} Axis:`"
              :placeholder="`Enter name for ${axisType.toLowerCase()} axis`"
              v-model="updateFormData[`axis_${index}`]"
              validation="required"
            />
          </div>


          <div v-if="addChildError" class="error-message">
            {{ addChildError }}
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="createLayoutLoading">
              {{ createLayoutLoading ? 'Adding...' : 'Add Child' }}
            </button>
            <button
              type="button"
              @click="closeAddChildModal"
              class="btn btn-secondary"
              :disabled="createLayoutLoading"
            >
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>

    <div v-if="expanded && cachedLayout.children.length > 0" class="children">
      <div v-for="child in cachedLayout.children" :key="child.id" class="child-item">
        <LayoutNode
          :layoutId="child.id"
          :location-id="locationId"
          :layout-types="layoutTypes"
          @load-layouts="$emit('load-layouts', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import { FormKit } from '@formkit/vue'

import ControllerBadge from '../ControllerBadge.vue'
import {useQueryLayouts} from "@/composables/arrangementManagement/layoutBoxQueries";
import {useMutateLayouts} from "@/composables/arrangementManagement/mutateLayouts";


const props = defineProps({
  layoutId: {
    type: Number,
    required: true
  },
  locationId: {
    type: Number,
    required: true
  },
  layoutTypes: {
    type: Array,
    required: true
  }
})

const locationCache = inject('locationCache')
const layoutCache = inject('layoutCache')
const queryLayouts = useQueryLayouts(layoutCache)
const mutateLayouts = useMutateLayouts(layoutCache, queryLayouts)

const { getRegion, getDescendantLocations } = locationCache

const {
  getLayout,
  getAvailableParents
} = layoutCache


// Prepare mutation handlers
const {
  createLayout, createLayoutLoading,
  updateLayout, updateLayoutLoading,
  deleteLayout, deleteLayoutLoading
} = mutateLayouts

const $emit = defineEmits(['load-layouts'])

const expanded = ref(false)


const cachedLayout = computed( () => {
  return getLayout(props.layoutId).value
})

const toggleExpand = () => {
  expanded.value = !expanded.value
  if (expanded.value) {
    $emit('load-layouts', cachedLayout.value.children.map(child => child.id))
  }
}

// Modal states
const isEditModalOpen = ref(false)
const isAddChildModalOpen = ref(false)
const isDeleteModalOpen = ref(false)

// Form data
const updateFormData = ref({
  name: '',
  typeId: null,
  parentId: null,
  position: null,
  locationId: props.locationId
})


const addChildFormData = ref({
  parentName: '',
  name: '',
  typeId: null,
  position: null
})


// Error states
const editError = ref('')
const deleteError = ref('')
const addChildError = ref('')

//todo, in unit node we handle the below with refs that then get the value assigned,
// not sure if this pattern is better/worse, both work

// get the parent layout for form position fields
const parentLayout = computed(() => {
  if (!updateFormData.value.parentId) {
    return null
  }
  return getLayout(updateFormData.value.parentId)
})

// Get the selected layout type for form axis name fields
const selectedAddChildLayoutType = computed(() => {
  if (!addChildFormData.value.typeId) {
    return null
  }
  return props.layoutTypes.find(type => type.id === addChildFormData.value.typeId)
})


// Collect dropdown menu options
const locationOptions = computed(() => {
  const region = getRegion(props.locationId).value
  console.log('regio is:', region)
  const descendants = getDescendantLocations(region.id).value
  console.log('descendants are:', descendants)
  return descendants.map(loc => ({
    value: loc.id,
    label: loc.name
  }))
})

const parentOptions = computed(() => {
  return getAvailableParents(props.layoutId).map(layout => ({
      value: layout.id,
      label: layout.name || `${layout.type.name} ${layout.id}`
    }))
})


// Edit Modal
const openEditModal = () => {
  updateFormData.value = {
    typeId: cachedLayout.value.type?.id || null,
    name: cachedLayout.value.name || '',
    parentId: cachedLayout.value.parent?.id || null,
    locationId: props.locationId,
  }
  // Pre-populate axis names if they exist
  if (cachedLayout.value.axes && cachedLayout.value.axes.length > 0) {
    cachedLayout.value.axes.forEach((axisName, index) => {
      updateFormData.value[`axis_${index}`] = axisName
    })
  }
  // Pre-populate positions if they exist
  if (cachedLayout.value.position && cachedLayout.value.position.length > 0) {
    cachedLayout.value.position.forEach((axisPosition, index) => {
      updateFormData.value[`position_${index}`] = axisPosition
    })
  }
  editError.value = ''
  isEditModalOpen.value = true
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  editError.value = ''
}

const submitUpdate = async () => {
  try {
    editError.value = ''

     // Collect axis names from form data
    const axes = []
    if (selectedEditLayoutType.value?.axes) {
      for (let i = 0; i < selectedEditLayoutType.value.axes.length; i++) {
        const axisName = updateFormData.value[`axis_${i}`]
        if (axisName) {
          axes.push(axisName)
        }
      }
    }
    // Collect positions from form data
    const positions = []
    if (parentLayout.value?.axes) {
      for (let i = 0; i < parentLayout.value.axes.length; i++) {
        const axisPosition = updateFormData.value[`position_${i}`]
        if (axisPosition) {
          positions.push(axisPosition)
        }
      }
    }

    const layoutData = {
        layoutId: cachedLayout.value.id,
        locationId: updateFormData.value.locationId || undefined,
        name: updateFormData.value.name || undefined,
        typeId: updateFormData.value.typeId || undefined,
        parentId: updateFormData.value.parentId || undefined,
        position: positions.length > 0 ? positions : undefined,
        axes: axes.length > 0 ? axes : undefined
      }
    const { status, errors } = await updateLayout(layoutData)
    if (status === 'SUCCESS') {
      closeEditModal()
    } else {
      if (errors && errors.length > 0) {
        editError.value = errors.map(err => err.message).join(', ')
      } else {
        editError.value = 'Failed to update layout. Please try again.'
      }
    }

  } catch (error) {
    console.error('Error updating layout:', error)
    editError.value = error.message || 'An unexpected error occurred.'
  }
}

// Add Child Modal functions
const openAddChildModal = () => {
  addChildFormData.value = {
    parentName: cachedLayout.value.name,
    name: '',
    typeId: null,
    position: null
  }
  addChildError.value = ''
  isAddChildModalOpen.value = true
}

const closeAddChildModal = () => {
  isAddChildModalOpen.value = false
  addChildFormData.value = {
    parentName: '',
    name: '',
    typeId: null,
    position: null
  }
  addChildError.value = ''
}

const submitAddChild = async () => {
  try {
    addChildError.value = ''

    // Collect axis names from form data
    const axes = []
    if (selectedAddChildLayoutType.value?.axes) {
      for (let i = 0; i < selectedAddChildLayoutType.value.axes.length; i++) {
        const axisName = addChildFormData.value[`axis_${i}`]
        if (axisName) {
          axes.push(axisName)
        }
      }
    }

    // Collect position values from form data
    const positions = []
    if (cachedLayout.value) {
      for (let i = 0; i < cachedLayout.value.axes.length; i++) {
        const axisPosition = addChildFormData.value[`position_${i}`]
        if (axisPosition) {
          positions.push(axisPosition)
        }
      }
    }
    const layoutData = {
        locationId: props.locationId,
        name: addChildFormData.value.name,
        typeId: addChildFormData.value.typeId,
        parentId: props.layoutId,
        position: positions.length > 0 ? positions: undefined,
        axes: axes.length > 0 ? axes : undefined
    }
    const { status, errors } = await createLayout(layoutData)
    if (status === 'SUCCESS') {
      closeAddChildModal()
    } else {
      if (errors && errors.length > 0) {
        addChildError.value = errors.map(err => err.message).join(', ')
      } else {
        addChildError.value = 'Failed to add child layout. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error adding child layout:', error)
    addChildError.value = error.message || 'An unexpected error occurred. '
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
    const { status, errors } = await deleteLayout(props.layoutId)
    if (status === 'SUCCESS') {
      closeDeleteModal()
    } else {
      if (errors && errors.length > 0) {
        deleteError.value = errors.map(err => err.message).join(', ')
      } else {
        deleteError.value = 'Failed to delete layout. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error deleting layout:', error)
    deleteError.value = error.message || 'An unexpected error occurred.'
  }
}

// Dynamic fields in forms
watch(parentLayout.value, (newParentLayout) => {
  if (!newParentLayout) return;

  // Dynamically add or remove position fields in updateFormData.value
  newParentLayout.axes.forEach((axisName, index) => {
    const positionField = `position_${index}`;
    // If the position field doesn't exist, add it with an empty string
    if (!Object.prototype.hasOwnProperty.call(updateFormData.value, positionField)) {
      if (cachedLayout.value.position) {
        updateFormData.value[positionField] = cachedLayout.value.position[index];  // Initialize axis with value
      }
    }
  });

  // Remove unused position fields if the number of axes has decreased
  const maxPositions = Object.keys(updateFormData.value).filter(key => key.startsWith('position_')).length;
  for (let i = newParentLayout.axes.length; i < maxPositions; i++) {
    const positionField = `position_${i}`;

    // Safely delete the axis field if it no longer exists
    if (Object.prototype.hasOwnProperty.call(updateFormData.value, positionField)) {
      delete updateFormData.value[positionField];
    }
  }
});

// Get the selected layout type for edit form
const selectedEditLayoutType = computed(() => {
  if (!updateFormData.value.typeId) {
    return null
  }
  return props.layoutTypes.find(type => type.id === updateFormData.value.typeId)
})


watch(selectedEditLayoutType, (newLayoutType) => {
  if (!newLayoutType) return;

  // Dynamically add or remove axis fields in updateFormData.value
  newLayoutType.axes.forEach((axisType, index) => {
    const axisField = `axis_${index}`;

    // If the axis field doesn't exist, add it with an empty string
    if (!Object.prototype.hasOwnProperty.call(updateFormData.value, axisField)) {
      updateFormData.value[axisField] = '';  // Initialize axis with an empty string
    }

    // Add a name for the axis if it's not already set
    if (updateFormData.value[axisField] === '') {
      updateFormData.value[axisField] = axisType;  // Initialize name with the axisType (like 'Tree', 'Row')
    }
  });

  // Remove unused axis fields if the number of axes has decreased
  const maxAxes = Object.keys(updateFormData.value).filter(key => key.startsWith('axis_')).length;
  for (let i = newLayoutType.axes.length; i < maxAxes; i++) {
    const axisField = `axis_${i}`;

    // Safely delete the axis field if it no longer exists
    if (Object.prototype.hasOwnProperty.call(updateFormData.value, axisField)) {
      delete updateFormData.value[axisField];
    }
  }
});

// Watch for layout type changes in add child form and reset axis fields
watch(() => addChildFormData.value.typeId, (newTypeId, oldTypeId) => {
  if (newTypeId !== oldTypeId) {
    // Clear axis fields when layout-type changes
    const currentFormData = { ...addChildFormData.value }
    Object.keys(currentFormData).forEach(key => {
      if (key.startsWith('axis_')) {
        delete currentFormData[key]
      }
    })
    addChildFormData.value = currentFormData
  }
})

</script>

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