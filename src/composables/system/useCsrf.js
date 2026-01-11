import { ref } from 'vue'

const csrfEndpoint = `${process.env.VUE_APP_API_HOST}/csrf`

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

  const refreshCsrfToken = async () => {
    console.log('Refreshing expired CSRF token...')
    return await fetchCsrfToken()
  }

  const makeRequestWithCsrf = async (requestFn, maxRetries = 1) => {
    let retries = 0

    while (retries <= maxRetries) {
      try {
        // Ensure we have a token
        if (!csrfToken.value) {
          await fetchCsrfToken()
        }

        // Make the request
        const result = await requestFn(csrfToken.value)
        return result
      } catch (error) {
        const isTokenExpired = isCSRFTokenExpired(error)

        if (isTokenExpired && retries < maxRetries) {
          console.log('CSRF token expired, attempting to refresh and retry...')
          retries++

          try {
            await refreshCsrfToken()
            // Continue to next iteration to retry with new token
          } catch (refreshError) {
            console.error('Failed to refresh CSRF token:', refreshError)
            throw refreshError
          }
        } else {
          // Either not a token expiry error, or we've exhausted retries
          throw error
        }
      }
    }
  }

  const isCSRFTokenExpired = (error) => {
    // Check various indicators that suggest CSRF token expiry
    if (!error) return false

    // Check HTTP status codes commonly used for CSRF failures
    if (error.response?.status === 403 || error.response?.status === 419) {
      return true
    }

    // Check error messages that might indicate CSRF issues
    const errorMessage = error.message?.toLowerCase() || ''
    const csrfKeywords = ['csrf', 'token', 'expired', 'invalid', 'mismatch']

    return csrfKeywords.some(keyword => errorMessage.includes(keyword))
  }

  const clearCsrfToken = () => {
    csrfToken.value = null
  }

  return {
    csrfToken,
    fetchCsrfToken,
    refreshCsrfToken,
    makeRequestWithCsrf,
    clearCsrfToken,
    isCSRFTokenExpired
  }
}