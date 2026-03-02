import { ref, computed } from 'vue'
import { checkAuthentication } from './useAuthentication'


// Global reactive state - only public data
const user = ref(null)
const isAuthenticated = ref(false)
const isLoading = ref(false)
const error = ref(null)
const lastAuthCheck = ref(null)

// Cache duration (5 minutes)
const AUTH_CACHE_DURATION = 5 * 60 * 1000

export function useAuthStore() {
  const currentUserId = computed(() => user.value?.id || null)
  
  const authenticate = async (forceRefresh = false) => {
    try {
      // Only check server if cache is expired or forced refresh
      const now = Date.now()
      const cacheValid = lastAuthCheck.value && 
                        (now - lastAuthCheck.value) < AUTH_CACHE_DURATION
      
      if (!forceRefresh && cacheValid && isAuthenticated.value) {
        return true
      }
      
      isLoading.value = true
      error.value = null
      
      const authResult = await checkAuthentication()
      console.log("Authentication", authResult.isAuthenticated ? "success" : "failed")
      lastAuthCheck.value = now
      
      if (authResult.isAuthenticated) {
        user.value = authResult.user
        isAuthenticated.value = true
        return true
      } else {
        // Clear any cached data on auth failure
        clearAuthState()
        error.value = authResult.error
        return false
      }
    } catch (err) {
      console.error('Authentication failed:', err)
      clearAuthState()
      error.value = err.message
      return false
    } finally {
      isLoading.value = false
    }
  }
  
  const clearAuthState = () => {
    user.value = null
    isAuthenticated.value = false
    error.value = null
    lastAuthCheck.value = null
  }
  
  const logout = () => {
    clearAuthState()

    // The logout mutation causes the back end (breedgraph) to set the httponly cookie to expire immediately
  }
  

  return {
    user: computed(() => user.value),
    currentUserId,
    isAuthenticated: computed(() => isAuthenticated.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    authenticate,
    clearAuthState,
    logout
  }
}
