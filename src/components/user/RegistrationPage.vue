<script setup>
import { ref, watch } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import CREATE_ACCOUNT from '../../graphql/account/createAccount.graphql'

const error = ref('')
const success = ref('')
const formValues = ref({})
const showPrivacyModal = ref(false)
const privacyHtml = ref('')
const privacyLoading = ref(false)
const privacyError = ref(false)

const { mutate, loading, onError } = useMutation(CREATE_ACCOUNT)

onError((err) => {
  console.error('Registration error:', err)
  error.value = err.message
})

const emit = defineEmits(['registrationComplete'])


// Load privacy notice when modal opens
watch(showPrivacyModal, async (isOpen) => {
  if (isOpen && !privacyHtml.value) {
    privacyLoading.value = true
    privacyError.value = false
    try {
      const response = await fetch('/privacy_notice.md')
      const markdown = await response.text()
      privacyHtml.value = parseMarkdown(markdown)
    } catch (e) {
      console.error('Failed to load privacy notice:', e)
      privacyError.value = true
    } finally {
      privacyLoading.value = false
    }
  }
})


// Simple markdown to HTML parser
const parseMarkdown = (md) => {
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/^---$/gim, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hulo]|<li|<hr)/gim, '<p>')
}

const submitHandler = async (formData) => {
  error.value = ''
  success.value = ''

  try {
    const response = await mutate({
      name: formData.name,
      fullname: formData.fullname,
      email: formData.email,
      password: formData.password
    })

    if (response.data.accountsCreateAccount.status === 'SUCCESS') {
      success.value = 'Registration successful! Redirecting to login...'
      setTimeout(() => {
        emit('registrationComplete')
      }, 2000)
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
        validation="required"
        placeholder="Enter your full name"
      />
      <FormKit
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

      <div class="gdpr-consent">
        <FormKit
          type="checkbox"
          name="gdprConsent"
          validation="accepted"
          :validation-messages="{
            accepted: 'You must accept the privacy notice to register'
          }"
        >
          <template #label>
            <span class="gdpr-label">
              I have read and accept the
              <a href="#" @click.prevent="showPrivacyModal = true" class="privacy-link">
                Privacy Notice
              </a>
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
.gdpr-consent {
  margin: 16px 0;
}

.gdpr-label {
  font-size: 0.95em;
  color: #333;
}

.privacy-link {
  color: #007bff;
  text-decoration: underline;
  cursor: pointer;
}

.privacy-link:hover {
  color: #0056b3;
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