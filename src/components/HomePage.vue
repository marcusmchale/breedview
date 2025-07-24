<template>
  <div class="page-container">
    <div v-if="loading" class="loading">
      Loading...
    </div>

    <div v-else-if="error" class="error">
      <p>Unable to load user information</p>
      <button @click="redirectToLogin" class="btn btn-primary">
        Go to Login
      </button>
    </div>

    <div v-else-if="account && account.user">
      <!-- Main Home View -->
      <div v-if="!showEditProfile && !showAffiliations" class="welcome">
        <h1>Welcome, {{ account.user.fullname }}!</h1>
        <div class="user-info">
          <p><strong>Username:</strong> {{ account.user.name }}</p>
          <p><strong>Email:</strong> {{ account.user.email }}</p>
          <p><strong>User ID:</strong> {{ account.user.id }}</p>
        </div>

        <div class="user-actions">
          <button @click="showEditProfile = true" class="btn btn-primary">
            Edit Profile
          </button>
          <button @click="showAffiliations = true" class="btn btn-primary">
            Edit Affiliations
          </button>
          <button @click="showInviteModal = true" class="btn btn-primary">
            Invite User
          </button>
          <button @click="logout" class="btn btn-danger" :disabled="logoutLoading">
            {{ logoutLoading ? 'Logging out...' : 'Logout' }}
          </button>
        </div>

        <div v-if="logoutError" class="error-message">
          {{ logoutError }}
        </div>
      </div>

      <!-- Edit Profile View -->
      <div v-else-if="showEditProfile">
        <EditProfilePage
          @back-to-home="handleBackToHome"
          @profile-updated="handleProfileUpdated"
        />
      </div>

      <!-- Edit Affiliations View -->
      <div v-else-if="showAffiliations">
        <AffiliationsPage
          :current-user-id="account.user.id"
          @back-to-home="handleBackToHome"
        />
      </div>
    </div>

    <!-- Invite User Modal -->
    <InviteUserModal
      :is-open="showInviteModal"
      @close="showInviteModal = false"
      @invited="handleUserInvited"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery, useMutation } from '@vue/apollo-composable'
import ACCOUNT_QUERY from '../graphql/account/account.graphql'
import LOGOUT_MUTATION from '../graphql/authentication/logout.graphql'
import EditProfilePage from './EditProfilePage.vue'
import AffiliationsPage from './AffiliationsPage.vue'
import InviteUserModal from './InviteUserModal.vue'

const router = useRouter()

const account = ref(null)
const loading = ref(true)
const error = ref(false)
const logoutError = ref('')
const showEditProfile = ref(false)
const showAffiliations = ref(false)
const showInviteModal = ref(false)

// Use Apollo query
const { result, loading: queryLoading, error: queryError, refetch } = useQuery(ACCOUNT_QUERY, {}, {
  fetchPolicy: 'network-only',
  errorPolicy: 'all'
})

// Use logout mutation
const { mutate: logoutMutation, loading: logoutLoading, onError: onLogoutError } = useMutation(LOGOUT_MUTATION)

// Handle logout errors
onLogoutError((err) => {
  console.error('Logout error:', err)
  logoutError.value = err.message || 'Logout failed. Please try again.'
})

// Watch for query state changes
watch([queryLoading, queryError, result], () => {
  if (queryLoading.value) {
    loading.value = true
    return
  }

  loading.value = false

  // Check if there's an error or if the query failed
  if (queryError.value) {
    error.value = true
    setTimeout(() => {
      redirectToLogin()
    }, 2000)
    return
  }

  // Check if we have a valid result
  const accountData = result.value?.account
  if (!accountData) {
    error.value = true
    setTimeout(() => {
      redirectToLogin()
    }, 2000)
    return
  }

  // Check if the account query was successful
  if (accountData.status === 'SUCCESS' && accountData.result) {
    account.value = accountData.result
    error.value = false
  } else {
    // Account query returned an error status
    error.value = true
    console.error('Account query failed:', accountData.errors)
    setTimeout(() => {
      redirectToLogin()
    }, 2000)
  }
}, { immediate: true })

const redirectToLogin = () => {
  router.push('/login')
}

const handleBackToHome = () => {
  showEditProfile.value = false
  showAffiliations.value = false
}

const handleProfileUpdated = async () => {
  // Refetch the account data to show updated information
  await refetch()
  showEditProfile.value = false
}

const handleUserInvited = (email) => {
  console.log('User invited:', email)
  // You can add additional logic here if needed, such as showing a notification
}

const logout = async () => {
  try {
    logoutError.value = ''
    const response = await logoutMutation()

    console.log('Logout response:', response?.data?.logout)

    if (response?.data?.logout?.status === 'SUCCESS') {
      // Successfully logged out, redirect to login
      router.push('/login')
    } else {
      // Logout failed, show error
      const errorMsg = response?.data?.logout?.errors?.[0]?.message || 'Logout failed'
      logoutError.value = errorMsg
    }
  } catch (error) {
    console.error('Logout failed:', error)
    logoutError.value = error.message || 'An unexpected error occurred during logout.'
  }
}
</script>


<style scoped>
.welcome {
  text-align: center;
  margin-bottom: 2rem;
}

.welcome h1 {
  margin-bottom: 1.5rem;
  color: #333;
}

.user-info {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border: 1px solid #e9ecef;
}

.user-info p {
  margin: 0.5rem 0;
  font-size: 1rem;
}

.user-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
</style>
