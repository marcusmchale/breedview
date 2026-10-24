import { computed } from 'vue'
import { useAuthStore } from '@/composables/user/useAuthStore'

// The names of the dataset actions, the same on the programs page, on each study card and on the modals they open, and
// in the order they come in: data is submitted, then viewed and curated, then analysed. A visitor can only view the
// records, so is not offered curation.
export const SUBMIT_DATA = 'Submit data'

export function useViewDatasetsLabel () {
  const { isAuthenticated } = useAuthStore()
  return computed(() => (isAuthenticated.value ? 'View & curate datasets' : 'View datasets'))
}
