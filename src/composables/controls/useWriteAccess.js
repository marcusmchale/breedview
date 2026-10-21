import { computed, toValue } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import { useUserAccess } from '@/composables/user/useUserAccess'
import { useAuthStore } from '@/composables/user/useAuthStore'
import { useControllerQuery } from '@/composables/controls/useControllerQuery'
import CONTROLLER_RELEASE_QUERY from '@/graphql/controls/controllerRelease.graphql'
import CONTROLLER_ACCESS_QUERY from '@/graphql/controls/controllerAccess.graphql'

/**
 * Whether to offer write actions, following the backend's checks: creating a controlled entity needs a write
 * affiliation to some team, and changing or removing one, or adding to it (a trial to a program, a study to a
 * trial), needs curate access to a team that controls it. The backend refuses the rest, so the actions are hidden.
 *
 * The user's access is read from the cache once loaded, so panels do not each send a request for it. Curate access
 * to an entity is answered by the server (Controller.access) from the user's affiliations, not by comparing team ids
 * here: a controlling team hidden from the user is shown as a visible team standing in for it. It is read with the
 * controller badge's query, so the check adds no request of its own. Anonymous users can write nothing, so
 * neither check sends a request for them.
 */
export function useCanCreate() {
  const { isAuthenticated } = useAuthStore()
  const { writeTeamIds } = useUserAccess({ fetchPolicy: 'cache-first' })
  return computed(() => isAuthenticated.value && writeTeamIds.value.length > 0)
}

// What the user's affiliations let them do with an entity (Controller.access), empty for anonymous users
export function useEntityAccess({ entityLabel, entityId }) {
  const { isAuthenticated } = useAuthStore()
  const { controller } = useControllerQuery({
    entityLabel,
    entityId,
    query: CONTROLLER_RELEASE_QUERY,
    enabled: () => isAuthenticated.value && toValue(entityId) != null
  })
  return computed(() => (isAuthenticated.value ? controller.value?.access ?? [] : []))
}

export function useCanCurate({ entityLabel, entityId }) {
  const access = useEntityAccess({ entityLabel, entityId })
  return computed(() => access.value.includes('CURATE'))
}

// Whether the user curates every one of these entities, e.g. the units of an arrival moved together, which the backend
// refuses unless they do: one request for them all. False for anonymous users and while it is read.
export function useCanCurateAll({ entityLabel, entityIds }) {
  const { isAuthenticated } = useAuthStore()
  const ids = computed(() => toValue(entityIds) ?? [])
  const { result } = useQuery(
    CONTROLLER_ACCESS_QUERY,
    () => ({ entityLabel: toValue(entityLabel), entityIds: ids.value }),
    { enabled: computed(() => isAuthenticated.value && ids.value.length > 0) }
  )
  return computed(() => {
    const controllers = result.value?.controlsControllers?.result ?? []
    return isAuthenticated.value && ids.value.length > 0 && controllers.length === ids.value.length
      && controllers.every((controller) => controller?.access?.includes('CURATE'))
  })
}
