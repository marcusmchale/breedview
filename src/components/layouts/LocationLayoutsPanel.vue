<script setup>
import { ref, watch } from 'vue'

import LayoutsBox from './LayoutsBox.vue'
import LayoutTree from './LayoutTree.vue'
import LayoutCard from './LayoutCard.vue'

import { useLayoutTypesQuery } from '@/composables/layouts/layoutTypesQuery'

// The layouts at one location: its layout trees, the selected tree, and the selected layout's card
const props = defineProps({
  locationId: {
    type: [String, Number],
    required: true
  }
})

const selectedArrangementId = ref(null)
const selectedNodeId = ref(null)
const selectedParentId = ref(null)
// read here, so that the tree and card have them once they load, however soon a layout is selected
const { layoutTypes } = useLayoutTypesQuery()
const arrangementTreeKey = ref(0)

watch(() => props.locationId, () => {
  selectedArrangementId.value = null
  selectedNodeId.value = null
})

const onArrangementSelected = (arrangementId) => {
  selectedArrangementId.value = arrangementId
  selectedNodeId.value = arrangementId
  arrangementTreeKey.value++
}

const onNodeSelected = ({ nodeId, parentId }) => {
  selectedNodeId.value = nodeId
  selectedParentId.value = parentId
}

const handleRefreshTree = () => {
  arrangementTreeKey.value++
}

const handleNodeDeleted = () => {
  selectedNodeId.value = null
  arrangementTreeKey.value++
}
</script>

<template>
  <div class="location-layouts-panel">
    <div class="top-row">
      <div class="box-panel">
        <LayoutsBox
          :locationId="locationId"
          @arrangement-selected="onArrangementSelected"
        />
      </div>

      <div class="tree-panel">
        <div v-if="!selectedArrangementId" class="empty-selection">
          <p>Select a layout tree to view its structure</p>
        </div>
        <LayoutTree
          v-else
          :key="arrangementTreeKey"
          :arrangementId="selectedArrangementId"
          :layoutTypes="layoutTypes"
          @node-selected="onNodeSelected"
        />
      </div>
    </div>

    <div v-if="selectedArrangementId" class="card-panel">
      <LayoutCard
        :layoutId="selectedNodeId"
        :parentId="selectedParentId"
        :arrangementId="selectedArrangementId"
        :layoutTypes="layoutTypes"
        @refresh-tree="handleRefreshTree"
        @node-deleted="handleNodeDeleted"
      />
    </div>
  </div>
</template>

<style scoped>
.location-layouts-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);  /* as wide as the page, whatever the width of its contents */
  gap: 20px;
}

.top-row {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 20px;
  min-height: 300px;
}

.box-panel,
.tree-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.empty-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: #999;
  font-size: 16px;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.card-panel {
  width: 100%;
}

/* too narrow for the tree beside the list: the tree goes below it */
@media (max-width: 700px) {
  .top-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
