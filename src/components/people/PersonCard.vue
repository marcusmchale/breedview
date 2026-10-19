<script setup>
import { computed } from 'vue'
import ControllerBadge from '@/components/controls/ControllerBadge.vue'
import { personForm, personLabel, orcidUrl, personTeamNames } from '@/composables/people/personDisplay'
import { useEntityAccess } from '@/composables/controls/useWriteAccess'
import { useAuthStore } from '@/composables/user/useAuthStore'

// A Person as the viewer sees it (breedgraph docs/person.md §3): the full record to read affiliates of a controlling
// team and the linked user; name, institution and ORCID iD to those reading it by release only; or its id.

const props = defineProps({
  person: {
    type: Object,
    required: true
  },
  // Offer edit and erase where the user may (false hides them regardless)
  editable: {
    type: Boolean,
    default: true
  }
})

defineEmits(['edit', 'erase'])

const form = computed(() => personForm(props.person))
const orcidLink = computed(() => orcidUrl(props.person.orcid))
const teamNames = computed(() => personTeamNames(props.person, { full: true }))

// As the backend allows: curators edit, admins of the controlling teams erase, and the linked user does both
const { currentUserId, isAuthenticated } = useAuthStore()
const access = useEntityAccess({ entityLabel: 'PERSON', entityId: () => props.person.id })
const isSubject = computed(() => currentUserId.value != null && String(props.person.linkedUser?.id) === String(currentUserId.value))
const canEdit = computed(() => props.editable && (isSubject.value || access.value.includes('CURATE')))
const canErase = computed(() => props.editable && (isSubject.value || access.value.includes('ADMIN')))

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
</script>

<template>
  <div class="person-card" :class="`person-${form}`">
    <div class="card-header">
      <h3 class="person-name">{{ personLabel(person) }}</h3>
      <ControllerBadge entity-label="PERSON" :entity-id="String(person.id)" />
    </div>

    <div v-if="form === 'restricted'" class="card-body text-muted">
      You do not have read access to this record.
      <template v-if="isAuthenticated">The badge shows which teams control it.</template>
    </div>

    <div v-else-if="form === 'erased'" class="card-body text-muted">
      Erased<template v-if="person.erasedAt"> {{ formatDate(person.erasedAt) }}</template>. Contributions stay attributed to this id.
    </div>

    <div v-if="form === 'full' || form === 'attribution'" class="card-body">
      <dl class="details">
        <template v-if="teamNames.length">
          <dt>Teams</dt>
          <dd>{{ teamNames.join(', ') }}</dd>
        </template>
        <template v-if="orcidLink">
          <dt>ORCID iD</dt>
          <dd><a :href="orcidLink" target="_blank" rel="noopener">{{ orcidLink }}</a></dd>
        </template>
        <!-- whether an account is linked, in the full record only: the account itself may be hidden (accounts are private) -->
        <template v-if="form === 'full' && person.linked != null">
          <dt>Account</dt>
          <dd>
            <template v-if="person.linkedUser">linked to {{ person.linkedUser.fullname || person.linkedUser.name }}</template>
            <template v-else-if="person.linked">linked</template>
            <span v-else class="text-muted">not linked</span>
          </dd>
        </template>
        <template v-if="person.recordedAt">
          <dt>Recorded</dt>
          <dd>
            {{ formatDate(person.recordedAt) }}
            <template v-if="person.recordedBy">by {{ person.recordedBy.fullname || person.recordedBy.name }}</template>
          </dd>
        </template>
      </dl>

      <div v-if="canEdit || canErase" class="card-actions">
        <button v-if="canEdit" class="btn btn-secondary btn-small" @click="$emit('edit', person)">Edit</button>
        <button v-if="canErase" class="btn btn-danger btn-small" @click="$emit('erase', person)">Erase</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.person-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px 16px;
}

.person-restricted,
.person-erased {
  background: #fafafa;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.person-name {
  margin: 0;
  font-size: 1.05rem;
  color: #333;
}

.person-restricted .person-name,
.person-erased .person-name {
  font-style: italic;
  color: #666;
}

.details {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 12px;
  margin: 0;
  font-size: 0.9rem;
}

.details dt {
  color: #666;
}

.details dd {
  margin: 0;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
