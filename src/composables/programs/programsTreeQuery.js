import { useApolloClient } from '@vue/apollo-composable'

import PROGRAMS_TREE_QUERY from '@/graphql/programs/programsTree.graphql'

/**
 * The whole program > trial > study tree in one request, for selecting studies at once.
 * loadStudyGroups(node) resolves to the trials and studies below a program or a trial, or below every program
 * when node is null, as groups by type: [{ key, label, nodes }].
 */
export function useProgramsTree() {
  const { resolveClient } = useApolloClient()
  const client = resolveClient()

  const loadTree = async () => {
    const { data } = await client.query({ query: PROGRAMS_TREE_QUERY, fetchPolicy: 'cache-first' })
    return (data?.programs?.result ?? []).filter(Boolean)
  }

  const trialsOf = (program) => (program?.trials ?? []).filter(Boolean)
  const studiesOf = (trial) => (trial?.studies ?? []).filter(Boolean)

  const loadStudyGroups = async (node) => {
    const programs = await loadTree()
    let trials, studies
    if (!node) {
      trials = programs.flatMap(trialsOf)
    } else if (node.__typename === 'Program') {
      trials = trialsOf(programs.find((p) => String(p.id) === String(node.id)))
    } else if (node.__typename === 'Trial') {
      trials = [programs.flatMap(trialsOf).find((t) => String(t.id) === String(node.id))].filter(Boolean)
      studies = trials.flatMap(studiesOf)
      return [{ key: 'Study', label: 'Study', nodes: studies }]
    } else {
      return []
    }
    studies = trials.flatMap(studiesOf)
    return [
      { key: 'Trial', label: 'Trial', nodes: trials },
      { key: 'Study', label: 'Study', nodes: studies }
    ]
  }

  return { loadTree, loadStudyGroups }
}
