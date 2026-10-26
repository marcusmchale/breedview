import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/composables/user/useAuthStore'
import LoginPage from '../components/user/LoginPage.vue'
import ProgramsPage from '../components/programs/ProgramsPage.vue'
import RegistrationPage from '../components/user/RegistrationPage.vue'
import ResetPassword from '../components/user/ResetPassword.vue'
import VerifyEmail from '../components/user/VerifyEmail.vue'
import OntologyManagementPage from '../components/ontology/OntologyManagementPage.vue'
import CommitHistoryPage from '@/components/ontology/CommitHistoryPage.vue'
import OntologyRolePage from '@/components/user/OntologyRolePage.vue'
import GermplasmManagement from '@/components/germplasm/GermplasmManagement.vue'
import LocationsPage from '@/components/locations/LocationsPage.vue'
import UnitsPage from '@/components/units/UnitsPage.vue'
import AnalysisWorkspace from "@/components/analysis/AnalysisWorkspace.vue";
import PeoplePage from '@/components/people/PeoplePage.vue'
import ProfilePage from '@/components/user/ProfilePage.vue'
import OrcidCallbackPage from '@/components/user/OrcidCallbackPage.vue'
import AccessControlPage from '@/components/controls/AccessControlPage.vue'
import PrivacyNoticePage from '@/components/user/PrivacyNoticePage.vue'
import TermsOfUsePage from '@/components/user/TermsOfUsePage.vue'
import GuidePage from '@/components/guide/GuidePage.vue'
import { useTermsOfUse } from '@/composables/system/useTermsOfUse'

const routes = [
  {
    // home: the profile when signed in, otherwise the programs, which anyone may read
    path: '/',
    name: 'Root',
    component: { render: () => null },
    beforeEnter: async () => {
      const signedIn = await useAuthStore().authenticate().catch(() => false)
      return signedIn ? '/profile' : '/programs'
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginPage,
    meta: {
      title: 'Login',
      hideNavigation: true
    }
  },
  {
    path: '/register',
    name: 'Register',
    component: RegistrationPage,
    props: route => ({ token: route.query.token }),
    meta: {
      title: 'Register',
      hideNavigation: true
    }
  },
  {
    path: '/programs',
    name: 'Programs',
    component: ProgramsPage,
    meta: {
      // anyone may read what has been released to the public; signing in shows more
      allowAnonymous: true,
      title: 'Programs'
    }
  },
  {
    path: '/ontology',
    name: 'Ontology',
    component: OntologyManagementPage,
    meta: {
      // anyone may read the published ontology; signing in shows drafts, the commit history and roles
      allowAnonymous: true,
      title: 'Ontology'
    }
  },
  {
    path: '/ontology/commits',
    name: 'commit-history',
    component: CommitHistoryPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/ontology/roles',
    name: 'ontology-roles',
    component: OntologyRolePage,
    meta: { requiresAuth: true }
  },
  {
    path: '/germplasm',
    name: 'Germplasm',
    component: GermplasmManagement,
    meta: {
      // anyone may read what has been released to the public; signing in shows more
      allowAnonymous: true,
      title: 'Germplasm'
    }
  },
  {
    path: '/locations',
    name: 'Locations',
    component: LocationsPage,
    meta: {
      // anyone may read what has been released to the public; signing in shows more
      allowAnonymous: true,
      title: 'Locations'
    }
  },
  {
    // units by location: ?location=, and graph, arrival, from and unit for what is selected there
    path: '/units',
    name: 'Units',
    component: UnitsPage,
    meta: {
      // anyone may read what has been released to the public; signing in shows more
      allowAnonymous: true,
      title: 'Units'
    }
  },
  {
    path: '/analysis',
    name: 'Analysis',
    component: AnalysisWorkspace,
    meta: {
      requiresAuth: true,
      title: 'Analysis'
    }
  },

  {
    path: '/people',
    name: 'People',
    component: PeoplePage,
    meta: {
      // People are not listed publicly: signed-out visitors see Persons only where they are credited, by attribution
      // (breedgraph docs/person.md §3), and the API refuses them the people queries
      requiresAuth: true,
      title: 'People'
    }
  },
  {
    path: '/privacy',
    name: 'Privacy',
    component: PrivacyNoticePage,
    meta: {
      allowAnonymous: true,
      // shown before the Terms of Use are accepted, as the Terms themselves are
      openBeforeTerms: true,
      title: 'Privacy notice'
    }
  },
  {
    path: '/terms',
    name: 'Terms',
    component: TermsOfUsePage,
    meta: {
      allowAnonymous: true,
      openBeforeTerms: true,
      title: 'Terms of Use'
    }
  },
  // the page guide/pdf.mjs prints a collection of the guide's chapters from, as a document of its own: in the dev server
  // and the guide's own build (guide:serve) only, not in a site's
  ...(import.meta.env.DEV || import.meta.env.VITE_GUIDE_PRINT
    ? [{
        path: '/guide/print/:collection',
        name: 'GuidePrint',
        component: () => import('@/components/guide/GuidePrint.vue'),
        meta: {
          allowAnonymous: true,
          openBeforeTerms: true,
          hideNavigation: true,
          title: 'User guide'
        }
      }]
    : []),
  {
    path: '/guide/:chapter?',
    name: 'Guide',
    component: GuidePage,
    meta: {
      allowAnonymous: true,
      openBeforeTerms: true,
      title: 'User guide'
    }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: ProfilePage,
    meta: {
      requiresAuth: true,
      title: 'Profile'
    }
  },
  {
    // ORCID's redirect after sign-in, configured as ORCID_REDIRECT_URI on the API
    path: '/orcid',
    name: 'OrcidCallback',
    component: OrcidCallbackPage,
    props: route => ({ code: route.query.code, state: route.query.state, error: route.query.error }),
    meta: {
      requiresAuth: true,
      title: 'ORCID',
      hideNavigation: true
    }
  },
  {
    path: '/access',
    name: 'AccessControl',
    component: AccessControlPage,
    meta: {
      requiresAuth: true,
      title: 'Access control'
    }
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: ResetPassword,
    props: route => ({ token: route.query.token }),
    meta: {
      title: 'Reset Password',
      hideNavigation: true
    }
  },
  {
    path: '/verify-email',
    name: 'VerifyEmail',
    component: VerifyEmail,
    props: route => ({ token: route.query.token }),
    meta: {
      title: 'Verify Email',
      hideNavigation: true
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to, from, next) => {
  // Set page title
  if (to.meta.title) {
    document.title = `${to.meta.title} - BreedView`
  }

  // Until the Terms of Use are accepted the API refuses all else, sign-in checks included: App shows the Terms in place
  // of the page, and accepting them loads the page again (breedgraph docs/licences.md §4)
  const { load: loadTerms } = useTermsOfUse()
  if (!(await loadTerms())) {
    next()
    return
  }

  const { authenticate } = useAuthStore()

  // Routes open to anonymous users still learn who is signed in, for the navigation and what the page offers
  if (to.meta.allowAnonymous) {
    try {
      await authenticate()
    } catch (error) {
      console.log('Auth check failed on an open route:', error)
    }
    next()
    return
  }

  // Handle protected routes
  if (to.meta.requiresAuth) {
    try {
      const authSuccess = await authenticate()

      if (authSuccess) {
        next()
      } else {
        next({
          name: 'Login',
          query: {
            redirect: to.fullPath,
            error: 'Authentication required'
          }
        })
      }
    } catch (error) {
      console.error('Router auth check failed:', error)
      next({
        name: 'Login',
        query: {
          redirect: to.fullPath,
          error: 'Authentication check failed'
        }
      })
    }
  } else {
    // Handle public routes (login/register)
    if (to.name === 'Login' || to.name === 'Register') {
      try {
        // Check if already authenticated
        const authSuccess = await authenticate()
        if (authSuccess) {
          // Already logged in, redirect to intended page or the profile
          const redirectPath = to.query.redirect || '/profile'
          next(redirectPath)
          return
        }
      } catch (error) {
        console.log('Auth check failed on public route:', error)
        // Continue to login/register page
      }
    }
    next()
  }
})

export default router