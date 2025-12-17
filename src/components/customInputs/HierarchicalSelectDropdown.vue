<template>
  <div class="hierarchical-select" ref="dropdownRef">
    <!-- Selected value display / trigger -->
    <div
      class="select-trigger"
      :class="{ open: isOpen, disabled: disabled }"
      @click.stop="toggleDropdown"
      tabindex="0"
      @keydown.enter.prevent="toggleDropdown"
      @keydown.space.prevent="toggleDropdown"
      @keydown.escape="closeDropdown"
    >
      <span v-if="selectedNode" class="selected-value">
        {{ getNodeLabel(selectedNode) }}
      </span>
      <span v-else class="placeholder">
        {{ placeholder }}
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
              :key="`breadcrumb-${getNodeId(pathNode)}`"
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

          <!-- Back button -->
          <button
            v-if="navigationPath.length > 0"
            @click.stop="navigateBack"
            class="back-button"
            type="button"
          >
            ← Back to {{ getNodeLabel(navigationPath[navigationPath.length - 1]) }}
          </button>

          <!-- Options list -->
          <div class="options-list">
            <div
              v-for="node in currentOptions"
              :key="`option-${getNodeId(node)}`"
              :class="{
                'option-item': true,
                'selected': isNodeSelected(node),
                'disabled': isNodeDisabled(node),
                'has-children': hasChildren(node)
              }"
            >
              <button
                @click.stop="selectNode(node)"
                :disabled="isNodeDisabled(node)"
                class="option-label-button"
                type="button"
              >
                <span class="option-label">{{ getNodeLabel(node) }}</span>
              </button>
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

            <div v-if="currentOptions.length === 0" class="empty-state">
              No options available
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = defineProps({
  // The currently selected node ID
  modelValue: {
    type: [Number, String, null],
    default: null
  },

  // Array of root nodes to display initially
  rootNodes: {
    type: Array,
    required: true,
    default: () => []
  },

  // Function to get children for a node (synchronous)
  // Signature: (nodeId) => Array<Node>
  getChildrenFn: {
    type: Function,
    required: true
  },

  // Function to get node ID
  // Signature: (node) => number|string
  getNodeIdFn: {
    type: Function,
    default: (node) => node.id
  },

  // Function to get node label/name
  // Signature: (node) => string
  getNodeLabelFn: {
    type: Function,
    default: (node) => node.name
  },

  // Function to check if node has children (optional, will use getChildrenFn if not provided)
  // Signature: (node) => boolean
  hasChildrenFn: {
    type: Function,
    default: null
  },

  // Optional function to determine if a node should be disabled
  // Signature: (node) => boolean
  isDisabledFn: {
    type: Function,
    default: () => false
  },

  // Node ID to exclude (along with its descendants)
  excludeNodeId: {
    type: [Number, String, null],
    default: null
  },

  // Placeholder text
  placeholder: {
    type: String,
    default: 'Select an option'
  },

  // Disabled state
  disabled: {
    type: Boolean,
    default: false
  },

  // Multi-select mode (for future use)
  multiple: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

// Dropdown state
const isOpen = ref(false)
const dropdownRef = ref(null)

// Navigation state
const navigationPath = ref([]) // Array of parent nodes leading to current level
const currentParentNode = ref(null) // The node whose children we're currently viewing
const dropdownPanelRef = ref(null)
const dropdownStyle = ref({})

// Position the dropdown panel
const updateDropdownPosition = () => {
  if (!dropdownRef.value || !isOpen.value) return

  nextTick(() => {
    const triggerRect = dropdownRef.value.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const spaceBelow = viewportHeight - triggerRect.bottom
    const spaceAbove = triggerRect.top

    // Decide whether to show dropdown below or above
    const showBelow = spaceBelow >= 320 || spaceBelow > spaceAbove

    if (showBelow) {
      dropdownStyle.value = {
        position: 'fixed',
        top: `${triggerRect.bottom + 4}px`,
        left: `${triggerRect.left}px`,
        width: `${triggerRect.width}px`,
        maxHeight: `${Math.min(320, spaceBelow - 8)}px`
      }
    } else {
      dropdownStyle.value = {
        position: 'fixed',
        bottom: `${viewportHeight - triggerRect.top + 4}px`,
        left: `${triggerRect.left}px`,
        width: `${triggerRect.width}px`,
        maxHeight: `${Math.min(320, spaceAbove - 8)}px`
      }
    }
  })
}


// Build excluded node IDs set (self + descendants)
const excludedNodeIds = computed(() => {
  if (!props.excludeNodeId) return new Set()

  const excluded = new Set()

  const addDescendants = (nodeId) => {
    excluded.add(nodeId)
    // We need to find the node and get its children
    // This is tricky without a full cache, so we'll handle it during rendering
    // For now, just add the node itself
  }

  addDescendants(props.excludeNodeId)
  return excluded
})

// Update position when dropdown opens or window resizes
watch(isOpen, (newValue) => {
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

// Add a small delay before the clickOutside handler is active
const handleClickOutside = (event) => {
  // Use setTimeout to ensure this runs after the toggle
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    if (dropdownPanelRef.value && !dropdownPanelRef.value.contains(event.target)) {
      closeDropdown()
    }
  }
}

// Helper functions
const getNodeId = (node) => {
  return props.getNodeIdFn(node)
}


// Current options to display
const currentOptions = computed(() => {
  if (currentParentNode.value === null) {
    // Show root nodes
    return props.rootNodes
  } else {
    // Show children of current parent
    const nodeId = getNodeId(currentParentNode.value)
    return props.getChildrenFn(nodeId) || []
  }
})

// Label for current level
const currentLevelLabel = computed(() => {
  if (currentParentNode.value === null) {
    return 'Root'
  }
  return 'Children'
})

// Find selected node
const selectedNode = computed(() => {
  if (!props.modelValue) return null

  // Search through available nodes to find the selected one
  const findNode = (nodes) => {
    for (const node of nodes) {
      if (getNodeId(node) === props.modelValue) {
        return node
      }
      if (hasChildren(node)) {
        const nodeId = getNodeId(node)
        const children = props.getChildrenFn(nodeId)
        const found = findNode(children)
        if (found) return found
      }
    }
    return null
  }

  return findNode(props.rootNodes)
})


const getNodeLabel = (node) => {
  return props.getNodeLabelFn(node)
}

const hasChildren = (node) => {
  if (props.hasChildrenFn) {
    return props.hasChildrenFn(node)
  }
  const nodeId = getNodeId(node)
  const children = props.getChildrenFn(nodeId)
  return children && children.length > 0
}

const isNodeDisabled = (node) => {
  const nodeId = getNodeId(node)

  // Check if excluded
  if (excludedNodeIds.value.has(nodeId)) {
    return true
  }

  // Check custom disabled function
  return props.isDisabledFn(node)
}

const isNodeSelected = (node) => {
  return getNodeId(node) === props.modelValue
}

// Navigation functions
const navigateInto = (node) => {
  if (isNodeDisabled(node)) return
  navigationPath.value.push(currentParentNode.value || { id: 'root', name: 'Root' })
  currentParentNode.value = node
}

const navigateBack = () => {
  if (navigationPath.value.length === 0) return

  const previousParent = navigationPath.value.pop()
  if (previousParent.id === 'root') {
    currentParentNode.value = null
  } else {
    currentParentNode.value = previousParent
  }
}

const navigateToLevel = (index) => {
  // Navigate to a specific breadcrumb level
  if (index === -1) {
    // Go to root
    navigationPath.value = []
    currentParentNode.value = null
  } else {
    const targetNode = navigationPath.value[index]
    navigationPath.value = navigationPath.value.slice(0, index)
    currentParentNode.value = targetNode.id === 'root' ? null : targetNode
  }
}

const selectNode = (node) => {
  const nodeId = getNodeId(node)
  emit('update:modelValue', nodeId)
  emit('change', node)
  closeDropdown()
}

// Dropdown controls
const toggleDropdown = (event) => {
  if (props.disabled) return
  event.stopPropagation() // Prevent the click from bubbling to document
  isOpen.value = !isOpen.value
}

//const openDropdown = () => {
//  if (props.disabled) return
//  isOpen.value = true
//}

const closeDropdown = () => {
  isOpen.value = false
  // Reset navigation when closing
  navigationPath.value = []
  currentParentNode.value = null
}

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
.hierarchical-select {
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

.select-trigger:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.placeholder {
  color: #999;
  font-style: italic;
}

.selected-value {
  color: #333;
  font-weight: 500;
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
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-height: 320px;
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

.back-button {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  background: #f8f9fa;
  border: none;
  border-bottom: 1px solid #e0e0e0;
  cursor: pointer;
  font-size: 13px;
  color: #007bff;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: #e9ecef;
}

.options-list {
  overflow-y: auto;
  max-height: 240px;
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

.option-label-button {
  flex: 1;
  padding: 10px 12px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  color: #333;
}

.option-label-button:disabled {
  cursor: not-allowed;
}

.option-item.selected .option-label-button {
  color: #007bff;
  font-weight: 500;
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

.has-children-indicator {
  margin-left: 8px;
}
.empty-state {
  padding: 20px;
  text-align: center;
  color: #999;
  font-style: italic;
  font-size: 13px;
}

/* Transition animations */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.dropdown-panel {
  /* Remove: position: absolute, top, left, right */
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000; /* Changed from 1000 to 10000 */
  display: flex;
  flex-direction: column;
  /* Remove: max-height: 320px */
}

</style>