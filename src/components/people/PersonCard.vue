<script setup>
import { computed } from 'vue'
import ControllerBadge from '@/components/controls/ControllerBadge.vue'
import { personForm, personLabel, orcidUrl } from '@/composables/people/personDisplay'

const props = defineProps({
  person: {
    type: Object,
    required: true
  },
  // Show edit and erase actions (the server still checks who may do what)
  editable: {
    type: Boolean,
    default: true
  }
})

defineEmits(['edit', 'erase'])

const form = computed(() => personForm(props.person))
const orcidLink = computed(() => orcidUrl(props.person.orcid))

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

const basisLabel = computed(() => ({
  PUBLIC_TASK: 'Public task',
  LEGITIMATE_INTEREST: 'Legitimate interest'
}[props.person.basis] ?? props.person.basis))
</script>

<template>
  <div class="person-card" :class="`person-${form}`">
    <div class="card-header">
      <h3 class="person-name">{{ personLabel(person) }}</h3>
      <ControllerBadge entity-label="PERSON" :entity-id="String(person.id)" />
    </div>

    <div v-if="form === 'restricted'" class="card-body text-muted">
      You do not have read access to this record. The badge shows which teams control it.
    </div>

    <div v-else-if="form === 'erased'" class="card-body text-muted">
      Erased {{ formatDate(person.erasedAt) }}. Contributions stay attributed to this id.
    </div>

    <div v-else class="card-body">
      <dl class="details">
        <template v-if="person.teams?.length">
          <dt>Teams</dt>
          <dd>{{ person.teams.map(team => team.fullname || team.name).join(', ') }}</dd>
        </template>
        <template v-if="orcidLink">
          <dt>ORCID iD</dt>
          <dd><a :href="orcidLink" target="_blank" rel="noopener">{{ orcidLink }}</a></dd>
        </template>
        <dt>Account</dt>
        <dd>
          <template v-if="person.linkedUser">
            linked to {{ person.linkedUser.fullname || person.linkedUser.name }}
          </template>
          <span v-else class="text-muted">not linked</span>
        </dd>
        <template v-if="person.basis">
          <dt>Lawful basis</dt>
          <dd>{{ basisLabel }}</dd>
        </template>
        <template v-if="person.recordedAt">
          <dt>Recorded</dt>
          <dd>
            {{ formatDate(person.recordedAt) }}
            <template v-if="person.recordedBy">by {{ person.recordedBy.fullname || person.recordedBy.name }}</template>
          </dd>
        </template>
      </dl>

      <div v-if="editable" class="card-actions">
        <button class="btn btn-secondary btn-small" @click="$emit('edit', person)">Edit</button>
        <button class="btn btn-danger btn-small" @click="$emit('erase', person)">Erase</button>
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
