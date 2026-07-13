<script setup>
import { computed } from 'vue'
import { FormKit } from '@formkit/vue'

import { useSelectGermplasmQueries } from '@/composables/germplasm/selectGermplasmQueries'

const props = defineProps({
  row: {
    type: Object,
    required: true
  },
  rowIndex: {
    type: Number,
    required: true
  },
  subjects: {
    type: Array,
    required: true
  },
  coordinateAxes: {
    type: Array,
    required: true
  },
  createUnitLoading: {
    type: Boolean,
    default: false
  },
  bulkSubmitting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['remove'])

const {
  germplasm,
  crops,
  currentChildGermplasm,
  childGermplasmLoading,
  loadChildGermplasm,
  hasChildren
} = useSelectGermplasmQueries({ germplasmId: () => props.row.germplasmId })

const rowCoordinates = computed(() => {
  return props.coordinateAxes.map((_, index) => `coordinate_${index}`)
})

const rowStatusLabel = computed(() => {
  if (props.row.status === 'completed') return 'Completed'
  if (props.row.status === 'error') return 'Needs fix'
  if (props.row.status === 'submitting') return 'Adding...'
  return 'Pending'
})

const markRowDirty = () => {
  if (props.row.status === 'error') {
    props.row.status = 'pending'
    props.row.errorMessage = ''
  }
}
</script>

<template>
  <tr
    :class="{
      'row-completed': row.status === 'completed',
      'row-error': row.status === 'error',
      'row-submitting': row.status === 'submitting'
    }"
  >
    <td class="row-index">{{ rowIndex + 1 }}</td>
    <td class="status-cell">
      <span
        class="status-pill"
        :class="{
          'status-pill--completed': row.status === 'completed',
          'status-pill--error': row.status === 'error',
          'status-pill--submitting': row.status === 'submitting'
        }"
      >
        {{ rowStatusLabel }}
      </span>
    </td>
    <td>
      <select
        v-model="row.subjectId"
        class="bulk-input"
        :disabled="createUnitLoading || bulkSubmitting || row.status === 'completed'"
        @change="markRowDirty"
      >
        <option :value="null">-- Select a subject --</option>
        <option v-for="subject in subjects" :key="subject.id" :value="subject.id">
          {{ subject.name }}
        </option>
      </select>
    </td>
    <td>
      <FormKit
        type="hierarchical-select"
        v-model="row.germplasmId"
        :selected="germplasm"
        :rootNodes="crops"
        :hasChildrenFn="hasChildren"
        :loadChildrenFn="loadChildGermplasm"
        :childrenLoading="childGermplasmLoading"
        :currentChildren="currentChildGermplasm"
        :exclude-node-id="null"
        :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
        validation="optional"
        :disabled="createUnitLoading || bulkSubmitting || row.status === 'completed'"
        @update:modelValue="markRowDirty"
        @change="markRowDirty"
      />
    </td>
    <td>
      <input
        v-model="row.positionStart"
        type="text"
        class="bulk-input"
        :disabled="createUnitLoading || bulkSubmitting || row.status === 'completed'"
        placeholder="Optional"
        @input="markRowDirty"
      >
    </td>
    <td>
      <input
        v-model="row.positionEnd"
        type="text"
        class="bulk-input"
        :disabled="createUnitLoading || bulkSubmitting || row.status === 'completed'"
        placeholder="Optional"
        @input="markRowDirty"
      >
    </td>
    <td v-for="(key, index) in rowCoordinates" :key="key">
      <input
        v-model="row[key]"
        type="text"
        class="bulk-input"
        :disabled="createUnitLoading || bulkSubmitting || row.status === 'completed'"
        :placeholder="coordinateAxes[index]"
        @input="markRowDirty"
      >
    </td>
    <td>
      <input
        v-model="row.name"
        type="text"
        class="bulk-input"
        :disabled="createUnitLoading || bulkSubmitting || row.status === 'completed'"
        placeholder="Optional"
        @input="markRowDirty"
      >
    </td>
    <td>
      <input
        v-model="row.description"
        type="text"
        class="bulk-input"
        :disabled="createUnitLoading || bulkSubmitting || row.status === 'completed'"
        placeholder="Optional"
        @input="markRowDirty"
      >
    </td>
    <td class="row-actions">
      <button
        type="button"
        class="btn btn-secondary btn-small"
        :disabled="createUnitLoading || bulkSubmitting || row.status === 'submitting'"
        @click="emit('remove')"
      >
        Remove
      </button>
    </td>
  </tr>
  <tr v-if="row.status === 'error' && row.errorMessage" class="row-error-message">
    <td :colspan="9 + coordinateAxes.length" class="row-error-message-cell">
      {{ row.errorMessage }}
    </td>
  </tr>
</template>

<style scoped>
.row-completed {
  background: #f8f9fa;
  color: #6c757d;
}

.row-error {
  background: #fff5f5;
}

.row-submitting {
  opacity: 0.85;
}

.status-cell {
  width: 100px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: #e9ecef;
  color: #495057;
}

.status-pill--completed {
  background: #e2e3e5;
  color: #5c636a;
}

.status-pill--error {
  background: #f8d7da;
  color: #842029;
}

.status-pill--submitting {
  background: #cff4fc;
  color: #055160;
}

.bulk-input {
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font: inherit;
  background: white;
  color: #212529;
  box-sizing: border-box;
}

.bulk-input:disabled {
  background: #f5f5f5;
  color: #6c757d;
}

.row-error-message-cell {
  padding: 0 12px 12px;
  color: #842029;
  background: #fff5f5;
  font-size: 13px;
}
</style>
