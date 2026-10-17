<script setup>
import { watch } from 'vue'
import HierarchicalSelectDropdown from '@/components/customInputs/HierarchicalSelectDropdown.vue'
import { useDefinePositionQueries } from '@/composables/units/definePositionQueries'
import { registerNames } from '@/composables/analysis/useAnalysisNames'

/** Selects a location and, optionally, a layout at it. Emits the selected layout for its axes. */
const props = defineProps({
  locationId: { type: [String, Number], default: null },
  layoutId: { type: [String, Number], default: null },
  layoutOptional: { type: Boolean, default: true }
})

const emit = defineEmits(['update:locationId', 'update:layoutId', 'layout'])

const {
  location,
  regions,
  loadChildLocations,
  childLocationsLoading,
  currentChildLocations,
  layout,
  arrangements,
  loadChildLayouts,
  childLayoutsLoading,
  currentChildLayouts
} = useDefinePositionQueries({
  locationId: () => props.locationId ?? null,
  layoutId: () => props.layoutId ?? null
})

watch(location, (l) => l && registerNames('location', [l]), { immediate: true })
watch(layout, (l) => emit('layout', l ?? null), { immediate: true })

const nodeLabel = (node) => node.name || `${node.type?.name ?? ''} ${node.id}`.trim()

const setLocation = (id) => {
  emit('update:locationId', id)
  emit('update:layoutId', null)
}
</script>

<template>
  <div class="field-row">
    <div class="field">
      <span class="field-label">Location</span>
      <HierarchicalSelectDropdown
        :model-value="locationId"
        :selected="location"
        :root-nodes="regions ?? []"
        :load-children-fn="loadChildLocations"
        :children-loading="!!childLocationsLoading"
        :current-children="currentChildLocations ?? []"
        :get-node-label-fn="nodeLabel"
        placeholder="Select a location"
        @update:model-value="setLocation"
      />
    </div>
    <div class="field">
      <span class="field-label">
        Layout{{ layoutOptional ? ' (optional)' : '' }}
        <button v-if="layoutId" type="button" class="btn-link" @click="emit('update:layoutId', null)">Clear</button>
      </span>
      <HierarchicalSelectDropdown
        :key="`layout-${locationId}`"
        :model-value="layoutId"
        :selected="layout"
        :root-nodes="arrangements ?? []"
        :load-children-fn="loadChildLayouts"
        :children-loading="!!childLayoutsLoading"
        :current-children="currentChildLayouts ?? []"
        :get-node-label-fn="nodeLabel"
        :disabled="!locationId"
        placeholder="Any layout"
        @update:model-value="emit('update:layoutId', $event)"
      />
    </div>
  </div>
</template>
