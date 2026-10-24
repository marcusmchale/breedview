<script setup>
import { computed, ref } from 'vue'
import { FormKit } from '@formkit/vue'

import ControlSelector from '@/components/controls/ControlSelector.vue'

import { useSelectUnitsQuery } from '@/composables/datasets/selectUnitsQueries'
import { useDefinePositionQueries } from '@/composables/units/definePositionQueries'
import { useSelectGermplasmQueries } from '@/composables/germplasm/selectGermplasmQueries'
import { useCachedName } from '@/composables/queryBase/cachedName'
import { CHILD_NAME_TEMPLATE, MAX_CHILDREN, childName, useAddChildren } from '@/composables/units/addChildren'
import { today } from '@/composables/units/unitPositions'

// Adds children of one subject to many units at once, e.g. a sampling event: the leaves taken from each tree of a field
// on one day. The units are given ({ unitIds } or { arrival }, as unitsAddChildren takes them), or picked at a location
// and the places within it, where "By type…" selects all of a subject. Each child is named from a template and, with
// the day it was taken, placed where its unit was then; without one it is where its unit is (breedgraph README, Unit).
const props = defineProps({
  // the units to add children to; null to pick them
  units: {
    type: Object,
    default: null
  },
  // the units given, e.g. "the 12 units that arrived at Lab on 2025-03-25"
  description: {
    type: String,
    default: null
  },
  // the name of one of the units given, for the example name
  exampleName: {
    type: String,
    default: null
  },
  subjects: {
    type: Array,
    default: () => []
  },
  // where the units are picked, at first
  locationId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'added'])

const { addChildren, addChildrenLoading } = useAddChildren()
const unitNameOf = useCachedName('Unit')

const formData = ref({
  locationId: props.locationId,
  unitIds: [],
  subjectId: null,
  count: 1,
  name: CHILD_NAME_TEMPLATE,
  start: today(),
  description: null,
  germplasmId: null
})
const controlTeamId = ref(null)
const release = ref(null)
const addError = ref('')

const picking = computed(() => !props.units)

const {
  location,
  regions,
  loadChildLocations,
  childLocationsLoading,
  currentChildLocations
} = useDefinePositionQueries({ locationId: () => formData.value.locationId, layoutId: () => null })

const {
  rootNodes: unitRootNodes,
  loadChildren: loadChildUnits,
  childrenLoading: childUnitsLoading,
  currentChildren: childUnits,
  isSelectable: isSelectableUnit,
  hasChildren: unitHasChildren,
  loadTypeGroups: loadUnitTypeGroups
} = useSelectUnitsQuery({
  locationIds: () => (picking.value && formData.value.locationId ? [formData.value.locationId] : []),
  unitIds: () => formData.value.unitIds,
  below: true
})

const {
  germplasm,
  crops,
  currentChildGermplasm,
  childGermplasmLoading,
  loadChildGermplasm,
  hasChildren
} = useSelectGermplasmQueries({ germplasmId: () => formData.value.germplasmId })

const subjectOptions = computed(() => [
  { value: null, label: '-- Select a subject --' },
  ...props.subjects.map((subject) => ({ value: subject.id, label: subject.name }))
])
const subjectName = computed(() => props.subjects.find((subject) => subject.id === formData.value.subjectId)?.name)

const count = computed(() => Number(formData.value.count) || 0)
const template = computed(() => formData.value.name?.trim() ?? '')
// the first name the template gives, from a unit chosen and the subject, or placeholders until they are
const example = computed(() => {
  if (!template.value) return null
  const parent = picking.value
    ? (formData.value.unitIds.length ? unitNameOf(formData.value.unitIds[0]) : null)
    : props.exampleName
  return childName(template.value, parent || 'Tree 1', subjectName.value || 'Leaf', 1)
})
// the name tells a unit's children apart only with {n}
const nameError = computed(() => (template.value && count.value > 1 && !template.value.includes('{n}')
  ? 'With more than one child for each unit, the name needs {n} to tell them apart'
  : ''))

const submit = async () => {
  addError.value = ''
  if (nameError.value) return
  const parents = picking.value ? { unitIds: formData.value.unitIds } : props.units
  if (picking.value && !formData.value.unitIds.length) {
    addError.value = 'Choose the units to add children to.'
    return
  }
  const { status, errors, units } = await addChildren({
    parents,
    subjectId: formData.value.subjectId,
    count: count.value,
    name: template.value,
    description: formData.value.description,
    germplasmId: formData.value.germplasmId,
    start: formData.value.start,
    controlTeamId,
    release
  })
  if (status === 'SUCCESS') {
    emit('added', { units })
    emit('close')
  } else {
    addError.value = errors?.map((error) => error.message).join(', ') || 'The children could not be added.'
  }
}
</script>

<template>
  <div class="modal modal-large" @click.stop>
    <div class="modal-header">
      <h4>{{ description ? `Add children to ${description}` : 'Add children to units' }}</h4>
    </div>
    <FormKit
      v-model="formData"
      type="form"
      :actions="false"
      class="modal-content"
      @submit="submit"
    >
      <p class="add-help">
        The same children for each unit, e.g. the leaves sampled from each tree of a field. With the day they were
        taken, each is placed where its unit was then, from then, so a sample sent on to a lab afterwards arrives there.
      </p>
      <template v-if="picking">
        <FormKit
          type="hierarchical-select"
          name="locationId"
          label="At:"
          help="Where the units are, or a place above them"
          :selected="location"
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
          help="The units to add children to, there and at the places within it: &quot;By type…&quot; selects all of a subject, e.g. every tree"
          :disabled="!formData.locationId"
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
      </template>
      <FormKit
        type="select"
        name="subjectId"
        label="Subject:"
        help="What each child is, e.g. a leaf"
        :options="subjectOptions"
        validation="required"
      />
      <FormKit
        type="number"
        name="count"
        label="Children for each unit:"
        :min="1"
        :max="MAX_CHILDREN"
        :validation="`required|min:1|max:${MAX_CHILDREN}`"
      />
      <FormKit
        type="text"
        name="name"
        label="Name:"
        help="{parent} is the unit's name, {subject} the subject's and {n} the child's number, from 1. Empty, they are unnamed."
      />
      <p v-if="nameError" class="error-message">{{ nameError }}</p>
      <p v-else-if="example" class="example">The first is named “{{ example }}”</p>
      <FormKit
        type="text"
        name="start"
        label="Taken on (optional):"
        help="Each child is placed where its unit was then, from then: YYYY-MM-DD, or partial (YYYY-MM), or with a time (YYYY-MM-DDTHH:mm). Empty, they stay with their units, undated."
        validation="partialDateTime"
      />
      <FormKit
        type="text"
        name="description"
        label="Description (optional):"
      />
      <FormKit
        type="hierarchical-select"
        name="germplasmId"
        label="Germplasm (optional):"
        help="Empty, they take their units' germplasm"
        :selected="germplasm"
        :rootNodes="crops"
        :hasChildrenFn="hasChildren"
        :loadChildrenFn="loadChildGermplasm"
        :childrenLoading="childGermplasmLoading"
        :currentChildren="currentChildGermplasm"
        :get-node-label-fn="(entry) => entry.name || `${entry.type?.name} ${entry.id}`"
        :clearable="true"
      />

      <div v-if="addError" class="error-message">{{ addError }}</div>

      <div class="form-actions">
        <ControlSelector
          v-model:controlTeamId="controlTeamId"
          v-model:readRelease="release"
          class="form-control"
          @error="addError = $event"
        />
        <button type="submit" class="btn btn-primary" :disabled="addChildrenLoading || !!nameError">
          {{ addChildrenLoading ? 'Adding…' : 'Add' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="addChildrenLoading" @click="emit('close')">
          Cancel
        </button>
      </div>
    </FormKit>
  </div>
</template>

<style scoped>
.add-help {
  margin: 0 0 12px;
  color: #666;
  font-size: 0.9rem;
}

.example {
  margin: -4px 0 12px;
  color: #555;
  font-size: 0.85rem;
}
</style>
