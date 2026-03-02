import { ref } from 'vue'

const csrfEndpoint = `${import.meta.env.VITE_API_HOST}/csrf`

const csrfToken = ref(null)

export function useCsrf() {
  const fetchCsrfToken = async () => {
    try {
      const response = await fetch(csrfEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`)
      }

      const data = await response.json()
      csrfToken.value = data.token
      return data.token
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error)
      throw error
    }
  }

  const clearCsrfToken = () => {
    csrfToken.value = null
  }

  return {
    csrfToken,
    fetchCsrfToken,
    clearCsrfToken
  }
}