<script setup>
import HierarchicalMultiSelectDropdown from '@/components/customInputs/HierarchicalMultiSelectDropdown.vue'

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
  getNodeLabelFn: { type: Function, default: (node) => node.name || `${node.id}` },
  isSelectableFn: { type: Function, default: () => true },
  labelFn: { type: Function, required: true },
  placeholder: { type: String, default: 'Select' }
})

const emit = defineEmits(['update:modelValue'])

const remove = (id) => emit('update:modelValue', props.modelValue.filter((x) => x !== id))
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
      :get-node-label-fn="getNodeLabelFn"
      :is-selectable-fn="isSelectableFn"
      :placeholder="placeholder"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <div v-if="modelValue.length" class="chip-list selected-chips">
      <span v-for="id in modelValue" :key="id" class="chip">
        {{ labelFn(id) }}
        <button type="button" class="chip-remove" title="Remove" @click="remove(id)">×</button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.selected-chips {
  margin-top: 6px;
}
</style>
