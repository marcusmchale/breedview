<script setup>
import { ref } from 'vue'
import { FormKit } from '@formkit/vue'

import { useSelectUnitsQuery } from '@/composables/datasets/selectUnitsQueries'
import { useDefinePositionQueries } from '@/composables/units/definePositionQueries'
import { useCachedName } from '@/composables/queryBase/cachedName'
import { useMutateUnits } from '@/composables/units/mutateUnits'
import { DERIVATION_STAGES } from '@/composables/units/derivations'

// The units a unit's material came from (derivedFrom), e.g. linking plantlets recorded already to the microcuttings
// they grew from. Unlike parents they pass nothing down. Units to add are chosen where they are now, as when units are
// received; one you can no longer read is kept as it is.
const props = defineProps({
  // { id, name, subject }
  unit: {
    type: Object,
    required: true
  },
  // as Unit.derivedFrom lists them: { unit: { id, name }, stage, description }
  derivedFrom: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['close', 'success'])

const { updateUnit, updateUnitLoading } = useMutateUnits()
const unitNameOf = useCachedName('Unit')

const rows = ref(props.derivedFrom.map((derivation) => ({
  unitId: derivation.unit.id,
  name: derivation.unit.name || `Unit ${derivation.unit.id}`,
  stage: derivation.stage,
  description: derivation.description ?? ''
})))
const pick = ref({ fromLocationId: null, unitIds: [] })
const editError = ref('')

const {
  location: fromLocation,
  regions,
  loadChildLocations,
  childLocationsLoading,
  currentChildLocations
} = useDefinePositionQueries({ locationId: () => pick.value.fromLocationId, layoutId: () => null })

const {
  rootNodes: unitRootNodes,
  loadChildren: loadChildUnits,
  childrenLoading: childUnitsLoading,
  currentChildren: childUnits,
  isSelectable: isSelectableUnit,
  hasChildren: unitHasChildren,
  loadTypeGroups: loadUnitTypeGroups
} = useSelectUnitsQuery({
  locationIds: () => (pick.value.fromLocationId ? [pick.value.fromLocationId] : []),
  unitIds: () => pick.value.unitIds
})

const addPicked = () => {
  const listed = new Set(rows.value.map((row) => String(row.unitId)))
  for (const unitId of pick.value.unitIds ?? []) {
    if (listed.has(String(unitId)) || String(unitId) === String(props.unit.id)) continue
    rows.value.push({ unitId, name: unitNameOf(unitId), stage: 'UNKNOWN', description: '' })
  }
  pick.value = { ...pick.value, unitIds: [] }
}

const removeRow = (index) => {
  rows.value = rows.value.filter((_, i) => i !== index)
}

const submit = async () => {
  editError.value = ''
  const { status, errors } = await updateUnit({
    id: props.unit.id,
    derivedFrom: rows.value.map((row) => ({
      unitId: row.unitId,
      stage: row.stage,
      description: row.description || null
    }))
  })
  if (status === 'SUCCESS') {
    emit('success')
    emit('close')
  } else {
    editError.value = errors?.map((error) => error.message).join(', ') || 'The units it came from could not be changed.'
  }
}
</script>

<template>
  <div class="modal modal-large" @click.stop>
    <div class="modal-header">
      <h4>What {{ unit.name || `Unit ${unit.id}` }} was derived from</h4>
    </div>
    <div class="modal-content">
      <p class="derive-help">
        The units its material came from, e.g. the microcuttings plantlets grew from. Unlike parents, they pass nothing
        down: the unit keeps its own germplasm and place, and their factors don't describe it.
      </p>

      <div v-if="rows.length === 0" class="empty-state">Not derived from any unit</div>
      <div v-for="(row, index) in rows" :key="row.unitId" class="derivation-row">
        <span class="derivation-name">{{ row.name }}</span>
        <select v-model="row.stage" class="derivation-type" :name="`stage_${index}`" title="The stage the material was at">
          <option v-for="option in DERIVATION_STAGES" :key="option.value" :value="option.value" :title="option.help">{{ option.label }}</option>
        </select>
        <input
          v-model="row.description"
          type="text"
          class="derivation-description"
          :name="`description_${index}`"
          placeholder="Description (optional)"
        />
        <button type="button" class="btn-remove" title="Remove" @click="removeRow(index)">&times;</button>
      </div>

      <FormKit v-model="pick" type="form" :actions="false" @submit="addPicked">
        <h5>Add units it came from</h5>
        <FormKit
          type="hierarchical-select"
          name="fromLocationId"
          label="At:"
          help="Where they are now"
          :selected="fromLocation"
          :rootNodes="regions"
          :loadChildrenFn="loadChildLocations"
          :childrenLoading="childLocationsLoading"
          :currentChildren="currentChildLocations"
          :get-node-label-fn="(node) => node.name || `${node.type?.name} ${node.id}`"
        />
        <FormKit
          type="hierarchical-multiselect"
          name="unitIds"
          label="Units:"
          help="From the unit graphs and arrivals there"
          :disabled="!pick.fromLocationId"
          :label-fn="unitNameOf"
          :rootNodes="unitRootNodes"
          :loadChildrenFn="loadChildUnits"
          :childrenLoading="childUnitsLoading"
          :currentChildren="childUnits"
          :is-selectable-fn="isSelectableUnit"
          :has-children-fn="unitHasChildren"
          :get-node-label-fn="(node) => node.name || `${node.subject?.name} ${node.id}`"
          :load-type-groups-fn="loadUnitTypeGroups"
        />
        <button type="submit" class="btn btn-secondary btn-small" :disabled="!pick.unitIds?.length">Add</button>
      </FormKit>

      <div v-if="editError" class="error-message">{{ editError }}</div>

      <div class="form-actions">
        <button type="button" class="btn btn-primary" :disabled="updateUnitLoading" @click="submit">
          {{ updateUnitLoading ? 'Saving…' : 'Save' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="updateUnitLoading" @click="emit('close')">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.derive-help {
  margin: 0 0 12px;
  color: #666;
  font-size: 0.9rem;
}

h5 {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.empty-state {
  padding: 8px 0;
  color: #999;
  font-style: italic;
}

.derivation-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.derivation-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.derivation-type,
.derivation-description {
  padding: 4px 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.85rem;
}

.derivation-description {
  flex: 1;
}

.btn-remove {
  border: none;
  background: none;
  color: #d32f2f;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
</style>
