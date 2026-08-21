<script setup>
import { ref, watch } from 'vue'

import BlockTreeNode from './BlockTreeNode.vue'

import { useUnitQuery } from '@/composables/blocks/unitQuery'

const props = defineProps({
  blockId: {
    type: String,
    required: true
  },
  subjects: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['node-selected'])

const unitTreeKey = ref(0)

const {
  unit: block,
  unitLoading: blockLoading,
  unitError: blockError
} = useUnitQuery(props.blockId)

const selectedNodeId = ref(null)

watch(() => props.blockId, () => {
  selectedNodeId.value = props.blockId
  emit('node-selected', { nodeId: props.blockId, parentId: null })
  unitTreeKey.value++
})

const handleNodeSelected = ({ nodeId, parentId }) => {
  selectedNodeId.value = nodeId
  emit('node-selected', { nodeId, parentId })
}

const handleRefresh = () => {
  unitTreeKey.value++
}

// Automatically select the root block when loaded
watch(block, (newBlock) => {
  if (newBlock && !selectedNodeId.value) {
    selectedNodeId.value = props.blockId
    emit('node-selected', { nodeId: props.blockId, parentId: null })
  }
})
</script>

<template>
  <div class="unit-tree">
    <div v-if="blockLoading" class="loading">
      Loading block structure...
    </div>
    <div v-else-if="blockError" class="error">
      Error loading block: {{ blockError.message }}
    </div>
    <div v-else-if="block">
      <BlockTreeNode
        :key="unitTreeKey"
        :unitId="blockId"
        :blockId="blockId"
        :selectedNodeId="selectedNodeId"
        @node-selected="handleNodeSelected"
        @refresh="handleRefresh"
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