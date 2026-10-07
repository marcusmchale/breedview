<script setup>
import { ref } from 'vue'
import LocationLayoutSelect from '@/components/analysis/config/LocationLayoutSelect.vue'

/** A position criterion of an exclusion rule: location, optional layout and optional axis values. */
const props = defineProps({
  modelValue: { type: Object, required: true }
})

const emit = defineEmits(['update:modelValue'])

const layout = ref(null)

const update = (patch) => emit('update:modelValue', { ...props.modelValue, ...patch })

const setLocation = (locationId) => update({ locationId, layoutId: null, axes: [] })
const setLayout = (layoutId) => update({ layoutId, axes: [] })

const axisValue = (index) => props.modelValue.axes?.find((a) => a.index === index)?.value ?? ''

// An empty value means the axis isn't matched
const setAxis = (index, value) => {
  const axes = (props.modelValue.axes ?? []).filter((a) => a.index !== index)
  if (value.trim()) axes.push({ index, value: value.trim() })
  update({ axes: axes.sort((a, b) => a.index - b.index) })
}
</script>

<template>
  <div>
    <LocationLayoutSelect
      :location-id="modelValue.locationId"
      :layout-id="modelValue.layoutId"
      @update:location-id="setLocation"
      @update:layout-id="setLayout"
      @layout="layout = $event"
    />
    <div v-if="modelValue.layoutId && layout?.axes?.length" class="axes">
      <label v-for="(axis, i) in layout.axes" :key="i">
        <span class="muted">{{ axis }}</span>
        <input type="text" :value="axisValue(i)" placeholder="Any" @change="setAxis(i, $event.target.value)" />
      </label>
    </div>
    <p class="hint">
      {{
        !modelValue.layoutId
          ? 'Any position at the location matches.'
          : 'Leave an axis empty to match any value on it.'
      }}
    </p>
  </div>
</template>

<style scoped>
.axes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.axes label {
  display: flex;
  flex-direction: column;
  font-size: 0.75rem;
}

.axes input {
  width: 100px;
}
</style>