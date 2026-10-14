<script setup>
import { ref, computed } from 'vue'
import PersonCard from './PersonCard.vue'
import PersonFormModal from './PersonFormModal.vue'
import ErasePersonModal from './ErasePersonModal.vue'
import ClaimRequestsPanel from './ClaimRequestsPanel.vue'
import PERSON_FRAGMENT from '@/graphql/people/personFragment.graphql'
import { useCacheUpdates } from '@/apolloConfig/cacheUpdates'
import { usePeopleQuery } from '@/composables/people/peopleQuery'
import { personForm, personLabel } from '@/composables/people/personDisplay'

const { people, peopleLoading, peopleError, refetchPeople } = usePeopleQuery()
const { updateCache } = useCacheUpdates({ typename: 'Person', fragment: PERSON_FRAGMENT })

const filter = ref('')
const showErased = ref(false)
const showFormModal = ref(false)
const personToEdit = ref(null)
const showEraseModal = ref(false)
const personToErase = ref(null)

const visiblePeople = computed(() => {
  const text = filter.value.trim().toLowerCase()
  return people.value.filter(person => {
    if (!showErased.value && personForm(person) === 'erased') return false
    if (!text) return true
    return personLabel(person).toLowerCase().includes(text) ||
      (person.teams ?? []).some(team => (team.name || '').toLowerCase().includes(text))
  })
})

const openCreate = () => {
  personToEdit.value = null
  showFormModal.value = true
}

const openEdit = (person) => {
  personToEdit.value = person
  showFormModal.value = true
}

const openErase = (person) => {
  personToErase.value = person
  showEraseModal.value = true
}

// Mutations return no record, so refetch the list (it is small) after create and update
const handleSaved = async () => {
  await refetchPeople()
}

// Tombstone the cached record so every place showing this Person updates
const handleErased = (personId) => {
  updateCache({
    id: personId,
    name: null,
    institution: null,
    orcid: null,
    teams: [],
    linkedUser: null,
    erased: true,
    erasedAt: new Date().toISOString()
  })
}
</script>

<template>
  <div class="page-container people-page">
    <div class="page-header">
      <h2>People</h2>
      <button class="btn btn-primary" @click="openCreate">+ Add Person</button>
    </div>

    <p class="page-intro text-muted">
      People are credited for research data as dataset contributors and listed as contacts for programs and trials.
      Records you cannot read are shown restricted.
    </p>

    <ClaimRequestsPanel @decided="refetchPeople" />

    <div class="toolbar">
      <input
        v-model="filter"
        type="text"
        class="filter-input"
        placeholder="Filter by name, institution or team"
      />
      <label class="show-erased">
        <input v-model="showErased" type="checkbox" />
        <span>Show erased</span>
      </label>
    </div>

    <div v-if="peopleLoading && people.length === 0" class="loading">Loading people...</div>
    <div v-else-if="peopleError" class="error">Failed to load people: {{ peopleError.message }}</div>
    <div v-else-if="visiblePeople.length === 0" class="empty-state text-muted">
      No people to show.
    </div>
    <div v-else class="people-grid">
      <PersonCard
        v-for="person in visiblePeople"
        :key="person.id"
        :person="person"
        @edit="openEdit"
        @erase="openErase"
      />
    </div>

    <PersonFormModal
      :is-open="showFormModal"
      :person="personToEdit"
      @close="showFormModal = false"
      @saved="handleSaved"
    />

    <ErasePersonModal
      :is-open="showEraseModal"
      :person="personToErase"
      @close="showEraseModal = false"
      @erased="handleErased"
    />
  </div>
</template>

<style scoped>
.people-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.page-header h2 {
  margin: 0;
}

.page-intro {
  margin: 0 0 16px;
}

.toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}

.filter-input {
  flex: 1;
  max-width: 400px;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.show-erased {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.show-erased input {
  width: auto;
}

.people-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.empty-state {
  padding: 40px;
  text-align: center;
}
</style>
