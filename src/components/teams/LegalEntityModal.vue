<script setup>
import { ref, computed, watch } from 'vue'
import LegalEntityForm from './LegalEntityForm.vue'
import { useMutateLegalEntity } from '@/composables/teams/mutateLegalEntity'

// Declare, update or withdraw the legal entity of an organisation root team. For admins of that team.
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  team: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'legal-entity-updated'])

const form = ref({ legalName: '', privacyContact: '', accepted: false })
const formRef = ref(null)
const termsVersion = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
const confirmWithdraw = ref(false)

const {
  declareLegalEntity,
  declareLegalEntityLoading,
  withdrawLegalEntity,
  withdrawLegalEntityLoading
} = useMutateLegalEntity()

const busy = computed(() => declareLegalEntityLoading.value || withdrawLegalEntityLoading.value)
const current = computed(() => props.team?.legalEntity ?? null)
const canSubmit = computed(() => !!formRef.value?.complete && !busy.value)

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    form.value = {
      legalName: current.value?.legalName ?? '',
      privacyContact: current.value?.privacyContact ?? '',
      accepted: false
    }
    errorMessage.value = ''
    successMessage.value = ''
    confirmWithdraw.value = false
  }
})

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

const submitDeclaration = async () => {
  if (!canSubmit.value) return
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { status, errors } = await declareLegalEntity({
      teamId: props.team.id,
      legalEntity: {
        legalName: form.value.legalName.trim(),
        privacyContact: form.value.privacyContact.trim(),
        termsVersion: termsVersion.value
      }
    })
    if (status === 'SUCCESS') {
      successMessage.value = 'Legal entity declared.'
      emit('legal-entity-updated')
    } else {
      errorMessage.value = errors?.[0]?.message || 'Failed to declare the legal entity'
    }
  } catch (error) {
    console.error('Declare legal entity failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const submitWithdraw = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const { status, errors } = await withdrawLegalEntity(props.team.id)
    if (status === 'SUCCESS') {
      successMessage.value = 'Legal entity declaration withdrawn.'
      confirmWithdraw.value = false
      emit('legal-entity-updated')
    } else {
      errorMessage.value = errors?.[0]?.message || 'Failed to withdraw the declaration'
    }
  } catch (error) {
    console.error('Withdraw legal entity failed:', error)
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
        <h3>Legal entity for {{ team.fullname || team.name }}</h3>
        <button @click="closeModal" class="modal-close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <p class="intro">
          The legal entity is the data controller for the person records this team tree holds.
          It must be declared before the team tree can record people.
        </p>

        <div v-if="current" class="current-declaration">
          <h4>Current declaration</h4>
          <p><strong>Legal name:</strong> {{ current.legalName }}</p>
          <p><strong>Privacy contact:</strong> {{ current.privacyContact }}</p>
          <p>
            <strong>Terms:</strong> version {{ current.termsVersion }},
            accepted {{ formatDate(current.declaredAt) }}
            <template v-if="current.declaredBy">by {{ current.declaredBy.fullname || current.declaredBy.name }}</template>
          </p>

          <div v-if="!confirmWithdraw" class="form-actions right">
            <button class="btn btn-danger btn-small" :disabled="busy" @click="confirmWithdraw = true">
              Withdraw declaration
            </button>
          </div>
          <div v-else class="withdraw-confirm">
            <p class="warning-message">
              Withdrawing is refused while this team tree controls any person records, including erased ones.
              Transfer them to another team tree first. The declaration is kept as history.
            </p>
            <div class="form-actions right">
              <button class="btn btn-secondary btn-small" :disabled="busy" @click="confirmWithdraw = false">
                Keep declaration
              </button>
              <button class="btn btn-danger btn-small" :disabled="busy" @click="submitWithdraw">
                {{ withdrawLegalEntityLoading ? 'Withdrawing...' : 'Confirm withdrawal' }}
              </button>
            </div>
          </div>
        </div>

        <form @submit.prevent="submitDeclaration">
          <h4>{{ current ? 'Update declaration' : 'Declare legal entity' }}</h4>
          <p v-if="current" class="help-text">
            A new declaration replaces the current one and accepts the current terms again.
          </p>
          <LegalEntityForm
            ref="formRef"
            v-model="form"
            :disabled="busy"
            @terms-version="termsVersion = $event"
          />

          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
          <div v-if="successMessage" class="success-message">{{ successMessage }}</div>

          <div class="form-actions right">
            <button type="button" class="btn btn-secondary" :disabled="busy" @click="closeModal">
              Close
            </button>
            <button type="submit" class="btn btn-primary" :disabled="!canSubmit">
              {{ declareLegalEntityLoading ? 'Declaring...' : (current ? 'Update declaration' : 'Declare') }}
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

.current-declaration {
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.current-declaration h4,
form h4 {
  margin: 0 0 8px;
}

.current-declaration p {
  margin: 4px 0;
}

.withdraw-confirm {
  margin-top: 8px;
}

.help-text {
  margin: 0 0 12px;
  font-size: 0.85rem;
  color: #666;
}
</style>
