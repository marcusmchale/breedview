<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import SelectionChips from './SelectionChips.vue'

const props = defineProps({
  // Array of selected node IDs (FormKit value)
  modelValue: {
    type: Array,
    default: () => []
  },
  // Selected node objects, a fallback for labelling the chips in the trigger when no labelFn is given
  selectedNodes: {
    type: Array,
    default: () => []
  },
  // The label of a selected id, for the chips in the trigger
  labelFn: {
    type: Function,
    default: null
  },
  // Whether the trigger shows the selection as chips; otherwise the placeholder and the count
  showChips: {
    type: Boolean,
    default: true
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
  // Whether the root nodes are loading, e.g. the unit graphs and arrivals at locations just chosen
  rootsLoading: {
    type: Boolean,
    default: false
  },
  currentChildren: {
    type: Array,
    required: true,
    default: () => []
  },
  // Loads what lies below a node (null for below every root) grouped by type, as [{ key, label, nodes }],
  // e.g. the units of a block by subject. Enables selecting by type.
  loadTypeGroupsFn: {
    type: Function,
    default: null
  },
  getNodeLabelFn: {
    type: Function,
    default: (node) => node.name
  },
  isDisabledFn: {
    type: Function,
    default: () => false
  },
  isSelectableFn: {
    type: Function,
    default: () => true
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

const emit = defineEmits(['update:modelValue', 'update:groups', 'change'])

// Dropdown state
const isOpen = ref(false)
const dropdownRef = ref(null)

// Navigation state
const navigationPath = ref([])
const currentParentNode = ref(null)
const dropdownPanelRef = ref(null)
const dropdownStyle = ref({})

// Internal selection state (array of IDs)
const internalSelectedIds = ref([...props.modelValue])
const selectedIdSet = computed(() => new Set(internalSelectedIds.value.map(String)))

// The label of a selected id in the trigger: labelFn, or the selected nodes, or the id
const chipLabel = (id) => {
  if (props.labelFn) return props.labelFn(id)
  const node = props.selectedNodes.find((n) => String(n.id) === String(id))
  return node ? getNodeLabel(node) : `#${id}`
}

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

// "Loading..." in place of the options, not "No options available", while they load
const isLoading = computed(() => (currentParentNode.value ? props.childrenLoading : props.rootsLoading))

const updateCurrentOptions = async () => {
  if (!currentParentNode.value) return
  const nodeId = currentParentNode.value.id
  props.loadChildrenFn(nodeId, currentParentNode.value)
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

/* ---------- selection rules ---------- */

// A disabled node can neither be selected nor opened
const isNodeDisabled = (node) => {
  if (excludedNodeIds.value.has(node.id)) {
    return true
  }
  return props.isDisabledFn(node)
}

// A selectable node can be ticked; its children may still be opened when it is not
const isNodeSelectable = (node) => {
  if (isNodeDisabled(node)) {
    return false
  }
  return props.isSelectableFn(node)
}

// ids are only unique per type, so a node of another type (e.g. a program with a study's id) is never selected
const isNodeSelected = (node) => selectedIdSet.value.has(String(node.id)) && props.isSelectableFn(node)

const canSelectMore = computed(() => {
  if (!props.maxSelections) return true
  return internalSelectedIds.value.length < props.maxSelections
})

const limitReached = computed(() => !canSelectMore.value)

// The limit stops further ticks, not navigation or unticking
const canToggle = (node) => isNodeSelectable(node) && (isNodeSelected(node) || canSelectMore.value)

const commitSelection = (ids) => {
  internalSelectedIds.value = ids
  emit('update:modelValue', ids)
  emit('change', ids)
}

const toggleSelection = (node) => {
  if (selectsBelow(node)) {
    if (canToggleBelow(node)) toggleBelow(node)
    return
  }
  if (!canToggle(node)) return

  const newSelectedIds = [...internalSelectedIds.value]
  const index = newSelectedIds.indexOf(node.id)

  if (index > -1) {
    newSelectedIds.splice(index, 1)
  } else {
    newSelectedIds.push(node.id)
  }
  commitSelection(newSelectedIds)
}

const removeSelection = (nodeId) => {
  commitSelection(internalSelectedIds.value.filter(id => id !== nodeId))
}

const clearAllSelections = () => {
  commitSelection([])
}

// Add the selectable nodes among `nodes` that are not yet selected, as many as the limit allows.
// Returns how many were left out by the limit.
const addNodes = (nodes) => {
  const newSelectedIds = [...internalSelectedIds.value]
  const selected = new Set(newSelectedIds.map(String))
  let leftOut = 0
  for (const node of nodes) {
    if (!isNodeSelectable(node) || selected.has(String(node.id))) continue
    if (props.maxSelections && newSelectedIds.length >= props.maxSelections) {
      leftOut += 1
      continue
    }
    newSelectedIds.push(node.id)
    selected.add(String(node.id))
  }
  commitSelection(newSelectedIds)
  return leftOut
}

const removeNodes = (nodes) => {
  const drop = new Set(nodes.map((node) => String(node.id)))
  commitSelection(internalSelectedIds.value.filter((id) => !drop.has(String(id))))
}

// What is listed at this level: the nodes that can be selected, and for each node that stands for what lies below it
// (a program or a trial where only studies are selected), everything selectable below it, as its own tick selects
const selectAllDisplayed = async () => {
  const nodes = currentOptions.value
  addNodes(nodes)
  for (const node of nodes.filter((n) => selectsBelow(n))) {
    const below = await loadGroupsBelow(node)
    for (const group of below.groups) {
      addNodes(group.nodes)
      rememberGroup(node, group)
    }
  }
}

/* ---------- selection by type, over everything below the current node ---------- */

const typePanel = ref(null)
let typePanelRequest = 0

const closeTypePanel = () => {
  typePanel.value = null
  typePanelRequest += 1
}

const scopeLabel = (scope) => (scope ? getNodeLabel(scope) : 'everything')

const typePanelScopeLabel = computed(() => scopeLabel(typePanel.value?.scope))

const scopeKey = (scope) => (scope ? `${scope.__typename ?? ''}:${scope.id}` : 'root')

// The selectable groups below a scope, loaded once per scope while the dropdown is open
const groupsBelow = ref({})
const groupsBelowPending = new Map()

const loadGroupsBelow = (scope) => {
  const key = scopeKey(scope)
  if (groupsBelow.value[key]) return Promise.resolve(groupsBelow.value[key])
  if (groupsBelowPending.has(key)) return groupsBelowPending.get(key)
  const pending = (async () => {
    try {
      const loaded = await props.loadTypeGroupsFn(scope)
      const groups = []
      let notSelectable = 0
      for (const group of loaded ?? []) {
        const nodes = (group.nodes ?? []).filter((node) => {
          if (isNodeSelectable(node)) return true
          notSelectable += 1
          return false
        })
        if (nodes.length > 0) groups.push({ key: String(group.key), label: group.label ?? String(group.key), nodes })
      }
      const below = { groups, notSelectable, ids: groups.flatMap((group) => group.nodes.map((node) => String(node.id))) }
      groupsBelow.value = { ...groupsBelow.value, [key]: below }
      return below
    } finally {
      groupsBelowPending.delete(key)
    }
  })()
  groupsBelowPending.set(key, pending)
  return pending
}

const openTypePanel = async () => {
  if (!props.loadTypeGroupsFn) return
  const request = ++typePanelRequest
  const scope = currentParentNode.value
  typePanel.value = { scope, loading: true, error: null, groups: [], notSelectable: 0, leftOut: 0 }
  try {
    const { groups, notSelectable } = await loadGroupsBelow(scope)
    if (request !== typePanelRequest) return
    typePanel.value = { scope, loading: false, error: null, groups, notSelectable, leftOut: 0 }
  } catch (error) {
    if (request !== typePanelRequest) return
    typePanel.value = { scope, loading: false, error: error?.message || 'Could not load', groups: [], notSelectable: 0, leftOut: 0 }
  }
}

const groupSelectedCount = (group) => group.nodes.filter(isNodeSelected).length

// Groups selected by type, kept while every one of their ids stays selected, so the chips can show them as one
const selectedGroups = ref([])

const emitGroups = () => emit('update:groups', selectedGroups.value.map((group) => ({ ...group, ids: [...group.ids] })))

const groupKey = (scope, group) => `${scope?.id ?? 'root'}:${group.key}`

const rememberGroup = (scope, group) => {
  const key = groupKey(scope, group)
  const label = scope ? `${group.label} in ${scopeLabel(scope)}` : group.label
  const ids = group.nodes.map((node) => node.id).filter((id) => selectedIdSet.value.has(String(id)))
  selectedGroups.value = [...selectedGroups.value.filter((g) => g.key !== key), { key, label, ids }]
  emitGroups()
}

const forgetGroup = (key) => {
  if (!selectedGroups.value.some((g) => g.key === key)) return
  selectedGroups.value = selectedGroups.value.filter((g) => g.key !== key)
  emitGroups()
}

// A group whose member is unticked, or that is cleared, goes back to single chips
watch(selectedIdSet, (ids) => {
  const kept = selectedGroups.value.filter((group) => group.ids.every((id) => ids.has(String(id))))
  if (kept.length !== selectedGroups.value.length) {
    selectedGroups.value = kept
    emitGroups()
  }
})

const selectGroup = (group, select) => {
  if (!typePanel.value) return
  if (select) {
    typePanel.value.leftOut = addNodes(group.nodes)
    rememberGroup(typePanel.value.scope, group)
  } else {
    typePanel.value.leftOut = 0
    forgetGroup(groupKey(typePanel.value.scope, group))
    removeNodes(group.nodes)
  }
}

const selectAllGroups = (select) => {
  for (const group of typePanel.value?.groups ?? []) selectGroup(group, select)
}

const removeGroup = (group) => {
  forgetGroup(group.key)
  commitSelection(internalSelectedIds.value.filter((id) => !group.ids.map(String).includes(String(id))))
}

const allGroupNodes = computed(() => (typePanel.value?.groups ?? []).flatMap((group) => group.nodes))

/* ---------- a node that cannot be selected itself stands for everything selectable below it ---------- */

// e.g. a program or a trial in a tree where only studies are selected: its tick selects its studies
const selectsBelow = (node) => !!props.loadTypeGroupsFn && !isNodeDisabled(node) && !props.isSelectableFn(node) && hasChildren(node)

const belowState = (node) => {
  const below = groupsBelow.value[scopeKey(node)]
  if (!below) return { known: false, all: false, some: false }
  const selected = below.ids.filter((id) => selectedIdSet.value.has(id)).length
  return { known: true, all: below.ids.length > 0 && selected === below.ids.length, some: selected > 0 && selected < below.ids.length }
}

const isBelowAllSelected = (node) => selectsBelow(node) && belowState(node).all
const isBelowSomeSelected = (node) => selectsBelow(node) && belowState(node).some
const canToggleBelow = (node) => selectsBelow(node) && belowState(node).known && (belowState(node).all || canSelectMore.value)

const toggleBelow = async (node) => {
  const below = await loadGroupsBelow(node)
  const select = !belowState(node).all
  for (const group of below.groups) {
    if (select) {
      addNodes(group.nodes)
      rememberGroup(node, group)
    } else {
      forgetGroup(groupKey(node, group))
      removeNodes(group.nodes)
    }
  }
}

const belowTitle = (node) => {
  const below = groupsBelow.value[scopeKey(node)]
  if (!below) return 'Loading what lies below…'
  if (below.ids.length === 0) return 'Nothing selectable below'
  const what = below.groups.map((group) => `${group.nodes.length.toLocaleString()} ${group.label}`).join(', ')
  return `${belowState(node).all ? 'Deselect' : 'Select'} everything below: ${what}`
}

// know what lies below the listed nodes that select below, so their ticks show the state of it
watch(currentOptions, (nodes) => {
  for (const node of nodes ?? []) {
    if (selectsBelow(node)) loadGroupsBelow(node).catch(() => {})
  }
}, { immediate: true })

/* ---------- navigation ---------- */

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

// The type panel is scoped to the level it was opened at
watch(currentParentNode, closeTypePanel)

const toggleDropdown = (event) => {
  if (props.disabled) return
  event.stopPropagation()
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
  navigationPath.value = []
  currentParentNode.value = null
  closeTypePanel()
  // what lies below a node is read again when the dropdown opens next, in case it changed
  groupsBelow.value = {}
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

<template>
  <div class="hierarchical-multiselect" ref="dropdownRef">
    <div
      class="select-trigger"
      :class="{ open: isOpen, disabled: disabled }"
      @click.stop="toggleDropdown"
      tabindex="0"
    >
      <div v-if="showChips && internalSelectedIds.length > 0" class="selected-values">
        <SelectionChips
          compact
          :ids="internalSelectedIds"
          :groups="selectedGroups"
          :label-fn="chipLabel"
          :disabled="disabled"
          @remove="removeSelection"
          @remove-group="removeGroup"
          @clear="clearAllSelections"
        />
      </div>
      <span v-else class="placeholder">
        {{ placeholder }}
        <span v-if="showSelectionCount && internalSelectedIds.length > 0" class="selection-count">
          ({{ internalSelectedIds.length.toLocaleString() }} selected)
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

          <!-- Selection summary and bulk actions -->
          <div class="selection-summary" :class="{ 'limit-reached': limitReached }">
            <span class="selection-count-text">
              {{ internalSelectedIds.length.toLocaleString() }} selected<template v-if="maxSelections"> of at most {{ maxSelections }}</template>
            </span>
            <div class="selection-actions">
              <button
                type="button"
                class="select-all-button"
                @click.stop="selectAllDisplayed"
                :disabled="!canSelectMore || currentOptions.length === 0"
                title="Select what is listed at this level, with everything selectable below what stands for it"
              >
                Select shown
              </button>
              <button
                v-if="loadTypeGroupsFn"
                type="button"
                class="select-by-type-button"
                :class="{ active: !!typePanel }"
                @click.stop="typePanel ? closeTypePanel() : openTypePanel()"
                title="Select everything of a type below this level"
              >
                By type…
              </button>
              <button
                v-if="internalSelectedIds.length > 0"
                type="button"
                class="clear-all-button"
                @click.stop="clearAllSelections"
              >
                Clear all
              </button>
            </div>
          </div>

          <!-- Selection by type over everything below the current level -->
          <div v-if="typePanel" class="type-panel">
            <div class="type-panel-header">
              <span>Below <strong>{{ typePanelScopeLabel }}</strong></span>
              <button type="button" class="type-panel-close" @click.stop="closeTypePanel" title="Close">×</button>
            </div>
            <div v-if="typePanel.loading" class="loading-state">
              <span class="spinner"></span> Loading…
            </div>
            <div v-else-if="typePanel.error" class="type-panel-error">{{ typePanel.error }}</div>
            <template v-else>
              <div v-if="typePanel.groups.length === 0" class="empty-state">
                Nothing selectable below {{ typePanelScopeLabel }}
              </div>
              <template v-else>
                <div
                  v-for="group in typePanel.groups"
                  :key="`type-${group.key}`"
                  class="type-row"
                >
                  <span class="type-label">
                    {{ group.label }} <span class="type-count">({{ group.nodes.length.toLocaleString() }})</span>
                  </span>
                  <span class="type-selected">{{ groupSelectedCount(group).toLocaleString() }} selected</span>
                  <span class="type-actions">
                    <button
                      type="button"
                      class="btn-link"
                      :disabled="!canSelectMore || groupSelectedCount(group) === group.nodes.length"
                      @click.stop="selectGroup(group, true)"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      class="btn-link"
                      :disabled="groupSelectedCount(group) === 0"
                      @click.stop="selectGroup(group, false)"
                    >
                      None
                    </button>
                  </span>
                </div>
                <div v-if="typePanel.groups.length > 1" class="type-row type-row-all">
                  <span class="type-label">Everything <span class="type-count">({{ allGroupNodes.length.toLocaleString() }})</span></span>
                  <span class="type-selected">{{ allGroupNodes.filter(isNodeSelected).length.toLocaleString() }} selected</span>
                  <span class="type-actions">
                    <button
                      type="button"
                      class="btn-link"
                      :disabled="!canSelectMore"
                      @click.stop="selectAllGroups(true)"
                    >
                      All
                    </button>
                    <button type="button" class="btn-link" @click.stop="selectAllGroups(false)">None</button>
                  </span>
                </div>
              </template>
              <div v-if="typePanel.leftOut > 0" class="type-panel-note">
                {{ typePanel.leftOut }} not selected: at most {{ maxSelections }} can be selected
              </div>
              <div v-else-if="typePanel.notSelectable > 0" class="type-panel-note">
                {{ typePanel.notSelectable }} below {{ typePanelScopeLabel }} cannot be selected here
              </div>
            </template>
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
                  'selected': isNodeSelected(node) || isBelowAllSelected(node),
                  'selects-below': selectsBelow(node),
                  'disabled': isNodeDisabled(node),
                  'not-selectable': !isNodeSelectable(node),
                  'has-children': hasChildren(node)
                }"
              >
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    :checked="isNodeSelected(node) || isBelowAllSelected(node)"
                    :indeterminate.prop="isBelowSomeSelected(node)"
                    @change="toggleSelection(node)"
                    :disabled="!(canToggle(node) || canToggleBelow(node))"
                    :title="selectsBelow(node) ? belowTitle(node) : undefined"
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
            <div v-if="!isLoading && currentOptions.length === 0" class="empty-state">
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

.selection-summary.limit-reached .selection-count-text {
  color: #b26a00;
}

.select-all-button,
.select-by-type-button {
  background: none;
  border: none;
  color: #1976d2;
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
}

.select-all-button:hover:not(:disabled),
.select-by-type-button:hover:not(:disabled) {
  color: #0d47a1;
}

.select-all-button:disabled,
.select-by-type-button:disabled {
  color: #999;
  cursor: not-allowed;
  text-decoration: none;
}

.select-by-type-button.active {
  font-weight: 600;
  text-decoration: none;
}

.type-panel {
  border-bottom: 1px solid #e0e0e0;
  background: #fafbfc;
  font-size: 13px;
}

.type-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  color: #333;
  border-bottom: 1px solid #eee;
}

.type-panel-close {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 4px;
}

.type-panel-close:hover {
  color: #000;
}

.type-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 6px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.type-row-all {
  background: #f0f4f8;
}

.type-label {
  color: #333;
}

.type-count,
.type-selected {
  color: #666;
  font-size: 12px;
}

.type-actions {
  display: flex;
  gap: 8px;
}

.type-actions .btn-link {
  background: none;
  border: none;
  color: #1976d2;
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
  padding: 0;
}

.type-actions .btn-link:disabled {
  color: #999;
  cursor: not-allowed;
  text-decoration: none;
}

.type-panel-note,
.type-panel-error {
  padding: 6px 12px;
  font-size: 12px;
  color: #b26a00;
}

.type-panel-error {
  color: #d32f2f;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  color: #666;
  font-size: 13px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #cfd8dc;
  border-top-color: #1976d2;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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