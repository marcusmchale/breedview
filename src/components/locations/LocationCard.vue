<script setup>
import { computed, ref } from 'vue'
import ControllerBadge from '@/components/controls/ControllerBadge.vue'
import UpdateModal from "@/components/locations/updateLocationModal.vue";
import DeleteModal from "@/components/locations/deleteModal.vue";
import AddChildModal from "@/components/locations/addChildModal.vue";

import { useLocationNodeQueries } from "@/composables/locations/locationNodeQueries";
import { useCanCreate, useCanCurate } from '@/composables/controls/useWriteAccess'

const props = defineProps({
  locationId: {
    type: String,
    default: null
  },
  locationTypes: {
    type: Array,
    required: false,
    default: () => []
  },
  // coordinates currently drawn on the location map, or null when nothing is drawn
  drawnCoordinates: {
    type: Array,
    default: null
  },
  saveCoordinatesLoading: {
    type: Boolean,
    default: false
  },
  saveCoordinatesError: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['save-coordinates', 'discard-drawing'])

const drawnShapeDescription = computed(() => {
  const count = props.drawnCoordinates?.length ?? 0
  if (count === 0) return null
  if (count === 1) return 'a point'
  return `a polygon with ${count} points`
})

const saveCoordinates = () => {
  emit('save-coordinates', {
    locationId: props.locationId,
    coordinates: props.drawnCoordinates
  })
}

const {
    location,
    locationLoading,
    locationError,
    refetchLocation
}  = useLocationNodeQueries({
  locationId: () => props.locationId
})

const hasData = computed(() => !!location.value)

// Changing or removing it needs curate access to it; adding a child changes only the new one
const canCreate = useCanCreate()
const canCurate = useCanCurate({ entityLabel: 'LOCATION', entityId: () => props.locationId })

const displayFields = computed(() => {
  if (!location.value) return []
  const l = location.value
  return [
    { label: 'Name', value: l.name },
    { label: 'Type', value: l.type?.name },
    { label: 'Location tree', value: l.root?.name },
    { label: 'Parent', value: l.parent?.name },
    { label: 'Code', value: l.code },
    { label: 'Address', value: l.address },
    { label: 'Description', value: l.description },

  ].filter(f => f.value)
})

const coordinatesList = computed(() => {
  if (!location.value) return []
  return location.value.coordinates ?? []
})

const childrenList = computed(() => {
  if (!location.value) return []
  return location.value.children ?? []
})


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


//Delete modal state and events
const isDeleteModalOpen = ref(false)
const openDeleteModal = () => {
  isDeleteModalOpen.value = true
}
const closeDeleteModal = () => {
  isDeleteModalOpen.value = false
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
  await refetchLocation()
}



</script>

<template>
  <div v-if="locationLoading" class="card-loading">
    Loading location…
  </div>

  <div v-else-if="locationError" class="card-error">
    Failed to load the location: {{ locationError.message }}
  </div>

  <div v-else-if="hasData" class="details-card">
    <div class="card-header">
      <h2>{{ location.name }}</h2>
      <div class="card-actions">
        <button v-if="canCurate" @click="openEditModal" class="btn btn-sm btn-outline">
          ✏️ Edit
        </button>
        <button v-if="canCurate" @click="openDeleteModal" class="btn btn-sm btn-danger">
          🗑️ Delete
        </button>
        <button v-if="canCreate" @click="openAddChildModal" class="btn btn-sm btn-add-child">
          + Add Child
        </button>
        <ControllerBadge entityLabel="LOCATION" :entityId="location.id" />
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

      <!-- Coordinates; a country (a location without a parent) is shown by its outline, so has none -->
      <div v-if="location.parent" class="section">
        <h3 class="section-title">Coordinates</h3>

        <div v-if="drawnShapeDescription && canCurate" class="drawn-shape">
          <p class="drawn-shape-text">
            Drawn on map: <strong>{{ drawnShapeDescription }}</strong>.
            <template v-if="coordinatesList.length > 0">
              Saving replaces the {{ coordinatesList.length }} existing coordinate{{ coordinatesList.length !== 1 ? 's' : '' }} below.
            </template>
          </p>
          <div class="drawn-shape-actions">
            <button
              class="btn btn-sm btn-save"
              :disabled="saveCoordinatesLoading"
              @click="saveCoordinates"
            >
              {{ saveCoordinatesLoading ? 'Saving…' : `✓ Save as coordinates for ${location.name}` }}
            </button>
            <button
              class="btn btn-sm btn-outline"
              :disabled="saveCoordinatesLoading"
              @click="emit('discard-drawing')"
            >
              Discard
            </button>
          </div>
        </div>
        <p v-else-if="canCurate" class="coord-hint">
          Draw a marker or polygon on the map to set this location's coordinates.
        </p>
        <p v-if="saveCoordinatesError" class="coord-error">{{ saveCoordinatesError }}</p>

        <p v-if="coordinatesList.length === 0" class="coord-empty">No coordinates recorded.</p>
        <div v-else class="list">
          <div v-for="(coord, index) in coordinatesList" :key="index" class="list-item">
            <span class="coord-pair">
              {{ coord.latitude }}°, {{ coord.longitude }}°
            </span>
            <span v-if="coord.altitude != null" class="coord-extra">
              Alt: {{ coord.altitude }} m
            </span>
            <span v-if="coord.uncertainty != null" class="coord-extra">
              ±{{ coord.uncertainty }} m
            </span>
            <span v-if="coord.description" class="coord-extra">
              {{ coord.description }}
            </span>
          </div>
        </div>
      </div>

      <!-- Children -->
      <div v-if="childrenList.length > 0" class="section">
        <h3 class="section-title">Child Locations</h3>
        <div class="tag-list">
          <span v-for="child in childrenList" :key="child.id" class="tag">
            {{ child.name }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="isDeleteModalOpen" class="modal-overlay" @click="closeDeleteModal">
      <DeleteModal
          :location="location"
          @close="closeDeleteModal"
      />
    </div>


    <div v-if="isEditModalOpen" class="modal-overlay" @click="closeEditModal">
      <UpdateModal
        :locationTypes="locationTypes"
        :location="location"
        @close="closeEditModal"
        @success="handleUpdateSuccess"
      />
    </div>

    <div v-if="isAddChildModalOpen" class="modal-overlay" @click="closeAddChildModal">
      <AddChildModal
          :locationTypes="locationTypes"
          :parentLocation="location"
          @close="closeAddChildModal"
          @success="handleAddChildSuccess"
      />
    </div>

  </div>

</template>

<style scoped>
.card-loading {
  padding: 20px;
  color: #999;
  font-style: italic;
  text-align: center;
}

.card-error {
  padding: 20px;
  color: #dc3545;
  text-align: center;
}

.details-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;  /* the actions go below the name when they don't fit beside it */
  gap: 12px;
  padding: 20px;
  border-bottom: 2px solid #f0f0f0;
  background: linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%);
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
  max-width: 100%;
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

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  padding: 8px 12px;
  background: #f9f9f9;
  border-left: 3px solid #42a5f5;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #333;
}

.coord-pair {
  font-weight: 500;
}

.coord-extra {
  font-size: 0.82rem;
  color: #666;
}

.drawn-shape {
  margin-bottom: 12px;
  padding: 12px;
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  border-radius: 4px;
}

.drawn-shape-text {
  margin: 0 0 10px 0;
  font-size: 0.9rem;
  color: #333;
}

.drawn-shape-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.coord-hint,
.coord-empty {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  color: #666;
}

.coord-empty {
  font-style: italic;
  color: #999;
}

.coord-error {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  color: #dc3545;
}

.btn-save {
  background: #28a745;
  color: white;
}

.btn-save:hover:not(:disabled) {
  background: #218838;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
</style>