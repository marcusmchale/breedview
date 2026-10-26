import { ref, toValue, watch } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'

import LAYOUTS_QUERY from '@/graphql/layouts/layouts.graphql'

/**
 * A layout and every layout below it, read level by level: { layouts, layoutsLoading, layoutsError }, the layouts in
 * the order read, each with its tree's location, which the API gives only on the tree's root. Read again when the
 * layout chosen changes; empty without one.
 */
export function useLayoutSubtree(layoutId) {
  const { resolveClient } = useApolloClient()
  const client = resolveClient()

  const layouts = ref([])
  const layoutsLoading = ref(false)
  const layoutsError = ref(null)
  let reading = 0

  const readLayouts = async (ids) => {
    const { data } = await client.query({ query: LAYOUTS_QUERY, variables: { layoutIds: ids } })
    const payload = data?.layoutsLayouts
    if (payload?.status !== 'SUCCESS') throw new Error(payload?.errors?.map((e) => e.message).join(', ') || 'The layouts could not be read.')
    return payload.result
  }

  const read = async (rootId) => {
    const run = ++reading
    layouts.value = []
    layoutsError.value = null
    if (!rootId) return
    layoutsLoading.value = true
    const found = []
    const seen = new Set()
    try {
      for (let ids = [String(rootId)]; ids.length;) {
        ids.forEach((id) => seen.add(id))
        const level = await readLayouts(ids)
        found.push(...level)
        ids = level.flatMap((layout) => (layout.children ?? []).map((child) => String(child.id))).filter((id) => !seen.has(id))
      }
      // the tree's location, from its root, read too when the layout chosen is below it
      const chosen = found[0]
      const location = chosen?.location ?? (chosen?.root ? (await readLayouts([String(chosen.root.id)]))[0]?.location : null)
      if (run === reading) layouts.value = found.map((layout) => ({ ...layout, location: layout.location ?? location ?? null }))
    } catch (error) {
      if (run === reading) layoutsError.value = error.message
    } finally {
      if (run === reading) layoutsLoading.value = false
    }
  }

  watch(() => toValue(layoutId), read, { immediate: true })

  return { layouts, layoutsLoading, layoutsError }
}
