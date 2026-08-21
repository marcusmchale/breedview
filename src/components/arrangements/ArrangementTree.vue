<script setup>
import { ref } from 'vue'

import ArrangementTreeNode from './ArrangementTreeNode.vue'

const props = defineProps({
  arrangementId: {
    type: String,
    required: true
  },
  layoutTypes: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['node-selected'])

const selectedNodeId = ref(null)

const handleNodeSelected = ( { nodeId, parentId } ) => {
  selectedNodeId.value = nodeId
  emit('node-selected', { nodeId: nodeId, parentId: parentId } )
}
</script>

<template>
  <div class="arrangement-tree">
    <h5>Arrangement Structure</h5>
    <ArrangementTreeNode
      :layoutId="arrangementId"
      :arrangementId="arrangementId"
      :selectedNodeId="selectedNodeId"
      @node-selected="handleNodeSelected"
    />
  </div>
</template>

<style scoped>
.arrangement-tree {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.arrangement-tree h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
}
</style>