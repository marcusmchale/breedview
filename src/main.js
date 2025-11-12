
import { createApp } from 'vue'
import { ApolloClients } from '@vue/apollo-composable'
import { plugin as formKitPlugin, defaultConfig } from '@formkit/vue'
import '@formkit/themes/genesis'
import App from './App.vue'
import router from './router'
import apolloClient from './graphql/apollo'
import './assets/styles/global.css'

import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev";
if (process.env.NODE_ENV === "development") {
  // Adds debugging messages only in a dev environment
  loadDevMessages();
  loadErrorMessages();
}

const app = createApp(App)

app.provide(ApolloClients, {
  default: apolloClient,
})

app.use(router)

// Register FormKit WITHOUT custom inputs - we'll handle it differently
app.use(formKitPlugin, defaultConfig({
  theme: 'genesis'
}))

app.mount('#app')


// Register service worker for tile caching
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope)
      })
      .catch((error) => {
        console.error('SW registration failed:', error)
      })
  })
}