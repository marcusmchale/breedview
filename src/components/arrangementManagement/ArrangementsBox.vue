<template>
  <div class="arrangements-box">
    <div class="arrangements-header">
      <h5>Arrangements</h5>
      <button
        @click="openAddLayoutModal"
        class="btn btn-sm btn-add-layout"
        title="Create new arrangements"
      >
        + New Layout
      </button>
    </div>

    <div v-if="arrangementsLoading" class="loading">
      Loading layouts...
    </div>

    <div v-else-if="locationArrangements.length === 0" class="empty-state">
      No layouts at this location
    </div>

    <div v-else class="layouts-list">
      <div
        v-for="layout in locationArrangements.filter(Boolean)"
        :key="layout.id"
        class="layout-item"
        @click.prevent="openLayoutModal(layout)"
      >
        <span class="layout-name">{{ layout.name || `${layout.type?.name} ${layout.id}` }}</span>
        <span class="layout-subject">{{ layout.type?.name }}</span>
      </div>
    </div>

    <!-- Create Layout Modal -->
    <div v-if="isCreateLayoutModalOpen" class="modal-overlay" @click="closeAddLayoutModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h4>Add layout</h4>
          <button @click="closeAddLayoutModal" class="modal-close" :disabled="createLayoutLoading">&times;</button>
        </div>

        <FormKit
          v-model="createFormData"
          type="form"
          @submit="submitAddLayout"
          :actions="false"
          class="modal-content"
        >
          <FormKit
            type="text"
            name="name"
            label="Layout Name:"
            placeholder="Enter layout name (Optional)"
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
          <div v-if="selectedLayoutType && selectedLayoutType.axes && selectedLayoutType.axes.length > 0" class="axes-section">
            <h5>Axis Names</h5>
            <FormKit
              v-for="(axisType, index) in selectedLayoutType.axes"
              :key="index"
              type="text"
              :name="`axis_${index}`"
              :label="`${axisType} Axis:`"
              :placeholder="`Enter name for ${axisType.toLowerCase()} axis`"
              validation="required"
            />
          </div>

          <div v-if="addLayoutError" class="error-message">
            {{ addLayoutError }}
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="createLayoutLoading">
              {{ createLayoutLoading ? 'Adding...' : 'Add Layout' }}
            </button>
            <button
              type="button"
              @click="closeAddLayoutModal"
              class="btn btn-secondary"
              :disabled="createLayoutLoading"
            >
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>

    <!-- Layout details modal -->
    <div v-if="selectedLayout" class="modal-overlay" @click="closeLayoutModal">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
         <h4>{{ selectedLayout.name || `${selectedLayout.type.name} ${selectedLayout.id}` }}</h4>
         <button @click="closeLayoutModal" class="modal-close">&times;</button>
        </div>

        <div class="layout-details">
          <LayoutNode
            :key="selectedLayout.id"
            :layoutId="selectedLayout.id"
            :locationId="locationId"
            :layoutTypes="layoutTypes"
            @load-layouts="handleLoadLayouts"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, computed, watch, inject } from 'vue'
import { FormKit } from '@formkit/vue'

import LayoutNode from './LayoutNode.vue'
import {useQueryLayouts} from "@/composables/arrangementManagement/layoutBoxQueries";
import {useMutateLayouts} from "@/composables/arrangementManagement/mutateLayouts";

const layoutCache = inject('layoutCache')
const queryLayouts = useQueryLayouts(layoutCache)
const mutateLayouts = useMutateLayouts(layoutCache, queryLayouts)

const {
  getLocationArrangements
} = layoutCache

const {
  loadLocationArrangements,
  reloadLocationArrangements,
  loadLayouts
} = queryLayouts

const {
  createLayout,
  createLayoutLoading
} = mutateLayouts

const props = defineProps({
  locationId: {
    type: Number,
    required: true
  },
  arrangementsLoading: {
    type: Boolean,
    default: false
  },
  layoutTypes: {
    type: Array,
    required: true
  }
})

watch(() => props.locationId, (newLocationId) => {
  if (newLocationId) {
    loadLocationArrangements(newLocationId)
  }
}, { immediate: true })

// get Arrangements for the selected location
const locationArrangements = computed( () => {
  return getLocationArrangements(props.locationId).value
})

// Handle loading of locations for children on toggle expanded

const handleLoadLayouts = (layoutIds) => {
  console.log('load layouts:', layoutIds)
  loadLayouts(layoutIds)
}

// Add Layout Modal state
const isCreateLayoutModalOpen = ref(false)
const createFormData = ref({
  name: '',
  typeId: null
})
const addLayoutError = ref('')

// Layout details modal
const selectedLayout = ref(null)

const openLayoutModal = (layout) => {
  selectedLayout.value = layout
}

const closeLayoutModal = () => {
  selectedLayout.value = null
}

// Get the selected layout type
const selectedLayoutType = computed(() => {
  if (!createFormData.value.typeId) {
    return null
  }
  return props.layoutTypes.find(type => type.id === createFormData.value.typeId)
})

// Watch for layout type changes and reset axis fields
watch(() => createFormData.value.typeId, (newTypeId, oldTypeId) => {
  if (newTypeId !== oldTypeId) {
    // Clear axis fields when layout type changes
    const currentFormData = { ...createFormData.value }
    Object.keys(currentFormData).forEach(key => {
      if (key.startsWith('axis_')) {
        delete currentFormData[key]
      }
    })
    createFormData.value = currentFormData
  }
})

// Add Layout Modal functions
const openAddLayoutModal = () => {
  createFormData.value = {
    name: '',
    typeId: null
  }
  addLayoutError.value = ''
  isCreateLayoutModalOpen.value = true
}

const closeAddLayoutModal = () => {
  isCreateLayoutModalOpen.value = false
  createFormData.value = {
    name: '',
    typeId: null
  }
  addLayoutError.value = ''
}

const submitAddLayout = async () => {
  try {
    addLayoutError.value = ''

    // Collect axis names from form data
    const axes = []
    if (selectedLayoutType.value?.axes) {
      for (let i = 0; i < selectedLayoutType.value.axes.length; i++) {
        const axisName = createFormData.value[`axis_${i}`]
        if (axisName) {
          axes.push(axisName)
        }
      }
    }

    const layoutData = {
      layout: {
        locationId: props.locationId,
        name: createFormData.value.name,
        typeId: createFormData.value.typeId,
        axes: axes.length > 0 ? axes : undefined,
      }
    }

    const { status, errors } = await createLayout(layoutData)

    if (status === 'SUCCESS') {
      closeAddLayoutModal()
      await reloadLocationArrangements(props.locationId)
    } else {
      // Handle server errors
      if (errors && errors.length > 0) {
        addLayoutError.value = errors.map(err => err.message).join(', ')
      } else {
        addLayoutError.value = 'Failed to add layout. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error adding layout:', error)
    addLayoutError.value = error.message || 'An unexpected error occurred.'
  }
}

</script>

<style scoped>
.arrangements-box {
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #f9f9f9;
}

.arrangements-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.arrangements-header h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}


.layout-name {
  font-weight: 500;
  color: #333;
  font-size: 13px;
}

.layout-subject {
  font-size: 11px;
  color: #666;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 10px;
}

.btn-add-layout {
  background-color: #28a745;
  color: white;
  white-space: nowrap;
}

.btn-add-layout:hover:not(:disabled) {
  background-color: #218838;
}

.loading,
.empty-state {
  text-align: center;
  padding: 20px;
  color: #666;
  font-size: 13px;
}

.layouts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layout-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.layout-item:hover {
  background-color: #e3f2fd;
}

.layout-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}


/* Axes section styling */
.axes-section {
  padding: 12px;
  background-color: #f0f8ff;
  border: 1px solid #d0e8ff;
  border-radius: 4px;
  margin-top: 8px;
}

.axes-section h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
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

.modal-close:hover:not(:disabled) {
  background-color: #e9ecef;
  border-radius: 50%;
}

.modal-close:disabled {
  cursor: not-allowed;
  opacity: 0.5;
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

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.error-message {
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  font-size: 14px;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>