<template>
  <div v-if="programsLoading" class="loading">Loading programs...</div>
  <div v-else-if="programsError" class="error">Error loading programs!</div>
  <div v-else-if="programs.length === 0" class="empty-state">No programs found.</div>
  <div v-else class="program-tree">
    <div v-for="program in programs" :key="`program_${program.id}`" class="tree-item">
      <ProgramNode
        :node="program"
        :nodeType="'Program'"
        :isExpandedFn="isExpanded"
        :selectedStudyId="selectedStudyId"
        :getChildrenFn="getChildren"
        :childrenLoading="childrenLoading"
        @toggle-expand="(nodeId, node) => handleToggleExpanded(nodeId, node)"
        @select-study="handleSelectStudyAndEmit"
      />
    </div>
  </div>
</template>

<script setup>
import ProgramNode from './ProgramNode.vue'
import { useProgramTreeQueries } from '@/composables/programs/programTreeQueries'
import { useProgramTreeNavigation } from '@/composables/programs/programTreeNavigation'

const emit = defineEmits(['study-selected'])

const {
  programs,
  programsLoading,
  programsError,
  loadChildren,
  childrenLoading,
  getTrialsForProgram,
  getStudiesForTrial
} = useProgramTreeQueries()

const {
  selectedStudyId,
  isExpanded,
  handleToggleExpanded
} = useProgramTreeNavigation(loadChildren)

const getChildren = (node) => {
  if (node.__typename === 'Program') {
    return getTrialsForProgram(node.id)
  } else if (node.__typename === 'Trial') {
    return getStudiesForTrial(node.id)
  }
  return []
}

const handleSelectStudyAndEmit = (studyId, study) => {
  emit('study-selected', studyId, study)
}
</script>

<style scoped>
.loading,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 16px;
}

.error {
  text-align: center;
  padding: 40px 20px;
  color: #dc3545;
  font-size: 16px;
}

.program-tree {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tree-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
}
</style>