<template>
  <div>
    <div ref="graphContainer" class="germplasm-network-graph"></div>

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
      <div class="menu-item" @click="updateEntry">
        Update entry
      </div>
      <div class="menu-item" @click="manageControllers">
        Manage Controllers
      </div>
      <div class="menu-item menu-item-danger" @click="deleteEntry">
        Delete entry
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

<script setup>
import { ref, watch, onMounted, nextTick, onUnmounted } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  entries: {
    type: Array,
    required: true,
    default: () => []
  }
})

const emit = defineEmits([
  'expand-sources',
  'expand-sinks',
  'collapse-sources',
  'collapse-sinks',
  'update-entry',
  'delete-entry',
  'manage-controllers'
])

const graphContainer = ref(null)
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  entry: null
})

let simulation = null

const closeContextMenu = () => {
  contextMenu.value.show = false
  contextMenu.value.entry = null
}

const expandSources = () => {
  if (contextMenu.value.entry) {
    emit('expand-sources', contextMenu.value.entry)
  }
  closeContextMenu()
}

const expandSinks = () => {
  if (contextMenu.value.entry) {
    emit('expand-sinks', contextMenu.value.entry)
  }
  closeContextMenu()
}

const collapseSources = () => {
  if (contextMenu.value.entry) {
    emit('collapse-sources', contextMenu.value.entry)
  }
  closeContextMenu()
}

const collapseSinks = () => {
  if (contextMenu.value.entry) {
    emit('collapse-sinks', contextMenu.value.entry)
  }
  closeContextMenu()
}

const updateEntry = () => {
  if (contextMenu.value.entry) {
    emit('update-entry', contextMenu.value.entry)
  }
  closeContextMenu()
}

const deleteEntry = () => {
  if (contextMenu.value.entry) {
    emit('delete-entry', contextMenu.value.entry)
  }
  closeContextMenu()
}

const manageControllers = () => {
  if (contextMenu.value.entry) {
    emit('manage-controllers', contextMenu.value.entry)
  }
  closeContextMenu()
}

const renderGraph = async () => {
  await nextTick()

  // Clear previous graph
  d3.select(graphContainer.value).selectAll("*").remove()

  // Get container dimensions
  const containerWidth = graphContainer.value.clientWidth
  const containerHeight = graphContainer.value.clientHeight

  // Prepare data
  const entrys = []
  const entryMap = new Map()

  // First, create entrys for displayed entries
  props.entries.forEach(entryData => {
    if (!entryMap.has(entryData.id)) {
      const entry = {
        id: entryData.id,
        name: entryData.name,
        description: entryData.description,
        data: entryData
      }
      entrys.push(entry)
      entryMap.set(entryData.id, entry)
    }
  })

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
    .force("center", d3.forceCenter(containerWidth / 2, containerHeight / 2))
    .force("collision", d3.forceCollide(30))

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
      .on("drag", dragged))

  // Add circle to each entry group
  entry.append("circle")
    .attr("r", 15)
    .attr("fill", "#4CAF50")
    .attr("stroke", d => (d.fx !== undefined && d.fx !== null) ? "#333" : "#fff")
    .attr("stroke-width", 2)
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
      // Double-click to release/lock the entry
      if (d.fx !== null) {
        d.fx = null
        d.fy = null
      } else {
        d.fx = d.x
        d.fy = d.y
      }
      // Update visual indicator
      d3.select(event.currentTarget)
        .attr("stroke", d.fx !== null ? "#333" : "#fff")

      simulation.alpha(0.3).restart()
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

  // Simulation tick event
  simulation.on("tick", () => {
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
  })

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

  // Add zoom functionality
  const zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      g.attr('transform', event.transform)
    })

  svg.call(zoom)
    .call(zoom.translateTo, containerWidth / 2, containerHeight / 2)
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

<style scoped>
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