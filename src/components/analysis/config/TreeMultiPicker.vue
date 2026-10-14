<script setup>
import { ref } from 'vue'
import HierarchicalMultiSelectDropdown from '@/components/customInputs/HierarchicalMultiSelectDropdown.vue'
import SelectionChips from '@/components/customInputs/SelectionChips.vue'

/**
 * Hierarchical multi-select with removable chips for the selected IDs.
 * Labels of selected IDs come from labelFn, since selected nodes may not be loaded.
 */
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  rootNodes: { type: Array, required: true },
  loadChildrenFn: { type: Function, required: true },
  childrenLoading: { type: Boolean, default: false },
  currentChildren: { type: Array, default: () => [] },
  hasChildrenFn: { type: Function, default: undefined },
  loadTypeGroupsFn: { type: Function, default: null },
  getNodeLabelFn: { type: Function, default: (node) => node.name || `${node.id}` },
  isSelectableFn: { type: Function, default: () => true },
  labelFn: { type: Function, required: true },
  placeholder: { type: String, default: 'Select' }
})

const emit = defineEmits(['update:modelValue'])

// groups selected by type in the dropdown, shown as one chip each
const groups = ref([])

const remove = (id) => emit('update:modelValue', props.modelValue.filter((x) => x !== id))
const removeGroup = (group) => {
  const ids = new Set(group.ids.map(String))
  emit('update:modelValue', props.modelValue.filter((x) => !ids.has(String(x))))
}
const clear = () => emit('update:modelValue', [])
</script>

<template>
  <div class="tree-multi-picker">
    <HierarchicalMultiSelectDropdown
      :model-value="modelValue"
      :root-nodes="rootNodes"
      :load-children-fn="loadChildrenFn"
      :children-loading="childrenLoading"
      :current-children="currentChildren"
      :has-children-fn="hasChildrenFn"
      :load-type-groups-fn="loadTypeGroupsFn"
      :show-chips="false"
      :get-node-label-fn="getNodeLabelFn"
      :is-selectable-fn="isSelectableFn"
      :placeholder="placeholder"
      @update:model-value="emit('update:modelValue', $event)"
      @update:groups="groups = $event"
    />
    <SelectionChips
      v-if="modelValue.length"
      class="selected-chips"
      :ids="modelValue"
      :groups="groups"
      :label-fn="labelFn"
      @remove="remove"
      @remove-group="removeGroup"
      @clear="clear"
    />
  </div>
</template>

<style scoped>
.selected-chips {
  margin-top: 6px;
}
</style>
