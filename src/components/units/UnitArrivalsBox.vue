<script setup>
import { computed, ref, watch } from 'vue'

import { useUnitArrivalsQuery } from '@/composables/units/unitArrivalsQuery'
import { arrivalParam } from '@/composables/units/unitPlaces'

// The arrivals at a location: the units that came there together from elsewhere in their unit graphs, newest first
const props = defineProps({
  locationId: {
    type: String,
    required: true
  },
  // only the arrivals of the units at, below or above this unit
  unitId: {
    type: String,
    default: null
  },
  // the selected arrival's start, as the page's address has it (arrivalParam)
  selectedArrival: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['arrival-selected', 'arrivals-loaded'])

const {
  arrivals,
  arrivalsLoading,
  arrivalsError
} = useUnitArrivalsQuery({
  locationIds: computed(() => [props.locationId]),
  unitId: () => props.unitId
})

// the panel opens the first when it was asked where a unit went
watch(arrivals, (list) => emit('arrivals-loaded', list), { immediate: true })

// An arrival is settled when none of its units is pending: each was derived from (e.g. microcuttings planted as
// plantlets in a unit graph of their own), moved on or used up. Settled arrivals are folded away below the others,
// except when following a unit, where every arrival of its units is where it went.
const isSettled = (arrival) => arrival.pendingUnitCount === 0
const folding = computed(() => !props.unitId)
const openArrivals = computed(() => (folding.value ? arrivals.value.filter((a) => !isSettled(a)) : arrivals.value))
const settledArrivals = computed(() => (folding.value ? arrivals.value.filter(isSettled) : []))
const showSettled = ref(false)
watch([() => props.selectedArrival, settledArrivals], ([selected, settled]) => {
  if (settled.some((arrival) => arrivalParam(arrival.start) === selected)) showSettled.value = true
}, { immediate: true })

const startLabel = (arrival) => (arrival.start ? `Arrived ${arrival.start}` : 'Undated')
const fromLabel = (arrival) => arrival.roots.map((root) => root.name || `Unit ${root.id}`).join(', ')
const derivedLabel = (arrival) => (arrival.derivedUnitCount ? ` · ${arrival.derivedUnitCount} derived from` : '')
</script>

<template>
  <div class="arrivals-box">
    <div class="arrivals-header">
      <h5>Arrivals</h5>
    </div>

    <div v-if="arrivalsLoading && !arrivals.length" class="loading">
      Loading arrivals...
    </div>
    <div v-else-if="arrivalsError" class="error">
      Error loading arrivals!
    </div>
    <div v-else-if="arrivals.length === 0" class="empty-state">
      {{ unitId ? 'None of these units came here' : 'No units came here from elsewhere' }}
    </div>
    <div v-else class="arrivals-list">
      <template v-for="arrival in [...openArrivals, ...(showSettled ? settledArrivals : [])]" :key="`arrival_${arrivalParam(arrival.start)}`">
        <button
          v-if="arrival === settledArrivals[0]"
          type="button"
          class="settled-toggle open"
          @click="showSettled = false"
        >
          ▾ Settled ({{ settledArrivals.length }})
        </button>
        <div
          class="arrival-item"
          :class="{ selected: selectedArrival === arrivalParam(arrival.start), settled: folding && isSettled(arrival) }"
          @click="emit('arrival-selected', arrival)"
        >
          <span class="arrival-start">{{ startLabel(arrival) }}</span>
          <span class="arrival-meta">
            {{ arrival.unitCount }} unit{{ arrival.unitCount !== 1 ? 's' : '' }} · from {{ fromLabel(arrival) }}{{ derivedLabel(arrival) }}
          </span>
        </div>
      </template>
      <button
        v-if="settledArrivals.length && !showSettled"
        type="button"
        class="settled-toggle"
        title="Arrivals whose units were all derived from, moved on or used up"
        @click="showSettled = true"
      >
        ▸ Settled ({{ settledArrivals.length }})
      </button>
    </div>
  </div>
</template>

<style scoped>
.arrivals-box {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #f9f9f9;
}

.arrivals-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.arrivals-header h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.loading,
.empty-state,
.error {
  text-align: center;
  padding: 20px;
  color: #666;
  font-size: 13px;
}

.error {
  color: #d32f2f;
}

.arrivals-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.arrival-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.arrival-item:hover {
  background-color: #f5f5f5;
  border-color: #bbb;
}

.arrival-item.selected {
  background-color: var(--brand-accent-light);
  border-color: var(--brand-accent);
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
}

.arrival-start {
  font-weight: 500;
  color: #333;
  font-size: 13px;
}

.arrival-meta {
  font-size: 11px;
  color: #666;
}

.arrival-item.settled {
  background: #fafafa;
}

.arrival-item.settled .arrival-start {
  color: #777;
}

.settled-toggle {
  align-self: flex-start;
  padding: 2px 0;
  border: none;
  background: none;
  color: var(--brand-accent-darker);
  cursor: pointer;
  font-size: 12px;
}
</style>
