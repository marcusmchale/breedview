
<template>
  <div ref="graphContainer" class="ontology-network-graph"></div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'

export default {
  props: {
    entries: {
      type: Array,
      required: true
    }
  },
  setup(props) {
    const graphContainer = ref(null)

    const renderGraph = () => {
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
            description: entry.description 
          }
          nodes.push(node)
          nodeMap.set(entry.id, node)
        }

        // Add parent links
        entry.parents?.forEach(parent => {
          if (!nodeMap.has(parent.id)) {
            const parentNode = { 
              id: parent.id, 
              name: parent.name 
            }
            nodes.push(parentNode)
            nodeMap.set(parent.id, parentNode)
          }
          
          links.push({
            source: parent.id,
            target: entry.id,
            type: 'parent'
          })
        })

        // Add child links
        entry.children?.forEach(child => {
          if (!nodeMap.has(child.id)) {
            const childNode = { 
              id: child.id, 
              name: child.name 
            }
            nodes.push(childNode)
            nodeMap.set(child.id, childNode)
          }
          
          links.push({
            source: entry.id,
            target: child.id,
            type: 'child'
          })
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

      // Color scale
      const color = d3.scaleOrdinal(d3.schemeCategory10)

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

      // Create nodes
      const node = svg.append("g")
        .selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("r", 10)
        .attr("fill", (d, i) => color(i))
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended))

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
