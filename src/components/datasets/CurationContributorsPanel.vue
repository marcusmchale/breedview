<script setup>
import { computed, ref } from 'vue'
import { usePeopleQuery } from '@/composables/people/peopleQuery'
import { useOntologyEntriesQuery } from '@/composables/ontology/ontologyEntriesQuery'
import { personLabel } from '@/composables/people/personDisplay'
import ContributionsField from '@/components/people/ContributionsField.vue'

/**
 * The contributors of the loaded datasets, credited by name with their roles, and edited for each dataset the user
 * can curate. Changes are saved with the table's other changes.
 * datasets: [{ id, label, contributions, people, canEdit, changed }], contributions being [{ personId, roleIds }]
 * and people the Persons as loaded
 */
const props = defineProps({
  datasets: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update'])

const open = ref(false)
// the dataset whose contributions are being edited
const editing = ref(null)

const { people } = usePeopleQuery()
const { entries: roles } = useOntologyEntriesQuery({ labels: ['ROLE'], view: 'PUBLISHED' })

const personName = (dataset, id) => {
  const person = people.value.find((p) => String(p.id) === String(id)) ??
    dataset.people.find((p) => String(p.id) === String(id))
  return person ? personLabel(person) : `Person #${id}`
}
const roleName = (id) => roles.value?.find((r) => String(r.id) === String(id))?.name ?? `Role ${id}`

const credits = (dataset) =>
  dataset.contributions.map(({ personId, roleIds }) =>
    roleIds?.length ? `${personName(dataset, personId)} — ${roleIds.map(roleName).join(', ')}` : personName(dataset, personId)
  )

const changedCount = computed(() => props.datasets.filter((d) => d.changed).length)
const total = computed(() => props.datasets.reduce((count, d) => count + d.contributions.length, 0))

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
      <p class="hint">People credited for each loaded dataset, with their roles. Only person records you can read are listed to pick from.</p>
      <div
        v-for="dataset in datasets"
        :key="dataset.id"
        class="dataset-contributors"
        :class="{ changed: dataset.changed }"
      >
        <div class="dataset-row">
          <span class="dataset-label">{{ dataset.label }}</span>
          <span class="names">
            <template v-if="dataset.contributions.length">{{ credits(dataset).join('; ') }}</template>
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
          <ContributionsField
            :model-value="dataset.contributions"
            kind="dataset"
            :people="dataset.people"
            :disabled="disabled"
            @update:model-value="emit('update', { datasetId: dataset.id, contributions: $event })"
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
