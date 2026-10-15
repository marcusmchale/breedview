import { computed, toValue } from 'vue'
import { useUserAccess } from '@/composables/user/useUserAccess'
import { useControllerQuery } from '@/composables/controls/useControllerQuery'
import CONTROLLER_RELEASE_QUERY from '@/graphql/controls/controllerRelease.graphql'

/**
 * Whether to offer write actions, following the backend's checks: creating a controlled entity needs a write
 * affiliation to some team, and changing or removing one, or adding to it (a trial to a program, a study to a
 * trial), needs curate access to a team that controls it. The backend refuses the rest, so the actions are hidden.
 *
 * The user's access is read from the cache once loaded, so panels do not each send a request for it. Curate access
 * to an entity is answered by the server (Controller.access) from the user's affiliations, not by comparing team ids
 * here: a controlling team hidden from the user is shown as a visible team standing in for it. It is read with the
 * controller badge's query, so the check adds no request of its own.
 */
export function useCanCreate() {
  const { writeTeamIds } = useUserAccess({ fetchPolicy: 'cache-first' })
  return computed(() => writeTeamIds.value.length > 0)
}

export function useCanCurate({ entityLabel, entityId }) {
  const { controller } = useControllerQuery({
    entityLabel,
    entityId,
    query: CONTROLLER_RELEASE_QUERY,
    enabled: () => toValue(entityId) != null
  })
  return computed(() => controller.value?.access?.includes('CURATE') ?? false)
}
