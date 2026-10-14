<script setup>
import { ref, computed, watch } from 'vue'
import PersonPicker from './PersonPicker.vue'
import { useMutateClaims } from '@/composables/people/mutateClaims'

// Ask to link the current user's account to a Person. Admins of its controlling teams approve.
// Works for Persons the user can only see restricted, by id.
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'requested'])

const pickedId = ref(null)
const typedId = ref('')
const confirmed = ref(false)
const errorMessage = ref('')

const { requestClaim, requestClaimLoading } = useMutateClaims()

const personId = computed(() => typedId.value.trim() || pickedId.value || null)

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    pickedId.value = null
    typedId.value = ''
    confirmed.value = false
    errorMessage.value = ''
  }
})

const submitClaim = async () => {
  if (!personId.value || !confirmed.value) return
  errorMessage.value = ''
  try {
    const { status, errors } = await requestClaim(String(personId.value))
    if (status === 'SUCCESS') {
      emit('requested', personId.value)
      emit('close')
    } else {
      errorMessage.value = errors?.[0]?.message || 'Failed to send the request'
    }
  } catch (error) {
    console.error('Request claim failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const closeModal = () => {
  if (!requestClaimLoading.value) emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>Claim a person record</h3>
        <button @click="closeModal" class="modal-close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <p class="intro">
          Pick the record that credits you. Admins of the teams controlling it are asked to confirm your
          identity and approve the link. Each account can be linked to one record.
        </p>

        <div class="form-group">
          <label>Records you can read</label>
          <PersonPicker
            v-model="pickedId"
            :multiple="false"
            exclude-linked
            :disabled="requestClaimLoading || !!typedId.trim()"
            empty-text="No unlinked person records are readable by you."
          />
        </div>

        <div class="form-group">
          <label for="claim-person-id">Or enter the record's id</label>
          <input
            id="claim-person-id"
            v-model="typedId"
            type="text"
            placeholder="For a record you can only see restricted"
            :disabled="requestClaimLoading"
          />
        </div>

        <div class="link-notice">
          <p>Before you confirm, note that once the record is linked to your account:</p>
          <ul>
            <li>
              Other users may message you through BreedGraph if the record is listed as a contact on a
              program or trial. Messages arrive at your account email address, which senders never see.
            </li>
            <li>You can remove yourself as a contact, and unlink or erase the record, at any time.</li>
          </ul>
          <label class="check-option">
            <input v-model="confirmed" type="checkbox" :disabled="requestClaimLoading" />
            <span>I understand and want to request this link</span>
          </label>
        </div>

        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

        <div class="form-actions right">
          <button type="button" class="btn btn-secondary" :disabled="requestClaimLoading" @click="closeModal">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!personId || !confirmed || requestClaimLoading"
            @click="submitClaim"
          >
            {{ requestClaimLoading ? 'Sending...' : 'Request link' }}
          </button>
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

.link-notice {
  margin: 16px 0;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 0.9em;
}

.link-notice p {
  margin: 0 0 4px;
}

.link-notice ul {
  margin: 0 0 8px;
  padding-left: 20px;
}

.check-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-weight: normal;
  cursor: pointer;
}

.check-option input {
  width: auto;
  margin-top: 3px;
}
</style>
