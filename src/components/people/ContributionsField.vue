<script setup>
import { computed, ref } from 'vue'
import PersonPicker from './PersonPicker.vue'
import { usePeopleQuery } from '@/composables/people/peopleQuery'
import { useOntologyEntriesQuery } from '@/composables/ontology/ontologyEntriesQuery'
import { personLabel, SUGGESTED_ROLES } from '@/composables/people/personDisplay'
import { optionLabel } from '@/composables/ontology/ontologyLifecycles'

// The Persons credited for a record, each with the roles they had (Role entries). Roles are declared, not
// exhaustive: a contribution may have none. v-model: [{ personId, roleIds }]
const model = defineModel({
  type: Array,
  default: () => []
})

const props = defineProps({
  // dataset, program or reference: whose roles are offered first
  kind: {
    type: String,
    default: 'dataset'
  },
  // the Persons as loaded with the record, to name those the viewer cannot list
  people: {
    type: Array,
    default: () => []
  },
  label: {
    type: String,
    default: 'Contributors'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const picking = ref(false)

const { people: readable } = usePeopleQuery()
const { entries: roleEntries } = useOntologyEntriesQuery({ labels: ['ROLE'], view: 'PUBLISHED' })
// roles the contributions have that are no longer published, e.g. retired, read as cited: shown, to be kept or let go
const unlistedRoleIds = computed(() => {
  const listed = new Set((roleEntries.value ?? []).map((r) => String(r.id)))
  const held = new Set(model.value.flatMap((c) => (c.roleIds ?? []).map(String)))
  const ids = [...held].filter((id) => !listed.has(id))
  return ids.length ? ids : null
})
const { entries: unlistedRoles } = useOntologyEntriesQuery({ entryIds: unlistedRoleIds, view: 'REFERENTIAL' })

// The roles that fit this kind of record first, then the others
const roleGroups = computed(() => {
  const suggested = SUGGESTED_ROLES[props.kind] ?? []
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '')
  const all = [...(roleEntries.value ?? [])].filter(Boolean)
  return [
    { key: 'suggested', roles: all.filter((r) => suggested.includes(r.name)).sort(byName) },
    { key: 'other', roles: all.filter((r) => !suggested.includes(r.name)).sort(byName) },
    { key: 'unlisted', roles: unlistedRoleIds.value ? [...(unlistedRoles.value ?? [])].sort(byName) : [] }
  ].filter((group) => group.roles.length)
})
const roleName = (id) => {
  const role = [...(roleEntries.value ?? []), ...(unlistedRoles.value ?? [])].find((r) => String(r.id) === String(id))
  return role ? optionLabel(role) : `Role ${id}`
}

const personName = (id) => {
  const person = readable.value.find((p) => String(p.id) === String(id)) ??
    props.people.find((p) => String(p?.id) === String(id))
  return person ? personLabel(person) : `Person #${id}`
}

const personIds = computed(() => model.value.map((c) => String(c.personId)))

// Picking people keeps the roles of those already credited
const setPeople = (ids) => {
  const current = new Map(model.value.map((c) => [String(c.personId), c]))
  model.value = (ids ?? []).map(String).map((id) => current.get(id) ?? { personId: id, roleIds: [] })
}

const toggleRole = (contribution, roleId, on) => {
  const roleIds = new Set((contribution.roleIds ?? []).map(String))
  if (on) roleIds.add(String(roleId))
  else roleIds.delete(String(roleId))
  model.value = model.value.map((c) =>
    String(c.personId) === String(contribution.personId) ? { ...c, roleIds: [...roleIds] } : c
  )
}

const roleSummary = (contribution) =>
  contribution.roleIds?.length ? contribution.roleIds.map(roleName).join(', ') : 'No roles'
</script>

<template>
  <div class="contributions-field">
    <div class="field-header">
      <span class="section-label">{{ label }}</span>
      <button type="button" class="btn btn-sm btn-link" :disabled="disabled" @click="picking = !picking">
        {{ picking ? 'Done' : (model.length ? 'Change people' : '+ Add people') }}
      </button>
    </div>

    <div v-if="picking" class="picker-wrapper">
      <PersonPicker
        :model-value="personIds"
        :disabled="disabled"
        empty-text="No person records available to credit."
        @update:model-value="setPeople"
      />
    </div>

    <ul v-if="model.length" class="contribution-list">
      <li v-for="contribution in model" :key="contribution.personId" class="contribution">
        <span class="person-name">{{ personName(contribution.personId) }}</span>
        <details class="role-menu">
          <summary :class="{ empty: !contribution.roleIds?.length }">{{ roleSummary(contribution) }}</summary>
          <div class="role-options">
            <template v-for="(group, g) in roleGroups" :key="group.key">
              <hr v-if="g > 0" />
              <label v-for="role in group.roles" :key="role.id" :title="role.description">
                <input
                  type="checkbox"
                  :checked="(contribution.roleIds ?? []).map(String).includes(String(role.id))"
                  :disabled="disabled"
                  @change="toggleRole(contribution, role.id, $event.target.checked)"
                />
                {{ optionLabel(role) }}
              </label>
            </template>
            <p v-if="!roleGroups.length" class="text-muted">No roles in the ontology.</p>
          </div>
        </details>
      </li>
    </ul>
    <p v-else-if="!picking" class="text-muted none">Nobody credited.</p>
  </div>
</template>

<style scoped>
.contributions-field {
  margin-top: 12px;
}

.field-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-label {
  font-weight: 600;
  color: #333;
}

.picker-wrapper {
  margin: 8px 0;
}

.contribution-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.contribution {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.person-name {
  font-weight: 500;
}

.role-menu {
  position: relative;
  font-size: 0.9rem;
}

.role-menu summary {
  cursor: pointer;
  color: var(--brand-accent-darker);
}

.role-menu summary.empty {
  color: #888;
  font-style: italic;
}

.role-options {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 220px;
  max-height: 300px;
  overflow-y: auto;
  padding: 8px 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.role-options label {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  cursor: pointer;
}

.role-options hr {
  width: 100%;
  margin: 4px 0;
  border: none;
  border-top: 1px solid #eee;
}

.none {
  margin: 4px 0 0;
}
</style>
