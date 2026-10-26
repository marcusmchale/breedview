import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'

import GuideSiteApp from './GuideSiteApp.vue'
import GuidePage from '@/components/guide/GuidePage.vue'

import '@/assets/styles/global.css'

// The user guide on its own, as a static site (guide/README.md, The guide on GitHub Pages): the app's guide pages,
// at the same paths under the site's base, with no API, sign-in or Terms of Use, as it shows no data
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/guide' },
    { path: '/guide/:chapter?', name: 'Guide', component: GuidePage },
    { path: '/:rest(.*)*', redirect: '/guide' }
  ],
  scrollBehavior: (to, from, saved) => saved ?? (to.hash ? { el: to.hash } : { top: 0 })
})

createApp(GuideSiteApp).use(router).mount('#app')
