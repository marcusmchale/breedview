import HierarchicalMultiSelect from '@/components/customInputs/HierarchicalMultiSelect.vue'

export const hierarchicalMultiSelectInput = {
  type: 'input',
  schema: [
    {
      $cmp: 'HierarchicalMultiSelect',
      props: {
        context: '$node.context'
      }
    }
  ],
  library: {
    HierarchicalMultiSelect
  },
  props: [
    'selectedNodes',      // Array of selected node objects
    'rootNodes',
    'loadChildrenFn',
    'childrenLoading',
    'currentChildren',
    'loadTypeGroupsFn',   // Optional: loads what lies below a node grouped by type, enables selection by type
    'labelFn',            // Optional: the label of a selected id, for the chips
    'excludeNodeIds',     // Array of node IDs to exclude
    'getNodeLabelFn',
    'hasChildrenFn',
    'isDisabledFn',
    'isSelectableFn',
    'placeholder',
    'maxSelections',      // Optional: limit number of selections
    'showSelectionCount'  // Optional: show count in trigger
  ]
}

// Custom plugin to register hierarchical-multiselect input
export const hierarchicalMultiSelectPlugin = (node) => {
  node.addProps([
    'selectedNodes',
    'rootNodes',
    'loadChildrenFn',
    'childrenLoading',
    'currentChildren',
    'loadTypeGroupsFn',
    'labelFn',
    'excludeNodeIds',
    'getNodeLabelFn',
    'hasChildrenFn',
    'isDisabledFn',
    'isSelectableFn',
    'placeholder',
    'maxSelections',
    'showSelectionCount'
  ])

  if (node.props.type === 'hierarchical-multiselect') {
    node.define(hierarchicalMultiSelectInput)
  }
}