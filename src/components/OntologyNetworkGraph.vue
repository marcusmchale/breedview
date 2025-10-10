
<template>
  <div ref="graphContainer" class="ontology-network-graph"></div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import { getNodeColor } from '@/composables/nodeColorMap'

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
    }
  },
  emits: ['node-right-click'],
  setup(props, { emit }) {
    console.log('OntologyNetworkGraph props:', props)
    const graphContainer = ref(null)

    const renderGraph = () => {
      // Wait for relationships to load
      if (props.relationshipsLoading || !props.relationships) {
        return
      }

      // Clear previous graph
      d3.select(graphContainer.value).selectAll("*").remove()

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
            __typename: entry.__typename
          }
          nodes.push(node)
          nodeMap.set(entry.id, node)
        }
      })

      // Create links from relationships
      props.relationships.forEach(rel => {
        // Ensure both source and target nodes exist
        if (!nodeMap.has(rel.source_id)) {
          const sourceNode = { id: rel.source_id, name: `Entry ${rel.source_id}` }
          nodes.push(sourceNode)
          nodeMap.set(rel.source_id, sourceNode)
        }
        if (!nodeMap.has(rel.target_id)) {
          const targetNode = { id: rel.target_id, name: `Entry ${rel.target_id}` }
          nodes.push(targetNode)
          nodeMap.set(rel.target_id, targetNode)
        }

        links.push({
          source: rel.source_id,
          target: rel.target_id,
          label: rel.label,
          type: rel.label
        })
      })

      // Visualization dimensions
      const width = 800
      const height = 600

      // Create SVG
      const svg = d3.select(graphContainer.value)
        .append("svg")
        .attr("width", width)
        .attr("height", height)

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
      const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2))

      // Create links
      const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("stroke", d => d.type === 'parent' ? "#999" : "#ccc")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowhead)")

      // Create link labels
      const linkLabel = svg.append("g")
        .selectAll("text")
        .data(links)
        .enter().append("text")
        .attr("font-size", 8)
        .attr("fill", "#666")
        .attr("text-anchor", "middle")
        .text(d => d.label)

      // Create nodes
      const node = svg.append("g")
        .selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("r", 10)
        .attr("fill", (d) => getNodeColor(d.__typename))
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended))
        .on("contextmenu", (event, d) => {
          event.preventDefault()
          emit('node-right-click', d)
        })

      // Add labels
      const label = svg.append("g")
        .selectAll("text")
        .data(nodes)
        .enter().append("text")
        .text(d => d.name)
        .attr("font-size", 10)
        .attr("dx", 12)
        .attr("dy", 4)

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

        node
          .attr("cx", d => d.x)
          .attr("cy", d => d.y)

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

      function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      }

      // Add zoom functionality
      const zoom = d3.zoom()
        .scaleExtent([0.1, 10])
        .on('zoom', (event) => {
          svg.attr('transform', event.transform)
        })

      svg.call(zoom)
    }

    // Render on mount and when entries change
    onMounted(renderGraph)
    watch(() => props.entries, renderGraph)
    watch(() => props.relationships, renderGraph)
    watch(() => props.relationshipsLoading, renderGraph)

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
