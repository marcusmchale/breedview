<template>
  <div class="layout-node">
    <div v-if="!layout">Loading...</div>
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
        <h6 class="layout-name">{{ layout.name || layout.id }}</h6>
        <div class="layout-meta">
          <span v-if="layout.type" class="type-badge">{{ layout.type.name }}</span>
          <span v-if="layout.children && layout.children.length >0 " class="position">x{{ layout.children.length }}</span>
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
            :options="regionLocations.map(loc => ({ value: loc.id, label: loc.name }))"
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
            :options="otherLayouts.map(l => ({ value: l.id, label: l.name || l.id }))"
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
            <button type="submit" class="btn btn-primary">
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
            Are you sure you want to delete <strong>{{ layout.name }}</strong>?
          </p>
          <p v-if="layout.children.length > 0" class="delete-warning-children">
            ⚠️ This layout has {{ layout.children.length }} child layout(s).
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
          <h4>Add Child Layout</h4>
          <button @click="closeAddChildModal" class="modal-close" :disabled="createChildLoading">&times;</button>
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
            :model-value="layout.name"
            label="Parent Layout:"
            disabled
          />

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

          <!-- Dynamic axis position inputs based on parent layout axes -->
          <div v-if="layout" class="axes-section">
            <h5>Position</h5>
            <FormKit
              v-for="(axisName, index) in layout.axes"
              :key="index"
              type="text"
              :name="`position_${index}`"
              :label="`${axisName} Axis:`"
              :placeholder="`Enter position for ${axisName.toLowerCase()} axis`"
              validation="required"
            />
          </div>

          <div v-if="addChildError" class="error-message">
            {{ addChildError }}
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="createChildLoading">
              {{ createChildLoading ? 'Adding...' : 'Add Child' }}
            </button>
            <button
              type="button"
              @click="closeAddChildModal"
              class="btn btn-secondary"
              :disabled="createChildLoading"
            >
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>

    <div v-if="expanded && layout.children.length > 0" class="children">
      <div v-for="childId in layout.children" :key="childId" class="child-item">
        <LayoutNode
          :layoutId="childId"
          :location-id="locationId"
          :layout-types="layoutTypes"
          :locationCache="locationCache"
          @load-layouts="handleLoadLayouts"
          @reload-layouts="handleReloadLayouts"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { FormKit } from '@formkit/vue'
import { useMutation } from '@vue/apollo-composable'

import ControllerBadge from './ControllerBadge.vue'
import DELETE_LAYOUT_MUTATION from '@/graphql/arrangements/deleteLayout.graphql'
import UPDATE_LAYOUT_MUTATION from '@/graphql/arrangements/updateLayout.graphql'
import CREATE_LAYOUT_MUTATION from '@/graphql/arrangements/createLayout.graphql'


const {layoutId, locationId, layoutTypes, locationCache } = defineProps({
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
  },
  locationCache: {
    type: Object,
    required: true
  },
})

const $emit = defineEmits(['load-layouts', 'reload-layouts', 'delete-layouts', 'reload-locations'])

const expanded = ref(false)

// Use the passed cache instance
const { getLayoutIds, getLayouts, getLayout } = locationCache


const handleLoadLayouts = (layoutIds) => {
  // Emit the new layouts to the parent component
  if (!layoutIds.length >0) return
  $emit('load-layouts', layoutIds)
}

const handleReloadLayouts = (layoutIds) => {
  // Emit the reload layouts to the parent component
  if (!layoutIds.length >0) return
  $emit('reload-layouts', layoutIds)
}

const handleDeleteLayouts = (layoutIds) => {
  //emit the delete layouts to parent component
  if (!layoutIds.length>0) return
  $emit('delete-layouts', layoutIds)
}

const allLayouts = computed(() => {
  const layoutIds = getLayoutIds(locationId)
  if (layoutIds.size === 0) {
    return []
  }
  return getLayouts(layoutIds)
})


const layout = computed( () => {
  if (!layoutId) {
    console.log('no layout ID provided')
    return null;
  }
  const layoutData = getLayout(layoutId)
  console.log('layoutData', layoutId, layoutData)
  return layoutData || null
})

if (layout.value) {
  handleLoadLayouts(layout.value.children)
}

// Get other layouts for parent dropdown (exclude self and descendants)
const otherLayouts = computed(() => {
  const excludeIds = new Set([layout.value.id])
  const addDescendants = (layoutId) => {
    const children = allLayouts.value.filter(l => l.parent?.id === layoutId)
    children.forEach(child => {
      excludeIds.add(child.id)
      addDescendants(child.id)
    })
  }
  addDescendants(layout.value.id)
  return allLayouts.value.filter(l => !excludeIds.has(l.id))
})

const toggleExpand = () => {
  expanded.value = !expanded.value
}

// Edit Modal state
const isEditModalOpen = ref(false)
const updateFormData = ref({
  name: '',
  typeId: null,
  parentId: null,
  position: null,
  locationId: locationId
})
const editError = ref('')

const parentLayout = computed(() => {
  if (!updateFormData.value.parentId) {
    return
  }
  return getLayout(updateFormData.value.parentId)
})


watch(layout, (newLayout) => {
  console.log('newLayout', layout.value.id, newLayout)
  handleLoadLayouts(newLayout.children)
}, {deep: true})

watch(parentLayout, (newParentLayout) => {
  if (!newParentLayout) return;

  // Dynamically add or remove position fields in updateFormData.value
  newParentLayout.axes.forEach((axisName, index) => {
    const positionField = `position_${index}`;
    console.log('layout:', layout)
    // If the position field doesn't exist, add it with an empty string
    if (!Object.prototype.hasOwnProperty.call(updateFormData.value, positionField)) {
      if (layout.value.position) {
        updateFormData.value[positionField] = layout.value.position[index];  // Initialize axis with value
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
  return layoutTypes.find(type => type.id === updateFormData.value.typeId)
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


// Add Child Modal state
const isAddChildModalOpen = ref(false)
const addChildFormData = ref({
  parentName: '',
  name: '',
  typeId: null,
  position: null
})
const addChildError = ref('')


// Get the selected layout type for add child form
const selectedAddChildLayoutType = computed(() => {
  if (!addChildFormData.value.typeId) {
    return null
  }
  return layoutTypes.find(type => type.id === addChildFormData.value.typeId)
})

// Watch for layout type changes in add child form and reset axis fields
watch(() => addChildFormData.value.typeId, (newTypeId, oldTypeId) => {
  if (newTypeId !== oldTypeId) {
    // Clear axis fields when layout type changes
    const currentFormData = { ...addChildFormData.value }
    Object.keys(currentFormData).forEach(key => {
      if (key.startsWith('axis_')) {
        delete currentFormData[key]
      }
    })
    addChildFormData.value = currentFormData
  }
})


// Delete Modal state
const isDeleteModalOpen = ref(false)
const deleteError = ref('')

// Mutations
const { mutate: deleteLayoutMutation, loading: deleteLoading } = useMutation(DELETE_LAYOUT_MUTATION)
const { mutate: updateLayoutMutation } = useMutation(UPDATE_LAYOUT_MUTATION)
const { mutate: createLayoutMutation, loading: createChildLoading } = useMutation(CREATE_LAYOUT_MUTATION)

// Edit Modal functions
const openEditModal = () => {
  updateFormData.value = {
    name: layout.value.name || '',
    typeId: layout.value.type?.id || null,
    parentId: layout.value.parent?.id || null,
    locationId: locationId,
  }
  // Pre-populate axis names if they exist
  if (layout.value.axes && layout.value.axes.length > 0) {
    layout.value.axes.forEach((axisName, index) => {
      updateFormData.value[`axis_${index}`] = axisName
    })
  }
  console.log('layout has positions:', layout.value.position)
  // Pre-populate positions if they exist
  if (layout.value.position && layout.value.position.length > 0) {
    layout.value.position.forEach((axisPosition, index) => {
      updateFormData.value[`position_${index}`] = axisPosition
    })
  }
  editError.value = ''
  isEditModalOpen.value = true
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  updateFormData.value = {
    name: '',
    typeId: null,
    parentId: null,
    locationId: null
  }
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
    const oldParentId = layout.value?.parent?.id || null
    console.log('old parent ID', oldParentId)
    const response = await updateLayoutMutation({
      layout: {
        layoutId: layout.value.id,
        locationId: updateFormData.value.locationId || locationId,
        name: updateFormData.value.name || undefined,
        typeId: updateFormData.value.typeId || undefined,
        parentId: updateFormData.value.parentId || undefined,
        position: positions.length > 0 ? positions : undefined,
        axes: axes.length > 0 ? axes : undefined
      }
    })

    if (response?.data?.arrangementsUpdateLayout) {
      const result = response.data.arrangementsUpdateLayout
      if (result.status === 'SUCCESS') {
        const toReload = [layout.value.id, oldParentId, updateFormData.value.parentId]
        console.log('reloading:', toReload)
        handleReloadLayouts(toReload)
        if (updateFormData.value.locationId !== locationId) {
                $emit("reload-locations", [locationId, updateFormData.value.locationId])
        }
        closeEditModal()
      } else {
        const errors = result.errors
        if (errors && errors.length > 0) {
          editError.value = errors.map(err => err.message).join(', ')
        } else {
          editError.value = 'Failed to update layout. Please try again.'
        }
      }
    }
  } catch (error) {
    console.error('Error updating layout:', error)
    editError.value = error.message || 'An unexpected error occurred while updating the layout.'
  }
}

// Add Child Modal functions
const openAddChildModal = () => {
  addChildFormData.value = {
    parentName: layout.value.name,
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
    if (layout.value) {
      for (let i = 0; i < layout.value.axes.length; i++) {
        const axisPosition = addChildFormData.value[`position_${i}`]
        if (axisPosition) {
          positions.push(axisPosition)
        }
      }
    }
    console.log('creating child with formdata:', addChildFormData.value)
    const response = await createLayoutMutation({
      layout: {
        locationId: locationId,
        name: addChildFormData.value.name,
        typeId: addChildFormData.value.typeId,
        parentId: layoutId,
        position: positions.length > 0 ? positions: undefined,
        axes: axes.length > 0 ? axes : undefined
      }
    })

    if (response?.data?.arrangementsCreateLayout) {
      const result = response.data.arrangementsCreateLayout
      if (result.status === 'SUCCESS') {
        handleReloadLayouts([layoutId])
        closeAddChildModal()
      } else {
        const errors = result.errors
        if (errors && errors.length > 0) {
          addChildError.value = errors.map(err => err.message).join(', ')
        } else {
          addChildError.value = 'Failed to add child layout. Please try again.'
        }
      }
    }
  } catch (error) {
    console.error('Error adding child layout:', error)
    addChildError.value = error.message || 'An unexpected error occurred while adding the child layout.'
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
    const parentId = layout.value.parent?.id || null
    deleteError.value = ''
    const response = await deleteLayoutMutation({
      layoutId: layoutId
    })
    if (response?.data?.arrangementsDeleteLayout) {
      const result = response.data.arrangementsDeleteLayout

      if (result.status === 'SUCCESS') {
        handleDeleteLayouts([layoutId])
        if (parentId) {
          handleReloadLayouts([parentId])
        }
        closeDeleteModal()
      } else {
        const errors = result.errors
        if (errors && errors.length > 0) {
          deleteError.value = errors.map(err => err.message).join(', ')
        } else {
          deleteError.value = 'Failed to delete layout. Please try again.'
        }
      }
    }
  } catch (error) {
    console.error('Error deleting layout:', error)
    deleteError.value = error.message || 'An unexpected error occurred while deleting the layout.'
  }
}

// Use the passed cache instance
const { getRegionLocations, getLocationRegionId } = locationCache


// Get all locations in this region for dropdowns
const regionLocations = computed(() => {
  const regionId = getLocationRegionId(locationId)
  return getRegionLocations(regionId)
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