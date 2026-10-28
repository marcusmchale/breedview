
<script setup>
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMutation, useApolloClient } from '@vue/apollo-composable'
import { useCsrf } from './composables/system/useCsrf'
import { useAuthStore } from './composables/user/useAuthStore'
import { useTermsOfUse } from './composables/system/useTermsOfUse'
import TermsGate from './components/user/TermsGate.vue'
import DemoBanner from './components/guide/DemoBanner.vue'
import { branding } from './branding/loadBranding'
import LOGOUT_MUTATION from './graphql/authentication/logout.graphql'

const router = useRouter()
const route = useRoute()
// the licences of the code the build bundles (scripts/thirdPartyLicences.js), beside it
const licencesUrl = `${import.meta.env.BASE_URL}licenses.txt`

const { fetchCsrfToken, clearCsrfToken } = useCsrf()
const { clearAuthState, isAuthenticated } = useAuthStore()

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

// The Terms of Use come before any page but those open before them (the Terms and the privacy notice): the API refuses
// everything else until they are accepted. data-terms on the root says which, for the e2e tests.
const { accepted: termsAccepted } = useTermsOfUse()
const termsAsked = computed(() => termsAccepted.value === false && !route.meta?.openBeforeTerms)
const termsState = computed(() => (termsAccepted.value === null ? 'unknown' : (termsAccepted.value ? 'accepted' : 'asked')))

const clearApolloCache = async () => {
  try {
    // Use clearStore instead of resetStore - doesn't refetch queries
    await client.clearStore()
    console.log('Apollo cache cleared')
  } catch (error) {
    console.error('Failed to clear Apollo cache:', error)
  }
}

// Signed out, a page open to everyone stays, read again as an anonymous user would see it; any other page leaves for
// the programs. The cache held what the account could read, so it is cleared either way.
const leaveSignedOut = async () => {
  clearAuthState()
  clearCsrfToken()
  if (route.meta?.allowAnonymous) {
    try {
      // clears the cache and reads the page's queries again
      await client.resetStore()
    } catch (error) {
      console.error('Failed to read the page again after logout:', error)
    }
  } else {
    await clearApolloCache()
    await router.push('/programs')
  }
}

const logout = async () => {
  try {
    const response = await logoutMutation()
    if (response?.data?.accountsLogout?.status !== 'SUCCESS') {
      // signed out here all the same
      console.error('Logout failed:', response?.data?.accountsLogout?.errors)
    }
  } catch (error) {
    console.error('Logout failed:', error)
  }
  await leaveSignedOut()
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
  <div id="app" :data-terms="termsState">
    <DemoBanner />
    <!-- Navigation Bar -->
    <nav v-if="!hideNavigation" class="navbar">
      <div class="nav-container">
        <div class="nav-brand">
          <!-- a deployment's logos (src/branding), before BreedView's name -->
          <component
            :is="logo.href ? 'a' : 'span'"
            v-for="logo in branding.logos"
            :key="logo.src"
            :href="logo.href || undefined"
            :target="logo.href ? '_blank' : undefined"
            :rel="logo.href ? 'noopener noreferrer' : undefined"
            class="brand-logo"
          >
            <img :src="logo.src" :alt="logo.alt" :style="{ height: `${logo.height}px` }">
          </component>
          <router-link to="/" class="brand-link">
            BreedView
            <span class="brand-note">an app for BreedGraph</span>
          </router-link>
        </div>

        <div class="nav-menu">
          <!-- anonymous users see only the pages open to them (allowAnonymous in the router) -->
          <router-link to="/programs" class="nav-link" active-class="active">
            Programs
          </router-link>
          <router-link to="/locations" class="nav-link" active-class="active">
            Locations
          </router-link>
          <router-link to="/units" class="nav-link" active-class="active">
            Units
          </router-link>
          <router-link to="/germplasm" class="nav-link" active-class="active">
            Germplasm
          </router-link>
          <router-link to="/ontology" class="nav-link" active-class="active">
            Ontology
          </router-link>
          <router-link v-if="isAuthenticated" to="/people" class="nav-link" active-class="active">
            People
          </router-link>
          <router-link v-if="isAuthenticated" to="/access" class="nav-link" active-class="active">
            Access control
          </router-link>
          <template v-if="isAuthenticated">
            <router-link to="/profile" class="nav-link" active-class="active">
              Profile
            </router-link>
            <button @click="logout" class="nav-logout" :disabled="logoutLoading">
              {{ logoutLoading ? 'Logging out...' : 'Logout' }}
            </button>
          </template>
          <router-link v-else :to="{ name: 'Login', query: { redirect: route.fullPath } }" class="nav-login">
            Log in
          </router-link>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="main-content">
      <TermsGate v-if="termsAsked" />
      <router-view v-else></router-view>
    </main>

    <footer v-if="!hideNavigation" class="app-footer">
      <div class="footer-links">
        <router-link to="/guide">User guide</router-link>
        <router-link to="/terms">Terms of Use</router-link>
        <router-link to="/privacy">Privacy notice</router-link>
        <a :href="licencesUrl" class="licences-link" target="_blank" rel="noopener">Open-source licences</a>
        <!-- a deployment's links (src/branding) -->
        <a v-for="link in branding.footer.links" :key="link.href" :href="link.href" target="_blank" rel="noopener noreferrer">
          {{ link.label }}
        </a>
      </div>
      <p v-if="branding.footer.text" class="footer-text">{{ branding.footer.text }}</p>
      <p class="footer-projects">
        <a href="https://github.com/marcusmchale/breedview" target="_blank" rel="noopener noreferrer">BreedView</a>,
        an app for
        <a href="https://github.com/marcusmchale/breedgraph" target="_blank" rel="noopener noreferrer">BreedGraph</a>
      </p>
    </footer>
  </div>
</template>


<style>
@import './assets/styles/global.css';
@import './assets/styles/layout.css';
@import './assets/styles/buttons.css';
@import './assets/styles/forms.css';
@import './assets/styles/modals.css';
@import './assets/styles/badges.css';
@import './assets/styles/navigation.css';

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
  box-sizing: border-box;  /* the padding is within the width, so the page doesn't scroll sideways */
}

.app-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid #eee;
  text-align: center;
  font-size: 0.85rem;
  background: var(--brand-footer);
  color: var(--brand-footer-text);
}

.app-footer a {
  color: var(--brand-footer-text);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 1.5rem;
}

.footer-text,
.footer-projects {
  margin: 0.5rem 0 0;
}

.footer-projects {
  font-size: 0.8rem;
}

@media (max-width: 768px) {
  .main-content {
    padding: 1rem 0.5rem;
  }
}
</style>