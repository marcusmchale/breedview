import { ref } from 'vue'

// Whether this browser's user has accepted the current Terms of Use: null until the API is asked. Kept apart from
// useTermsOfUse, which reads the Terms through the Apollo client, so that the client's error link can set it when the
// API refuses a request for want of an acceptance (breedgraph docs/licences.md §4).
export const termsAccepted = ref(null)
