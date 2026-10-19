<script setup>
import { ref, computed, toValue } from 'vue'
import { useRecordGroupings } from '@/composables/programs/useRecordGroupings'
import { useCanCurate } from '@/composables/controls/useWriteAccess'

import RecordGroupingList from './RecordGroupingList.vue'
import RecordGroupingModal from './RecordGroupingModal.vue'

const props = defineProps({
  studyId: {
    type: String,
    required: true
  }
})

const {
  groupings,
  recordGroupTypes,
  isLoading,
  createGrouping,
  updateGrouping,
  deleteGrouping
} = useRecordGroupings(props.studyId)

// groupings are part of the study, so changing them needs curate access to it
const canCurate = useCanCurate({ entityLabel: 'STUDY', entityId: () => props.studyId })

// Modal state
const showModal = ref(false)
const editingGrouping = ref(null)
const modalError = ref('')

const isCreating = computed(() => !editingGrouping.value)

const openCreateModal = () => {
  editingGrouping.value = null
  modalError.value = ''
  showModal.value = true
}

const openEditModal = (grouping) => {
  editingGrouping.value = { ...grouping }
  modalError.value = ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingGrouping.value = null
  modalError.value = ''
}

const errorText = (errors, fallback) =>
  errors?.map((e) => e.message).join('; ') || fallback


const handleSave = async (formData) => {
  try {
    const groupingData = toValue(formData)
    const { status, errors } = isCreating.value
      ? await createGrouping({ groupingData: { ...groupingData, studyId: props.studyId } })
      : await updateGrouping({ groupingData })

    if (status === 'SUCCESS') {
      closeModal()
    } else {
      modalError.value = errorText(errors, 'Operation failed')
    }
  } catch (error) {
    modalError.value = error.message
  }
}

const handleDelete = async (grouping) => {
  if (confirm(`Delete grouping "${grouping.name}"?`)) {
    const { status, errors } = await deleteGrouping(grouping.id)
    if (status !== 'SUCCESS') {
      alert(`Failed to delete: ${errorText(errors, 'Unknown error')}`)
    }
  }
}
</script>

<template>
  <div class="record-grouping-panel">
    <div class="panel-header">
      <h3>Record Groupings</h3>
      <button v-if="canCurate" class="btn-primary" @click="openCreateModal">
        + Create Grouping
      </button>
    </div>

    <div v-if="isLoading" class="loading">Loading groupings...</div>
    <div v-else-if="groupings.length === 0" class="empty-state">
      <p>No groupings defined for this study yet.</p>
      <p class="hint">Create a grouping to organize records by study-specific contexts (e.g., replicates, batches).</p>
    </div>
    <div v-else class="groupings-list">
      <RecordGroupingList
        :groupings="groupings"
        :record-group-types="recordGroupTypes"
        :editable="canCurate"
        @edit="openEditModal"
        @delete="handleDelete"
      />
    </div>

    <RecordGroupingModal
      v-if="showModal"
      :visible="showModal"
      :grouping="editingGrouping"
      :record-group-types="recordGroupTypes"
      :study-id="studyId"
      :error="modalError"
      @close="closeModal"
      @save="handleSave"
    />
  </div>
</template>

<style scoped>
.record-grouping-panel {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.btn-primary {
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary:hover {
  background: #1976d2;
}

.loading,
.empty-state {
  padding: 24px;
  text-align: center;
  color: #666;
}

.hint {
  font-size: 0.9rem;
  color: #999;
}

.groupings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>