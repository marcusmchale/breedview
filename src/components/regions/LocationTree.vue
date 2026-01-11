<template>
  <button v-if="showEdit" @click="openModal" class="btn btn-primary">
    Register New Region
  </button>
  <div v-if="locationTypesLoading" class="loading">
    Loading location types...
  </div>
  <div v-else-if="locationTypesError" class="error">
    Error loading location types!
  </div>
  <div v-if="regionsLoading" class="loading">
    Loading regions...
  </div>
  <div v-else-if="regionsError" class="error">
    Error loading regions!
  </div>
  <div v-else-if="regions.length === 0" class="empty-state">
    No regions found.
  </div>
  <div v-else class="regions-tree">
    <div v-for="region in regions" :key="`locationNode_${region?.id}`" class="location-item">
      <LocationNode
          :regionId="region?.id"
          :locationId="region?.id"
          :isExpandedFn="isExpanded"
          :locationTypes="locationTypes"
          :selectedLocationId="selectedLocationId"
          :showEdit="showEdit"
          @toggle-expand="handleToggleExpanded"
          @select-location="handleSelectLocationAndEmit"
      />
    </div>
  </div>

  <!-- Create Region Modal -->
  <div v-if="isModalOpen" class="modal-overlay" @click="closeModal">
    <CreateRegionModal
        :countries="countries"
        :countriesLoading="countriesLoading.value"
        :countriesError="countriesError"
        :enableCountries="enableCountries"
        @success="handleSuccess"
        @close="closeModal"
    />
  </div>
</template>

<script setup>
import { ref } from "vue";

import LocationNode from "@/components/regions/LocationNode.vue";
import CreateRegionModal from "@/components/regions/createRegionModal.vue";

import { useLocationTreeNavigation } from "@/composables/regions/locationTreeNavigation";
import { useLocationTreeQueries} from "@/composables/regions/locationTreeQueries";

const props = defineProps({
  showEdit: {
    type: Boolean,
    default: false
  },
  onLocationSelected: {
    type: Function,
    required: false
  }
})

const emit = defineEmits(['location-selected'])

const enableCountries = ref(false)

const {
  locationTypes,
  locationTypesLoading,
  locationTypesError,

  countries,
  countriesLoading,
  countriesError,

  regions,
  regionsLoading,
  regionsError,
  refetchRegions,

  loadChildLocations
} = useLocationTreeQueries(enableCountries, props.onLocationSelected)

const {
    isExpanded,
    handleToggleExpanded,
    handleSelectLocation,
    selectedLocationId
} = useLocationTreeNavigation(
    loadChildLocations
)

const handleSelectLocationAndEmit = (event) => {
  handleSelectLocation(event)
  emit('location-selected', event)
}


const handleSuccess = async () => {
  await refetchRegions()
}

const openModal = () => {
  enableCountries.value = true
  isModalOpen.value = true
}

const closeModal = () => {
    isModalOpen.value = false
}
const isModalOpen = ref(false)

</script>

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