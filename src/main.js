
import { createApp } from 'vue'
import { DefaultApolloClient } from '@vue/apollo-composable'


import { plugin as formKitPlugin, defaultConfig } from '@formkit/vue'
import '@formkit/themes/genesis'
import { createPartialDatetimeRule } from "@/plugins/formkitRules";
import { hierarchicalSelectPlugin } from '@/plugins/formkitHierarchicalSelect'
import { hierarchicalMultiSelectPlugin } from '@/plugins/formkitHierarchicalMultiSelect'

import App from './App.vue'
import router from './router'
import apolloClient from './graphql/apollo'


import './assets/styles/global.css'

import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev";

if (import.meta.env.DEV) {
  // Adds debugging messages only in a dev environment
  loadDevMessages();
  loadErrorMessages();
}

const app = createApp(App)

app.provide(DefaultApolloClient, apolloClient)
app.use(router)


app.use(formKitPlugin, defaultConfig({
  theme: 'genesis',
  rules: [createPartialDatetimeRule()],
  plugins: [hierarchicalSelectPlugin, hierarchicalMultiSelectPlugin]
}))

app.mount('#app')


// Register service worker for tile caching
if ('serviceWorker' in navigator && import.meta.env.PROD) {
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