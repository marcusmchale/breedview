import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/composables/useAuthStore'
import HomePage from '../components/HomePage.vue'
import LoginPage from '../components/LoginPage.vue'
import ProgramsPage from '../components/ProgramsPage.vue'
import RegistrationPage from '../components/RegistrationPage.vue'
import EditProfilePage from '../components/EditProfilePage.vue'
import AffiliationsPage from '../components/AffiliationsPage.vue'
import ResetPassword from '../components/ResetPassword.vue'
import VerifyEmail from '../components/VerifyEmail.vue'
import OntologyManagementPage from '../components/OntologyManagementPage.vue'
import CommitHistoryPage from '@/components/CommitHistoryPage.vue'
import GermplasmManagement from '@/components/GermplasmManagement.vue'


const routes = [
  {
    path: '/',
    name: 'Root',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: HomePage,
    meta: {
      requiresAuth: true,
      title: 'Home'
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
    meta: {
      title: 'Register',
      hideNavigation: true
    }
  },
  {
    path: '/edit-profile',
    name: 'EditProfile',
    component: EditProfilePage,
    meta: {
      requiresAuth: true,
      title: 'Edit Profile'
    }
  },
  {
    path: '/edit-affiliations',
    name: 'EditAffiliations',
    component: AffiliationsPage,
    meta: {
      requiresAuth: true,
      title: 'Edit Affiliations'
    }
  },
  {
    path: '/programs',
    name: 'Programs',
    component: ProgramsPage,
    meta: {
      requiresAuth: true,
      title: 'Programs Management'
    }
  },
  {
    path: '/ontology-management',
    name: 'OntologyManagement',
    component: OntologyManagementPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/ontology/commits',
    name: 'commit-history',
    component: CommitHistoryPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/germplasm-management',
    name: 'GermplasmManagement',
    component: GermplasmManagement,
    meta: {
      requiresAuth: true,
      title: 'Germplasm Graph'
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
    redirect: '/home'
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

router.beforeEach(async (to, from, next) => {
  // Set page title
  if (to.meta.title) {
    document.title = `${to.meta.title} - BreedView`
  }

  const { authenticate } = useAuthStore()

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
          // Already logged in, redirect to intended page or home
          const redirectPath = to.query.redirect || '/home'
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