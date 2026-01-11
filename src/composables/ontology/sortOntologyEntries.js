
// Sort ontology entries by hierarchy using Breadth-First Search
export function sortByHierarchyBFS(entries) {
  // Create a map for quick lookup
  const entryMap = new Map(entries.map(e => [e.id, e]))

  // Find root entries (entries with no parents)
  const roots = entries.filter(entry => !entry.parents || entry.parents.length === 0)

  // If no roots found, return original list
  if (roots.length === 0) {
    return entries
  }

  const sorted = []
  const visited = new Set()
  const queue = []

  // Initialize queue with root entries
  roots.forEach(root => {
    queue.push({ entry: root, depth: 0 })
    visited.add(root.id)
  })

  // BFS traversal
  while (queue.length > 0) {
    const { entry, depth } = queue.shift()

    // Add entry to sorted list with depth information
    sorted.push({
      ...entry,
      _depth: depth
    })

    // Add children to queue
    if (entry.children && entry.children.length > 0) {
      entry.children.forEach(childRef => {
        const child = entryMap.get(childRef.id)
        // Only add if not visited - this handles merged branches
        if (child && !visited.has(child.id)) {
          visited.add(child.id)
          queue.push({ entry: child, depth: depth + 1 })
        }
      })
    }
  }

  // Add any orphaned entries (not reachable from roots)
  entries.forEach(entry => {
    if (!visited.has(entry.id)) {
      sorted.push({ ...entry, _depth: 0 })
    }
  })

  return sorted
}