<script setup>

import { ref, computed } from 'vue'
import { FormKit } from "@formkit/vue";

import { useUnitUpdateQueries } from "@/composables/blocks/unitUpdateQueries"
import { useSelectGermplasmQueries } from "@/composables/germplasm/selectGermplasmQueries"
import { useMutateUnits } from "@/composables/blocks/mutateUnits"

const props = defineProps({
  subjects: {
    type: Array,
    required: true
  },
  unit: {
    type: Object,
    required: true
  },
  blockId: {
    type: Number,
    required: true
  },
  locationId: {
    type: Number,
    required: false  // only needed when updating a root unit (block) to allow merging into another block.
  }
})

const emit = defineEmits(['success', 'close', 'reload-blocks'])

const updateFormData = ref({
  subjectId: props.unit.subject?.id,
  germplasmId: props.unit.germplasm?.id,
  name: props.unit.name,
  description: props.unit.description,
  parentIds: props.unit.parents.map(p => p.id)
})

const {
    germplasm,
    crops,
    currentChildGermplasm,
    childGermplasmLoading,
    loadChildGermplasm,
    hasChildren
} = useSelectGermplasmQueries({germplasmId: () => updateFormData.value.germplasmId })

const rowKeys = ref(props.unit.parents.map(() => Math.random().toString(36).substring(2, 7)))
const {
  blocks,
  blocksLoading,
  blocksError,

  blockUnit,
  blockLoading,
  blockError,

  parents,
  parentsLoading,
  parentsError,

  currentChildUnits,
  childUnitsLoading,
  loadChildUnits
} = useUnitUpdateQueries({
  locationId: props.locationId,
  blockId: props.blockId,
  // This breaks the proxy-link that causes the feedback loop.
  parentIds: computed(() => {
    const ids = updateFormData.value?.parentIds;
    return Array.isArray(ids) ? [...ids] : [];
  })
})

const handleAddParent = () => {
  const currentIds = updateFormData.value.parentIds || []
  updateFormData.value.parentIds = [...currentIds, null]
  rowKeys.value.push(Math.random().toString(36).substring(2, 7))
}

const handleParentChange = (val, index) => {
  updateFormData.value.parentIds[index] = val
}

const handleRemoveParent = (index) => {
  // Create a NEW array reference without the item at index.
  const currentIds = updateFormData.value.parentIds || []
  updateFormData.value.parentIds = currentIds.filter((_, i) => i !== index)

  rowKeys.value.splice(index, 1)
}

const { getCached, updateUnit, updateUnitLoading, updateUnitError } = useMutateUnits()

const blockUnits = computed(()=> {
  if (props.unit?.parents?.length > 0) {
    return blockUnit.value? [blockUnit.value]: []
  } else {
    return blocks
  }
})

const updateError = ref('')

const submitUpdate = async () => {
  try {
    updateError.value = ''

    const unitData = {
      unitId: props.unit.id,
      subjectId: updateFormData.value.subjectId || undefined,
      germplasmId: updateFormData.value.germplasmId || undefined,
      name: updateFormData.value.name || undefined,
      description: updateFormData.value.description || undefined,
      parentIds: updateFormData.value.parentIds
    }
    const oldCachedUnit = getCached( {itemId: props.unit.id} )
    const { status, errors } = await updateUnit(unitData)
    if (status === 'SUCCESS') {
      emit('success')
      const newCachedUnit = getCached( {itemId: props.unit.id} )
      if (
          (newCachedUnit.parents?.length === 0 || oldCachedUnit.parents?.length === 0) &&
          newCachedUnit.parents?.length !== oldCachedUnit.parents?.length
      ) {
        emit('reload-blocks')
      }
      emit('close')
    } else {
      if (errors && errors.length > 0) {
        updateError.value = errors.map(err => err.message).join(', ')
      } else {
        updateError.value = 'Failed to update unit. Please try again.'
      }
    }
  } catch (error) {
    console.error('Error updating unit:', error)
    updateError.value = error.message || 'An unexpected error occurred.'
  }
}

</script>


<template>
<div class="modal" @click.stop>
  <div class="modal-header">
    <h4>Update Unit Details</h4>
  </div>

  <FormKit
    v-model="updateFormData"
    type="form"
    @submit="submitUpdate"
    :actions="false"
    class="modal-content"
  >
    <FormKit
      type="select"
      name="subjectId"
      label="Subject Type:"
      :options="subjects.map(subject => ({ value: subject.id, label: subject.name }))"
      validation="required"
    />

    <FormKit
      type="hierarchical-select"
      name="germplasmId"
      label="Germplasm:"
      help="Optionally define a germplasm entry for this unit"
      :selected="germplasm"
      :rootNodes="crops"
      :hasChildrenFn="hasChildren"
      :loadChildrenFn="loadChildGermplasm"
      :childrenLoading="childGermplasmLoading"
      :currentChildren="currentChildGermplasm"
      :exclude-node-id=null
      :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
      validation="optional"
    />

    <FormKit
      type="text"
      name="name"
      label="Unit Name (optional):"
    />
    <div v-if="parentsLoading">Loading parents...</div>
    <div v-else-if="parentsError" class="error-message">{{ updateError }}</div>
    <div v-if="unit?.parents?.length === 0" class="parents-section">
      <div class="parent-input-row">
        <FormKit
          type="hierarchical-select"
          id="merge-select"
          label="Merge into block"
          help="Optionally select a parent unit in another block to merge"
          :value="updateFormData.parentIds[0]"
          @input="(val) => handleParentChange(val, 0)"
          :selected="parents.find(p => p.id === updateFormData.parentIds[0])"
          :rootNodes="blockUnits"
          :loadChildrenFn="loadChildUnits"
          :childrenLoading="childUnitsLoading"
          :currentChildren="currentChildUnits"
          :excludeNodeId="unit.id"
          :getNodeLabelFn="(u) => u.name || `${u.subject?.name} ${u.id}`"
          validation="optional"
        />
        <button
          type="button"
          @click="handleRemoveParent(index)"
          class="btn-remove"
          title="Remove parent"
        >
        &times;
        </button>
      </div>
    </div>
    <div v-else class="parents-section">
      <div class="section-header">
        <h5>Parents</h5>
        <button
            type="button"
            @click="handleAddParent"
            class="btn btn-secondary btn-small"
        >
          Add Parent
        </button>
      </div>
      <div v-if="blocksLoading || blockLoading" class="loading-state"> Loading Blocks...</div>
      <div v-else-if="blocksError || blockError" class="error-message"> Error Loading Blocks!</div>
      <FormKit type="list">
        <div v-for="(rowKey, index) in rowKeys" :key="rowKey" class="parent-input-row">
          <FormKit
            type="hierarchical-select"
            :id="`parent-select-${rowKey}`"
            :label="`Parent ${index + 1}`"
            :value="updateFormData.parentIds[index]"
            @input="(val) => handleParentChange(val, index)"
            :selected="parents.find(p => p.id === updateFormData.parentIds[index])"
            :rootNodes="blockUnits"
            :loadChildrenFn="loadChildUnits"
            :childrenLoading="childUnitsLoading"
            :currentChildren="currentChildUnits"
            :excludeNodeId="unit.id"
            :getNodeLabelFn="(u) => u.name || `${u.subject?.name} ${u.id}`"
            validation="required"
          />
          <button
            type="button"
            @click="handleRemoveParent(index)"
            class="btn-remove"
            title="Remove parent"
          >
            &times;
          </button>
        </div>
      </FormKit>
    </div>
    <div v-if="updateUnitError" class="error-message">
      {{ updateUnitError }}
    </div>
    <div v-if="updateError" class="error-message">
      {{ updateError }}
    </div>
    <div class="form-actions">
      <button
          :disabled="updateUnitLoading"
          type="submit"
          class="btn btn-primary">
        Update
      </button>
      <button
          type="button"
          @click="$emit('close')"
          class="btn btn-secondary"
      >
        Cancel
      </button>
    </div>
  </FormKit>
</div>
</template>

<style scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.parent-input-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.parent-input-row :deep(.formkit-outer) {
  flex-grow: 1;
  margin-bottom: 0;
}

.btn-remove {
  background: #ff4d4f;
  color: white;
  border: none;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  cursor: pointer;
  margin-top: 26px; /* Align with input field below label */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.btn-small {
  padding: 4px 12px;
  font-size: 13px;
}

</style>