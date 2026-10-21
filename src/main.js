
import { createApp } from 'vue'
import { DefaultApolloClient } from '@vue/apollo-composable'


import { plugin as formKitPlugin, defaultConfig } from '@formkit/vue'
import '@formkit/themes/genesis'
import { partialDateTimeRule, partialDateTimeMessage } from "@/plugins/formkitRules";
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
  rules: { partialDateTime: partialDateTimeRule },
  messages: { en: { validation: { partialDateTime: partialDateTimeMessage } } },
  plugins: [hierarchicalSelectPlugin, hierarchicalMultiSelectPlugin]
}))

app.mount('#app')