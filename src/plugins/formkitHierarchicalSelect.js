import HierarchicalSelect from '@/components/customInputs/HierarchicalSelect.vue'

export const hierarchicalSelectInput = {
  type: 'input',
  schema: [
    {
      $cmp: 'HierarchicalSelect',
      props: {
        context: '$node.context'
      }
    }
  ],
  library: {
    HierarchicalSelect
  },
  props: [
    'selected',
    'rootNodes',
    'loadChildrenFn',
    'childrenLoading',
    'currentChildren',
    'excludeNodeId',
    'getNodeLabelFn',
    'hasChildrenFn',
    'isDisabledFn',
    'placeholder'
  ]
}

// Custom plugin to register hierarchical-select input
export const hierarchicalSelectPlugin = (node) => {
  node.addProps([
    'selected',
    'rootNodes',
    'loadChildrenFn',
    'childrenLoading',
    'currentChildren',
    'excludeNodeId',
    'getNodeLabelFn',
    'hasChildrenFn',
    'isDisabledFn',
    'placeholder'
  ])

  if (node.props.type === 'hierarchical-select') {
    node.define(hierarchicalSelectInput)
  }
}