import { ref } from 'vue'

export function useProgramTreeNavigation(loadChildren, onStudySelected = null) {
  const selectedStudyId = ref(null)
  const selectedStudy = ref(null)
  const expandedNodes = ref(new Set())

  // Create a unique key for each node using type and id
  const getNodeKey = (nodeId, node) => {
    const typeName = node?.__typename || 'Unknown'
    return `${typeName}_${nodeId}`
  }

  const handleToggleExpanded = (nodeId, node) => {
    const key = getNodeKey(nodeId, node)
    if (expandedNodes.value.has(key)) {
      expandedNodes.value.delete(key)
    } else {
      expandedNodes.value.add(key)
      loadChildren(nodeId, node)
    }
  }

  const handleSelectStudy = (studyId, study) => {
    selectedStudyId.value = studyId
    selectedStudy.value = study

    if (onStudySelected && typeof onStudySelected === 'function') {
      onStudySelected(studyId, study)
    }
  }

  const isExpanded = (nodeId, node) => {
    const key = getNodeKey(nodeId, node)
    return expandedNodes.value.has(key)
  }

  const expandNode = (nodeId, node) => {
    const key = getNodeKey(nodeId, node)
    if (!expandedNodes.value.has(key)) {
      expandedNodes.value.add(key)
      loadChildren(nodeId, node)
    }
  }

  const collapseNode = (nodeId, node) => {
    const key = getNodeKey(nodeId, node)
    expandedNodes.value.delete(key)
  }

  const collapseAll = () => {
    expandedNodes.value.clear()
  }

  return {
    selectedStudyId,
    selectedStudy,
    expandedNodes,
    handleToggleExpanded,
    handleSelectStudy,
    isExpanded,
    expandNode,
    collapseNode,
    collapseAll
  }
}