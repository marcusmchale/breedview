
<script setup>
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMutation, useApolloClient } from '@vue/apollo-composable'
import { useCsrf } from './composables/system/useCsrf'
import { useAuthStore } from './composables/user/useAuthStore'
import LOGOUT_MUTATION from './graphql/authentication/logout.graphql'

const router = useRouter()
const route = useRoute()

const { fetchCsrfToken, clearCsrfToken } = useCsrf()
const { clearAuthState } = useAuthStore()

// Get Apollo client once at setup
const { client } = useApolloClient()


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

const clearApolloCache = async () => {
  try {
    // Use clearStore instead of resetStore - doesn't refetch queries
    await client.clearStore()
    console.log('Apollo cache cleared')
  } catch (error) {
    console.error('Failed to clear Apollo cache:', error)
  }
}

const logout = async () => {
  try {
    const response = await logoutMutation()
    if (response?.data?.accountsLogout?.status === 'SUCCESS') {
      // Successfully logged out, clear auth state and redirect
      console.log('Logout successful')
      clearAuthState()
      clearCsrfToken()
      await router.push('/login')
    } else {
      // Logout failed, but clear auth state and redirect anyway for security
      console.error('Logout failed:', response?.data?.accountsLogout?.errors)
      clearAuthState()
      clearCsrfToken()
      await clearApolloCache()
      await router.push('/login')
    }
  } catch (error) {
    console.error('Logout failed:', error)
    // Clear auth state and redirect even if logout mutation fails
    clearAuthState()
    clearCsrfToken()
    await router.push('/login')
  }
}

onMounted(async () => {
  try {
    // Initialize CSRF protection
    await fetchCsrfToken()
    console.log('CSRF protection initialized successfully')

  } catch (error) {
    console.error('Failed to initialize app security:', error)
  }
})

</script>


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
          <router-link to="/affiliations" class="nav-link" active-class="active">
            Affiliations
          </router-link>
          <router-link to="/ontology" class="nav-link" active-class="active">
            Ontology
          </router-link>
          <router-link to="/germplasm" class="nav-link" active-class="active">
            Germplasm
          </router-link>
          <router-link to="/regions" class="nav-link" active-class="active">
            Regions
          </router-link>
          <router-link to="/arrangements" class="nav-link" active-class="active">
            Arrangements
          </router-link>
          <router-link to="/blocks" class="nav-link" active-class="active">
            Blocks
          </router-link>
          <router-link to="/programs" class="nav-link" active-class="active">
            Programs
          </router-link>
          <router-link to="/datasets" class="nav-link" active-class="active">
            Datasets
          </router-link>
          <router-link to="/analysis" class="nav-link" active-class="active">
            Analysis
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