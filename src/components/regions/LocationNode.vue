<script setup>

import { computed } from 'vue'

import { useLocationNodeQueries } from "@/composables/regions/locationNodeQueries";


const props = defineProps({
  regionId: {
    type: String,
    required: true
  },
  locationId: {
    type: String,
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
    type: String,
    default: null
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
  location: displayedLocation
}  = useLocationNodeQueries({
  locationId: props.locationId
})

const children = computed( () => {
  if (!displayedLocation.value?.children) return []
  return [...displayedLocation.value.children].sort((a,b) => a?.name?.localeCompare(b?.name) )
})


</script>

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
        <div class="location-meta">
          <span v-if="displayedLocation.id" class="address">{{ displayedLocation.id }}</span>
          <span v-if="displayedLocation.type" class="type-badge">{{ displayedLocation.type.name }}</span>
        </div>
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
          @toggle-expand="$emit('toggle-expand', $event)"
          @select-location="$emit('select-location', $event)"
        />

      </div>
    </div>




  </div>
</template>

<style scoped>
.modal-header h4 {
  margin: 0;
  color: #333;
  font-size: 18px;
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


.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}


</style>