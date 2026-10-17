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

const getType = (typeId, types) => types.find(t => t.id === typeId)
</script>

<template>
  <div class="groupings-list">
    <RecordGroupingCard
      v-for="grouping in groupings"
      :key="`${grouping.name}-${grouping.scope}`"
      :grouping="grouping"
      :type-name="getType(grouping.type.id, recordGroupTypes)?.name || grouping.type.name || grouping.type.id"
      :extent="grouping.extent"
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