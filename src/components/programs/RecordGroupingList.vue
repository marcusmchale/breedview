<script setup>
import RecordGroupingCard from './RecordGroupingCard.vue'

defineProps({
  groupings: {
    type: Array,
    required: true
  },
  recordGroupTypes: {
    type: Array,
    required: true
  },
  editable: {
    type: Boolean,
    default: false
  }
})

defineEmits(['edit', 'delete'])

const getTypeName = (typeId, types) => {
  return types.find(t => t.id === typeId)?.name || typeId
}
</script>

<template>
  <div class="groupings-list">
    <RecordGroupingCard
      v-for="grouping in groupings"
      :key="`${grouping.name}-${grouping.scope}`"
      :grouping="grouping"
      :type-name="getTypeName(grouping.type.id, recordGroupTypes)"
      :editable="editable"
      @edit="$emit('edit', grouping)"
      @delete="$emit('delete', grouping)"
    />
  </div>
</template>

<style scoped>
.groupings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>