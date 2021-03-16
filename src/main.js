import Vue from "vue";
import App from "./App.vue";
import VueFormulate from "@braid/vue-formulate";
import { createProvider } from "./vue-apollo";

Vue.config.productionTip = false;
Vue.use(VueFormulate);

new Vue({
  apolloProvider: createProvider(),
  render: h => h(App)
}).$mount("#app");
