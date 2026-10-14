<script setup>
import { ref, computed, watch } from 'vue'
import { useMutateContacts } from '@/composables/people/mutateContacts'
import { personLabel } from '@/composables/people/personDisplay'

// Send a message to a contact of a Program or Trial. BreedGraph emails the contact's linked account;
// the sender's name and email address are included so the contact can reply.
const SUBJECT_MAX = 200
const MESSAGE_MAX = 5000

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  person: {
    type: Object,
    default: null
  },
  entityLabel: {
    type: String,
    required: true
  },
  entityId: {
    type: String,
    required: true
  },
  entityName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'sent'])

const subject = ref('')
const message = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const { contactPerson, contactPersonLoading } = useMutateContacts()

const entityDescription = computed(() =>
  `${props.entityLabel === 'TRIAL' ? 'trial' : 'program'}${props.entityName ? ` ${props.entityName}` : ''}`
)

const canSend = computed(() =>
  !contactPersonLoading.value &&
  subject.value.trim().length > 0 && subject.value.length <= SUBJECT_MAX &&
  message.value.trim().length > 0 && message.value.length <= MESSAGE_MAX
)

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    subject.value = props.entityName ? `About ${entityDescription.value}` : ''
    message.value = ''
    errorMessage.value = ''
    successMessage.value = ''
  }
})

const send = async () => {
  if (!canSend.value || !props.person) return
  errorMessage.value = ''
  try {
    const { status, errors } = await contactPerson({
      personId: String(props.person.id),
      entityLabel: props.entityLabel,
      entityId: props.entityId,
      subject: subject.value.trim(),
      message: message.value.trim()
    })
    if (status === 'SUCCESS') {
      successMessage.value = 'Your message has been sent.'
      emit('sent')
    } else {
      errorMessage.value = errors?.[0]?.message || 'Failed to send the message'
    }
  } catch (error) {
    console.error('Contact person failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const closeModal = () => {
  if (!contactPersonLoading.value) emit('close')
}
</script>

<template>
  <div v-if="isOpen && person" class="modal-overlay" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>Contact {{ personLabel(person) }}</h3>
        <button @click="closeModal" class="modal-close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <p class="intro">
          Your message about the {{ entityDescription }} is emailed to this contact by BreedGraph.
          You do not see their email address.
        </p>

        <div v-if="successMessage" class="success-message">{{ successMessage }}</div>

        <form v-else @submit.prevent="send">
          <div class="form-group">
            <label for="contact-subject">Subject</label>
            <input
              id="contact-subject"
              v-model="subject"
              type="text"
              :maxlength="SUBJECT_MAX"
              required
              :disabled="contactPersonLoading"
            />
            <p class="counter" :class="{ over: subject.length > SUBJECT_MAX }">{{ subject.length }} / {{ SUBJECT_MAX }}</p>
          </div>

          <div class="form-group">
            <label for="contact-message">Message</label>
            <textarea
              id="contact-message"
              v-model="message"
              rows="8"
              :maxlength="MESSAGE_MAX"
              required
              :disabled="contactPersonLoading"
            ></textarea>
            <p class="counter" :class="{ over: message.length > MESSAGE_MAX }">{{ message.length }} / {{ MESSAGE_MAX }}</p>
          </div>

          <p class="warning-message">
            Your name and email address are included in the message so the contact can reply to you.
            Messages are limited to a few per hour and cannot carry attachments.
          </p>

          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

          <div class="form-actions right">
            <button type="button" class="btn btn-secondary" :disabled="contactPersonLoading" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="!canSend">
              {{ contactPersonLoading ? 'Sending...' : 'Send' }}
            </button>
          </div>
        </form>

        <div v-if="successMessage" class="form-actions right">
          <button type="button" class="btn btn-secondary" @click="closeModal">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.intro {
  margin: 0 0 16px;
  color: #495057;
}

.counter {
  margin: 2px 0 0;
  text-align: right;
  font-size: 0.8rem;
  color: #666;
}

.counter.over {
  color: #dc3545;
}

textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.95rem;
  resize: vertical;
}
</style>
