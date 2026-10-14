<script setup>
import { watch } from 'vue'
import { useUnitsQuery } from '@/composables/blocks/unitsQuery'
import { useUnitsLazyQuery } from '@/composables/blocks/unitsLazyQuery'
import { useUnitsBySubject } from '@/composables/blocks/unitsBySubject'
import { registerNames, unitName } from '@/composables/analysis/useAnalysisNames'
import TreeMultiPicker from '@/components/analysis/config/TreeMultiPicker.vue'

/** Unit tree rooted at the blocks of the selected datasets. */
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  blockIds: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select units' }
})

const emit = defineEmits(['update:modelValue'])

const { units: blocks } = useUnitsQuery({ unitIds: () => props.blockIds })
const { units: children, unitsLoading, loadChildUnits } = useUnitsLazyQuery()

watch([blocks, children], ([roots, kids]) => registerNames('unit', [...roots, ...kids]), { immediate: true })

const loadChildren = (nodeId) => loadChildUnits(nodeId)

// Everything below a unit, or below every block, by subject, for selecting all of a subject at once
const { loadUnitGroups } = useUnitsBySubject()
const loadTypeGroups = async (node) => {
  const groups = await loadUnitGroups(node ? [node] : blocks.value)
  for (const group of groups) registerNames('unit', group.nodes)
  return groups
}
const hasChildren = (node) => (node.children?.length ?? 0) > 0
const nodeLabel = (node) => node.name || `Unit ${node.id}`
</script>

<template>
  <TreeMultiPicker
    :model-value="modelValue"
    :root-nodes="blocks"
    :load-children-fn="loadChildren"
    :children-loading="!!unitsLoading"
    :current-children="children"
    :has-children-fn="hasChildren"
    :load-type-groups-fn="loadTypeGroups"
    :get-node-label-fn="nodeLabel"
    :label-fn="unitName"
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
