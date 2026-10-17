<!-- src/components/controls/ControlledEntitiesList.vue: the entities of a label a team controls, a page at a time -->
<script setup>
import { ref, computed, watch } from 'vue'

import BulkControlActions from './BulkControlActions.vue'
import {
  useControlledEntities, labelInfo, countOf, RELEASES, RELEASE_LABELS
} from '@/composables/controls/bulkControl'

const props = defineProps({
  team: { type: Object, required: true },
  label: { type: String, required: true },
  // the release to list first, as chosen in the counts table; null for all
  release: { type: String, default: null }
})

const emit = defineEmits(['changed'])

const PAGE_SIZE = 50
const releaseFilter = ref(props.release ?? '')
const offset = ref(0)
watch(() => [props.label, props.release, props.team.id], () => {
  releaseFilter.value = props.release ?? ''
  offset.value = 0
})
watch(releaseFilter, () => { offset.value = 0 })

const { total, items, entitiesLoading, entitiesError, refetchEntities } = useControlledEntities({
  teamId: () => props.team.id,
  label: () => props.label,
  release: releaseFilter,
  offset,
  limit: PAGE_SIZE
})

const info = computed(() => labelInfo(props.label))

// Chosen entities by id, or everything listed (a scope the server resolves, so no ids are sent)
const chosen = ref(new Set())
const allChosen = ref(false)
watch([() => props.label, () => props.team.id, releaseFilter], () => {
  chosen.value = new Set()
  allChosen.value = false
})

const toggle = (id) => {
  const next = new Set(chosen.value)
  next.has(id) ? next.delete(id) : next.add(id)
  chosen.value = next
  allChosen.value = false
}
const pageChosen = computed(() => items.value.length > 0 && items.value.every((item) => chosen.value.has(item.id)))
const togglePage = () => {
  const next = new Set(chosen.value)
  if (pageChosen.value) items.value.forEach((item) => next.delete(item.id))
  else items.value.forEach((item) => next.add(item.id))
  chosen.value = next
  allChosen.value = false
}

const atRelease = computed(() => (releaseFilter.value ? ` at ${RELEASE_LABELS[releaseFilter.value]}` : ''))
const selection = computed(() => {
  if (allChosen.value) {
    return { scope: { teamId: String(props.team.id), label: props.label, ...(releaseFilter.value ? { release: releaseFilter.value } : {}) } }
  }
  if (chosen.value.size === 0) return null
  return { entities: [...chosen.value].map((id) => ({ label: props.label, id })) }
})
const description = computed(() =>
  allChosen.value ? `all ${countOf(total.value, info.value)}${atRelease.value}` : countOf(chosen.value.size, info.value))

const clearChoice = () => {
  chosen.value = new Set()
  allChosen.value = false
}

const changed = () => {
  clearChoice()
  refetchEntities()
  emit('changed')
}

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const page = computed(() => Math.floor(offset.value / PAGE_SIZE) + 1)
const teamNames = (references) => references.map((r) => `${r.team.name}${r.standIn ? ' (a team within)' : ''}`).join(', ')
</script>

<template>
  <div class="controlled-entities">
    <div class="list-header">
      <h4>{{ info.plural }} {{ team.name }} controls</h4>
      <label>
        Release
        <select v-model="releaseFilter" name="releaseFilter">
          <option value="">All</option>
          <option v-for="r in RELEASES" :key="r" :value="r">{{ RELEASE_LABELS[r] }}</option>
        </select>
      </label>
    </div>

    <BulkControlActions :selection="selection" :description="description" :label="label" :team="team" @changed="changed" />

    <div v-if="entitiesError" class="error-message">{{ entitiesError }}</div>
    <div v-else-if="entitiesLoading && !items.length" class="text-muted">Loading…</div>
    <template v-else>
      <p v-if="pageChosen && total > items.length && !allChosen" class="select-all">
        All {{ items.length }} on this page are chosen.
        <button class="link-button" @click="allChosen = true">Choose all {{ countOf(total, info) }}{{ atRelease }}</button>
      </p>
      <p v-else-if="allChosen" class="select-all">
        All {{ countOf(total, info) }}{{ atRelease }} are chosen.
        <button class="link-button" @click="clearChoice">Clear</button>
      </p>

      <table class="controlled-table">
        <thead>
          <tr>
            <th class="check"><input type="checkbox" :checked="pageChosen || allChosen" :disabled="!items.length" aria-label="Choose this page" @change="togglePage" /></th>
            <th>Name</th>
            <th v-if="info.context">{{ info.context }}</th>
            <th>Release</th>
            <th>Shared with</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" :class="{ chosen: allChosen || chosen.has(item.id) }">
            <td class="check">
              <input type="checkbox" :checked="allChosen || chosen.has(item.id)" :disabled="allChosen" @change="toggle(item.id)" />
            </td>
            <td>{{ item.name || `#${item.id}` }} <span class="text-muted">#{{ item.id }}</span></td>
            <td v-if="info.context">{{ item.context }}</td>
            <td><span class="release-badge" :class="item.release">{{ RELEASE_LABELS[item.release] }}</span></td>
            <td class="text-muted">{{ teamNames(item.otherTeams) }}</td>
          </tr>
          <tr v-if="!items.length">
            <td :colspan="info.context ? 5 : 4" class="text-muted">None{{ atRelease }}.</td>
          </tr>
        </tbody>
      </table>

      <div v-if="pageCount > 1" class="pager">
        <button class="btn btn-secondary btn-sm" :disabled="page <= 1" @click="offset -= PAGE_SIZE">‹ Previous</button>
        <span>Page {{ page }} of {{ pageCount }} ({{ countOf(total, info) }})</span>
        <button class="btn btn-secondary btn-sm" :disabled="page >= pageCount" @click="offset += PAGE_SIZE">Next ›</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.list-header h4 {
  margin: 0;
}

.controlled-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.controlled-table th,
.controlled-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #e9ecef;
  text-align: left;
}

.controlled-table .check {
  width: 32px;
}

.controlled-table tr.chosen td {
  background: #f1f8e9;
}

.select-all {
  margin: 0 0 8px;
}

.link-button {
  border: none;
  background: none;
  padding: 0;
  color: #1976d2;
  text-decoration: underline;
  cursor: pointer;
}

.pager {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.release-badge {
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 0.8rem;
  background: #eceff1;
}

.release-badge.PRIVATE { background: #fce4ec; color: #880e4f; }
.release-badge.REGISTERED { background: #fff3e0; color: #e65100; }
.release-badge.PUBLIC { background: #e8f5e9; color: #1b5e20; }

.error-message {
  padding: 8px 12px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
}
</style>
