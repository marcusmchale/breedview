import { createApp } from 'vue'
import { ApolloClients } from '@vue/apollo-composable'
import { plugin, defaultConfig } from '@formkit/vue'
import '@formkit/themes/genesis'
import App from './App.vue'
import router from './router'
import apolloClient from './graphql/apollo'

import './assets/styles/global.css'

const app = createApp(App)

app.provide(ApolloClients, {
  default: apolloClient,
})

app.use(router)
app.use(plugin, defaultConfig({
  theme: 'genesis'
}))

app.mount('#app')