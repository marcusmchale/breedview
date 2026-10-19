<script setup>
import { ref, computed, watch } from 'vue'
import ControlSelector from '@/components/controls/ControlSelector.vue'
import { useMutatePeople } from '@/composables/people/mutatePeople'
import { useUserAccess } from '@/composables/user/useUserAccess'
import { RELEASE_CEILINGS } from '@/composables/controls/releases'

// Create a Person (person null) or update one. Creating needs a control team and confirmation that the person was
// told about the record and the privacy notice. Persons are released at most to registered users.
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  person: {
    type: Object,
    default: null
  },
  // The linked user may change only the name and institution
  limitedToOwnFields: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'saved'])

const isUpdate = computed(() => !!props.person)

const form = ref({ name: '', institution: '', teamIds: [], informed: false })
const errorMessage = ref('')
const controlTeamId = ref(null)
const release = ref(null)

const { createPerson, createPersonLoading, updatePerson, updatePersonLoading } = useMutatePeople()
const { readTeams, writeTeams, adminTeams, curateTeams } = useUserAccess()

// Teams the user can see, for the Person's affiliation
const teamOptions = computed(() => {
  const byId = new Map()
  for (const list of [readTeams.value, writeTeams.value, adminTeams.value, curateTeams.value]) {
    for (const team of list) byId.set(String(team.id), team)
  }
  // the Person's current teams, should the user see them other than through an affiliation; teams hidden from the
  // user are not offered, and the server keeps them when the rest are saved
  for (const { team, standIn } of props.person?.teams ?? []) {
    if (!standIn && !byId.has(String(team.id))) byId.set(String(team.id), team)
  }
  return [...byId.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
})

const busy = computed(() => createPersonLoading.value || updatePersonLoading.value)

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    form.value = {
      name: props.person?.name ?? '',
      institution: props.person?.institution ?? '',
      teamIds: (props.person?.teams ?? []).filter(({ standIn }) => !standIn).map(({ team }) => String(team.id)),
      informed: false
    }
    errorMessage.value = ''
  }
})

const canSubmit = computed(() => {
  if (busy.value || !form.value.name.trim()) return false
  if (!isUpdate.value) return form.value.informed && !!controlTeamId.value
  return true
})

const submitForm = async () => {
  if (!canSubmit.value) return
  errorMessage.value = ''
  try {
    let result
    if (isUpdate.value) {
      const personData = {
        id: props.person.id,
        name: form.value.name.trim(),
        institution: form.value.institution.trim()
      }
      if (!props.limitedToOwnFields) {
        personData.teamIds = form.value.teamIds
      }
      result = await updatePerson(personData)
    } else {
      result = await createPerson({
        personData: {
          name: form.value.name.trim(),
          institution: form.value.institution.trim() || null,
          teamIds: form.value.teamIds,
          informedAttestation: form.value.informed
        },
        controlTeamId,
        release
      })
    }
    if (result.status === 'SUCCESS') {
      emit('saved')
      emit('close')
    } else {
      errorMessage.value = result.errors?.[0]?.message || 'Failed to save the person record'
    }
  } catch (error) {
    console.error('Save person failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const closeModal = () => {
  if (!busy.value) emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>{{ isUpdate ? 'Edit person' : 'Add person' }}</h3>
        <button @click="closeModal" class="modal-close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <p v-if="!isUpdate" class="intro">
          A person record credits someone for research, with or without an account. It holds only a display
          name, an institution and team affiliations. External authors are cited through references instead.
        </p>

        <form @submit.prevent="submitForm">
          <div class="form-group">
            <label for="person-name">Name</label>
            <input
              id="person-name"
              v-model="form.name"
              type="text"
              required
              placeholder="Display name used for attribution"
              :disabled="busy"
            />
          </div>

          <div class="form-group">
            <label for="person-institution">Institution</label>
            <input
              id="person-institution"
              v-model="form.institution"
              type="text"
              placeholder="Institution the person did the work with (optional)"
              :disabled="busy"
            />
            <p class="help-text">Shown with the name, as an author's affiliation is in a publication.</p>
          </div>

          <template v-if="!limitedToOwnFields">
            <div class="form-group">
              <label>Teams</label>
              <p v-if="teamOptions.length === 0" class="text-muted">No teams available.</p>
              <div v-else class="team-options">
                <label v-for="team in teamOptions" :key="team.id" class="team-option">
                  <input v-model="form.teamIds" type="checkbox" :value="String(team.id)" :disabled="busy" />
                  <span>{{ team.fullname || team.name }}</span>
                </label>
              </div>
            </div>

            <p v-if="isUpdate" class="help-text">Changing teams requires curate access.</p>
          </template>

          <div v-if="!isUpdate" class="form-group">
            <label class="informed-attestation">
              <input v-model="form.informed" type="checkbox" :disabled="busy" />
              <span>
                I confirm this person took part in the research and has been told about this record and the
                <router-link to="/privacy" target="_blank">BreedGraph privacy notice</router-link>
              </span>
            </label>
          </div>

          <p v-if="!isUpdate" class="help-text release-note">
            Released to registered users, the name, institution and ORCID iD are shown to signed-in users where this
            person is credited; teams and the rest stay with the teams that control the record. People are never
            shown to visitors who are not signed in.
          </p>

          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

          <div class="form-actions">
            <ControlSelector
              v-if="!isUpdate"
              v-model:controlTeamId="controlTeamId"
              v-model:readRelease="release"
              :max-release="RELEASE_CEILINGS.PERSON"
              @error="errorMessage = $event || ''"
            />
            <button type="button" class="btn btn-secondary" :disabled="busy" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="!canSubmit">
              {{ busy ? 'Saving...' : (isUpdate ? 'Save' : 'Add person') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.intro {
  margin: 0 0 16px;
  color: #495057;
}

.help-text {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: #666;
}

.team-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 160px;
  overflow-y: auto;
  padding: 6px 10px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.team-option,
.informed-attestation {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-weight: normal;
  cursor: pointer;
}

.team-option input,
.informed-attestation input {
  width: auto;
  margin-top: 3px;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  align-items: flex-end;
  margin-top: 20px;
}
</style>
