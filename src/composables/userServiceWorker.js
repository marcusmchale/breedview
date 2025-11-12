
import { ref, onMounted } from 'vue'

/**
 * Composable for managing the service worker
 * Handles registration, updates, and cache management
 */
export function useServiceWorker() {
  const isSupported = ref('serviceWorker' in navigator)
  const isRegistered = ref(false)
  const isOnline = ref(navigator.onLine)
  const updateAvailable = ref(false)
  const registration = ref(null)

  /**
   * Register the service worker
   */
  const register = async () => {
    if (!isSupported.value) {
      console.warn('Service workers are not supported in this browser')
      return false
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      registration.value = reg
      isRegistered.value = true

      console.log('Service worker registered:', reg.scope)

      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            updateAvailable.value = true
            console.log('New service worker available')
          }
        })
      })

      return true
    } catch (error) {
      console.error('Service worker registration failed:', error)
      return false
    }
  }

  /**
   * Update to the new service worker
   */
  const update = async () => {
    if (!registration.value) return

    const reg = await registration.value.update()
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    }
  }

  /**
   * Clear the tile cache
   */
  const clearTileCache = async () => {
    if (!registration.value?.active) {
      console.warn('No active service worker')
      return false
    }

    try {
      const messageChannel = new MessageChannel()

      const response = await new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data)
        }

        registration.value.active.postMessage(
          { type: 'CLEAR_TILE_CACHE' },
          [messageChannel.port2]
        )
      })

      return response.success
    } catch (error) {
      console.error('Failed to clear tile cache:', error)
      return false
    }
  }

  /**
   * Get the current cache size (number of cached tiles)
   */
  const getCacheSize = async () => {
    if (!registration.value?.active) return 0

    try {
      const messageChannel = new MessageChannel()

      const response = await new Promise((resolve) => {
        messageChannel.port1.onmessage = (event) => {
          resolve(event.data)
        }

        registration.value.active.postMessage(
          { type: 'GET_CACHE_SIZE' },
          [messageChannel.port2]
        )
      })

      return response.success ? response.size : 0
    } catch (error) {
      console.error('Failed to get cache size:', error)
      return 0
    }
  }

  /**
   * Monitor online/offline status
   */
  onMounted(() => {
    window.addEventListener('online', () => {
      isOnline.value = true
      console.log('App is online')
    })

    window.addEventListener('offline', () => {
      isOnline.value = false
      console.log('App is offline')
    })
  })

  return {
    isSupported,
    isRegistered,
    isOnline,
    updateAvailable,
    register,
    update,
    clearTileCache,
    getCacheSize
  }
}