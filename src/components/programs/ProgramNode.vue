<template>
  <div class="program-node">
    <div class="node-header" :class="{ selected: isStudySelected }">
      <button
        v-if="hasChildren"
        @click="$emit('toggle-expand', node.id, node)"
        class="expand-btn"
        :class="{ expanded: isExpandedFn(node.id, node) }"
      >
        ▶
      </button>
      <div v-else class="expand-placeholder"></div>

      <div class="node-info" @click="handleNodeClick">
        <h4 class="node-name">{{ node.name || `${nodeType} ${node.id}` }}</h4>
        <div class="node-meta">
          <span class="type-badge">{{ nodeType }}</span>
          <span v-if="node.fullname" class="fullname">{{ node.fullname }}</span>
        </div>
      </div>
    </div>

    <div v-if="isExpandedFn(node.id, node) && children.length > 0" class="children">
      <div v-if="childrenLoading && children.length === 0" class="loading-children">
        Loading...
      </div>
      <div v-for="child in children" :key="`node_${child.__typename}_${child.id}`" class="child-item">
        <ProgramNode
          :node="child"
          :nodeType="childType"
          :isExpandedFn="isExpandedFn"
          :selectedStudyId="selectedStudyId"
          :getChildrenFn="getChildrenFn"
          :childrenLoading="childrenLoading"
          @toggle-expand="(nodeId, node_) => $emit('toggle-expand', nodeId, node_)"
          @select-study="(studyId, study) => $emit('select-study', studyId, study)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  nodeType: {
    type: String,
    required: true
  },
  isExpandedFn: {
    type: Function,
    required: true
  },
  selectedStudyId: {
    type: Number,
    default: null
  },
  getChildrenFn: {
    type: Function,
    required: true
  },
  childrenLoading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-expand', 'select-study'])

const childType = computed(() => {
  if (props.nodeType === 'Program') return 'Trial'
  if (props.nodeType === 'Trial') return 'Study'
  return ''
})

const children = computed(() => {
  return props.getChildrenFn(props.node) || []
})

const hasChildren = computed(() => {
  if (props.nodeType === 'Study') return false
  if (props.nodeType === 'Trial') {
    return props.node.studies ? props.node.studies.length > 0 : true
  }
  if (props.nodeType === 'Program') {
    return props.node.trials ? props.node.trials.length > 0 : true
  }
  return false
})

const isStudySelected = computed(() => {
  return props.nodeType === 'Study' && props.selectedStudyId === props.node.id
})

const handleNodeClick = () => {
  if (props.nodeType === 'Study') {
    emit('select-study', props.node.id, props.node)
  } else {
    emit('toggle-expand', props.node.id, props.node)
  }
}
</script>

<style scoped>
.program-node {
  display: flex;
  flex-direction: column;
}

.node-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.node-header:hover {
  background-color: #f5f5f5;
}

.node-header.selected {
  background-color: #e3f2fd;
  border-left: 4px solid #007bff;
  padding-left: 8px;
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

.node-info {
  flex: 1;
}

.node-name {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.node-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.type-badge {
  display: inline-block;
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.fullname {
  font-size: 12px;
  color: #666;
}

.children {
  margin-left: 36px;
  margin-top: 8px;
  padding-left: 12px;
  border-left: 2px solid #e0e0e0;
}

.child-item {
  margin-bottom: 8px;
}

.loading-children {
  color: #666;
  font-size: 13px;
  padding: 8px;
}
</style>