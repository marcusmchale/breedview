
<template>
  <div id="app">
    <!-- Navigation Bar -->
    <nav v-if="!hideNavigation" class="navbar">
      <div class="nav-container">
        <div class="nav-brand">
          <router-link to="/home" class="brand-link">
            BreedView
          </router-link>
        </div>

        <div class="nav-menu">
          <router-link to="/home" class="nav-link" active-class="active">
            Home
          </router-link>
          <router-link to="/ontology" class="nav-link" active-class="active">
            Ontology
          </router-link>
          <router-link to="/germplasm" class="nav-link" active-class="active">
            Germplasm
          </router-link>
          <router-link to="/programs" class="nav-link" active-class="active">
            Programs
          </router-link>
          <router-link to="/regions" class="nav-link" active-class="active">
            Regions
          </router-link>
          <router-link to="/edit-affiliations" class="nav-link" active-class="active">
            Affiliations
          </router-link>
          <router-link to="/edit-profile" class="nav-link" active-class="active">
            Profile
          </router-link>

          <button @click="logout" class="nav-logout" :disabled="logoutLoading">
            {{ logoutLoading ? 'Logging out...' : 'Logout' }}
          </button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMutation } from '@vue/apollo-composable'
import { useCsrf } from './composables/useCsrf'
import { useAuthStore } from './composables/useAuthStore'
import LOGOUT_MUTATION from './graphql/authentication/logout.graphql'

const router = useRouter()
const route = useRoute()

const { fetchCsrfToken, refreshCsrfToken } = useCsrf()
const { clearAuthState, startPeriodicAuthCheck } = useAuthStore()

// Logout functionality
const { mutate: logoutMutation, loading: logoutLoading, onError: onLogoutError } = useMutation(LOGOUT_MUTATION)

// Handle logout errors
onLogoutError((err) => {
  console.error('Logout error:', err)
})

// Determine if navigation should be hidden
const hideNavigation = computed(() => {
  return route.meta?.hideNavigation || false
})

const logout = async () => {
  try {
    const response = await logoutMutation()

    console.log('Logout response:', response?.data?.accountsLogout)

    if (response?.data?.accountsLogout?.status === 'SUCCESS') {
      // Successfully logged out, clear auth state and redirect
      clearAuthState()
      router.push('/login')
    } else {
      // Logout failed, but clear auth state and redirect anyway for security
      console.error('Logout failed:', response?.data?.accountsLogout?.errors)
      clearAuthState()
      router.push('/login')
    }
  } catch (error) {
    console.error('Logout failed:', error)
    // Clear auth state and redirect even if logout mutation fails
    clearAuthState()
    router.push('/login')
  }
}

let tokenRefreshInterval = null

onMounted(async () => {
  try {
    // Initialize CSRF protection
    await fetchCsrfToken()
    console.log('CSRF protection initialized successfully')

    // Start periodic authentication checks
    startPeriodicAuthCheck()
    console.log('Periodic authentication checks started')

    // Set up periodic token refresh (optional - every 30 minutes)
    tokenRefreshInterval = setInterval(async () => {
      try {
        await refreshCsrfToken()
        console.log('CSRF token refreshed proactively')
      } catch (error) {
        console.warn('Proactive CSRF token refresh failed:', error)
      }
    }, 30 * 60 * 1000) // 30 minutes

  } catch (error) {
    console.error('Failed to initialize app security:', error)
  }
})

onUnmounted(() => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval)
  }
})
</script>

<style>
/* Import organized CSS files */
@import './assets/styles/global.css';
@import './assets/styles/layout.css';
@import './assets/styles/buttons.css';
@import './assets/styles/forms.css';
@import './assets/styles/modals.css';
@import './assets/styles/badges.css';
@import './assets/styles/navigation.css';

/* App-specific layout */
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding: 2rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

@media (max-width: 768px) {
  .main-content {
    padding: 1rem 0.5rem;
  }
}
</style>