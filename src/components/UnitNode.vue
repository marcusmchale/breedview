<template>
  <div v-if='!cachedUnit' class="unit-node">Loading...</div>
    <!--
    Redacted units won't have subject, don't present all the other options for these as they won't work
    But we do want to see the security details so we know who to contact to gain access
    And we need to see that one exists to prevent duplication
  -->
  <div v-else-if="!cachedUnit.subject">
    <div class="unit-info">
      <h6 class="unit-name">{{ cachedUnit.name || cachedUnit.id }}</h6>
      <ControllerBadge
        entity-label="UNIT"
        :entity-id="unitId"
      />
    </div>
  </div>

  <div v-else class="unit-header">
    <button
      v-if="cachedUnit.children && cachedUnit.children.length > 0"
      @click="toggleExpand"
      class="expand-btn"
      :class="{ expanded }"
    >
      ▶
    </button>
    <div v-else class="expand-placeholder"></div>

    <div class="unit-info">
      <h4 class="unit-name">
        {{ cachedUnit.name || `${cachedUnit.subject.name} ${cachedUnit.id}` }}
      </h4>
      <div class="unit-meta">
        <span class="subject-badge">{{ cachedUnit.subject.name }}</span>
        <span v-if="currentPosition" class="position-badge" @click="toggleExpandPosition">
          @ {{ currentPosition.location.name }}
        </span>
      </div>
      <p v-if="cachedUnit.description" class="unit-description">
        {{ cachedUnit.description }}
      </p>
      <!-- Position details when expanded -->
      <div v-if="positionExpanded && currentPosition" class="position-details">
        <div class="position-info">
          <strong>Current Position:</strong>
          <div class="position-content">
            <div>Location: {{ currentPosition.location.name }}</div>
            <div v-if="currentPosition.layout">
              Layout: {{ currentPosition.layout.name || `${currentPosition.layout.type.name} ${currentPosition.layout.type.id}` }}
            </div>
            <div v-if="currentPosition.coordinates && currentPosition.coordinates.length > 0">
              Coordinates: {{ currentPosition.coordinates.join(', ') }}
            </div>
            <div v-if="currentPosition.start">
              Start: {{ formatDate(currentPosition.start) }}
            </div>
            <div v-if="currentPosition.end">
              End: {{ formatDate(currentPosition.end) }}
            </div>
          </div>
        </div>

        <div v-if="cachedUnit.positions && cachedUnit.positions.length > 1" class="position-history">
          <button @click="showHistory = !showHistory" class="btn btn-sm btn-link">
            {{ showHistory ? 'Hide' : 'View' }} Position History ({{ cachedUnit.positions.length }})
          </button>

          <div v-if="showHistory" class="history-list">
            <div
              v-for="(pos, index) in cachedUnit.positions"
              :key="index"
              class="history-item"
            >
              <div v-if="removePositionLoading"> Removing position </div>
              <div v-else>
                <div>Location: {{ pos.location.name }}</div>
                <div v-if="pos.layout">Layout: {{ pos.layout.name || `${pos.layout.type.name} ${pos.layout.type.id}`}}</div>
                <div v-if="pos.coordinates && pos.coordinates.length > 0">
                  Coordinates: {{ pos.coordinates.join(', ') }}
                </div>
                <div v-if="pos.start">Start: {{ formatDate(pos.start) }}</div>
                <div v-if="pos.end">End: {{ formatDate(pos.end) }}</div>
                <button
                  @click="handleRemovePosition(pos)"
                  class="btn btn-sm btn-add-position"
                  title="Remove position record"
                >
                - Position
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions column -->
    <div v-if="!toolsExpanded" @click="toggleExpandTools">⋮</div>
    <div v-else class="actions" role="toolbar" aria-label="unit actions">
      <button @click="toggleExpandTools" class="modal-close">&times;</button>
      <button
        @click="openEditModal"
        class="btn btn-sm btn-edit"
        title="Update unit details"
      >
        ✎ Edit
      </button>

      <button
        @click="openAddChildModal"
        class="btn btn-sm btn-add-child"
        title="Add child unit"
      >
        + Add Child
      </button>

      <button
        @click="openAddPositionModal"
        class="btn btn-sm btn-add-position"
        title="Add position"
      >
        + Position
      </button>

      <button
        @click="openDeleteModal"
        class="btn btn-sm btn-danger"
        title="Delete unit"
      >
        Delete
      </button>

      <ControllerBadge
        entity-label="UNIT"
        :entity-id="cachedUnit.id"
      />

    </div>
  </div>

  <!-- Edit Modal -->
  <div v-if="isEditModalOpen" class="modal-overlay" @click="closeEditModal">
    <div class="modal modal-large" @click.stop>
      <div class="modal-header">
        <h4>Update Unit Details</h4>
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
          name="subjectId"
          label="Subject Type:"
          :options="subjectTypes.map(type => ({ value: type.id, label: type.name }))"
          validation="required"
        />

        <FormKit
          type="text"
          name="name"
          label="Name (optional):"
          placeholder="Enter unit name"
        />

        <FormKit
          type="textarea"
          name="description"
          label="Description (optional):"
          placeholder="Enter description"
        />

        <FormKit
          type="select"
          name="parentIds"
          label="Parent Units (optional):"
          :options="parentOptions"
          multiple
          help="Changing parents may cause block merges or splits"
        />

        <div v-if="editError" class="error-message">
          {{ editError }}
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="updateLoading">
            {{ updateLoading ? 'Updating...' : 'Update Unit' }}
          </button>
          <button
            type="button"
            @click="closeEditModal"
            class="btn btn-secondary"
            :disabled="updateLoading"
          >
            Cancel
          </button>
        </div>
      </FormKit>
    </div>
  </div>

  <!-- Add Position Modal -->
  <div v-if="isAddPositionModalOpen" class="modal-overlay" @click="closeAddPositionModal">
    <div class="modal modal-large" @click.stop>
      <div class="modal-header">
        <h4>Add Position</h4>
        <button @click="closeAddPositionModal" class="modal-close">&times;</button>
      </div>

      <FormKit
        v-model="positionFormData"
        type="form"
        @submit="submitAddPosition"
        :actions="false"
        class="modal-content"
      >
        <FormKit
          type="select"
          name="locationId"
          label="Location:"
          :options="locationOptions"
          validation="required"
          @input="handlePositionLocationChange"
        />

        <FormKit
          v-if="positionAvailableLayouts.length > 0"
          type="select"
          name="layoutId"
          label="Layout (optional):"
          placeholder="Select a layout"
          :options="positionLayoutOptions"
          @input="handlePositionLayoutChange"
        />

        <div v-if="positionLayoutAxes.length > 0" class="coordinates-section">
          <label>Coordinates:</label>
          <div class="coordinates-inputs">
            <FormKit
              v-for="(axis, index) in positionLayoutAxes"
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

        <div v-if="addPositionError" class="error-message">
          {{ addPositionError }}
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="addPositionLoading">
            {{ addPositionLoading ? 'Adding...' : 'Add Position' }}
          </button>
          <button
            type="button"
            @click="closeAddPositionModal"
            class="btn btn-secondary"
            :disabled="addPositionLoading"
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
        <h4>Delete Unit</h4>
        <button @click="closeDeleteModal" class="modal-close">&times;</button>
      </div>

      <div class="modal-content">
        <div v-if="deleteError" class="error-message">
          {{ deleteError }}
        </div>

        <p class="delete-warning">
          Are you sure you want to delete <strong>{{ cachedUnit.name || cachedUnit.subject.name }}</strong>?
        </p>
        <p v-if="cachedUnit.children.length > 0" class="delete-warning-children">
          ⚠️ This unit has {{ cachedUnit.children.length }} child unit(s).
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
    <div class="modal modal-large" @click.stop>
      <div class="modal-header">
        <h4>Add Child Unit</h4>
        <button @click="closeAddChildModal" class="modal-close" :disabled="createChildLoading">&times;</button>
      </div>

      <FormKit
        v-model="addChildFormData"
        type="form"
        @submit="submitAddChild"
        :actions="false"
        class="modal-content"
      >
        <div class="info-text">
          <strong>Parent Unit:</strong> {{ cachedUnit.name || cachedUnit.subject.name }}
        </div>

        <FormKit
          type="select"
          name="subjectId"
          label="Subject Type:"
          :options="subjectTypes.map(type => ({ value: type.id, label: type.name }))"
          validation="required"
        />

        <FormKit
          type="text"
          name="name"
          label="Name (optional):"
          placeholder="Enter unit name"
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
            label="Location (optional):"
            :options="locationOptions"
            placeholder="Select a location"
            @input="handleChildLocationChange"
          />

          <FormKit
            v-if="childAvailableLayouts.length > 0"
            type="select"
            name="positionLayoutId"
            label="Layout (optional):"
            placeholder="Select a layout"
            :options="childLayoutOptions"
            @input="handleChildLayoutChange"
          />

          <div v-if="childLayoutAxes.length > 0" class="coordinates-section">
            <label>Coordinates:</label>
            <div class="coordinates-inputs">
              <FormKit
                v-for="(axis, index) in childLayoutAxes"
                :key="index"
                type="text"
                :name="`coordinate_${index}`"
                :validation="`required`"
                :placeholder="`Enter ${axis}`"
              />
            </div>
          </div>

          <div class="date-inputs">
            <FormKit
              type="datetime-local"
              name="positionStart"
              label="Start Date/Time:"
            />

            <FormKit
              type="datetime-local"
              name="positionEnd"
              label="End Date/Time (optional):"
            />
          </div>
        </div>

        <div v-if="addChildError" class="error-message">
          {{ addChildError }}
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="createChildLoading">
            {{ createChildLoading ? 'Adding...' : 'Add Child Unit' }}
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

  <!-- Children -->
  <div v-if="expanded && cachedUnit.children.length > 0" class="children">
    <div v-for="childId in cachedUnit.children" :key="`unitNode_${childId}`" class="child-item">
      <UnitNode
        :unitId="childId"
        :unit-cache="unitCache"
        :location-cache="locationCache"
        :layout-cache="layoutCache"
        :subject-types="subjectTypes"
        @delete-units="$emit('delete-units', $event)"
        @load-units="$emit('load-units', $event)"
        @reload-units="$emit('reload-units', $event)"

      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { FormKit } from '@formkit/vue'
import { useMutation } from '@vue/apollo-composable'

import UPDATE_UNIT_MUTATION from '@/graphql/blocks/updateUnit.graphql'
import DELETE_UNIT_MUTATION from '@/graphql/blocks/deleteUnit.graphql'
import CREATE_UNIT_MUTATION from '@/graphql/blocks/createUnit.graphql'
import ADD_POSITION_MUTATION from '@/graphql/blocks/addPosition.graphql'
import REMOVE_POSITION_MUTATION from '@/graphql/blocks/removePosition.graphql'
import ControllerBadge from "@/components/ControllerBadge.vue";

const props = defineProps({
  unitId: {
    type: Number,
    required: true
  },
  subjectTypes: {
    type: Array,
    required: true
  }
})

const unitCache = inject('unitCache')
const layoutCache = inject('layoutCache')
const locationCache = inject('locationCache')

// destructure the required functions from passed caches
const { getUnit, getCurrentPosition, getAvailableParents } = unitCache
const { getRegionLocations, getLocationRegionId } = locationCache
const { getArrangementIds, getLayouts, getLayout } = layoutCache

const $emit = defineEmits([
  'delete-units',
  'load-units',
  'reload-units',
  'load-arrangements'
])

const expanded = ref(false)
const toggleExpand = () => {
  expanded.value = !expanded.value
}

const toolsExpanded = ref(false)
const toggleExpandTools = () => {
  toolsExpanded.value = !toolsExpanded.value
}

const positionExpanded = ref(false)
const toggleExpandPosition = () => {
  positionExpanded.value = !positionExpanded.value
}

// Get unit from cache
const cachedUnit = computed(() => {
  return getUnit(props.unitId)
})

if (cachedUnit.value) {
  $emit('load-units', cachedUnit.value.children)
}

const currentPosition = computed(() => {
  return getCurrentPosition(cachedUnit)
})

// Modal states
const isEditModalOpen = ref(false)
const isAddPositionModalOpen = ref(false)
const isAddChildModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const showHistory = ref(false)

// Form data
const updateFormData = ref({
  subjectId: null,
  name: '',
  description: '',
  parentIds: []
})

const positionFormData = ref({
  locationId: null,
  layoutId: null,
  start: null,
  end: null
})

const addChildFormData = ref({
  subjectId: null,
  name: '',
  description: '',
  positionLocationId: null,
  positionLayoutId: null,
  positionStart: null,
  positionEnd: null
})

// Error states
const editError = ref('')
const addPositionError = ref('')
const removePositionError = ref('')
const deleteError = ref('')
const addChildError = ref('')

// Layout selection for position modal
const positionAvailableLayouts = ref([])
const positionLayoutAxes = ref([])

// Layout selection for add child modal
const childAvailableLayouts = ref([])
const childLayoutAxes = ref([])

// Mutations
const { mutate: createUnit, loading: createChildLoading } = useMutation(CREATE_UNIT_MUTATION)
const { mutate: updateUnit, loading: updateLoading } = useMutation(UPDATE_UNIT_MUTATION)
const { mutate: deleteUnit, loading: deleteLoading } = useMutation(DELETE_UNIT_MUTATION)

const { mutate: addPosition, loading: addPositionLoading } = useMutation(ADD_POSITION_MUTATION)
const { mutate: removePosition, loading: removePositionLoading } = useMutation(REMOVE_POSITION_MUTATION)

// Drop down menu options
const locationOptions = computed(() => {
  const regionId = getLocationRegionId(props.locationId)
  return getRegionLocations(regionId).map(loc => ({
    value: loc.id,
    label: loc.name
  }))
})

const parentOptions = computed(() => {
  return getAvailableParents(props.unitId).map(unit => ({
      value: unit.id,
      label: unit.name || `${unit.subject.name} ${unit.id}`
    }))
})

const positionLayoutOptions = computed(() => {
  return positionAvailableLayouts.value.map(layout => ({
    value: layout.id,
    label: layout.name || `${layout.type.name} ${layout.type.id}`
  }))
})

const childLayoutOptions = computed(() => {
  return childAvailableLayouts.value.map(layout => ({
    value: layout.id,
    label: layout.name
  }))
})

// Edit Modal
const openEditModal = () => {
  updateFormData.value = {
    subjectId: cachedUnit.value.subject.id,
    name: cachedUnit.value.name || '',
    description:  cachedUnit.value.description || '',
    parentIds: cachedUnit.value.parents ? [...cachedUnit.value.parents] : []
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
    const oldParentIds = cachedUnit.value?.parents?.map(parent => parent.id) || null
    const response = await updateUnit({
      unit: {
        unitId: props.unitId,
        subjectId: updateFormData.value.subjectId,
        name: updateFormData.value.name || undefined,
        description: updateFormData.value.description || undefined,
        parentIds: updateFormData.value.parentIds || undefined
      }
    })

    if (response?.data?.blocksUpdateUnit) {
      const result = response.data.blocksUpdateUnit
      if (result.status === 'SUCCESS') {
        $emit('reload-units', [props.unitId, ...oldParentIds, ...updateFormData.value.parentIds])
        closeEditModal()
      } else {
        const errors = result.errors
        if (errors && errors.length > 0) {
          editError.value = errors.map(err => err.message).join(', ')
        } else {
          editError.value = 'Failed to update unit. Please try again.'
        }
      }
    }
  } catch (error) {
    console.error('Error updating unit:', error)
    editError.value = error.message || 'An unexpected error occurred.'
  }
}

// Add Position Modal
const openAddPositionModal = () => {
  const currentPos = currentPosition.value
  positionFormData.value = {
    locationId: currentPos?.location.id || null,
    layoutId: null,
    start: null,
    end: null
  }
  positionLayoutAxes.value = []
  addPositionError.value = ''
  isAddPositionModalOpen.value = true

  if (currentPos?.location.id) {
    handlePositionLocationChange(currentPos.location.id)
  }
}

const closeAddPositionModal = () => {
  isAddPositionModalOpen.value = false
  addPositionError.value = ''
}

const handlePositionLocationChange = async (locationId) => {
  positionAvailableLayouts.value = []
  positionLayoutAxes.value = []
  positionFormData.value.layoutId = null

  if (!locationId) return

  const arrangementIds = getArrangementIds(locationId)
  positionAvailableLayouts.value = getLayouts(arrangementIds)
}

const handlePositionLayoutChange = (layoutId) => {
  positionLayoutAxes.value = []

  if (!layoutId) return

  const layout = getLayout(layoutId)
  if (layout?.axes) {
    positionLayoutAxes.value = layout.axes
  }
}

const submitAddPosition = async () => {
  try {
    addPositionError.value = ''

    const coordinates = positionLayoutAxes.value.map((_, index) => {
      return positionFormData.value[`coordinate_${index}`] || ''
    })

    const response = await addPosition({
      unitId: props.unitId,
      position: {
        locationId: positionFormData.value.locationId,
        layoutId: positionFormData.value.layoutId || undefined,
        coordinates: coordinates.length > 0 ? coordinates : undefined,
        start: positionFormData.value.start || undefined,
        end: positionFormData.value.end || undefined
      }
    })

    if (response?.data?.blocksAddPosition) {
      const result = response.data.blocksAddPosition
      if (result.status === 'SUCCESS') {
        $emit('reload-units', [props.unitId])
        closeAddPositionModal()
      } else {
        const errors = result.errors
        if (errors && errors.length > 0) {
          addPositionError.value = errors.map(err => err.message).join(', ')
        } else {
          addPositionError.value = 'Failed to add position. Please try again.'
        }
      }
    }
  } catch (error) {
    console.error('Error adding position:', error)
    addPositionError.value = error.message || 'An unexpected error occurred.'
  }
}

const handleRemovePosition = (position) => {
  //todo remove position from cache for props.unitId, or just rely on reload when we get the response from submitRemove
  const {location, layout, coordinates, start, end } = position
  submitRemovePosition({locationId:location.id, layoutId:layout?.id, coordinates, start, end})
}


const submitRemovePosition = async (position) => {
  try {
    removePositionError.value = ''

    const response = await removePosition({
      unitId: props.unitId,
      position: position
    })

    if (response?.data?.blocksRemovePosition) {
      const result = response.data.blocksRemovePosition
      if (result.status === 'SUCCESS') {
        $emit('reload-units', [props.unitId])
      } else {
        const errors = result.errors
        if (errors && errors.length > 0) {
          addPositionError.value = errors.map(err => err.message).join(', ')
        } else {
          addPositionError.value = 'Failed to remove position. Please try again.'
        }
      }
    }
  } catch (error) {
    console.error('Error removing position:', error)
    addPositionError.value = error.message || 'An unexpected error occurred.'
  }
}



// Delete Modal
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
    const response = await deleteUnit({
      unitId: props.unitId
    })

    if (response?.data?.blocksDeleteUnit) {
      const result = response.data.blocksDeleteUnit
      if (result.status === 'SUCCESS') {
        $emit('delete-units', [props.unitId] )
        closeDeleteModal()
      } else {
        const errors = result.errors
        if (errors && errors.length > 0) {
          deleteError.value = errors.map(err => err.message).join(', ')
        } else {
          deleteError.value = 'Failed to delete unit. Please try again.'
        }
      }
    }
  } catch (error) {
    console.error('Error deleting unit:', error)
    deleteError.value = error.message || 'An unexpected error occurred.'
  }
}

// Add Child Modal
const openAddChildModal = () => {
  const currentPos = currentPosition.value
  addChildFormData.value = {
    subjectId: null,
    name: '',
    description: '',
    positionLocationId: currentPos?.location.id || null,
    positionLayoutId: null,
    positionStart: null,
    positionEnd: null
  }
  childLayoutAxes.value = []
  addChildError.value = ''
  isAddChildModalOpen.value = true

  if (currentPos?.location.id) {
    handleChildLocationChange(currentPos.location.id)
  }
}

const closeAddChildModal = () => {
  isAddChildModalOpen.value = false
  addChildError.value = ''
}

const handleChildLocationChange = async (locationId) => {
  childAvailableLayouts.value = []
  childLayoutAxes.value = []
  addChildFormData.value.positionLayoutId = null

  if (!locationId) return

  $emit('load-arrangements', locationId)

  const arrangementIds = getArrangementIds(locationId)
  childAvailableLayouts.value = getLayouts(arrangementIds)
}

const handleChildLayoutChange = (layoutId) => {
  childLayoutAxes.value = []

  if (!layoutId) return

  const layout = getLayout(layoutId)
  if (layout?.axes) {
    childLayoutAxes.value = layout.axes
  }
}

const submitAddChild = async () => {
  try {
    addChildError.value = ''

    const coordinates = childLayoutAxes.value.map((_, index) => {
      return addChildFormData.value[`coordinate_${index}`] || ''
    })

    const response = await createUnit({
      unit: {
        subjectId: addChildFormData.value.subjectId,
        name: addChildFormData.value.name || undefined,
        description: addChildFormData.value.description || undefined,
        parentIds: [props.unitId],
        childrenIds: []
      },
      position: {
        locationId: addChildFormData.value.positionLocationId,
        layoutId: addChildFormData.value.positionLayoutId || undefined,
        coordinates: coordinates.length > 0 ? coordinates : undefined,
        start: addChildFormData.value.positionStart || undefined,
        end: addChildFormData.value.positionEnd || undefined
      }
    })

    if (response?.data?.blocksCreateUnit) {
      const result = response.data.blocksCreateUnit
      if (result.status === 'SUCCESS') {
        $emit('reload-units', [props.unitId])
        closeAddChildModal()
      } else {
        const errors = result.errors
        if (errors && errors.length > 0) {
          addChildError.value = errors.map(err => err.message).join(', ')
        } else {
          addChildError.value = 'Failed to add child unit. Please try again.'
        }
      }
    }
  } catch (error) {
    console.error('Error adding child unit:', error)
    addChildError.value = error.message || 'An unexpected error occurred.'
  }
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  //const date = new Date(dateString)
  //return date.toLocaleString()
  return dateString
}


</script>

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