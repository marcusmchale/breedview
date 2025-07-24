<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useCsrf } from './composables/useCsrf'

const { fetchCsrfToken, refreshCsrfToken } = useCsrf()

let tokenRefreshInterval = null

onMounted(async () => {
  try {
    await fetchCsrfToken()
    console.log('CSRF protection initialized successfully')

    // Set up periodic token refresh (optional - every 30 minutes)
    // This prevents tokens from expiring during long user sessions
    tokenRefreshInterval = setInterval(async () => {
      try {
        await refreshCsrfToken()
        console.log('CSRF token refreshed proactively')
      } catch (error) {
        console.warn('Proactive CSRF token refresh failed:', error)
        // Don't throw here - the makeRequestWithCsrf will handle it on next request
      }
    }, 30 * 60 * 1000) // 30 minutes

  } catch (error) {
    console.error('Failed to initialize CSRF protection:', error)
    // Don't prevent app from loading if CSRF fetch fails initially
    // The makeRequestWithCsrf function will handle getting a token when needed
  }
})

onUnmounted(() => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval)
  }
})
</script>

<style>
/* CSS Variables for consistent theming */
:root {
  --primary-color: #4CAF50;
  --error-color: #ff0000;
  --success-color: #4CAF50;
  --disabled-color: #cccccc;
  --form-max-width: 400px;
}

/* Global styles */
body {
  margin: 0;
  font-family: Arial, sans-serif;
}

/* Common form styles */
.form-container {
  max-width: var(--form-max-width);
  margin: 0 auto;
  padding: 20px;
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

/* Common button styles */
.submit-button {
  width: 100%;
  padding: 0.5rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.submit-button:disabled {
  background-color: var(--disabled-color);
  cursor: not-allowed;
}

/* Message styles */
.error-message {
  color: var(--error-color);
  margin-top: 1rem;
}

.success-message {
  color: var(--success-color);
  margin-top: 1rem;
}

/* Navigation and action links */
.additional-actions {
  text-align: center;
  margin-top: 1rem;
}

.text-button {
  background: none;
  border: none;
  color: #2c3e50;
  text-decoration: underline;
  cursor: pointer;
  padding: 0.5rem;
}

.text-button:hover {
  color: var(--primary-color); /* Using the primary color variable for consistency */
}

</style>