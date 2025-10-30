
<template>
  <div ref="graphContainer" class="ontology-network-graph"></div>
</template>

<script>
import { ref, onMounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import { getNodeColor, getNodeCode, getEnumLabel } from '@/composables/nodeColorMap'

export default {
  props: {
    entries: {
      type: Array,
      required: true
    },
    relationships: {
      type: Array,
      required: true,
      default: () => []
    },
    relationshipsLoading: {
      type: Boolean,
      default: false
    },
    relationshipsError: {
      type: Object,
      default: null
    },
    selectedLabels: {
      type: Array,
      default: () => []
    }
  },
  emits: ['node-right-click'],
  setup(props, { emit }) {

    const graphContainer = ref(null)

    const renderGraph = async () => {

      // Wait for relationships to load and DOM to update
      await nextTick()

      // Clear previous graph
      d3.select(graphContainer.value).selectAll("*").remove()

      // Get container dimensions
      const containerWidth = graphContainer.value.clientWidth
      const containerHeight = graphContainer.value.clientHeight

      // Prepare data
      const nodes = []
      const links = []
      const nodeMap = new Map()

      // Create nodes
      props.entries.forEach(entry => {
        if (!nodeMap.has(entry.id)) {
          const node = { 
            id: entry.id, 
            name: entry.name, 
            description: entry.description,
            label: getEnumLabel(entry.__typename)
          }
          nodes.push(node)
          nodeMap.set(entry.id, node)
        }
      })

            // Filter nodes based on selected labels
      const filteredNodes = props.selectedLabels.length === 0
        ? nodes
        : nodes.filter(node => props.selectedLabels.includes(node.label))


      // Create links from relationships
      const filteredNodeIds = new Set(filteredNodes.map(n => n.id))
      props.relationships.forEach(rel => {
        if (filteredNodeIds.has(rel.source_id) && filteredNodeIds.has(rel.target_id)) {
          links.push({
            source: rel.source_id,
            target: rel.target_id,
            label: rel.label,
            type: rel.label
          })
        }
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
        .attr("id", "arrowhead")
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
      const simulation = d3.forceSimulation(filteredNodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-50))
        .force("center", d3.forceCenter(containerWidth / 2, containerHeight / 2))
        .force("collision", d3.forceCollide(20))  // Prevent node overlap


      // Create links
      const link = g.append("g")
        .selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("stroke", d => d.type === 'parent' ? "#999" : "#ccc")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowhead)")

      // Create link labels
      const linkLabel = g.append("g")
        .selectAll("text")
        .data(links)
        .enter().append("text")
        .attr("font-size", 8)
        .attr("fill", "#666")
        .attr("text-anchor", "middle")
        .text(d => d.label)

      // Create nodes
      const node = g.append("g")
        .selectAll("g")  // Change to group to contain both circle and text
        .data(filteredNodes)
        .enter().append("g")
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged))

      // Add circle to each node group
      node.append("circle")
        .attr("r", 10)
        .attr("fill", (d) => getNodeColor(d.label))
        .attr("stroke", d => (d.fx !== undefined && d.fx !== null) ? "#333" : "none")
        .attr("stroke-width", d => (d.fx !== undefined && d.fx !== null) ? 2 : 0)
        .on("contextmenu", (event, d) => {
          event.preventDefault()
          emit('node-right-click', d)
        })
        .on("dblclick", (event, d) => {
          // Double-click to release/lock the node
          if (d.fx !== null) {
            d.fx = null
            d.fy = null
          } else {
            d.fx = d.x
            d.fy = d.y
          }
          // Update visual indicator
          d3.select(event.currentTarget.parentNode).select("circle")
            .attr("stroke", d.fx !== null ? "#333" : "none")
            .attr("stroke-width", d.fx !== null ? 2 : 0)

          simulation.alpha(0.3).restart()
        })

      // Add text inside the circle
      node.append("text")
        .text(d => getNodeCode(d.label))
        .attr("text-anchor", "middle")
        .attr("dy", ".3em")  // Vertically center text
        .attr("font-size", 8)
        .attr("fill", "#ffffff")  // White text for contrast
        .attr("pointer-events", "none")  // Allow interaction with underlying circle

      // Separate label for node name outside the circle
      const label = g.append("g")
        .selectAll("text")
        .data(filteredNodes)
        .enter().append("text")
        .text(d => d.name)
        .attr("font-size", 10)
        .attr("dx", 12)
        .attr("dy", 4)

      // Simulation tick event (update both node groups and labels)
      simulation.on("tick", () => {
        link
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y)

        linkLabel
          .attr("x", d => (d.source.x + d.target.x) / 2)
          .attr("y", d => (d.source.y + d.target.y) / 2)

        node
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

      //function dragended(event, d) {
      //  if (!event.active) simulation.alphaTarget(0)
      //    d.fx = null
      //    d.fy = null
      //}

      // Add zoom functionality
      const zoom = d3.zoom()
        .scaleExtent([0.1, 10])
        .on('zoom', (event) => {
          g.attr('transform', event.transform)
        })

      svg.call(zoom)
        .call(zoom.translateTo, containerWidth / 2, containerHeight / 2)  // Center the graph initially
    }

    // Render on mount and when entries change
        // Render on mount and when entries change
    onMounted(() => {
      window.addEventListener('resize', renderGraph)
      renderGraph()
    })
    watch(() => props.entries, renderGraph)
    watch(() => props.relationships, renderGraph)
    watch(() => props.relationshipsLoading, renderGraph)
    watch(() => props.selectedLabels, renderGraph, { deep: true })

    return { graphContainer }
  }
}
</script>

<style scoped>
.ontology-network-graph {
  width: 100%;
  max-width: 800px;
  height: 600px;
  border: 1px solid #ddd;
}
</style>
