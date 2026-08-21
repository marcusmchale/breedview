<script setup>
import { ref, computed } from 'vue'

import { useBlocksBoxQueries } from '@/composables/blocks/blocksBoxQueries'

import CreateBlockModal from "@/components/blocks/createBlockModal.vue"

const props = defineProps({
  locationId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['block-selected'])

const locationIds = computed(() => {
  return [props.locationId]
})

const {
  blocks,
  blocksLoading,
  blocksError,
  refetchBlocks,
  subjects
} = useBlocksBoxQueries({ locationIds: locationIds })

// Add Unit Modal state
const isAddUnitModalOpen = ref(false)
const openAddUnitModal = () => {
  isAddUnitModalOpen.value = true
}
const closeAddUnitModal = () => {
  isAddUnitModalOpen.value = false
}
const handleAddUnitSuccess = () => {
  refetchBlocks()
}

// Selected block
const selectedBlockId = ref(null)
const handleBlockClick = (block) => {
  selectedBlockId.value = block.id
  emit('block-selected', block.id)
}
</script>

<template>
  <div class="blocks-box">
    <div class="blocks-header">
      <h5>Blocks</h5>
      <button
        @click="openAddUnitModal"
        class="btn btn-sm btn-add-unit"
        title="Create new block"
      >
        + New Block
      </button>
    </div>

    <div v-if="blocksLoading" class="loading">
      Loading blocks...
    </div>
    <div v-else-if="blocksError" class="error">
      Error loading blocks!
    </div>
    <div v-else-if="blocks.length === 0" class="empty-state">
      No blocks at this location
    </div>
    <div v-else class="blocks-list">
      <div
        v-for="block in blocks"
        :key="`blockNode_${block?.id}`"
        class="block-item"
        :class="{ selected: selectedBlockId === block.id }"
        @click="handleBlockClick(block)"
      >
        <span class="block-name">{{ block.name || `${block.subject?.name} ${block.id}` }}</span>
        <span class="block-subject">{{ block.subject?.name }}</span>
      </div>
    </div>

    <div v-if="isAddUnitModalOpen" class="modal-overlay" @click="closeAddUnitModal">
      <CreateBlockModal
        :subjects="subjects"
        :locationId="locationId"
        @close="closeAddUnitModal"
        @success="handleAddUnitSuccess"
      />
    </div>
  </div>
</template>

<style scoped>
.blocks-box {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #f9f9f9;
  height: 100%;
}

.blocks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.blocks-header h5 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.block-name {
  font-weight: 500;
  color: #333;
  font-size: 13px;
}

.block-subject {
  font-size: 11px;
  color: #666;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 10px;
}

.btn-add-unit {
  background-color: #28a745;
  color: white;
  white-space: nowrap;
}

.btn-add-unit:hover:not(:disabled) {
  background-color: #218838;
}

.loading,
.empty-state {
  text-align: center;
  padding: 20px;
  color: #666;
  font-size: 13px;
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.block-item:hover {
  background-color: #f5f5f5;
  border-color: #bbb;
}

.block-item.selected {
  background-color: #e3f2fd;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>