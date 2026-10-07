<script setup>
import { watch } from 'vue'
import { useSelectGermplasmQueries } from '@/composables/germplasm/selectGermplasmQueries'
import { germplasmName, registerNames } from '@/composables/analysis/useAnalysisNames'
import TreeMultiPicker from '@/components/analysis/config/TreeMultiPicker.vue'

defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select germplasm' }
})

const emit = defineEmits(['update:modelValue'])

const { crops, currentChildGermplasm, childGermplasmLoading, loadChildGermplasm, hasChildren } =
  useSelectGermplasmQueries({ germplasmId: () => null })

watch([crops, currentChildGermplasm], ([roots, children]) => registerNames('germplasm', [...roots, ...children]), {
  immediate: true
})

const loadChildren = (nodeId) => loadChildGermplasm(nodeId)
</script>

<template>
  <TreeMultiPicker
    :model-value="modelValue"
    :root-nodes="crops"
    :load-children-fn="loadChildren"
    :children-loading="!!childGermplasmLoading"
    :current-children="currentChildGermplasm"
    :has-children-fn="hasChildren"
    :label-fn="germplasmName"
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
