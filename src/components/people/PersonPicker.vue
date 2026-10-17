<script setup>
import { ref, computed } from 'vue'
import { usePeopleQuery } from '@/composables/people/peopleQuery'
import { personNamed, personLabel, personTeamNames } from '@/composables/people/personDisplay'

// Pick Persons the user can see in full or by attribution. v-model is a list of ids (multiple) or a single id.
// Restricted and erased Persons cannot be picked. Whether a Person is linked to an account is known in the full view
// only (Person.linked), so a Person seen by attribution counts as not known to be linked.
const model = defineModel({
  type: [Array, String, Number],
  default: null
})

const props = defineProps({
  multiple: {
    type: Boolean,
    default: true
  },
  // Only Persons known to be linked to an account, e.g. for contacts
  linkedOnly: {
    type: Boolean,
    default: false
  },
  // Only Persons not yet linked to an account, e.g. for claims
  excludeLinked: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  emptyText: {
    type: String,
    default: 'No people found.'
  }
})

const filter = ref('')

const { people, peopleLoading, peopleError } = usePeopleQuery()

const isLinked = (person) => person.linked === true || !!person.linkedUser

const candidates = computed(() =>
  people.value.filter(person => {
    if (!personNamed(person)) return false
    if (props.linkedOnly && !isLinked(person)) return false
    if (props.excludeLinked && isLinked(person)) return false
    const text = filter.value.trim().toLowerCase()
    if (!text) return true
    return personLabel(person).toLowerCase().includes(text) ||
      (person.teams ?? []).some(({ team }) => (team.name || '').toLowerCase().includes(text))
  })
)

const selectedIds = computed(() => {
  if (props.multiple) return (model.value ?? []).map(String)
  return model.value == null ? [] : [String(model.value)]
})

const isSelected = (person) => selectedIds.value.includes(String(person.id))

const toggle = (person) => {
  if (props.disabled) return
  const id = String(person.id)
  if (props.multiple) {
    const current = (model.value ?? []).map(String)
    model.value = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
  } else {
    model.value = selectedIds.value.includes(id) ? null : id
  }
}

// Selected Persons that are not in the readable list any more (e.g. restricted since), kept as ids
const unlistedSelected = computed(() =>
  selectedIds.value.filter(id => !people.value.some(person => String(person.id) === id))
)
</script>

<template>
  <div class="person-picker">
    <input
      v-model="filter"
      type="text"
      class="person-filter"
      placeholder="Filter by name, institution or team"
      :disabled="disabled"
    />

    <div v-if="peopleLoading && people.length === 0" class="loading-text">Loading people...</div>
    <div v-else-if="peopleError" class="error-message">Failed to load people</div>
    <p v-else-if="candidates.length === 0" class="text-muted">{{ emptyText }}</p>
    <ul v-else class="person-list">
      <li
        v-for="person in candidates"
        :key="person.id"
        class="person-option"
        :class="{ selected: isSelected(person), disabled }"
        @click="toggle(person)"
      >
        <input
          :type="multiple ? 'checkbox' : 'radio'"
          :checked="isSelected(person)"
          :disabled="disabled"
          tabindex="-1"
          @click.stop="toggle(person)"
        />
        <span class="person-name">{{ personLabel(person) }}</span>
        <span v-if="personTeamNames(person).length" class="person-teams">
          {{ personTeamNames(person).join(', ') }}
        </span>
        <span v-if="isLinked(person)" class="person-linked" title="Linked to an account">linked</span>
      </li>
    </ul>

    <p v-if="unlistedSelected.length > 0" class="text-muted unlisted">
      Also selected: {{ unlistedSelected.map(id => `#${id}`).join(', ') }} (not readable by you)
    </p>
  </div>
</template>

<style scoped>
.person-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.person-filter {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.9rem;
}

.person-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.person-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  border-bottom: 1px solid #f1f3f5;
}

.person-option:last-child {
  border-bottom: none;
}

.person-option:hover:not(.disabled) {
  background-color: #f8f9fa;
}

.person-option.selected {
  background-color: #e7f1ff;
}

.person-option.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.person-option input {
  width: auto;
  margin: 0;
}

.person-name {
  flex: 1;
  min-width: 0;
}

.person-teams,
.person-linked {
  font-size: 0.8rem;
  color: #666;
}

.person-linked {
  padding: 1px 6px;
  border-radius: 10px;
  background-color: #d4edda;
  color: #155724;
}

.unlisted {
  margin: 0;
  font-size: 0.85rem;
}
</style>
