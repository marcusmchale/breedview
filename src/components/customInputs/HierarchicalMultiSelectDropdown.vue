<template>
  <div class="hierarchical-multiselect" ref="dropdownRef">
    <div
      class="select-trigger"
      :class="{ open: isOpen, disabled: disabled }"
      @click.stop="toggleDropdown"
      tabindex="0"
    >
      <div v-if="selectedNodes.length > 0" class="selected-values">
        <span
          v-for="node in displayedSelectedNodes"
          :key="`selected-${node.id}`"
          class="selected-chip"
        >
          {{ getNodeLabel(node) }}
          <button
            type="button"
            class="remove-chip"
            @click.stop="removeSelection(node.id)"
            :disabled="disabled"
          >
            ×
          </button>
        </span>
        <span v-if="remainingCount > 0" class="remaining-count">
          +{{ remainingCount }} more
        </span>
      </div>
      <span v-else class="placeholder">
        {{ placeholder }}
        <span v-if="showSelectionCount && internalSelectedIds.length > 0" class="selection-count">
          ({{ internalSelectedIds.length }} selected)
        </span>
      </span>
      <span class="dropdown-arrow" :class="{ open: isOpen }">▼</span>
    </div>

    <!-- Dropdown panel -->
    <Teleport to="body">
      <Transition name="dropdown">
        <div
          v-if="isOpen"
          class="dropdown-panel"
          :style="dropdownStyle"
          ref="dropdownPanelRef"
        >
          <!-- Breadcrumb trail -->
          <div v-if="navigationPath.length > 0" class="breadcrumb">
            <button
              v-for="(pathNode, index) in navigationPath"
              :key="`breadcrumb-${pathNode.id}`"
              @click.stop="navigateToLevel(index)"
              class="breadcrumb-item"
              type="button"
            >
              {{ getNodeLabel(pathNode) }}
            </button>
            <span class="breadcrumb-item current">
              {{ currentLevelLabel }}
            </span>
          </div>

          <!-- Selection summary -->
          <div v-if="internalSelectedIds.length > 0" class="selection-summary">
            {{ internalSelectedIds.length }} item{{ internalSelectedIds.length !== 1 ? 's' : '' }} selected
            <div class="selection-actions">
              <button
                type="button"
                class="select-all-button"
                @click.stop="selectAllDisplayed"
                :disabled="!canSelectMore"
              >
                Select All
              </button>
              <button
                type="button"
                class="clear-all-button"
                @click.stop="clearAllSelections"
              >
                Clear All
              </button>
            </div>
          </div>

          <!-- If no items selected, show select all button separately -->
          <div v-else-if="currentOptions.length > 0" class="selection-summary">
            <span>0 items selected</span>
            <button
              type="button"
              class="select-all-button"
              @click.stop="selectAllDisplayed"
              :disabled="!canSelectMore"
            >
              Select All
            </button>
          </div>

          <!-- Options list -->
          <div class="options-list">
            <div v-if="isLoading" class="loading-state">
              <span class="spinner"></span> Loading...
            </div>
            <template v-else>
              <div
                v-for="node in currentOptions"
                :key="`option-${node.id}`"
                :class="{
                  'option-item': true,
                  'selected': isNodeSelected(node),
                  'disabled': isNodeDisabled(node),
                  'has-children': hasChildren(node)
                }"
              >
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    :checked="isNodeSelected(node)"
                    @change="toggleSelection(node)"
                    :disabled="isNodeDisabled(node)"
                    class="option-checkbox"
                  />
                  <span class="option-label">{{ getNodeLabel(node) }}</span>
                </label>
                <button
                  v-if="hasChildren(node)"
                  @click.stop="navigateInto(node)"
                  :disabled="isNodeDisabled(node)"
                  class="expand-button"
                  type="button"
                  title="Show children"
                >
                  <span class="has-children-indicator">→</span>
                </button>
              </div>
            </template>
            <div v-if="currentOptions.length === 0" class="empty-state">
              No options available
            </div>
          </div>

          <!-- Action buttons -->
          <div class="dropdown-actions">
            <button
              type="button"
              class="btn-done"
              @click.stop="closeDropdown"
            >
              Done
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  // Array of selected node IDs (FormKit value)
  modelValue: {
    type: Array,
    default: () => []
  },
  // Array of selected node objects
  selectedNodes: {
    type: Array,
    default: () => []
  },
  rootNodes: {
    type: Array,
    required: true
  },
  hasChildrenFn: {
    type: Function,
    required: false
  },
  loadChildrenFn: {
    type: Function,
    required: true,
    default: () => () => []
  },
  childrenLoading: {
    type: Boolean,
    required: true,
    default: false
  },
  currentChildren: {
    type: Array,
    required: true,
    default: () => []
  },
  getNodeLabelFn: {
    type: Function,
    default: (node) => node.name
  },
  isDisabledFn: {
    type: Function,
    default: () => false
  },
  // Array of node IDs to exclude
  excludeNodeIds: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: 'Select options'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  maxSelections: {
    type: Number,
    default: null
  },
  showSelectionCount: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

// Dropdown state
const isOpen = ref(false)
const dropdownRef = ref(null)
const isLoading = ref(false)

// Navigation state
const navigationPath = ref([])
const currentParentNode = ref(null)
const dropdownPanelRef = ref(null)
const dropdownStyle = ref({})

// Internal selection state (array of IDs)
const internalSelectedIds = ref([...props.modelValue])

// Display only first 3 selected nodes as chips
const displayedSelectedNodes = computed(() => {
  return props.selectedNodes.slice(0, 3)
})

const remainingCount = computed(() => {
  return Math.max(0, props.selectedNodes.length - 3)
})

const getNodeLabel = (node) => {
  if (!node) return ''
  return props.getNodeLabelFn(node)
}

const hasChildren = (node) => {
  if (props.hasChildrenFn) {
    return props.hasChildrenFn(node)
  } else {
    return node.children && node.children.length > 0
  }
}

const currentOptions = computed(() => {
  if (!currentParentNode.value) {
    return props.rootNodes
  } else {
    return props.currentChildren
  }
})

const updateCurrentOptions = async () => {
  if (!currentParentNode.value) return
  const nodeId = currentParentNode.value.id
  props.loadChildrenFn(nodeId)
}

watch(
  [() => props.rootNodes, currentParentNode],
  updateCurrentOptions,
  { immediate: true }
)

const updateDropdownPosition = () => {
  if (!dropdownRef.value || !isOpen.value) return

  nextTick(() => {
    const triggerRect = dropdownRef.value.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - triggerRect.bottom
    const spaceAbove = triggerRect.top

    const showBelow = spaceBelow >= 300 || spaceBelow >= spaceAbove

    const commonStyle = {
      position: 'fixed',
      left: `${triggerRect.left}px`,
      width: `${triggerRect.width}px`,
      zIndex: '99999'
    }

    if (showBelow) {
      dropdownStyle.value = {
        ...commonStyle,
        top: `${triggerRect.bottom + 4}px`,
        bottom: 'auto',
        maxHeight: `${Math.min(450, spaceBelow - 12)}px`
      }
    } else {
      dropdownStyle.value = {
        ...commonStyle,
        bottom: `${viewportHeight - triggerRect.top + 4}px`,
        top: 'auto',
        maxHeight: `${Math.min(450, spaceAbove - 12)}px`
      }
    }
  })
}

const excludedNodeIds = computed(() => {
  return new Set(props.excludeNodeIds || [])
})

watch(isOpen, async (newValue) => {
  if (newValue) {
    updateDropdownPosition()
  }
})

const handleScroll = () => {
  if (isOpen.value) {
    updateDropdownPosition()
  }
}

const handleResize = () => {
  if (isOpen.value) {
    updateDropdownPosition()
  }
}

const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    if (dropdownPanelRef.value && !dropdownPanelRef.value.contains(event.target)) {
      closeDropdown()
    }
  }
}

const currentLevelLabel = computed(() => {
  if (currentParentNode.value === null) {
    return 'Root'
  }
  return getNodeLabel(currentParentNode.value)
})

const isNodeDisabled = (node) => {
  if (excludedNodeIds.value.has(node.id)) {
    return true
  }

  // Check if max selections reached and node is not already selected
  if (props.maxSelections &&
      internalSelectedIds.value.length >= props.maxSelections &&
      !internalSelectedIds.value.includes(node.id)) {
    return true
  }

  return props.isDisabledFn(node)
}

const isNodeSelected = (node) => {
  return internalSelectedIds.value.includes(node.id)
}

const toggleSelection = (node) => {
  if (isNodeDisabled(node)) return

  const newSelectedIds = [...internalSelectedIds.value]
  const index = newSelectedIds.indexOf(node.id)

  if (index > -1) {
    // Remove selection
    newSelectedIds.splice(index, 1)
  } else {
    // Add selection
    if (!props.maxSelections || newSelectedIds.length < props.maxSelections) {
      newSelectedIds.push(node.id)
    }
  }

  internalSelectedIds.value = newSelectedIds
  emit('update:modelValue', newSelectedIds)
  emit('change', newSelectedIds)
}

const removeSelection = (nodeId) => {
  const newSelectedIds = internalSelectedIds.value.filter(id => id !== nodeId)
  internalSelectedIds.value = newSelectedIds
  emit('update:modelValue', newSelectedIds)
  emit('change', newSelectedIds)
}

const clearAllSelections = () => {
  internalSelectedIds.value = []
  emit('update:modelValue', [])
  emit('change', [])
}

const canSelectMore = computed(() => {
  if (!props.maxSelections) return true
  return internalSelectedIds.value.length < props.maxSelections
})


const selectAllDisplayed = () => {
  const newSelectedIds = [...internalSelectedIds.value]

  // Filter out disabled and already selected nodes
  const selectableNodes = currentOptions.value.filter(node =>
    !isNodeDisabled(node) && !newSelectedIds.includes(node.id)
  )

  // Add as many as possible within the max limit
  for (const node of selectableNodes) {
    if (props.maxSelections && newSelectedIds.length >= props.maxSelections) {
      break
    }
    newSelectedIds.push(node.id)
  }

  internalSelectedIds.value = newSelectedIds
  emit('update:modelValue', newSelectedIds)
  emit('change', newSelectedIds)
}


const navigateInto = (node) => {
  if (isNodeDisabled(node)) return
  navigationPath.value.push(currentParentNode.value || { id: 'root', name: 'Root' })
  currentParentNode.value = node
}

const navigateToLevel = (index) => {
  if (index === -1) {
    navigationPath.value = []
    currentParentNode.value = null
  } else {
    const targetNode = navigationPath.value[index]
    navigationPath.value = navigationPath.value.slice(0, index)
    currentParentNode.value = targetNode.id === 'root' ? null : targetNode
  }
}

const toggleDropdown = (event) => {
  if (props.disabled) return
  event.stopPropagation()
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
  navigationPath.value = []
  currentParentNode.value = null
}

// Sync internal state with props
watch(() => props.modelValue, (newIds) => {
  internalSelectedIds.value = [...newIds]
}, { deep: true })

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('scroll', handleScroll, true)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.hierarchical-multiselect {
  position: relative;
  width: 100%;
}

.select-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  min-height: 38px;
  transition: border-color 0.2s;
}

.select-trigger:hover:not(.disabled) {
  border-color: #007bff;
}

.select-trigger.open {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.select-trigger.disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.6;
}

.selected-values {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  align-items: center;
}

.selected-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #e3f2fd;
  border: 1px solid #2196f3;
  border-radius: 12px;
  font-size: 12px;
  color: #1976d2;
}

.remove-chip {
  background: none;
  border: none;
  color: #1976d2;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  line-height: 1;
  font-weight: bold;
}

.remove-chip:hover:not(:disabled) {
  color: #0d47a1;
}

.remaining-count {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.placeholder {
  color: #999;
  font-style: italic;
  flex: 1;
}

.selection-count {
  font-weight: 600;
  color: #007bff;
}

.dropdown-arrow {
  color: #666;
  font-size: 10px;
  transition: transform 0.2s;
  margin-left: 8px;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-panel {
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.breadcrumb {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  font-size: 12px;
  flex-wrap: wrap;
  gap: 4px;
}

.breadcrumb-item {
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 12px;
}

.breadcrumb-item:hover {
  background-color: #e3f2fd;
  text-decoration: underline;
}

.breadcrumb-item::after {
  content: ' >';
  margin-left: 6px;
  color: #666;
}

.breadcrumb-item.current {
  color: #666;
  font-weight: 600;
  cursor: default;
}

.breadcrumb-item.current::after {
  content: '';
}

.selection-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f0f7ff;
  border-bottom: 1px solid #e0e0e0;
  font-size: 13px;
  color: #1976d2;
  font-weight: 500;
}

.selection-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.select-all-button {
  background: none;
  border: none;
  color: #1976d2;
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
}

.select-all-button:hover:not(:disabled) {
  color: #0d47a1;
}

.select-all-button:disabled {
  color: #999;
  cursor: not-allowed;
  text-decoration: none;
}

.clear-all-button {
  background: none;
  border: none;
  color: #d32f2f;
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
}

.clear-all-button:hover {
  color: #b71c1c;
}

.options-list {
  overflow-y: auto;
  max-height: 300px;
  flex: 1;
}

.option-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  border-bottom: 1px solid #f0f0f0;
  background: white;
  transition: background-color 0.2s;
}

.option-item:last-child {
  border-bottom: none;
}

.option-item:hover:not(.disabled) {
  background-color: #f8f9fa;
}

.option-item.selected {
  background-color: #e3f2fd;
}

.option-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #f9f9f9;
}

.checkbox-label {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  gap: 8px;
}

.option-checkbox {
  cursor: pointer;
  width: 16px;
  height: 16px;
}

.option-checkbox:disabled {
  cursor: not-allowed;
}

.option-label {
  font-size: 14px;
  color: #333;
}

.expand-button {
  padding: 10px 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  font-size: 14px;
  transition: background-color 0.2s;
}

.expand-button:hover:not(:disabled) {
  background-color: #e9ecef;
}

.expand-button:disabled {
  cursor: not-allowed;
}

.dropdown-actions {
  padding: 8px 12px;
  border-top: 1px solid #e0e0e0;
  background: #f8f9fa;
  display: flex;
  justify-content: flex-end;
}

.btn-done {
  padding: 6px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.btn-done:hover {
  background: #0056b3;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: #999;
  font-style: italic;
  font-size: 13px;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>