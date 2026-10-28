<script setup>
import { computed } from 'vue'
import { datasetName } from '@/composables/analysis/useAnalysisNames'

/**
 * Selects a record group code: a grouping, a code and, for dataset-scoped
 * groupings, the dataset whose scope the code belongs to.
 */
const props = defineProps({
  modelValue: { type: Object, required: true },
  groupings: { type: Array, required: true },
  codesByGrouping: { type: Object, default: () => ({}) },
  datasetIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue'])

const grouping = computed(() => props.groupings.find((g) => g.id === props.modelValue.groupingId))
const scoped = computed(() => grouping.value?.scope === 'DATASET_SCOPED')
const codes = computed(() => props.codesByGrouping[props.modelValue.groupingId] ?? [])

const optionValue = (c) => `${c.datasetId ?? ''}|${c.code}`
const optionLabel = (c) => (c.datasetId ? `${c.code} — ${datasetName(c.datasetId)}` : c.code)
const selectedValue = computed(() =>
  props.modelValue.code ? `${props.modelValue.datasetId ?? ''}|${props.modelValue.code}` : ''
)
// a code the records don't have, e.g. of an analysis loaded since they changed, stays shown as chosen
const unknownCode = computed(() => !!selectedValue.value && !codes.value.some((c) => optionValue(c) === selectedValue.value))

const setGrouping = (groupingId) => emit('update:modelValue', { groupingId, code: '', datasetId: null })

const setCode = (value) => {
  const [datasetId, ...code] = value.split('|')
  emit('update:modelValue', { ...props.modelValue, code: code.join('|'), datasetId: datasetId || null })
}

const update = (patch) => emit('update:modelValue', { ...props.modelValue, ...patch })
</script>

<template>
  <div class="member-select">
    <select :value="modelValue.groupingId ?? ''" @change="setGrouping($event.target.value)">
      <option value="" disabled>Grouping</option>
      <option v-for="g in groupings" :key="g.id" :value="g.id">
        {{ g.name }}{{ g.studyName ? ` (${g.studyName})` : '' }}
      </option>
    </select>
    <template v-if="modelValue.groupingId">
      <select v-if="codes.length" :value="selectedValue" @change="setCode($event.target.value)">
        <option value="" disabled>Code</option>
        <option v-if="unknownCode" :value="selectedValue">{{ optionLabel(modelValue) }} (not in the records)</option>
        <option v-for="c in codes" :key="optionValue(c)" :value="optionValue(c)">{{ optionLabel(c) }}</option>
      </select>
      <template v-else>
        <input type="text" :value="modelValue.code" placeholder="Code" @change="update({ code: $event.target.value })" />
        <select
          v-if="scoped"
          :value="modelValue.datasetId ?? ''"
          @change="update({ datasetId: $event.target.value || null })"
        >
          <option value="" disabled>Dataset scope</option>
          <option v-for="id in datasetIds" :key="id" :value="id">{{ datasetName(id) }}</option>
        </select>
      </template>
    </template>
  </div>
</template>

<style scoped>
.member-select {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
