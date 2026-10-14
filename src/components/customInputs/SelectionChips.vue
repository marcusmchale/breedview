<script>
/**
 * The chips of a multi-selection: one per group selected by type ("Tree · 2,417"), then one per item selected by
 * hand while there are at most MAX_SELECTION_CHIPS of them, otherwise their count. Each chip removes what it shows.
 */
export const MAX_SELECTION_CHIPS = 20
</script>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // the selected ids
  ids: { type: Array, default: () => [] },
  // groups selected by type, as [{ key, label, ids }]; their ids are not shown as single chips
  groups: { type: Array, default: () => [] },
  labelFn: { type: Function, default: (id) => `${id}` },
  // what one selected thing is called, for the counts
  noun: { type: String, default: 'selected' },
  disabled: { type: Boolean, default: false },
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['remove', 'remove-group', 'clear'])

const grouped = computed(() => new Set(props.groups.flatMap((group) => group.ids.map(String))))
const singleIds = computed(() => props.ids.filter((id) => !grouped.value.has(String(id))))
const shownSingleIds = computed(() => (singleIds.value.length > MAX_SELECTION_CHIPS ? [] : singleIds.value))
const hiddenCount = computed(() => singleIds.value.length - shownSingleIds.value.length)
</script>

<template>
  <div class="selection-chips" :class="{ compact }">
    <span v-for="group in groups" :key="`group-${group.key}`" class="selection-chip group-chip">
      {{ group.label }} · {{ group.ids.length.toLocaleString() }}
      <button type="button" class="chip-remove" :disabled="disabled" title="Remove these" @click.stop="emit('remove-group', group)">×</button>
    </span>
    <span v-for="id in shownSingleIds" :key="`single-${id}`" class="selection-chip">
      {{ labelFn(id) }}
      <button type="button" class="chip-remove" :disabled="disabled" title="Remove" @click.stop="emit('remove', id)">×</button>
    </span>
    <span v-if="hiddenCount > 0" class="selection-chip count-chip">
      {{ hiddenCount.toLocaleString() }} {{ noun }}
      <button type="button" class="chip-remove" :disabled="disabled" title="Clear the selection" @click.stop="emit('clear')">×</button>
    </span>
  </div>
</template>

<style scoped>
.selection-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.selection-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #e3f2fd;
  border: 1px solid #2196f3;
  border-radius: 12px;
  font-size: 12px;
  color: #1976d2;
}

.group-chip {
  font-weight: 600;
}

.count-chip {
  background: #f0f4f8;
  border-color: #90a4ae;
  color: #455a64;
}

.chip-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  line-height: 1;
  font-weight: bold;
}

.chip-remove:hover:not(:disabled) {
  color: #0d47a1;
}

.chip-remove:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
