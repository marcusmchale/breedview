<template>
  <div :class="context.classes.outer">
    <!-- Label -->
    <label
      v-if="context.label"
      :class="context.classes.label"
      :for="context.id"
    >
      {{ context.label }}
    </label>

    <!-- Wrapper -->
    <div :class="context.classes.wrapper">
      <div :class="context.classes.inner">
        <HierarchicalSelectDropdown
          :model-value="context._value"
          @update:model-value="context.node.input($event)"
          :selected="context.selected"
          :rootNodes="context.rootNodes"
          :hasChildrenFn="context.hasChildrenFn"
          :loadChildrenFn="context.loadChildrenFn"
          :childrenLoading="context.childrenLoading"
          :currentChildren="context.currentChildren"
          :get-node-label-fn="context.getNodeLabelFn"
          :is-disabled-fn="context.isDisabledFn"
          :is-selectable-fn="context.isSelectableFn"
          :exclude-node-id="context.excludeNodeId"
          :placeholder="context.placeholder || context.attrs.placeholder"
          :disabled="context.disabled"
        />
      </div>
    </div>

    <!-- Help text -->
    <div
      v-if="context.help"
      :class="context.classes.help"
    >
      {{ context.help }}
    </div>

    <!-- Validation messages -->
    <ul
      v-if="context.messages.length"
      :class="context.classes.messages"
    >
      <li
        v-for="message in context.messages"
        :key="message.key"
        :class="context.classes.message"
        :data-message-type="message.type"
      >
        {{ message.value }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import HierarchicalSelectDropdown from './HierarchicalSelectDropdown.vue'

defineProps({
  context: {
    type: Object,
    required: true
  }
})

</script>