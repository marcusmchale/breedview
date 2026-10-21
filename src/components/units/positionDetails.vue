<script setup>
import { computed } from "vue";

import { useMutatePositions } from "@/composables/units/mutatePositions";
import { sortPositions } from "@/composables/units/unitPositions";

const props = defineProps({
  unitId: {
    type: String,
    required: true
  },
  positions: {
    type: Array,
    required: true
  },
  editable: {
    type: Boolean,
    default: false
  }
})

const {
  removePosition,
  removePositionLoading,
  removePositionError
} = useMutatePositions({unitId: () => props.unitId} )

const emit = defineEmits(['position-updated', 'edit-position'])

// In time order, as the API lists them: each partial time as its period, so a position ending 2021 runs through the year
const positionsSorted = computed(() => sortPositions(props.positions))

const submitRemovePosition = async (position) => {
  try {
    removePositionError.value = ''

    const { status, errors } = await removePosition(position)

    if (status === 'SUCCESS') {
      emit('position-updated')
    } else {
      if (errors && errors.length > 0) {
        removePositionError.value = errors.map(err => err.message).join(', ')
      } else {
        removePositionError.value = 'Failed to remove position. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error removing position:', error)
    removePositionError.value = error.message || 'An unexpected error occurred.'
  }
}

// this is just in case we want to change the date formatting in the future
const formatDate = (dateString) => {
  if (!dateString) return ''
  return dateString
}

</script>

<template>
<div v-if="positions" class="position-history">
  <div v-if="removePositionLoading"> Removing position </div>
  <div v-else-if="removePositionError" class="error-message">
    {{ removePositionError }}
  </div>
  <div class="history-list">
    <div
      v-for="(pos, index) in positionsSorted"
      :key="index"
      class="history-item"
  >
      <div>
        Location:
        <router-link :to="{ name: 'Units', query: { location: pos.location.id, unit: unitId } }">{{ pos.location.name }}</router-link>
      </div>
      <div v-if="pos.layout">Layout: {{ pos.layout.name || `${pos.layout.type.name} ${pos.layout.type.id}`}}</div>
      <div v-if="pos.coordinates && pos.coordinates.length > 0">
        Coordinates: {{ pos.coordinates.join(', ') }}
      </div>
      <div v-if="pos.start">Start: {{ formatDate(pos.start) }}</div>
      <div v-if="pos.end">End: {{ formatDate(pos.end) }}</div>
      <div v-if="editable" class="position-actions">
        <button
          @click="emit('edit-position', pos)"
          class="btn btn-sm btn-add-position"
          title="Correct this position as entered"
        >
          Edit
        </button>
        <button
          @click="submitRemovePosition(pos)"
          class="btn btn-sm btn-add-position"
          title="Remove position record"
        >
          - Position
        </button>
      </div>
    </div>
  </div>
</div>
</template>

<style scoped>

.position-content > div {
  margin-bottom: 4px;
  color: #555;
}

.position-history {
  margin-top: 12px;
}

.position-actions {
  display: flex;
  gap: 6px;
  margin-top: 4px;
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

.btn-add-position {
  background-color: #ffc107;
  color: #333;
}

.btn-add-position:hover:not(:disabled) {
  background-color: #e0a800;
}


.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.modal-header h4 {
  margin: 0;
  color: #333;
  font-size: 18px;
}
.form-section h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.error-message {
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  font-size: 14px;
}
</style>