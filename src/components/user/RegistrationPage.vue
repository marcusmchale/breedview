<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMutation } from '@vue/apollo-composable'
import CREATE_ACCOUNT from '../../graphql/account/createAccount.graphql'
import { useInvitationPreviewQuery } from '@/composables/account/invitationPreviewQuery'
import { describeAccesses, offersByTeam } from '@/composables/account/invitationOffers'
import { usePrivacyNotice } from '@/composables/system/usePrivacyNotice'

const props = defineProps({
  // From the invitation link, /register?token=...
  token: {
    type: String,
    default: null
  }
})

const router = useRouter()

const error = ref('')
const success = ref('')
const formValues = ref({})
const showPrivacyModal = ref(false)
const { html: privacyHtml, loading: privacyLoading, error: privacyError, load: loadPrivacyNotice } = usePrivacyNotice()

const {
  invitation,
  invitationMessage,
  invitationLoading,
  invitationError
} = useInvitationPreviewQuery(() => props.token)

const hasToken = computed(() => !!props.token)

// One option for each team offered: accepting a team accepts every access offered to it
const teamOptions = computed(() =>
  offersByTeam(invitation.value?.teams).map(({ teamId, teamName, accesses }) => ({
    value: teamId,
    label: `${teamName} (${describeAccesses(accesses)} access)`
  }))
)

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

const { mutate, loading, onError } = useMutation(CREATE_ACCOUNT)

onError((err) => {
  console.error('Registration error:', err)
  error.value = err.message
})

// Load privacy notice when modal opens
watch(showPrivacyModal, (isOpen) => {
  if (isOpen) loadPrivacyNotice()
})

const submitHandler = async (formData) => {
  error.value = ''
  success.value = ''

  const variables = {
    name: formData.name,
    fullname: formData.fullname?.trim() || null,
    // registration requires the invited address, so take it from the invitation rather than the form
    email: invitation.value?.email ?? formData.email,
    password: formData.password,
    privacyConsent: formData.privacyConsent === true
  }
  if (hasToken.value) {
    variables.invitationToken = props.token
    variables.acceptTeamIds = formData.acceptTeamIds ?? []
    variables.linkPerson = invitation.value?.offersPerson ? !!formData.linkPerson : false
  }

  try {
    const response = await mutate(variables)

    if (response.data?.accountsCreateAccount.status === 'SUCCESS') {
      success.value = 'Registration successful! Check your email to verify your address. Redirecting to login...'
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } else {
      // Handle server-side validation errors
      const errorMsg = response.data.accountsCreateAccount.errors?.[0]?.message || 'Registration failed. Please try again.'
      error.value = errorMsg
    }
  } catch (e) {
    console.error('Registration error:', e)
    error.value = e.message || 'An unexpected error occurred during registration.'
  }
}
</script>

<template>
  <div class="form-container">
    <h1>Register</h1>

    <div v-if="hasToken && invitationLoading" class="loading-state">
      Checking your invitation...
    </div>

    <div v-else-if="hasToken && (invitationMessage || invitationError)" class="invitation-invalid">
      <p class="error-message">
        {{ invitationMessage || 'Could not check the invitation. Please try again later.' }}
      </p>
      <p>
        Invitations are valid for a limited time and can only be used once.
        Ask the person who invited you to send a new invitation.
      </p>
      <router-link to="/login" class="btn btn-secondary">Go to login</router-link>
    </div>

    <template v-else>
      <div v-if="invitation" class="invitation-summary">
        <p>
          <template v-if="invitation.invitedBy">
            <strong>{{ invitation.invitedBy }}</strong> invited you to join BreedGraph.
          </template>
          <template v-else>
            You have been invited to join BreedGraph.
          </template>
          <span v-if="invitation.expiresAt" class="text-muted">
            This invitation expires on {{ formatDate(invitation.expiresAt) }}.
          </span>
        </p>
      </div>
      <p v-else class="text-muted no-invitation-note">
        Registration needs an invitation link, except for the first account on a new installation.
        If you were invited, open the link in the invitation email.
      </p>

      <FormKit
        type="form"
        v-model="formValues"
        @submit="submitHandler"
        :actions="false"
      >
        <FormKit
          type="text"
          name="name"
          label="Username"
          validation="required"
          placeholder="Enter your username"
        />
        <FormKit
          type="text"
          name="fullname"
          label="Full Name"
          help="Shown to other users. Defaults to your username."
          placeholder="Enter your full name (optional)"
        />
        <FormKit
          v-if="invitation"
          type="email"
          name="email"
          label="Email"
          :value="invitation.email"
          readonly="true"
          help="Registration uses the address the invitation was sent to."
        />
        <FormKit
          v-else
          type="email"
          name="email"
          label="Email"
          validation="required|email"
          placeholder="Enter your email address"
        />
        <FormKit
          type="password"
          name="password"
          label="Password"
          validation="required"
          placeholder="Enter your password"
        />

        <div v-if="teamOptions.length > 0" class="invitation-offer">
          <FormKit
            type="checkbox"
            name="acceptTeamIds"
            label="Team affiliations offered to you"
            :options="teamOptions"
            help="Tick the teams you want to join, with the access offered for each. Those you leave unticked are declined."
          />
        </div>

        <div v-if="invitation?.offersPerson" class="invitation-offer">
          <FormKit
            type="checkbox"
            name="linkPerson"
            label="Link the person record offered to you to this account"
          />
          <div class="link-person-notice">
            <p>
              A person record credits you for research data. Linking it to your account means:
            </p>
            <ul>
              <li>
                Other users may message you through BreedGraph if the record is listed as a contact on a
                program or trial. Messages arrive at your account email address, which senders never see.
              </li>
              <li>
                You can remove yourself as a contact, and unlink or erase the record, at any time.
              </li>
            </ul>
          </div>
        </div>

        <div class="gdpr-consent">
          <FormKit
            type="checkbox"
            name="privacyConsent"
            validation="accepted"
            :validation-messages="{
              accepted: 'Registering needs your consent to the processing of your personal data'
            }"
          >
            <template #label>
              <span class="gdpr-label">
                I consent to the processing of my personal data as the
                <a href="#" @click.prevent="showPrivacyModal = true" class="privacy-link">privacy notice</a>
                describes
              </span>
            </template>
          </FormKit>
        </div>

        <div class="form-actions">
          <FormKit
            type="submit"
            input-class="btn btn-primary"
            :disabled="loading"
          >
            {{ loading ? 'Registering...' : 'Register' }}
          </FormKit>
        </div>
      </FormKit>
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      <div v-if="success" class="success-message">
        {{ success }}
      </div>
    </template>

    <div v-if="showPrivacyModal" class="modal-overlay" @click="showPrivacyModal = false">
      <div class="modal privacy-modal" @click.stop>
        <div class="modal-header">
          <h2>Privacy Notice</h2>
          <button @click="showPrivacyModal = false" class="modal-close">&times;</button>
        </div>
        <div class="modal-content">
          <div v-if="privacyLoading" class="loading-state">
            Loading privacy notice...
          </div>
          <div v-else-if="privacyError" class="error-state">
            Failed to load privacy notice. Please try again.
          </div>
          <div v-else class="privacy-content" v-html="privacyHtml"></div>
        </div>
      </div>
    </div>


  </div>
</template>



<style scoped>
.invitation-summary {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  border-radius: 4px;
}

.invitation-summary p {
  margin: 0;
}

.no-invitation-note {
  margin-bottom: 16px;
}

.invitation-invalid p {
  margin-bottom: 16px;
}

.invitation-offer {
  margin: 16px 0;
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
}

.link-person-notice {
  font-size: 0.9em;
  color: #333;
}

.link-person-notice p {
  margin: 8px 0 4px;
}

.link-person-notice ul {
  margin: 0;
  padding-left: 20px;
}

.link-person-notice li {
  margin: 4px 0;
}

.gdpr-consent {
  margin: 16px 0;
}

.gdpr-label {
  font-size: 0.95em;
  color: #333;
}

.privacy-link {
  color: var(--brand-primary);
  text-decoration: underline;
  cursor: pointer;
}

.privacy-link:hover {
  color: var(--brand-primary-dark);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.privacy-modal {
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
}

.modal-header h2 {
  margin: 0;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.modal-close:hover {
  color: #333;
  background-color: #e9ecef;
}

.modal-content {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.privacy-content {
  line-height: 1.6;
  color: #333;
}

.privacy-content :deep(h1) {
  font-size: 1.5em;
  margin-top: 0;
  color: #222;
}

.privacy-content :deep(h2) {
  font-size: 1.25em;
  margin-top: 24px;
  color: #333;
}

.privacy-content :deep(h3) {
  font-size: 1.1em;
  margin-top: 16px;
  color: #444;
}

.privacy-content :deep(ul) {
  padding-left: 20px;
}

.privacy-content :deep(li) {
  margin: 8px 0;
}

.privacy-content :deep(hr) {
  border: none;
  border-top: 1px solid #eee;
  margin: 24px 0;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 40px;
  color: #666;
}

.error-state {
  color: #dc3545;
}
</style>
