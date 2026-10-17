import { computed, ref, toValue, watch } from 'vue'
import { useApolloClient, useMutation, useQuery } from '@vue/apollo-composable'

import CONTROLLED_COUNTS_QUERY from '@/graphql/controls/controlledCounts.graphql'
import CONTROLLED_ENTITIES_QUERY from '@/graphql/controls/controlledEntities.graphql'
import CONTROLLED_UNITS_QUERY from '@/graphql/controls/controlledUnits.graphql'
import SET_RELEASE_MUTATION from '@/graphql/controls/setRelease.graphql'
import SET_SCOPE_RELEASE_MUTATION from '@/graphql/controls/setScopeRelease.graphql'
import RENOUNCE_CONTROL_MUTATION from '@/graphql/controls/renounceControl.graphql'
import RENOUNCE_SCOPE_MUTATION from '@/graphql/controls/renounceScope.graphql'

// What a team controls, for its admins (breedgraph docs/front-end-changes.md §16). These reads change with every bulk
// action, and their items have no identity of their own in the cache, so they are read from the server each time.

// The labels of controlled entities, in the order the panel lists them
export const CONTROLLED_LABELS = [
  { value: 'PROGRAM', plural: 'Programs', one: 'program' },
  { value: 'TRIAL', plural: 'Trials', one: 'trial', context: 'Program' },
  { value: 'STUDY', plural: 'Studies', one: 'study', context: 'Trial' },
  { value: 'DATASET', plural: 'Datasets', one: 'dataset', context: 'Study' },
  { value: 'LOCATION', plural: 'Locations', one: 'location', context: 'Within' },
  { value: 'LAYOUT', plural: 'Layouts', one: 'layout', context: 'Location' },
  { value: 'UNIT', plural: 'Units', one: 'unit' },
  { value: 'GERMPLASM', plural: 'Germplasm', one: 'germplasm entry' },
  { value: 'REFERENCE', plural: 'References', one: 'reference' },
  { value: 'PERSON', plural: 'People', one: 'person' }
]
export const labelInfo = (value) => CONTROLLED_LABELS.find((l) => l.value === value) ?? { value, plural: value, one: value }
export const countOf = (n, info) => `${n.toLocaleString()} ${n === 1 ? info.one : info.plural.toLowerCase()}`

export const RELEASES = ['PRIVATE', 'REGISTERED', 'PUBLIC']
export const RELEASE_LABELS = { PRIVATE: 'Private', REGISTERED: 'Registered', PUBLIC: 'Public' }

const payloadError = (error, payload) => error?.message || payload?.errors?.map((e) => e.message).join(', ') || ''

/** How many entities of each label the teams control, by release */
export function useControlledCounts(teamIds) {
  const { result, loading, error, refetch } = useQuery(
    CONTROLLED_COUNTS_QUERY,
    () => ({ teamIds: toValue(teamIds) ?? [] }),
    () => ({ enabled: (toValue(teamIds) ?? []).length > 0, fetchPolicy: 'no-cache' })
  )
  const payload = computed(() => result.value?.controlsControlledCounts)
  return {
    counts: computed(() => payload.value?.result ?? []),
    countsLoading: loading,
    countsError: computed(() => payloadError(error.value, payload.value)),
    refetchCounts: refetch
  }
}

/** A page of the entities of a label a team controls, at a release when given */
export function useControlledEntities({ teamId, label, release, offset, limit }) {
  const { result, loading, error, refetch } = useQuery(
    CONTROLLED_ENTITIES_QUERY,
    () => ({
      teamId: toValue(teamId),
      label: toValue(label),
      release: toValue(release) || null,
      offset: toValue(offset),
      limit: toValue(limit)
    }),
    () => ({ enabled: !!toValue(teamId) && !!toValue(label), fetchPolicy: 'no-cache' })
  )
  const payload = computed(() => result.value?.controlsControlledEntities)
  return {
    total: computed(() => payload.value?.result?.total ?? 0),
    items: computed(() => payload.value?.result?.items ?? []),
    entitiesLoading: loading,
    entitiesError: computed(() => payloadError(error.value, payload.value)),
    refetchEntities: refetch
  }
}

// Above this many units at one level, the tree is not opened further on its own: the user opens what they need
const AUTO_OPEN_LIMIT = 20

/**
 * The units a team controls as a tree, from the roots of their unit graphs. Each node: { unit, release (the team's,
 * null where it controls only units below), count (units it controls at and below), otherTeams }. The tree opens down
 * to the team's control roots, the topmost units it controls on each path; a unit can sit under several parents.
 */
export function useControlledUnitTree(teamId) {
  const { resolveClient } = useApolloClient()
  const nodes = ref({}) // unit id -> node
  const childrenOf = ref({}) // parent unit id, or '' for the roots -> child unit ids
  const expanded = ref(new Set())
  const loading = ref(false)
  const error = ref('')

  const read = async (parentIds) => {
    const { data } = await resolveClient().query({
      query: CONTROLLED_UNITS_QUERY,
      variables: { teamId: toValue(teamId), parentIds },
      fetchPolicy: 'no-cache'
    })
    const payload = data?.controlsControlledUnits
    if (payload?.status !== 'SUCCESS') throw new Error(payloadError(null, payload) || 'Could not read the units')
    return payload.result ?? []
  }

  const store = (list, parentIds) => {
    const known = { ...nodes.value }
    const children = { ...childrenOf.value }
    parentIds.forEach((id) => { children[id] = [] })
    for (const node of list) {
      const id = String(node.unit.id)
      known[id] = node
      children[node.parentId == null ? '' : String(node.parentId)].push(id)
    }
    nodes.value = known
    childrenOf.value = children
  }

  // Whether the team controls units below the unit, so it can be opened
  const hasBelow = (id) => {
    const node = nodes.value[id]
    return !!node && node.count > (node.release ? 1 : 0)
  }

  const expand = async (ids) => {
    const toRead = ids.map(String).filter((id) => !childrenOf.value[id])
    if (toRead.length) store(await read(toRead), toRead)
    expanded.value = new Set([...expanded.value, ...ids.map(String)])
  }

  const toggle = async (id) => {
    id = String(id)
    if (expanded.value.has(id)) {
      const next = new Set(expanded.value)
      next.delete(id)
      expanded.value = next
      return
    }
    try {
      error.value = ''
      await expand([id])
    } catch (e) {
      error.value = e.message
    }
  }

  // Units the team doesn't control but holds units below that it does: opened, level by level, to the control roots
  const openToControlRoots = async (ids) => {
    let level = ids
    for (let depth = 0; depth < 10 && level.length > 0 && level.length <= AUTO_OPEN_LIMIT; depth++) {
      await expand(level)
      level = level.flatMap((id) => childrenOf.value[id] ?? []).filter((id) => !nodes.value[id].release && hasBelow(id))
    }
  }

  // Reads the tree again from its roots, keeping open what was open
  const load = async () => {
    const wasOpen = [...expanded.value]
    nodes.value = {}
    childrenOf.value = {}
    expanded.value = new Set()
    if (!toValue(teamId)) return
    loading.value = true
    error.value = ''
    try {
      store(await read(null), [''])
      const roots = childrenOf.value['']
      await openToControlRoots(roots.filter((id) => !nodes.value[id].release && hasBelow(id)))
      // what the user had opened, as far as it still holds units the team controls
      let reopen = wasOpen.filter((id) => nodes.value[id] && hasBelow(id) && !expanded.value.has(id))
      while (reopen.length) {
        await expand(reopen)
        reopen = wasOpen.filter((id) => nodes.value[id] && hasBelow(id) && !expanded.value.has(id))
      }
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  watch(() => toValue(teamId), () => {
    expanded.value = new Set()
    load()
  }, { immediate: true })

  return { nodes, childrenOf, expanded, hasBelow, toggle, reload: load, loading, error }
}

const unwrap = (response, field) => {
  const payload = response?.data?.[field]
  return payload ? { status: payload.status, errors: payload.errors } : { status: 'ERROR', errors: [{ message: 'No response from server' }] }
}

/**
 * Bulk actions on a selection: { entities: [{ label, id }] }, or { scope: { teamId, label, release?, belowUnitIds? } }
 * standing for everything a team controls in it, resolved on the server
 */
export function useBulkControlActions() {
  const { resolveClient } = useApolloClient()
  const { mutate: setListed, loading: setListedLoading } = useMutation(SET_RELEASE_MUTATION)
  const { mutate: setScoped, loading: setScopedLoading } = useMutation(SET_SCOPE_RELEASE_MUTATION)
  const { mutate: renounceListed, loading: renounceListedLoading } = useMutation(RENOUNCE_CONTROL_MUTATION)
  const { mutate: renounceScoped, loading: renounceScopedLoading } = useMutation(RENOUNCE_SCOPE_MUTATION)

  // Controllers cached for badges elsewhere are read again after a change
  const forgetControllers = () => {
    const cache = resolveClient().cache
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'controlsControllers' })
    cache.gc()
  }

  const setRelease = async (selection, release) => {
    const response = selection.scope
      ? await setScoped({ scope: selection.scope, release })
      : await setListed({
        entityLabel: selection.entities[0].label,
        entityIds: selection.entities.map((e) => e.id),
        release
      })
    forgetControllers()
    return unwrap(response, 'controlsSetRelease')
  }

  // End the teams' control where other teams also control the entities
  const renounce = async (selection, teamIds) => {
    const response = selection.scope
      ? await renounceScoped({ scope: selection.scope, teamIds })
      : await renounceListed({ entities: selection.entities, teamIds })
    forgetControllers()
    return unwrap(response, 'controlsRenounceControl')
  }

  const actionLoading = computed(() =>
    setListedLoading.value || setScopedLoading.value || renounceListedLoading.value || renounceScopedLoading.value)

  return { setRelease, renounce, forgetControllers, actionLoading }
}
