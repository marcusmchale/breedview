<script setup>
import { ref, watch, onMounted, nextTick, onUnmounted } from 'vue'
import * as d3 from 'd3'

import SearchBox from "@/components/ontology/searchBox.vue"

const props = defineProps({
  entries: {
    type: Array,
    required: true,
    default: () => []
  }
})

const emit = defineEmits([
  'select-entry',
  'expand-sources',
  'expand-sinks',
  'collapse-sources',
  'collapse-sinks',
  'toggle-expanded'
])

const graphContainer = ref(null)
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  entry: null
})

let simulation = null
let svgElement = null
let zoomBehavior = null
// Each entry's node as last drawn, by id: a new drawing starts each node from where it was
const nodeMap = new Map()
// The node last expanded or collapsed, held where it is while the graph settles around what was shown or hidden
let anchorId = null


const closeContextMenu = () => {
  contextMenu.value.show = false
  contextMenu.value.entry = null
}

const fromMenu = (event) => {
  const node = contextMenu.value.entry
  if (node) {
    anchorId = node.id
    emit(event, node)
  }
  closeContextMenu()
}

const expandSources = () => fromMenu('expand-sources')
const expandSinks = () => fromMenu('expand-sinks')
const collapseSources = () => fromMenu('collapse-sources')
const collapseSinks = () => fromMenu('collapse-sinks')

const toggleExpanded = (node) => {
  anchorId = node.id
  emit('toggle-expanded', node)
}


const recenterOnNode = (result) => {
  if (!svgElement || !zoomBehavior || !graphContainer.value) {
    return
  }

  const node = nodeMap.get(result.id)

  if (!node || node.x == null || node.y == null) {
    console.warn('Node position unavailable', result.id)
    return
  }

  const width = graphContainer.value.clientWidth
  const height = graphContainer.value.clientHeight

  const transform = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(2)
    .translate(-node.x, -node.y)

  d3.select(svgElement)
    .transition()
    .duration(750)
    .call(
      zoomBehavior.transform,
      transform
    )
}

const renderGraph = async () => {
  console.debug('Rendering graph')
  await nextTick()
  // A drawing replaces the last: its layout stops, and the view it was zoomed and panned to is kept
  simulation?.stop()
  const view = svgElement ? d3.zoomTransform(svgElement) : null
  // Clear previous graph
  d3.select(graphContainer.value).selectAll("*").remove()

  // Get container dimensions
  const containerWidth = graphContainer.value.clientWidth
  const containerHeight = graphContainer.value.clientHeight

  // Prepare data
  const entrys = []
  const entryMap = new Map()

  // First, create entrys for displayed entries, each where it was last drawn
  props.entries.forEach(entryData => {
    if (!entryMap.has(entryData.id)) {
      const drawn = nodeMap.get(entryData.id)
      const entry = {
        id: entryData.id,
        name: entryData.name,
        description: entryData.description,
        data: entryData,
        ...(drawn && { x: drawn.x, y: drawn.y })
      }
      entrys.push(entry)
      entryMap.set(entryData.id, entry)
    }
  })
  // The first drawing is laid out afresh and centred; a later one settles from where its nodes were
  const redrawn = entrys.some(node => node.x != null)
  // an entry not drawn before (one just created) starts beside one it is linked to
  entrys.filter(node => node.x == null).forEach(node => {
    const linkedIds = [
      ...(node.data.sources ?? []).map(rel => rel.source?.id),
      ...(node.data.sinks ?? []).map(rel => rel.sink?.id)
    ]
    const beside = linkedIds.map(id => entryMap.get(id)).find(other => other?.x != null)
    if (beside) {
      node.x = beside.x + 30
      node.y = beside.y + 30
    }
  })
  entrys.forEach(node => nodeMap.set(node.id, node))

  // Build the relationship map from ALL displayed entries
  const relationshipMap = new Map()

  props.entries.forEach(entryData => {
    // Process sinks (this entry is the source)
    if (entryData.sinks && entryData.sinks.length > 0) {
      entryData.sinks.forEach(sinkRel => {
        if (sinkRel.sink) {
          const key = `${entryData.id}->${sinkRel.sink.id}`
          // Only add if both entrys are displayed
          if (entryMap.has(entryData.id) && entryMap.has(sinkRel.sink.id)) {
            relationshipMap.set(key, {
              sourceId: entryData.id,
              sinkId: sinkRel.sink.id,
              sourceType: sinkRel.sourceType,
              description: sinkRel.description
            })
          }
        }
      })
    }

    // Process sources (this entry is the sink)
    if (entryData.sources && entryData.sources.length > 0) {
      entryData.sources.forEach(sourceRel => {
        if (sourceRel.source) {
          const key = `${sourceRel.source.id}->${entryData.id}`
          // Only add if both entrys are displayed
          if (entryMap.has(sourceRel.source.id) && entryMap.has(entryData.id)) {
            relationshipMap.set(key, {
              sourceId: sourceRel.source.id,
              sinkId: entryData.id,
              sourceType: sourceRel.sourceType,
              description: sourceRel.description
            })
          }
        }
      })
    }
  })

  // Create links from the relationship map
  const links = []
  relationshipMap.forEach((rel) => {
    links.push({
      source: rel.sourceId,
      target: rel.sinkId,
      sourceType: rel.sourceType,
      description: rel.description
    })
  })

  // Create SVG
  const svg = d3.select(graphContainer.value)
    .append("svg")
    .attr("width", containerWidth)
    .attr("height", containerHeight)

  svgElement = svg.node()

  // Add a group to apply zoom transformation
  const g = svg.append("g")

  // Define arrowhead marker
  svg.append("defs").append("marker")
    .attr("id", "arrowhead-germplasm")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 20)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#999")

  // Create force simulation
  simulation = d3.forceSimulation(entrys)
    .force("link", d3.forceLink(links).id(d => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("collision", d3.forceCollide(30))
  if (redrawn) {
    simulation.alpha(0.3)
  } else {
    simulation.force("center", d3.forceCenter(containerWidth / 2, containerHeight / 2))
  }

  // Create links
  const link = g.append("g")
    .selectAll("line")
    .data(links)
    .enter().append("line")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", 2)
    .attr("marker-end", "url(#arrowhead-germplasm)")

  // Add tooltips to links
  link.append("title")
    .text(d => {
      const parts = [`Type: ${d.sourceType || 'Unknown'}`]
      if (d.description) {
        parts.push(`Description: ${d.description}`)
      }
      return parts.join('\n')
    })

  // Create link labels (sourceType)
  const linkLabel = g.append("g")
    .selectAll("text")
    .data(links)
    .enter().append("text")
    .attr("font-size", 8)
    .attr("fill", "#666")
    .attr("text-anchor", "middle")
    .text(d => d.sourceType || '')
    .style("pointer-events", "none")

  // Create entrys
  const entry = g.append("g")
    .selectAll("g")
    .data(entrys)
    .enter().append("g")
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended))

  // Add circle to each entry group
  entry.append("circle")
    .attr("r", 15)
    .attr("fill", "#4CAF50")
    .attr("stroke", d => (d.fx !== undefined && d.fx !== null) ? "#333" : "#fff")
    .attr("stroke-width", 2)
    .on("click", (event, d) => {
      emit('select-entry', d.id)
    })
    .on("contextmenu", (event, d) => {
      event.preventDefault()
      contextMenu.value = {
        show: true,
        x: event.clientX,
        y: event.clientY,
        entry: d
      }
    })
    .on("dblclick", (event, d) => {
      // toggles the entry's sinks, without the zoom a double-click elsewhere on the graph makes
      event.stopPropagation()
      toggleExpanded(d)
    })

  // Add tooltip on hover
  entry.append("title")
    .text(d => `${d.name}${d.description ? '\n' + d.description : ''}`)

  // Separate label for entry name outside the circle
  const label = g.append("g")
    .selectAll("text")
    .data(entrys)
    .enter().append("text")
    .text(d => d.name)
    .attr("font-size", 12)
    .attr("dx", 20)
    .attr("dy", 4)
    .attr("font-weight", "500")
    .style("pointer-events", "none")

  // The node expanded or collapsed is held where it is until the others have settled around it
  const anchor = entryMap.get(anchorId)
  anchorId = null
  if (anchor?.x != null) {
    anchor.fx = anchor.x
    anchor.fy = anchor.y
    simulation.on("end", () => {
      anchor.fx = null
      anchor.fy = null
    })
  }

  // Simulation tick event; drawn at once too, so the nodes are not at the origin until the first tick
  const draw = () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y)

    linkLabel
      .attr("x", d => (d.source.x + d.target.x) / 2)
      .attr("y", d => (d.source.y + d.target.y) / 2)

    entry
      .attr("transform", d => `translate(${d.x},${d.y})`)

    label
      .attr("x", d => d.x)
      .attr("y", d => d.y)
  }
  simulation.on("tick", draw)
  draw()

  // Drag functions
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  function dragged(event, d) {
    d.fx = event.x
    d.fy = event.y
  }

  // the layout cools down once the node is let go, which stays where it was dropped
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0)
  }

  // Add zoom functionality
  const zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      g.attr('transform', event.transform)
    })

  zoomBehavior = zoom

  svg.call(zoom)
  if (view) {
    svg.call(zoom.transform, view)
  } else {
    svg.call(zoom.translateTo, containerWidth / 2, containerHeight / 2)
  }
}

const handleResize = () => {
  renderGraph()
}

// Lifecycle hooks
onMounted(() => {
  window.addEventListener('resize', handleResize)
  renderGraph()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (simulation) {
    simulation.stop()
  }
})

// Watch for changes
watch(() => props.entries, () => {
  renderGraph()
}, { deep: true })

</script>

<template>
  <div class="graph-wrapper">
    <div ref="graphContainer" class="germplasm-network-graph"></div>
    <SearchBox
      :entries="entries"
      @recenter-on-node="recenterOnNode"
    />

    <!-- Context Menu -->
    <div
      v-if="contextMenu.show"
      :style="{
        position: 'fixed',
        left: contextMenu.x + 'px',
        top: contextMenu.y + 'px',
        zIndex: 1000
      }"
      class="context-menu"
      @click.stop
    >
      <div class="menu-item" @click="expandSources">
        Expand Sources
      </div>
      <div class="menu-item" @click="expandSinks">
        Expand Sinks
      </div>
      <div class="menu-item" @click="collapseSources">
        Collapse Sources
      </div>
      <div class="menu-item" @click="collapseSinks">
        Collapse Sinks
      </div>
    </div>

    <!-- Overlay to close context menu -->
    <div
      v-if="contextMenu.show"
      class="context-menu-overlay"
      @click="closeContextMenu"
    ></div>
  </div>
</template>

<style scoped>
.graph-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.germplasm-network-graph {
  width: 100%;
  height: 600px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #fafafa;
}

.context-menu {
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  min-width: 150px;
}

.menu-item {
  padding: 10px 15px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.menu-item:hover {
  background-color: #f0f0f0;
}

.menu-item:active {
  background-color: #e0e0e0;
}

.menu-item-danger {
  color: #d32f2f;
}

.menu-item-danger:hover {
  background-color: #ffebee;
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}


</style>