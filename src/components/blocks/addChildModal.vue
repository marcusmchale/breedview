<script setup>
import { computed, ref, watch } from 'vue'
import { FormKit } from '@formkit/vue'

import { useDefinePositionQueries } from '@/composables/blocks/definePositionQueries'
import { useSelectGermplasmQueries } from '@/composables/germplasm/selectGermplasmQueries'
import { useMutateUnits } from '@/composables/blocks/mutateUnits'
import BulkChildRow from '@/components/blocks/BulkChildRow.vue'

const props = defineProps({
  subjects: {
    type: Array,
    required: true
  },
  parentUnit: {
    type: Object,
    required: false
  },
  parentPosition: {
    type: Object,
    required: false
  }
})

const emit = defineEmits(['close', 'success'])

const { createUnit, createUnitLoading, createUnitError } = useMutateUnits()

const mode = ref('single')
const bulkSubmitting = ref(false)
let bulkRowId = 0

const createBulkRow = (overrides = {}) => ({
  key: bulkRowId++,
  subjectId: null,
  germplasmId: null,
  name: '',
  description: '',
  positionStart: '',
  positionEnd: '',
  status: 'pending',
  errorMessage: '',
  ...overrides
})

const singleFormData = ref({
  parentName: props.parentUnit?.name || `${props.parentUnit?.subject?.name} ${props.parentUnit?.id}`,
  subjectId: null,
  germplasmId: null,
  name: '',
  description: '',
  positionLocationId: props.parentPosition?.location?.id,
  positionLayoutId: props.parentPosition?.layout?.id,
  positionStart: props.parentPosition?.end,
  positionEnd: null
})

const bulkTemplate = ref({
  parentName: props.parentUnit?.name || `${props.parentUnit?.subject?.name} ${props.parentUnit?.id}`,
  positionLocationId: props.parentPosition?.location?.id,
  positionLayoutId: props.parentPosition?.layout?.id,
  positionStart: props.parentPosition?.end,
  positionEnd: null,
  subjectId: null,
  germplasmId: null,
  name: '',
  description: ''
})

const bulkRows = ref([createBulkRow()])

const {
  location: singleLocation,
  regions: singleRegions,
  loadChildLocations: loadSingleChildLocations,
  childLocationsLoading: singleChildLocationsLoading,
  currentChildLocations: singleCurrentChildLocations,
  layout: singleLayout,
  arrangements: singleArrangements,
  loadChildLayouts: loadSingleChildLayouts,
  childLayoutsLoading: singleChildLayoutsLoading,
  currentChildLayouts: singleCurrentChildLayouts
} = useDefinePositionQueries({
  locationId: () => singleFormData.value.positionLocationId,
  layoutId: () => singleFormData.value.positionLayoutId
})

const {
  germplasm: singleGermplasm,
  crops: singleCrops,
  currentChildGermplasm: singleCurrentChildGermplasm,
  childGermplasmLoading: singleChildGermplasmLoading,
  loadChildGermplasm: loadSingleChildGermplasm,
  hasChildren: singleHasChildren
} = useSelectGermplasmQueries({ germplasmId: () => singleFormData.value.germplasmId })

const {
  location: bulkLocation,
  regions: bulkRegions,
  loadChildLocations: loadBulkChildLocations,
  childLocationsLoading: bulkChildLocationsLoading,
  currentChildLocations: bulkCurrentChildLocations,
  layout: bulkLayout,
  arrangements: bulkArrangements,
  loadChildLayouts: loadBulkChildLayouts,
  childLayoutsLoading: bulkChildLayoutsLoading,
  currentChildLayouts: bulkCurrentChildLayouts
} = useDefinePositionQueries({
  locationId: () => bulkTemplate.value.positionLocationId,
  layoutId: () => bulkTemplate.value.positionLayoutId
})

const {
  germplasm: bulkGermplasm,
  crops: bulkCrops,
  currentChildGermplasm: bulkCurrentChildGermplasm,
  childGermplasmLoading: bulkChildGermplasmLoading,
  loadChildGermplasm: loadBulkChildGermplasm,
  hasChildren: bulkHasChildren
} = useSelectGermplasmQueries({ germplasmId: () => bulkTemplate.value.germplasmId })

const arrangementsWithNull = computed(() => {
  return [
    { id: null, name: '-- None --' },
    ...singleArrangements.value
  ]
})

const bulkArrangementsWithNull = computed(() => {
  return [
    { id: null, name: '-- None --' },
    ...bulkArrangements.value
  ]
})

const subjectsWithNull = computed(() => {
  return [
    { value: null, label: '-- Select a subject --' },
    ...props.subjects.map(subject => ({ value: subject.id, label: subject.name }))
  ]
})

const addChildError = ref('')

const singleCoordinateKeys = computed(() => {
  return singleLayout.value?.axes?.map((_, index) => `coordinate_${index}`) || []
})

const bulkCoordinateKeys = computed(() => {
  return bulkLayout.value?.axes?.map((_, index) => `coordinate_${index}`) || []
})

const ensureCoordinateKeys = (target, keys) => {
  const next = { ...target }
  keys.forEach((key) => {
    if (!(key in next)) {
      next[key] = ''
    }
  })
  Object.keys(next).forEach((key) => {
    if (key.startsWith('coordinate_') && !keys.includes(key)) {
      delete next[key]
    }
  })
  return next
}

watch(singleCoordinateKeys, (keys) => {
  singleFormData.value = ensureCoordinateKeys(singleFormData.value, keys)
}, { immediate: true })

watch(bulkCoordinateKeys, (keys) => {
  bulkTemplate.value = ensureCoordinateKeys(bulkTemplate.value, keys)
  bulkRows.value = bulkRows.value.map(row => ensureCoordinateKeys(row, keys))
}, { immediate: true })

const buildCoordinates = (source, keys) => {
  return keys.map(key => source[key] || '')
}

const buildPosition = (source, keys) => {
  return {
    locationId: source.positionLocationId,
    layoutId: source.positionLayoutId || undefined,
    coordinates: keys.length > 0 ? buildCoordinates(source, keys) : undefined,
    start: source.positionStart || undefined,
    end: source.positionEnd || undefined
  }
}

const buildUnitData = (row) => {
  return {
    subjectId: row.subjectId,
    germplasmId: row.germplasmId || undefined,
    name: row.name || undefined,
    description: row.description || undefined,
    parentIds: [props.parentUnit.id],
    childrenIds: []
  }
}

const formatErrors = (errors, fallbackMessage = 'Failed to add child unit. Please try again.') => {
  if (errors && errors.length > 0) {
    return errors.map(err => err.message).join(', ')
  }
  return fallbackMessage
}

const submitSingle = async () => {
  try {
    addChildError.value = ''

    const { status, errors } = await createUnit(
      buildUnitData(singleFormData.value, singleFormData.value),
      buildPosition(singleFormData.value, singleCoordinateKeys.value)
    )

    if (status === 'SUCCESS') {
      emit('close')
      emit('success')
    } else {
      addChildError.value = formatErrors(errors)
    }
  } catch (error) {
    console.error('Error adding child unit:', error)
    addChildError.value = error.message || 'An unexpected error occurred.'
  }
}

const applyBulkTemplateToRows = () => {
  const keys = bulkCoordinateKeys.value
  bulkRows.value = bulkRows.value.map((row) => {
    if (row.status === 'completed') {
      return row
    }

    const next = { ...row }

    if (bulkTemplate.value.subjectId !== null && bulkTemplate.value.subjectId !== undefined) {
      next.subjectId = bulkTemplate.value.subjectId
    }
    if (bulkTemplate.value.germplasmId !== null && bulkTemplate.value.germplasmId !== undefined) {
      next.germplasmId = bulkTemplate.value.germplasmId
    }
    if (bulkTemplate.value.name) next.name = bulkTemplate.value.name
    if (bulkTemplate.value.description) next.description = bulkTemplate.value.description
    if (bulkTemplate.value.positionStart) next.positionStart = bulkTemplate.value.positionStart
    if (bulkTemplate.value.positionEnd) next.positionEnd = bulkTemplate.value.positionEnd

    keys.forEach((key) => {
      if (bulkTemplate.value[key] !== undefined && bulkTemplate.value[key] !== null && bulkTemplate.value[key] !== '') {
        next[key] = bulkTemplate.value[key]
      }
    })

    return next
  })
}

const addBulkRow = () => {
  bulkRows.value.push(createBulkRow(ensureCoordinateKeys({}, bulkCoordinateKeys.value)))
}

const removeBulkRow = (index) => {
  if (bulkRows.value.length === 1) {
    bulkRows.value[0] = createBulkRow(ensureCoordinateKeys({}, bulkCoordinateKeys.value))
    return
  }

  bulkRows.value.splice(index, 1)
}

const isBulkRowBlank = (row) => {
  const coordsBlank = bulkCoordinateKeys.value.every(key => !row[key])
  return !row.subjectId && !row.germplasmId && !row.name && !row.description && !row.positionStart && !row.positionEnd && coordsBlank
}

const submitBulk = async () => {
  try {
    addChildError.value = ''
    bulkSubmitting.value = true

    const rowsToSubmit = bulkRows.value
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.status !== 'completed' && row.status !== 'submitting' && !isBulkRowBlank(row))

    if (rowsToSubmit.length === 0) {
      addChildError.value = bulkRows.value.every(row => row.status === 'completed')
        ? 'All rows are already completed.'
        : 'Add at least one child row.'
      return
    }

    const failures = []
    let successCount = 0

    for (const { row, index } of rowsToSubmit) {
      if (!row.subjectId) {
        row.status = 'error'
        row.errorMessage = 'Subject is required.'
        failures.push(`Row ${index + 1}: subject is required.`)
        continue
      }

      row.status = 'submitting'
      row.errorMessage = ''

      const { status, errors } = await createUnit(
        buildUnitData(row),
        buildPosition({
          ...bulkTemplate.value,
          ...row
        }, bulkCoordinateKeys.value)
      )

      if (status === 'SUCCESS') {
        successCount += 1
        row.status = 'completed'
        row.errorMessage = ''
      } else {
        row.status = 'error'
        row.errorMessage = formatErrors(errors)
        failures.push(`Row ${index + 1}: ${row.errorMessage}`)
      }
    }

    if (successCount > 0) {
      emit('success')
    }

    if (failures.length === 0) {
      emit('close')
      return
    }

    addChildError.value = failures.join(' ')
  } catch (error) {
    console.error('Error adding child units:', error)
    addChildError.value = error.message || 'An unexpected error occurred.'
  } finally {
    bulkSubmitting.value = false
  }
}

const submitCurrentMode = () => {
  return mode.value === 'single' ? submitSingle() : submitBulk()
}

const setMode = (nextMode) => {
  mode.value = nextMode
  addChildError.value = ''
}
</script>

<template>
  <div class="modal" :class="{ 'modal-xl': mode === 'bulk' }" @click.stop>
    <div class="modal-header">
      <div class="header-title">
        <h4>{{ mode === 'single' ? 'Add Child Unit' : 'Add Children' }}</h4>
      </div>
      <div class="mode-switch" role="tablist" aria-label="Child entry mode">
        <button
          type="button"
          class="mode-btn"
          :class="{ active: mode === 'single' }"
          :disabled="createUnitLoading || bulkSubmitting"
          @click="setMode('single')"
        >
          Add Child
        </button>
        <button
          type="button"
          class="mode-btn"
          :class="{ active: mode === 'bulk' }"
          :disabled="createUnitLoading || bulkSubmitting"
          @click="setMode('bulk')"
        >
          Add Children
        </button>
      </div>
    </div>

    <FormKit
      v-if="mode === 'single'"
      v-model="singleFormData"
      type="form"
      @submit="submitCurrentMode"
      :actions="false"
      class="modal-content"
    >
      <FormKit type="text" name="parentName" label="Parent Unit:" disabled />

      <FormKit
        type="hierarchical-select"
        name="germplasmId"
        label="Germplasm:"
        help="Optionally define a germplasm entry for this child"
        :selected="singleGermplasm"
        :rootNodes="singleCrops"
        :hasChildrenFn="singleHasChildren"
        :loadChildrenFn="loadSingleChildGermplasm"
        :childrenLoading="singleChildGermplasmLoading"
        :currentChildren="singleCurrentChildGermplasm"
        :exclude-node-id="null"
        :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
        validation="optional"
      />

      <div class="form-section">
        <h5>Initial Position</h5>
        <FormKit
          type="hierarchical-select"
          name="positionLocationId"
          label="Location:"
          help="Select a location"
          :selected="singleLocation"
          :rootNodes="singleRegions"
          :loadChildrenFn="loadSingleChildLocations"
          :childrenLoading="singleChildLocationsLoading"
          :currentChildren="singleCurrentChildLocations"
          :exclude-node-id="null"
          :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
          validation="required"
        />

        <FormKit
          type="hierarchical-select"
          name="positionLayoutId"
          label="Layout (optional):"
          help="Select a layout"
          :selected="singleFormData.positionLayoutId ? singleLayout : null"
          :rootNodes="arrangementsWithNull"
          :loadChildrenFn="loadSingleChildLayouts"
          :childrenLoading="singleChildLayoutsLoading"
          :currentChildren="singleCurrentChildLayouts"
          :exclude-node-id="null"
          :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
        />

        <div v-if="singleCoordinateKeys.length > 0" class="coordinates-section">
          <label>Coordinates:</label>
          <div class="coordinates-inputs">
            <FormKit
              v-for="(key, index) in singleCoordinateKeys"
              :key="key"
              type="text"
              :name="key"
              :label="singleLayout?.axes?.[index]"
              :validation="`required`"
              :help="`Enter ${singleLayout?.axes?.[index]}`"
            />
          </div>
        </div>

        <div class="date-inputs">
          <FormKit
            type="text"
            name="positionStart"
            label="Start Date/Time (optional):"
            help="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
            validation="partialDateTime"
          />
          <FormKit
            type="text"
            name="positionEnd"
            label="End Date/Time (optional):"
            help="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
            validation="partialDateTime"
          />
        </div>
      </div>

      <div class="form-section">
        <h5>Child Details</h5>
        <FormKit
          type="select"
          name="subjectId"
          label="Subject:"
          help="Select a subject type"
          :options="subjectsWithNull"
          validation="required"
        />
        <FormKit type="text" name="name" label="Unit Name:" help="Enter unit name (optional)" />
        <FormKit type="textarea" name="description" label="Description:" help="Enter description (optional)" />
      </div>

      <div v-if="createUnitError" class="error-message">{{ createUnitError }}</div>
      <div v-if="addChildError" class="error-message">{{ addChildError }}</div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="createUnitLoading">
          {{ createUnitLoading ? 'Adding...' : 'Add Child' }}
        </button>
        <button type="button" @click="$emit('close')" class="btn btn-secondary" :disabled="createUnitLoading">
          Cancel
        </button>
      </div>
    </FormKit>

      <div v-else class="modal-content bulk-content">
      <div class="form-section">
        <div class="section-header">
          <h5>Fill all rows</h5>
          <button type="button" class="btn btn-secondary btn-small" :disabled="createUnitLoading || bulkSubmitting" @click="applyBulkTemplateToRows">
            Apply to rows
          </button>
        </div>

        <FormKit type="text" name="parentName" label="Parent Unit:" disabled v-model="bulkTemplate.parentName" />

        <FormKit
          type="hierarchical-select"
          name="positionLocationId"
          label="Location:"
          help="Select a location"
          :selected="bulkLocation"
          :rootNodes="bulkRegions"
          :loadChildrenFn="loadBulkChildLocations"
          :childrenLoading="bulkChildLocationsLoading"
          :currentChildren="bulkCurrentChildLocations"
          :exclude-node-id="null"
          :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
          validation="required"
          v-model="bulkTemplate.positionLocationId"
        />

        <FormKit
          type="hierarchical-select"
          name="positionLayoutId"
          label="Layout (optional):"
          help="Select a layout"
          :selected="bulkTemplate.positionLayoutId ? bulkLayout : null"
          :rootNodes="bulkArrangementsWithNull"
          :loadChildrenFn="loadBulkChildLayouts"
          :childrenLoading="bulkChildLayoutsLoading"
          :currentChildren="bulkCurrentChildLayouts"
          :exclude-node-id="null"
          :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
          v-model="bulkTemplate.positionLayoutId"
        />

        <div v-if="bulkCoordinateKeys.length > 0" class="coordinates-section">
          <label>Coordinates:</label>
          <div class="coordinates-inputs">
            <FormKit
              v-for="(key, index) in bulkCoordinateKeys"
              :key="key"
              type="text"
              :name="key"
              :label="bulkLayout?.axes?.[index]"
              :validation="`required`"
              :help="`Enter ${bulkLayout?.axes?.[index]}`"
              v-model="bulkTemplate[key]"
            />
          </div>
        </div>

        <div class="date-inputs">
          <FormKit
            type="text"
            name="positionStart"
            label="Start Date/Time (optional):"
            help="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
            validation="partialDateTime"
            v-model="bulkTemplate.positionStart"
          />
          <FormKit
            type="text"
            name="positionEnd"
            label="End Date/Time (optional):"
            help="YYYY-MM-DDTHH:mm or partial, e.g. YYYY or YYYY-MM"
            validation="partialDateTime"
            v-model="bulkTemplate.positionEnd"
          />
        </div>

        <div class="bulk-fill-grid">
          <FormKit type="select" name="subjectId" label="Subject:" :options="subjectsWithNull" v-model="bulkTemplate.subjectId" />
          <FormKit
            type="hierarchical-select"
            name="germplasmId"
            label="Germplasm:"
            help="Optional default germplasm for all rows"
            :selected="bulkGermplasm"
            :rootNodes="bulkCrops"
            :hasChildrenFn="bulkHasChildren"
            :loadChildrenFn="loadBulkChildGermplasm"
            :childrenLoading="bulkChildGermplasmLoading"
            :currentChildren="bulkCurrentChildGermplasm"
            :exclude-node-id="null"
            :get-node-label-fn="(unit) => unit.name || `${unit.type?.name} ${unit.id}`"
            validation="optional"
            v-model="bulkTemplate.germplasmId"
          />
          <FormKit type="text" name="name" label="Unit Name (optional):" v-model="bulkTemplate.name" />
          <FormKit type="textarea" name="description" label="Description (optional):" v-model="bulkTemplate.description" />
        </div>
      </div>

      <div class="bulk-section">
        <div class="bulk-toolbar">
          <h5>Child Units</h5>
          <button type="button" class="btn btn-secondary btn-small" :disabled="createUnitLoading || bulkSubmitting" @click="addBulkRow">
            Add Row
          </button>
        </div>

        <div class="bulk-table-wrap">
          <table class="bulk-table">
            <thead>
              <tr>
                <th class="row-index">#</th>
                <th class="status-col">Status</th>
                <th class="subject-col">Subject</th>
                <th class="germplasm-col">Germplasm</th>
                <th class="date-col">Start</th>
                <th class="date-col">End</th>
                <th v-for="(axis, index) in bulkLayout?.axes || []" :key="axis" class="coord-col">{{ axis }}</th>
                <th>Name</th>
                <th>Description</th>
                <th class="row-actions"></th>
              </tr>
            </thead>
            <tbody>
              <BulkChildRow
                v-for="(row, index) in bulkRows"
                :key="row.key"
                :row="row"
                :row-index="index"
                :subjects="props.subjects"
                :coordinate-axes="bulkLayout?.axes || []"
                :create-unit-loading="createUnitLoading"
                :bulk-submitting="bulkSubmitting"
                @remove="removeBulkRow(index)"
              />
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="createUnitError" class="error-message">{{ createUnitError }}</div>
      <div v-if="addChildError" class="error-message">{{ addChildError }}</div>

      <div class="form-actions">
        <button type="button" class="btn btn-primary" :disabled="createUnitLoading || bulkSubmitting" @click="submitCurrentMode">
          {{ (createUnitLoading || bulkSubmitting) ? 'Adding...' : 'Add Children' }}
        </button>
        <button type="button" @click="$emit('close')" class="btn btn-secondary" :disabled="createUnitLoading || bulkSubmitting">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  max-width: 620px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-xl {
  max-width: 1280px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
}

.header-title h4,
.form-section h5,
.bulk-toolbar h5 {
  margin: 0;
  color: #333;
}

.header-title h4 {
  font-size: 18px;
}

.form-section h5,
.bulk-toolbar h5 {
  font-size: 14px;
  font-weight: 600;
}

.mode-switch {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.mode-btn,
.btn {
  padding: 8px 14px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.mode-btn {
  background: #e9ecef;
  color: #495057;
}

.mode-btn.active {
  background: #0d6efd;
  color: white;
}

.mode-btn:disabled,
.btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.modal-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-section {
  padding: 16px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-header,
.bulk-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.bulk-fill-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.coordinates-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.coordinates-inputs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.date-inputs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.bulk-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bulk-table-wrap {
  overflow-x: auto;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
}

.bulk-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
}

.bulk-table th,
.bulk-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #ececec;
  text-align: left;
  vertical-align: top;
}

.bulk-table th {
  background: #f8f9fa;
  color: #495057;
  font-size: 13px;
  font-weight: 600;
}

.bulk-table tbody tr:last-child td {
  border-bottom: none;
}

.bulk-table tbody tr.row-completed td {
  background: #f8f9fa;
  color: #6c757d;
}

.bulk-table tbody tr.row-error td {
  background: #fff5f5;
}

.bulk-table tbody tr.row-submitting td {
  background: #f0fbff;
}

.row-index {
  width: 48px;
  white-space: nowrap;
}

.status-col {
  width: 100px;
}

.subject-col {
  width: 180px;
}

.germplasm-col {
  width: 220px;
}

.date-col {
  width: 150px;
}

.coord-col {
  width: 120px;
}

.row-actions {
  width: 92px;
  white-space: nowrap;
}

.bulk-small-btn {
  padding: 6px 10px;
  font-size: 13px;
}

.error-message {
  padding: 12px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  font-size: 14px;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
}

.btn-primary {
  background-color: #0d6efd;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0b5ed7;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5c636a;
}

.btn-small {
  padding: 6px 10px;
  font-size: 13px;
}

@media (max-width: 900px) {
  .modal-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .mode-switch {
    justify-content: flex-start;
  }

  .date-inputs,
  .bulk-fill-grid {
    grid-template-columns: 1fr;
  }
}
</style>
