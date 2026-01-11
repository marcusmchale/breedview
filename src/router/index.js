import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/composables/user/useAuthStore'
import HomePage from '../components/HomePage.vue'
import LoginPage from '../components/user/LoginPage.vue'
import ProgramsPage from '../components/programs/ProgramsPage.vue'
import RegistrationPage from '../components/user/RegistrationPage.vue'
import EditProfilePage from '../components/user/EditProfilePage.vue'
import AffiliationsPage from '../components/affiliations/AffiliationsPage.vue'
import ResetPassword from '../components/user/ResetPassword.vue'
import VerifyEmail from '../components/user/VerifyEmail.vue'
import OntologyManagementPage from '../components/ontology/OntologyManagementPage.vue'
import CommitHistoryPage from '@/components/ontology/CommitHistoryPage.vue'
import OntologyRolePage from '@/components/user/OntologyRolePage.vue'
import GermplasmManagement from '@/components/germplasm/GermplasmManagement.vue'
import RegionManagement from '@/components/regions/RegionsManagement.vue'
import ArrangementManagement from "@/components/arrangements/ArrangementManagement.vue";
import BlockManagement from '@/components/blocks/BlockManagement.vue'
import DatasetManagement from '@/components/datasets/DatasetManagement.vue'


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
    path: '/profile',
    name: 'EditProfile',
    component: EditProfilePage,
    meta: {
      requiresAuth: true,
      title: 'Edit Profile'
    }
  },
  {
    path: '/affiliations',
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
      title: 'Programs'
    }
  },
  {
    path: '/ontology',
    name: 'Ontology',
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
      requiresAuth: true,
      title: 'Germplasm'
    }
  },
  {
    path: '/regions',
    name: 'Regions',
    component: RegionManagement,
    meta: {
      requiresAuth: true,
      title: 'Regions'
    }
  },
  {
    path: '/arrangements',
    name: 'Arrangements',
    component: ArrangementManagement,
    meta: {
      requiresAuth: true,
      title: 'Arrangements'
    }
  },
  {
    path: '/blocks',
    name: 'Blocks',
    component: BlockManagement,
    meta: {
      requiresAuth: true,
      title: 'Blocks'
    }
  },
  {
    path: '/datasets',
    name: 'Datasets',
    component: DatasetManagement,
    meta: {
      requiresAuth: true,
      title: 'Datasets'
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