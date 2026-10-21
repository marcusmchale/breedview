<script setup>
import { watch } from 'vue'

import UnitTreeNode from './UnitTreeNode.vue'

import { useUnitQuery } from '@/composables/units/unitQuery'

// A unit graph's tree: its parent gives it a new key for another graph
const props = defineProps({
  blockId: {
    type: String,
    required: true
  },
  // the location the tree is shown at, for the units now elsewhere
  contextLocationId: {
    type: String,
    default: null
  },
  selectedNodeId: {
    type: String,
    default: null
  },
  // the units to open, e.g. the way down to the selected unit
  expandIds: {
    type: Set,
    default: () => new Set()
  }
})

const emit = defineEmits(['node-selected'])

const {
  unit: block,
  unitLoading: blockLoading,
  unitError: blockError
} = useUnitQuery(props.blockId)

// The root is selected when the tree opens without a unit to show
watch(block, (newBlock) => {
  if (newBlock && !props.selectedNodeId) {
    emit('node-selected', { nodeId: props.blockId })
  }
}, { immediate: true })
</script>

<template>
  <div class="unit-tree">
    <div v-if="blockLoading" class="loading">
      Loading units...
    </div>
    <div v-else-if="blockError" class="error">
      Error loading the unit graph: {{ blockError.message }}
    </div>
    <div v-else-if="block">
      <UnitTreeNode
        :unitId="blockId"
        :selectedNodeId="selectedNodeId"
        :contextLocationId="contextLocationId"
        :expandIds="expandIds"
        @node-selected="emit('node-selected', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.unit-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading,
.error {
  padding: 20px;
  text-align: center;
  color: #666;
  font-size: 14px;
}

.error {
  color: #d32f2f;
}
</style>