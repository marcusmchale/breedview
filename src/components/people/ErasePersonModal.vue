<script setup>
import { ref, watch } from 'vue'
import { useMutatePeople } from '@/composables/people/mutatePeople'
import { personLabel } from '@/composables/people/personDisplay'

// Erase a Person: identifying data is removed and the id kept, so contributions stay attributed.
// By admins of the controlling teams or the linked user. Cannot be undone.
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  person: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'erased'])

const errorMessage = ref('')
const confirmed = ref(false)

const { erasePerson, erasePersonLoading } = useMutatePeople()

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    errorMessage.value = ''
    confirmed.value = false
  }
})

const submitErase = async () => {
  if (!confirmed.value || !props.person) return
  errorMessage.value = ''
  try {
    const { status, errors } = await erasePerson(props.person.id)
    if (status === 'SUCCESS') {
      emit('erased', props.person.id)
      emit('close')
    } else {
      errorMessage.value = errors?.[0]?.message || 'Failed to erase the person record'
    }
  } catch (error) {
    console.error('Erase person failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const closeModal = () => {
  if (!erasePersonLoading.value) emit('close')
}
</script>

<template>
  <div v-if="isOpen && person" class="modal-overlay" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>Erase person record</h3>
        <button @click="closeModal" class="modal-close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <p>
          You are about to erase <strong>{{ personLabel(person) }}</strong> (id {{ person.id }}).
        </p>
        <p class="warning-message">
          This cannot be undone. The name, institution, ORCID iD and team affiliations are removed,
          and any account link is removed. The id is kept, so datasets and contact listings stay
          attributed to an anonymous person. The erasure is logged and applied again if a backup is restored.
        </p>

        <label class="confirm-erase">
          <input v-model="confirmed" type="checkbox" :disabled="erasePersonLoading" />
          <span>I understand that this person record will be permanently erased</span>
        </label>

        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

        <div class="form-actions right">
          <button type="button" class="btn btn-secondary" :disabled="erasePersonLoading" @click="closeModal">
            Cancel
          </button>
          <button type="button" class="btn btn-danger" :disabled="!confirmed || erasePersonLoading" @click="submitErase">
            {{ erasePersonLoading ? 'Erasing...' : 'Erase' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-erase {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 16px 0;
  cursor: pointer;
}

.confirm-erase input {
  width: auto;
  margin-top: 3px;
}
</style>
