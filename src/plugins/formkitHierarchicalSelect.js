/**
 * FormKit input type for hierarchical selection
 *
 * Usage:
 * <FormKit
 *   type="hierarchical-select"
 *   name="parentId"
 *   label="Select Parent:"
 *   :root-nodes="rootNodes"
 *   :get-children-fn="getChildren"
 *   :exclude-node-id="currentNodeId"
 * />
 */

//import HierarchicalSelectDropdown from '@/components/customInputs/HierarchicalSelectDropdown.vue'
//
//export const hierarchicalSelectInput = {
//  type: 'input',
//  schema: [
//    {
//      $cmp: 'HierarchicalSelectDropdown',
//      props: {
//        modelValue: '$_value',
//        rootNodes: '$rootNodes',
//        getChildrenFn: '$getChildrenFn',
//        getNodeIdFn: '$getNodeIdFn',
//        getNodeLabelFn: '$getNodeLabelFn',
//        hasChildrenFn: '$hasChildrenFn',
//        isDisabledFn: '$isDisabledFn',
//        excludeNodeId: '$excludeNodeId',
//        placeholder: '$placeholder',
//        disabled: '$disabled',
//        multiple: '$multiple',
//        'onUpdate:modelValue': '$handlers.updateModelValue'
//      }
//    }
//  ],
//  library: {
//    HierarchicalSelectDropdown
//  },
//  props: [
//    'rootNodes',
//    'getChildrenFn',
//    'getNodeIdFn',
//    'getNodeLabelFn',
//    'hasChildrenFn',
//    'isDisabledFn',
//    'excludeNodeId',
//    'placeholder',
//    'multiple'
//  ],
//  features: [
//    function (node) {
//      node.context.handlers.updateModelValue = (value) => {
//        node.input(value)
//      }
//    }
//  ]
//}
//
//// Custom plugin to register hierarchical-select input
//export const hierarchicalSelectPlugin = (node) => {
//  node.addProps([
//      'rootNodes',
//    'getChildrenFn',
//    'getNodeIdFn',
//    'getNodeLabelFn',
//    'hasChildrenFn',
//    'isDisabledFn',
//    'excludeNodeId',
//    'placeholder',
//    'multiple'
//  ])
//
//  if (node.props.type === 'hierarchical-select') {
//    node.define(hierarchicalSelectInput)
//  }
//}

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
    'rootNodes',
    'getChildrenFn',
    'getNodeIdFn',
    'getNodeLabelFn',
    'hasChildrenFn',
    'isDisabledFn',
    'excludeNodeId',
    'placeholder'
  ]
}

// Custom plugin to register hierarchical-select input
export const hierarchicalSelectPlugin = (node) => {
  node.addProps([
    'rootNodes',
    'getChildrenFn',
    'getNodeIdFn',
    'getNodeLabelFn',
    'hasChildrenFn',
    'isDisabledFn',
    'excludeNodeId',
    'placeholder'
  ])

  if (node.props.type === 'hierarchical-select') {
    node.define(hierarchicalSelectInput)
  }
}