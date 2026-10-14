<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useApolloClient } from '@vue/apollo-composable'
import { useAuthStore } from '@/composables/user/useAuthStore'
import { useCsrf } from '@/composables/system/useCsrf'
import { useMutateAccount } from '@/composables/account/mutateAccount'

// Delete the user's own account, confirming with their password. Logs them out at once.
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  // Whether the user has a linked Person, which can be erased with the account
  hasPerson: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const router = useRouter()
const { client } = useApolloClient()
const { clearAuthState } = useAuthStore()
const { clearCsrfToken } = useCsrf()
const { deleteAccount, deleteAccountLoading } = useMutateAccount()

const password = ref('')
const erasePerson = ref(true)
const confirmed = ref(false)
const errorMessage = ref('')

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    password.value = ''
    erasePerson.value = true
    confirmed.value = false
    errorMessage.value = ''
  }
})

const submitDelete = async () => {
  if (!confirmed.value || !password.value) return
  errorMessage.value = ''
  try {
    const { status, errors } = await deleteAccount({
      password: password.value,
      erasePerson: props.hasPerson ? erasePerson.value : false
    })
    if (status === 'SUCCESS') {
      clearAuthState()
      clearCsrfToken()
      try {
        await client.clearStore()
      } catch (error) {
        console.warn('Failed to clear the Apollo cache:', error)
      }
      await router.push({ path: '/login', query: { message: 'Your account has been deleted.' } })
    } else {
      errorMessage.value = errors?.[0]?.message || 'Failed to delete the account'
    }
  } catch (error) {
    console.error('Delete account failed:', error)
    errorMessage.value = error.message || 'An unexpected error occurred.'
  }
}

const closeModal = () => {
  if (!deleteAccountLoading.value) emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>Delete your account</h3>
        <button @click="closeModal" class="modal-close-btn" aria-label="Close">&times;</button>
      </div>

      <div class="modal-body">
        <p class="warning-message">
          This takes effect at once and cannot be undone. You are logged out, your login stops working,
          and your username becomes free to register again. Your contributions stay attributed to an anonymous id.
        </p>
        <p class="text-muted">
          Deletion is refused while you are the only ontology admin or the only admin of a team.
          Hand those roles over first.
        </p>

        <form @submit.prevent="submitDelete">
          <div class="form-group">
            <label for="delete-password">Confirm your password</label>
            <input
              id="delete-password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              :disabled="deleteAccountLoading"
            />
          </div>

          <div v-if="hasPerson" class="form-group">
            <label class="check-option">
              <input v-model="erasePerson" type="checkbox" :disabled="deleteAccountLoading" />
              <span>
                Also erase my person record. Otherwise it is only unlinked from this account and stays as a
                credit for your research data.
              </span>
            </label>
          </div>

          <div class="form-group">
            <label class="check-option">
              <input v-model="confirmed" type="checkbox" :disabled="deleteAccountLoading" />
              <span>I understand that my account will be permanently deleted</span>
            </label>
          </div>

          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

          <div class="form-actions right">
            <button type="button" class="btn btn-secondary" :disabled="deleteAccountLoading" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="btn btn-danger" :disabled="!confirmed || !password || deleteAccountLoading">
              {{ deleteAccountLoading ? 'Deleting...' : 'Delete my account' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
