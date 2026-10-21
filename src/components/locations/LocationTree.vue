
<script setup>
import { ref, watch } from "vue";

import LocationNode from "@/components/locations/LocationNode.vue";

import { useLocationTreeNavigation } from "@/composables/locations/locationTreeNavigation";
import { useLocationTreeQueries} from "@/composables/locations/locationTreeQueries";

const props = defineProps({
  // the page's location: highlighted, and the tree opened down to it
  selectedLocationId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['location-selected'])

const enableCountries = ref(false)

const {
  locationTypes,
  locationTypesLoading,
  locationTypesError,

  regions,
  regionsLoading,
  regionsError,

  loadChildLocations,
  loadParentId
} = useLocationTreeQueries(enableCountries)

const {
    isExpanded,
    handleToggleExpanded,
    expandTo
} = useLocationTreeNavigation(loadChildLocations, loadParentId)

const highlightedLocationId = ref(props.selectedLocationId)
watch(() => props.selectedLocationId, async (locationId) => {
  highlightedLocationId.value = locationId
  if (locationId) await expandTo(locationId)
}, { immediate: true })

const handleSelectLocationAndEmit = (locationId) => {
  highlightedLocationId.value = locationId
  emit('location-selected', locationId)
}

</script>

<template>

  <div v-if="locationTypesLoading" class="loading">
    Loading location types...
  </div>
  <div v-else-if="locationTypesError" class="error">
    Error loading location types! {{ locationTypesError }}
  </div>
  <div v-if="regionsLoading" class="loading">
    Loading location trees…
  </div>
  <div v-else-if="regionsError" class="error">
    Error loading location trees!
  </div>
  <div v-else-if="regions.length === 0" class="empty-state">
    No location trees found.
  </div>
  <div v-else class="regions-tree">
    <div v-for="region in regions" :key="`locationNode_${region?.id}`" class="location-item">
      <LocationNode
          :regionId="region?.id"
          :locationId="region?.id"
          :isExpandedFn="isExpanded"
          :locationTypes="locationTypes"
          :selectedLocationId="highlightedLocationId"
          @toggle-expand="handleToggleExpanded"
          @select-location="handleSelectLocationAndEmit"
      />
    </div>
  </div>


</template>


<style scoped>

.loading,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 16px;
}

.regions-tree {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.location-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
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
  z-index: 1000;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}


.form-group label {
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}


.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 8px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>