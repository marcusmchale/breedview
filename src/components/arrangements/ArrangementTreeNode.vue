<script setup>
import { ref } from 'vue'

import { useLayoutNodeQueries } from "@/composables/arrangements/layoutNodeQueries"

const props = defineProps({
  layoutId: {
    type: String,
    required: true
  },
  arrangementId: {
    type: String,
    required: true
  },
  selectedNodeId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['node-selected'])

const {
  layout,
  layoutLoading,
  layoutError,
  loadChildLayouts,
  childLayoutsLoading,
  childLayoutsError
} = useLayoutNodeQueries({ layoutId: props.layoutId })

// Expanded state for tree
const expanded = ref(false)
const toggleExpand = () => {
  expanded.value = !expanded.value
  if (expanded.value) {
    loadChildLayouts(props.layoutId)
  }
}

const handleNodeClick = () => {
  emit('node-selected', { nodeId: props.layoutId, parentId: null })
}

const handleChildNodeSelected = ( { nodeId, parentId } ) => {
  if (parentId == null && layout.value?.children.some((child) => (child.id))) {
    emit('node-selected', { nodeId: nodeId, parentId: props.layoutId } )
  } else {
    emit('node-selected', { nodeId: nodeId, parentId: parentId } )
  }
}
</script>

<template>
  <div class="tree-node">
    <div v-if="layoutLoading" class="loading">Loading...</div>
    <div v-else-if="layoutError" class="error">
      Error loading layout: {{ layoutError.message }}
    </div>
    <div v-else-if="layout">
      <div
        class="node-header"
        :class="{ selected: selectedNodeId === layoutId }"
        @click="handleNodeClick"
      >
        <button
          v-if="layout.children && layout.children.length > 0"
          @click.stop="toggleExpand"
          class="expand-btn"
          :class="{ expanded }"
        >
          ▶
        </button>
        <div v-else class="expand-placeholder"></div>

        <div class="node-info">
          <span class="node-name">{{ layout.name || `${layout.type?.name || 'Layout'} ${layout.id}` }}</span>
          <div class="node-meta">
            <span v-if="layout.type" class="type-badge">{{ layout.type.name }}</span>
            <span v-if="layout.children && layout.children.length > 0" class="count">
              {{ layout.children.length }} child{{ layout.children.length !== 1 ? 'ren' : '' }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="expanded && layout.children && layout.children.length > 0" class="children">
        <div v-if="childLayoutsLoading" class="loading">Loading children...</div>
        <div v-else-if="childLayoutsError" class="error">
          Error loading children: {{ childLayoutsError.message }}
        </div>
        <div v-else>
          <ArrangementTreeNode
            v-for="child in layout.children"
            :key="child.id"
            :layoutId="child.id"
            :arrangementId="arrangementId"
            :selectedNodeId="selectedNodeId"
            @node-selected="handleChildNodeSelected"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-node {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.node-header:hover {
  background-color: #f5f5f5;
  border-color: #bbb;
}

.node-header.selected {
  background-color: #e3f2fd;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
}

.expand-btn,
.expand-placeholder {
  min-width: 20px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: #666;
  font-size: 10px;
  transition: transform 0.2s;
}

.expand-btn.expanded {
  transform: rotate(90deg);
}

.expand-btn:hover {
  color: #333;
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-name {
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.type-badge {
  display: inline-block;
  background: #e8f5e9;
  color: #2e7d32;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.count {
  font-size: 11px;
  color: #999;
}

.children {
  margin-left: 28px;
  margin-top: 8px;
  padding-left: 8px;
  border-left: 2px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading,
.error {
  padding: 8px;
  font-size: 12px;
  color: #666;
}

.error {
  color: #d32f2f;
}
</style>