<script setup>
import { ref, computed } from 'vue'
import PersonDisplay from './PersonDisplay.vue'
import ContactPersonModal from './ContactPersonModal.vue'
import { useAuthStore } from '@/composables/user/useAuthStore'
import { useMutateContacts } from '@/composables/people/mutateContacts'
import { personForm } from '@/composables/people/personDisplay'

// The contacts of a Program or Trial, with "Contact" for each readable one and
// "Remove me" for the viewer's own Person.
const props = defineProps({
  contacts: {
    type: Array,
    default: () => []
  },
  entityLabel: {
    type: String,
    required: true,
    validator: (value) => ['PROGRAM', 'TRIAL'].includes(value)
  },
  entityId: {
    type: [String, Number],
    required: true
  },
  entityName: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['changed'])

const { currentUserId } = useAuthStore()
const { removeSelfAsContact, removeSelfAsContactLoading } = useMutateContacts()

const messageTarget = ref(null)
const errorMessage = ref('')
const confirmRemoveSelf = ref(false)

const contacts = computed(() => (props.contacts ?? []).filter(Boolean))

const isSelf = (contact) =>
  contact.linkedUser && String(contact.linkedUser.id) === String(currentUserId.value)

const canMessage = (contact) => personForm(contact) === 'full' && !isSelf(contact)

const handleRemoveSelf = async () => {
  errorMessage.value = ''
  const { status, errors } = await removeSelfAsContact({
    entityLabel: props.entityLabel,
    entityId: String(props.entityId)
  })
  confirmRemoveSelf.value = false
  if (status === 'SUCCESS') {
    emit('changed')
  } else {
    errorMessage.value = errors?.[0]?.message || 'Failed to remove you as a contact'
  }
}
</script>

<template>
  <div v-if="contacts.length > 0" class="contacts-display">
    <strong class="contacts-title">Contacts:</strong>
    <ul class="contacts-list">
      <li v-for="contact in contacts" :key="contact.id" class="contact-item">
        <PersonDisplay :person="contact" />
        <button
          v-if="canMessage(contact)"
          type="button"
          class="btn btn-sm btn-outline"
          @click="messageTarget = contact"
        >
          Contact
        </button>
        <template v-else-if="isSelf(contact)">
          <span class="self-note">(you)</span>
          <template v-if="!confirmRemoveSelf">
            <button type="button" class="btn btn-sm btn-link" @click="confirmRemoveSelf = true">
              Remove me as contact
            </button>
          </template>
          <template v-else>
            <button type="button" class="btn btn-sm btn-link" :disabled="removeSelfAsContactLoading" @click="confirmRemoveSelf = false">
              Keep
            </button>
            <button type="button" class="btn btn-sm btn-danger" :disabled="removeSelfAsContactLoading" @click="handleRemoveSelf">
              {{ removeSelfAsContactLoading ? 'Removing...' : 'Confirm removal' }}
            </button>
          </template>
        </template>
      </li>
    </ul>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

    <ContactPersonModal
      :is-open="!!messageTarget"
      :person="messageTarget"
      :entity-label="entityLabel"
      :entity-id="String(entityId)"
      :entity-name="entityName"
      @close="messageTarget = null"
    />
  </div>
</template>

<style scoped>
.contacts-display {
  margin: 8px 0;
}

.contacts-title {
  color: #333;
}

.contacts-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.contact-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.self-note {
  color: #666;
  font-size: 0.85em;
}

.btn {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-outline {
  background-color: transparent;
  color: #007bff;
  border: 1px solid #007bff;
}

.btn-outline:hover {
  background-color: #007bff;
  color: white;
}

.btn-link {
  background: none;
  color: #007bff;
  padding: 2px 6px;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
