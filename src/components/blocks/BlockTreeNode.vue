<script setup>
import { ref } from 'vue'

import { useUnitNodeQueries } from '@/composables/blocks/unitNodeQueries'
import BlockTreeNode from "@/components/blocks/BlockTreeNode.vue";

const props = defineProps({
  unitId: {
    type: String,
    required: true
  },
  blockId: {
    type: String,
    required: true
  },
  selectedNodeId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['node-selected', 'refresh'])

const {
  unit,
  unitLoading,
  unitError,
  loadChildUnits,
  childUnitsLoading,
  childUnitsError
} = useUnitNodeQueries({ unitId: props.unitId })

// Expanded state for tree
const expanded = ref(false)
const toggleExpand = () => {
  expanded.value = !expanded.value
  if (expanded.value) {
    loadChildUnits(props.unitId)
  }
}

const handleNodeClick = () => {
  emit('node-selected', { nodeId: props.unitId, parentId: null })
}

const handleChildNodeSelected = ({ nodeId, parentId }) => {
  if (parentId == null && unit.value?.children.some((child) => child.id)) {
    emit('node-selected', { nodeId: nodeId, parentId: props.unitId })
  } else {
    emit('node-selected', { nodeId: nodeId, parentId: parentId })
  }
}
</script>

<template>
  <div class="tree-node">
    <div v-if="unitLoading" class="loading">Loading...</div>
    <div v-else-if="unitError" class="error">
      Error loading unit: {{ unitError.message }}
    </div>
    <div v-else-if="unit">
      <div
        class="node-header"
        :class="{
          selected: selectedNodeId === unitId,
          redacted: !unit.subject
        }"
        @click="handleNodeClick"
      >
        <button
          v-if="unit.subject && unit.children && unit.children.length > 0"
          @click.stop="toggleExpand"
          class="expand-btn"
          :class="{ expanded }"
        >
          ▶
        </button>
        <div v-else class="expand-placeholder"></div>

        <div class="node-info">
          <span class="node-name">
            {{ unit.name || (unit.subject ? `${unit.subject.name} ${unit.id}` : `Unit ${unit.id}`) }}
          </span>
          <div class="node-meta">
            <span v-if="unit.subject" class="type-badge">{{ unit.subject.name }}</span>
            <span v-if="unit.germplasm" class="germplasm-badge">{{ unit.germplasm.name }}</span>
            <span v-if="!unit.subject" class="redacted-badge">Access Restricted</span>
            <span v-if="unit.children && unit.children.length > 0" class="count">
              {{ unit.children.length }} child{{ unit.children.length !== 1 ? 'ren' : '' }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="expanded && unit.children && unit.children.length > 0" class="children">
        <div v-if="childUnitsLoading" class="loading">Loading children...</div>
        <div v-else-if="childUnitsError" class="error">
          Error loading children: {{ childUnitsError.message }}
        </div>
        <div v-else>
          <BlockTreeNode
            v-for="child in unit.children"
            :key="child.id"
            :unitId="child.id"
            :blockId="blockId"
            :selectedNodeId="selectedNodeId"
            @node-selected="handleChildNodeSelected"
            @refresh="$emit('refresh')"
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

.node-header.redacted {
  background-color: #fff3e0;
  border-color: #ffb74d;
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

.germplasm-badge {
  display: inline-block;
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.redacted-badge {
  display: inline-block;
  background: #ffebee;
  color: #c62828;
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