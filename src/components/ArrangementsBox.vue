
<template>
  <div class="arrangements-box">
    <div class="arrangements-header">
      <button
        v-if="arrangements.length === 0"
        @click="openAddLayoutModal"
        class="btn btn-sm btn-add-layout"
        title="Add root layout"
      >
        + Add Layout
      </button>
    </div>

    <div v-if="loading" class="loading">
      Loading layouts...
    </div>

    <div class="layouts-tree">
      <button
        v-for="layout in arrangements"
        :key="layout.id"
        class="btn btn-sm"
        @click.prevent="openViewLayoutModal(layout)"
      >
        {{ layout.name || 'Layout'}}
      </button>
    </div>

    <!-- Modal window for viewing layouts -->
    <div v-if="isViewLayoutModalOpen" class="modal-overlay" @click="closeViewLayoutModal">
      <div class="modal" @click.stop>
         <h4>{{ selectedLayout.name || 'Layout' }}</h4>
          <div class="layouts-tree">
            <LayoutNode
              v-for="layout in arrangements"
              :key="layout.id"
              :layoutId="layout.id"
              :allLayouts="allLayouts"
              :location-id="locationId"
              :layout-types="layoutTypes"
              @load-layouts="handleLoadLayouts"
              @reload-layouts="handleReloadLayouts"
              @delete-layouts="handleDeleteLayouts"
            />
          </div>

        <!-- Display layout details here, e.g., layout name, type, axes, etc. -->
        <button class="btn btn-secondary" @click="closeViewLayoutModal">Close</button>
      </div>
    </div>

    <!-- Add Layout Modal -->
    <div v-if="isAddLayoutModalOpen" class="modal-overlay" @click="closeAddLayoutModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h4>Add Layout</h4>
          <button @click="closeAddLayoutModal" class="modal-close" :disabled="createLoading">&times;</button>
        </div>

        <FormKit
          v-model="addLayoutFormData"
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
            <button type="submit" class="btn btn-primary" :disabled="createLoading">
              {{ createLoading ? 'Adding...' : 'Add Layout' }}
            </button>
            <button
              type="button"
              @click="closeAddLayoutModal"
              class="btn btn-secondary"
              :disabled="createLoading"
            >
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, computed, watch, reactive} from 'vue'
import { FormKit } from '@formkit/vue'
import { useMutation, useQuery, useLazyQuery } from '@vue/apollo-composable'

import LayoutNode from './LayoutNode.vue'
import LAYOUTS_QUERY from '@/graphql/arrangements/layouts.graphql'
import CREATE_LAYOUT_MUTATION from '@/graphql/arrangements/createLayout.graphql'
import ONTOLOGY_ENTRIES_QUERY from '@/graphql/ontology/entries.graphql'


const {locationId, arrangements, loading} = defineProps({
  locationId: {
    type: Number,
    required: true
  },
  arrangements: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const $emit = defineEmits(['reload-layouts'])

const selectedLayout = ref(null)
const isViewLayoutModalOpen = ref(false)

// create a reactive allLayouts map
// then we can load arrangements and children ad hoc and share this reference like a simple cache
const allLayouts = reactive({})

// we simplify the children to an array of IDs
const addLayout = (layout) => {
  const existingLayout = allLayouts[layout.id]
  const newChildren = layout.children
  ? layout.children.map(c => typeof c === 'object' ? c.id : c)
  : []

  if (existingLayout) {
    existingLayout.name = layout.name
    existingLayout.type = layout.type
    existingLayout.parent = layout.parent
    existingLayout.axes.splice(0, existingLayout.axes.length, ...layout.axes)
    existingLayout.children.splice(0, existingLayout.children.length, ...newChildren)
    console.log('updated layout: ',existingLayout)
  } else {
    allLayouts[layout.id] = {
      ...layout,
      children: newChildren
    }
  }
}


watch(
  () => arrangements,
  (arr) => {
    // clear map
    for (const key in allLayouts) {
      console.log('deleting key from allLayouts', key)
      delete allLayouts[key]
    }

    // repopulate
    for (const item of arr) {
      addLayout(item)
    }
  },
  { immediate: true, deep: true }
)

const openViewLayoutModal = (layout) => {
  console.log('view layout:', layout)
  selectedLayout.value = allLayouts[layout.id]
  isViewLayoutModalOpen.value = true
}

const closeViewLayoutModal = (layout) => {
  console.log('close layout:', layout)
  selectedLayout.value = null
  isViewLayoutModalOpen.value = false
}

// Fetch layout types from ontology
const { result: layoutTypesResult } = useQuery(
  ONTOLOGY_ENTRIES_QUERY,
  () => ({
    labels: ['LAYOUT_TYPE']
  })
)

const layoutTypes = computed(() => {
  if (!layoutTypesResult.value?.ontologyEntries?.result) {
    return []
  }
  return layoutTypesResult.value.ontologyEntries.result
})

// Add Layout Modal state
const isAddLayoutModalOpen = ref(false)
const addLayoutFormData = ref({
  name: '',
  typeId: null
})
const addLayoutError = ref('')

// Get the selected layout type
const selectedLayoutType = computed(() => {
  if (!addLayoutFormData.value.typeId) {
    return null
  }
  return layoutTypes.value.find(type => type.id === addLayoutFormData.value.typeId)
})

// Watch for layout type changes and reset axis fields
watch(() => addLayoutFormData.value.typeId, (newTypeId, oldTypeId) => {
  if (newTypeId !== oldTypeId) {
    // Clear axis fields when layout type changes
    const currentFormData = { ...addLayoutFormData.value }
    Object.keys(currentFormData).forEach(key => {
      if (key.startsWith('axis_')) {
        delete currentFormData[key]
      }
    })
    addLayoutFormData.value = currentFormData
  }
})

// Mutations
const { mutate: createLayoutMutation, loading: createLoading } = useMutation(CREATE_LAYOUT_MUTATION)

// Add Layout Modal functions
const openAddLayoutModal = () => {
  addLayoutFormData.value = {
    name: '',
    typeId: null
  }
  addLayoutError.value = ''
  isAddLayoutModalOpen.value = true
}

const closeAddLayoutModal = () => {
  isAddLayoutModalOpen.value = false
  addLayoutFormData.value = {
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
        const axisName = addLayoutFormData.value[`axis_${i}`]
        if (axisName) {
          axes.push(axisName)
        }
      }
    }

    const response = await createLayoutMutation({
      layout: {
        locationId: locationId,
        name: addLayoutFormData.value.name,
        typeId: addLayoutFormData.value.typeId,
        axes: axes.length > 0 ? axes : undefined,
      }
    })

    if (response?.data?.arrangementsCreateLayout) {
      const result = response.data.arrangementsCreateLayout
      if (result.status === 'SUCCESS') {
        $emit('reload-layouts')
        closeAddLayoutModal()
      } else {
        const errors = result.errors
        if (errors && errors.length > 0) {
          addLayoutError.value = errors.map(err => err.message).join(', ')
        } else {
          addLayoutError.value = 'Failed to add layout. Please try again.'
        }
      }
    }
  } catch (error) {
    console.error('Error adding layout:', error)
    addLayoutError.value = error.message || 'An unexpected error occurred while adding the layout.'
  }
}

// Store variables for lazy query
const layoutQueryVariables = ref({
  layoutIds: []
})


// Fetch layouts
const { load: loadLayoutsByIds, onResult: onLayoutsResult, refetch: refetchLayoutsByIds } = useLazyQuery(
  LAYOUTS_QUERY,
  () => layoutQueryVariables.value
)


onLayoutsResult((result) => {
  if (result?.data?.arrangementsLayouts?.result) {
    const newLayouts = result.data.arrangementsLayouts.result
    console.log('newLayouts result recieved')
    newLayouts.forEach((item) => {
      console.log('newitem', item)
      addLayout(item)
    })
  }
})

// Handle the load-layouts events triggerred by child components
const handleLoadLayouts = (layoutIds) => {
  layoutQueryVariables.value = {layoutIds: layoutIds.filter(Boolean)}
  loadLayoutsByIds()
}

// Handle the load-layouts events triggerred by child components
const handleReloadLayouts = (layoutIds) => {
  console.log('reload layouts:', layoutIds)
  layoutQueryVariables.value = {layoutIds: layoutIds.filter(Boolean)}
  refetchLayoutsByIds()
}

const handleDeleteLayouts = (layoutIds) => {
  console.log('Remove layouts from cache')
  layoutIds.forEach(layoutId => {
    delete allLayouts[layoutId]
  })
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

.layouts-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
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