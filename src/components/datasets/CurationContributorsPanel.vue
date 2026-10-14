<script setup>
import { computed, ref } from 'vue'
import { usePeopleQuery } from '@/composables/people/peopleQuery'
import { personLabel } from '@/composables/people/personDisplay'
import PersonPicker from '@/components/people/PersonPicker.vue'

/**
 * The contributors of the loaded datasets, credited by name, with a picker for each dataset
 * the user can curate. Changes are saved with the table's other changes.
 * datasets: [{ id, label, ids, people, canEdit, changed }], people being the Persons as loaded
 */
const props = defineProps({
  datasets: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update'])

const open = ref(false)
// the dataset whose picker is open
const editing = ref(null)

const { people } = usePeopleQuery()

const findPerson = (dataset, id) =>
  people.value.find((person) => String(person.id) === String(id)) ??
  dataset.people.find((person) => String(person.id) === String(id))

const names = (dataset) =>
  dataset.ids.map((id) => {
    const person = findPerson(dataset, id)
    return person ? personLabel(person) : `Person #${id}`
  })

const changedCount = computed(() => props.datasets.filter((d) => d.changed).length)
const total = computed(() => props.datasets.reduce((count, d) => count + d.ids.length, 0))

const toggleEdit = (id) => {
  editing.value = editing.value === id ? null : id
}
</script>

<template>
  <div class="contributors">
    <button type="button" class="btn btn-secondary btn-sm toggle" @click="open = !open">
      {{ open ? '▾' : '▸' }} Contributors ({{ total }}){{ changedCount ? ` · ${changedCount} changed` : '' }}
    </button>

    <div v-if="open" class="contributors-list">
      <p class="hint">People credited for each loaded dataset. Only person records you can read are listed to pick from.</p>
      <div
        v-for="dataset in datasets"
        :key="dataset.id"
        class="dataset-contributors"
        :class="{ changed: dataset.changed }"
      >
        <div class="dataset-row">
          <span class="dataset-label">{{ dataset.label }}</span>
          <span class="names">
            <template v-if="dataset.ids.length">{{ names(dataset).join(', ') }}</template>
            <span v-else class="text-muted">No contributors</span>
          </span>
          <span v-if="dataset.changed" class="changed-mark">changed</span>
          <button
            v-if="dataset.canEdit"
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="disabled"
            @click="toggleEdit(dataset.id)"
          >
            {{ editing === dataset.id ? 'Done' : 'Edit' }}
          </button>
          <span v-else class="text-muted read-only">read only</span>
        </div>
        <div v-if="editing === dataset.id" class="picker">
          <PersonPicker
            :model-value="dataset.ids"
            :disabled="disabled"
            empty-text="No person records available to credit."
            @update:model-value="emit('update', { datasetId: dataset.id, ids: $event })"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.contributors {
  margin: 0 0 8px;
}

.contributors-list {
  margin-top: 6px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: #666;
}

.dataset-contributors.changed .dataset-row {
  background: #fff8e1;
}

.dataset-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.dataset-label {
  font-weight: 600;
  white-space: nowrap;
}

.names {
  flex: 1;
  min-width: 0;
}

.changed-mark {
  font-size: 11px;
  color: #b26a00;
  text-transform: uppercase;
}

.read-only {
  font-size: 12px;
}

.text-muted {
  color: #888;
}

.picker {
  padding: 6px 6px 10px;
  max-width: 520px;
}
</style>
