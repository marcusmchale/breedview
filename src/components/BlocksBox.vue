<template>
  <div class="blocks-box">
    <div class="blocks-header">
      <h5>Blocks</h5>
      <button
          @click="openCreateModal"
          class="btn btn-sm btn-create"
          title="Create new block"
      >
        + New Block
      </button>
    </div>

    <div v-if="blocksLoading" class="loading-state">
      Loading blocks...
    </div>

    <div v-else-if="blockUnits.length === 0" class="empty-state">
      No blocks at this location
    </div>

    <div v-else class="blocks-list">
      <div
        v-for="block in blockUnits"
        :key="block.id"
        class="block-item"
        @click="openUnitModal(block)"
      >
        <span class="block-name">{{ block.name || `${block.subject?.name} ${block.id}` }}</span>
        <span class="block-subject">{{ block.subject?.name }}</span>
      </div>
    </div>

    <!-- Create Unit Modal -->
    <div v-if="isCreateModalOpen" class="modal-overlay" @click="closeCreateModal">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
          <h4>Create New Block</h4>
          <button @click="closeCreateModal" class="modal-close" :disabled="createLoading">&times;</button>
        </div>

        <FormKit
          v-model="createFormData"
          type="form"
          @submit="submitCreate"
          :actions="false"
          class="modal-content"
        >
          <FormKit
            type="select"
            name="subjectId"
            label="Subject Type:"
            :options="subjectTypes.map(type => ({ value: type.id, label: type.name }))"
            validation="required"
            placeholder="Select a subject type"
            help="The type of experimental unit (e.g., field, plot, tree)"
          />

          <FormKit
            type="text"
            name="name"
            label="Name (optional):"
            placeholder="Enter a name for this unit"
          />

          <FormKit
            type="textarea"
            name="description"
            label="Description (optional):"
            placeholder="Enter description"
          />

          <div class="form-section">
            <h5>Initial Position</h5>

            <FormKit
              type="select"
              name="positionLocationId"
              label="Location:"
              :options="locationOptions"
              validation="required"
              @input="handleLocationChange"
            />

            <FormKit
              v-if="availableLayouts.length > 0"
              type="select"
              name="positionLayoutId"
              label="Layout (optional):"
              placeholder="Select a layout"
              :options="layoutOptions"
              @input="handleLayoutChange"
            />

            <div v-if="selectedLayoutAxes.length > 0" class="coordinates-section">
              <label>Coordinates:</label>
              <div class="coordinates-inputs">
                <FormKit
                  v-for="(axis, index) in selectedLayoutAxes"
                  :key="index"
                  type="text"
                  :name="`coordinate_${index}`"
                  :label="axis"
                  :validation="`required`"
                  :placeholder="`Enter ${axis}`"
                />
              </div>
            </div>

            <div class="date-inputs">
              <FormKit
                type="text"
                name="positionStart"
                label="Start Date/Time (optional):"
                placeholder="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
                validation="partialDateTime"
              />

              <FormKit
                type="text"
                name="positionEnd"
                label="End Date/Time (optional):"
                placeholder="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
                validation="partialDateTime"
              />
            </div>
          </div>

          <div v-if="createError" class="error-message">
            {{ createError }}
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary" :disabled="createLoading">
              {{ createLoading ? 'Creating...' : 'Create Block' }}
            </button>
            <button
              type="button"
              @click="closeCreateModal"
              class="btn btn-secondary"
              :disabled="createLoading"
            >
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>

    <!-- Unit Details Modal -->
    <div v-if="selectedUnit" class="modal-overlay" @click="closeUnitModal">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
          <h4>{{ selectedUnit.name || `${selectedUnit.subject.name} ${selectedUnit.id}` }}</h4>
          <button @click="closeUnitModal" class="modal-close">&times;</button>
        </div>

        <div class="unit-details">
          <UnitNode
            :unitId="selectedUnit.id"
            :subjectTypes="subjectTypes"
            @load-units="handleLoadUnits"
            @reload-units="handleReloadUnits"
            @delete-units="handleDeleteUnits"
            @load-arrangements="$emit('load-arrangements', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import { FormKit } from '@formkit/vue'
import { useMutation, useLazyQuery, useApolloClient } from '@vue/apollo-composable'

import UnitNode from "@/components/UnitNode.vue";

import CREATE_UNIT_MUTATION from '@/graphql/blocks/createUnit.graphql'
import UNITS_QUERY from "@/graphql/blocks/units.graphql";

const { client } = useApolloClient()

const props = defineProps({
  locationId: {
    type: Number,
    required: true
  },
  blocksLoading: {
    type: Boolean,
    default: false
  },
  subjectTypes: {
    type: Array,
    required: true
  }
})

const locationCache = inject("locationCache")
const unitCache = inject("unitCache")
const layoutCache = inject("layoutCache")

const $emit = defineEmits(['reload-blocks', 'load-arrangements'])

const { addUnit, removeUnit, getBlockIds, getUnits } = unitCache
const { getLocation } = locationCache
const { getArrangementIds, getLayout, getLayouts } = layoutCache

// Get blocks for this location
const blockUnits = computed(() => {
  const blockIds = getBlockIds(props.locationId)
  return getUnits(blockIds)
})

// Create Modal state
const isCreateModalOpen = ref(false)
const createFormData = ref({
  subjectId: null,
  name: '',
  description: '',
  positionLocationId: props.locationId,
  positionLayoutId: null,
  positionStart: null,
  positionEnd: null
})
const createError = ref('')
const showHistory = ref(false)

// Unit Details Modal
const selectedUnit = ref(null)

// Layout selection state
const selectedLocationId = ref(props.locationId)
const selectedLayoutId = ref(null)
const availableLayouts = ref([])
const selectedLayoutAxes = ref([])

// Mutations and Queries
const { mutate: createUnit, loading: createLoading } = useMutation(CREATE_UNIT_MUTATION)

// Location options for position
const locationOptions = computed(() => {
  const locations = []
  const currentLocation = getLocation(props.locationId)
  if (currentLocation) {
    locations.push({
      value: currentLocation.id,
      label: currentLocation.name
    })
  }
  return locations
})

// Layout options
const layoutOptions = computed(() => {
  if (availableLayouts.value.length === 0) return []

  return availableLayouts.value.map(layout => ({
    value: layout.id,
    label: layout.name
  }))
})

// Handle location change in form
const handleLocationChange = async (locationId) => {
  selectedLocationId.value = locationId
  selectedLayoutId.value = null
  selectedLayoutAxes.value = []
  availableLayouts.value = []

  if (!locationId) return

  // Load arrangements for this location
  $emit('load-arrangements', locationId)
  const arrangementIds = getArrangementIds(locationId)
  availableLayouts.value = getLayouts(arrangementIds)
}

// Handle layout change in form
const handleLayoutChange = (layoutId) => {
  selectedLayoutId.value = layoutId

  if (!layoutId) {
    selectedLayoutAxes.value = []
    return
  }

  const layout = getLayout(layoutId)
  if (layout?.axes) {
    selectedLayoutAxes.value = layout.axes
  } else {
    selectedLayoutAxes.value = []
  }
}

// Initialize layouts for current location
watch(() => props.locationId, async (newLocationId) => {
  if (newLocationId) {
    const arrangementIds = getArrangementIds(newLocationId)
    if (arrangementIds.length > 0) {
      availableLayouts.value = getLayouts(arrangementIds)
    }
  }
}, { immediate: true })

const openCreateModal = () => {
  createFormData.value = {
    subjectId: null,
    name: '',
    description: '',
    positionLocationId: props.locationId,
    positionLayoutId: null,
    positionStart: null,
    positionEnd: null
  }
  selectedLayoutAxes.value = []
  createError.value = ''
  isCreateModalOpen.value = true

  // Load layouts if not already loaded
  if (availableLayouts.value.length === 0) {
    handleLocationChange(props.locationId)
  }
}

const closeCreateModal = () => {
  isCreateModalOpen.value = false
  createFormData.value = {
    subjectId: null,
    name: '',
    description: '',
    positionLocationId: props.locationId,
    positionLayoutId: null,
    positionStart: null,
    positionEnd: null
  }
  selectedLayoutAxes.value = []
  createError.value = ''
}



const submitCreate = async () => {
  try {
    createError.value = ''
    // Build coordinates array from individual inputs
    const coordinates = selectedLayoutAxes.value.map((_, index) => {
      return createFormData.value[`coordinate_${index}`] || ''
    })

    // Build position object
    const position = {
      locationId: createFormData.value.positionLocationId,
      layoutId: createFormData.value.positionLayoutId || undefined,
      coordinates: coordinates.length > 0 ? coordinates : undefined,
      start: createFormData.value.positionStart || undefined,
      end: createFormData.value.positionEnd || undefined
    }
    const response = await createUnit({
      unit: {
        subjectId: createFormData.value.subjectId,
        name: createFormData.value.name || undefined,
        description: createFormData.value.description || undefined,
        parentIds: [], // New block has no parents
        childrenIds: []
      },
      position: position
    })

    if (response?.data?.blocksCreateUnit) {
      const result = response.data.blocksCreateUnit
      if (result.status === 'SUCCESS') {
        $emit('reload-blocks', props.locationId)
        closeCreateModal()
      } else {
        const errors = result.errors
        if (errors && errors.length > 0) {
          createError.value = errors.map(err => err.message).join(', ')
        } else {
          createError.value = 'Failed to create block. Please try again.'
        }
      }
    }
  } catch (error) {
    console.error('Error creating block:', error)
    createError.value = error.message || 'An unexpected error occurred.'
  }
}

const openUnitModal = (unit) => {
  selectedUnit.value = unit
  showHistory.value = false
}

const closeUnitModal = () => {
  selectedUnit.value = null
  showHistory.value = false
}

const unitsQueryVariables = ref({
  unitIds: []
})

// Fetch units by IDs
const {
  load: loadUnitsByIds,
  onResult: onUnitsResult,
  refetch: reloadUnitsByIds
} = useLazyQuery(
  UNITS_QUERY,
  () => unitsQueryVariables.value
)

onUnitsResult((result) => {
  console.log('units result', result)
  if (result?.data?.blocksUnits?.result) {
    const units = result.data.blocksUnits.result
    units.forEach(unit => {
      addUnit(unit)
    })
  }
})

// Handle the load-units events triggerred by child components
const handleLoadUnits = (unitIds) => {
  unitsQueryVariables.value = {unitIds: unitIds.filter(Boolean)}
  loadUnitsByIds()
}

// Handle the load-units events triggerred by child components
// this is a little complicated
// as we may have fetched a unit in the blocks query and are now reloading it with units query
// so we check the apollo cache manually to decide whether to load/reload (reload won't run if not already loaded)
const handleReloadUnits = (unitIds) => {
  const newVars = {unitIds: unitIds.filter(Boolean)}

  const cached = client.cache.readQuery({
    query: UNITS_QUERY,
    variables: newVars
  })

  unitsQueryVariables.value = newVars
  if (cached?.blocksUnits?.result) {
    reloadUnitsByIds()
  } else {
    loadUnitsByIds()
  }
}

const handleDeleteUnits = (unitIds) => {
  console.log('unitIds')
  unitIds.forEach(unitId => {
    removeUnit(unitId, props.locationId)
    if (selectedUnit.value === unitId) {
      closeUnitModal()
    }
  })

  $emit('reload-blocks', props.locationId)
}


</script>

<style scoped>
.blocks-box {
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.blocks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.blocks-header h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.btn-create {
  padding: 4px 10px;
  font-size: 12px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-create:hover {
  background-color: #218838;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 12px;
  color: #666;
  font-size: 13px;
  font-style: italic;
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.block-item {
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

.block-item:hover {
  background-color: #e3f2fd;
}

.block-name {
  font-weight: 500;
  color: #333;
  font-size: 13px;
}

.block-subject {
  font-size: 11px;
  color: #666;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 10px;
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

.unit-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-section label {
  font-weight: 600;
  font-size: 14px;
  color: #555;
}

.detail-section span,
.detail-section p {
  font-size: 14px;
  color: #333;
  margin: 0;
}

.text-muted {
  color: #999 !important;
  font-style: italic;
}

.position-info {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.position-info > div {
  margin-bottom: 6px;
  font-size: 13px;
}

.position-info > div:last-child {
  margin-bottom: 0;
}

.history-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  padding: 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}

.history-item > div {
  margin-bottom: 4px;
}

.history-item > div:last-child {
  margin-bottom: 0;
}


:deep(.formkit-list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.formkit-list-item) {
  display: flex;
  gap: 8px;
  align-items: center;
}

:deep(.formkit-list-item input) {
  flex: 1;
}

</style>