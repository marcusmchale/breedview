import { computed, ref, toValue, watch } from 'vue'
import { useApolloClient, useQuery } from '@vue/apollo-composable'

import DATASETS_UNITS_QUERY from '@/graphql/datasets/datasetsUnits.graphql'
import DATASETS_UNITS_BY_SUBJECT_QUERY from '@/graphql/datasets/datasetsUnitsBySubject.graphql'

/**
 * The tree of units some datasets have records for, a level at a time, for narrowing the datasets' records to units.
 *
 * Only units with records at or below them appear, so a block with records in one field of ten shows that field
 * alone; each node carries how many recorded units and records lie at or below it. The roots are the blocks that
 * hold records, read whenever the datasets or the time window change; levels below are loaded on demand. The
 * nodes are the units themselves (cached as Unit, so their names label the selection) with the counts added.
 * Everything comes back fresh, as curation changes the records.
 */
export function useDatasetsUnitsTree({ datasetIds, start, end }) {
  const { resolveClient } = useApolloClient()
  const client = resolveClient()

  const narrowing = computed(() => ({
    datasetIds: toValue(datasetIds) ?? [],
    start: toValue(start) || null,
    end: toValue(end) || null
  }))
  const enabled = computed(() => narrowing.value.datasetIds.length > 0)

  const toNode = ({ unit, unitCount, recordCount, hasChildren }) => ({ ...unit, unitCount, recordCount, hasChildren })

  const { result: rootsResult, loading: rootsLoading, error: rootsError } = useQuery(
    DATASETS_UNITS_QUERY,
    () => ({ ...narrowing.value, parentIds: null }),
    () => ({ enabled: enabled.value, fetchPolicy: 'network-only' })
  )
  const rootNodes = computed(() =>
    enabled.value ? (rootsResult.value?.datasetsUnits?.result ?? []).map(toNode) : []
  )

  // The level under the node last opened
  const children = ref([])
  const childrenLoading = ref(false)
  const loadChildren = async (nodeId) => {
    if (!enabled.value) {
      children.value = []
      return
    }
    childrenLoading.value = true
    try {
      const { data } = await client.query({
        query: DATASETS_UNITS_QUERY,
        variables: { ...narrowing.value, parentIds: [nodeId] },
        fetchPolicy: 'network-only'
      })
      children.value = (data?.datasetsUnits?.result ?? []).map(toNode)
    } finally {
      childrenLoading.value = false
    }
  }
  // A level loaded for an earlier narrowing says nothing about the current one
  watch(narrowing, () => { children.value = [] })

  const hasChildren = (node) => node?.hasChildren === true

  // Every recorded unit below a node, or in the whole selection, by subject: [{ key, label, nodes }]
  const loadTypeGroups = async (scopeNode) => {
    if (!enabled.value) return []
    const { data } = await client.query({
      query: DATASETS_UNITS_BY_SUBJECT_QUERY,
      variables: { ...narrowing.value, unitIds: scopeNode ? [scopeNode.id] : null },
      fetchPolicy: 'network-only'
    })
    return (data?.datasetsUnitsBySubject?.result ?? []).map((group) => ({
      key: group.subject?.id ?? 'none',
      label: group.subject?.name ?? 'No subject',
      nodes: group.units ?? []
    }))
  }

  // A node's name with what lies at or below it, for the option list and breadcrumbs
  const nodeLabel = (node) => {
    const name = node.name || (node.subject ? `${node.subject.name} ${node.id}` : `Unit ${node.id}`)
    if (node.unitCount == null) return name
    const amount = node.unitCount > 1
      ? `${node.unitCount.toLocaleString()} units`
      : `${(node.recordCount ?? 0).toLocaleString()} record${node.recordCount === 1 ? '' : 's'}`
    return `${name} · ${amount}`
  }

  return {
    rootNodes,
    rootsLoading,
    rootsError,
    children,
    childrenLoading,
    loadChildren,
    hasChildren,
    loadTypeGroups,
    nodeLabel
  }
}
