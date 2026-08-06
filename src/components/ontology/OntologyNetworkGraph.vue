<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'
import SearchBox from "@/components/ontology/searchBox.vue";
import OntologyFiltersPanel from "@/components/ontology/OntologyFiltersPanel.vue";
import { getNodeColor, getNodeCode, getEnumLabel } from '@/composables/ontology/nodeColorMap'

const props = defineProps({
  ontology: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: Object,
    default: null
  },
  lifecycleFilters: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['node-right-click'])

const graphContainer = ref(null)

const selectedPhases = ref(['DRAFT', 'ACTIVE'])
const selectedLabels = ref([])

const resizeObserver = ref(null)
const svgElement = ref(null)
const gElement = ref(null)
const zoomBehavior = ref(null)
const hasInitialFit = ref(false)
const panelIsCollapsed = ref(false)
const nodeMap = new Map()

let simulation = null

let nodeSelection = null
let linkSelection = null
let labelSelection = null
let linkLabelSelection = null

let allNodes = []
let allLinks = []

const updatePhases = (phases) => {
  selectedPhases.value = phases
}
const updateLabels = (labels) => {
  selectedLabels.value = labels
}


//center and size
const recenterOnNode = (result) => {
  if (!svgElement.value || !zoomBehavior.value || !graphContainer.value) {
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

  d3.select(svgElement.value)
    .transition()
    .duration(750)
    .call(
      zoomBehavior.value.transform,
      transform
    )
}


const resizeGraph = () => {
  if (!svgElement.value || !graphContainer.value) return

  const width = graphContainer.value.clientWidth
  const height = graphContainer.value.clientHeight

  d3.select(svgElement.value)
    .attr("width", width)
    .attr("height", height)

  simulation
    ?.force("x", d3.forceX(width / 2).strength(0.03))
    ?.force("y", d3.forceY(height / 2).strength(0.03))

  simulation?.alpha(0.2).restart()
}


/*
|--------------------------------------------------------------------------
| Data helpers
|--------------------------------------------------------------------------
*/

const buildData = () => {
  props.ontology.entries.forEach(entry => {
    //if (!nodeMap.has(entry.id)) {
      nodeMap.set(entry.id, {
        id: entry.id,
        name: entry.name,
        description: entry.description,
        label: getEnumLabel(entry.__typename),
        phase: entry.phase
      })
    //}
  })
  allNodes = Array.from(nodeMap.values())
  allLinks = props.ontology.relationships.map(rel => ({
    id: rel.id,
    source: rel.sourceId,
    target: rel.targetId,
    label: rel.label,
    type: rel.label,
    phase: rel.phase
  }))
}


const getFilteredData = () => {

  const filteredNodes =
    selectedLabels.value.length === 0
      ? props.lifecycleFilters
        ? allNodes.filter(node =>
            selectedPhases.value.includes(node.phase)
          )
        : allNodes
      : props.lifecycleFilters
        ? allNodes.filter(node =>
            selectedLabels.value.includes(node.label) &&
            selectedPhases.value.includes(node.phase)
          )
        : allNodes.filter(node =>
            selectedLabels.value.includes(node.label)
          )


  const ids = new Set(filteredNodes.map(node => node.id))


  const filteredLinks = allLinks.filter(link =>
    ids.has(link.source) &&
    ids.has(link.target) &&
      (props.lifecycleFilters ? selectedPhases.value.includes(link.phase) : true)
  ).map(link => ({
    id: link.id,
    source: link.source,
    target: link.target,
    label: link.label,
    type: link.type,
    phase: link.phase
  }))


  return {
    filteredNodes,
    filteredLinks
  }
}


/*
|--------------------------------------------------------------------------
| Simulation helpers
|--------------------------------------------------------------------------
*/

const wakeSimulation = (strength = 0.15) => {

  if (!simulation) return

  simulation
    .alpha(strength)
    .restart()

}

//cluster by label
const clusterForce = (
  defaultStrength = 0.08,
  labelStrengths = {}
) => {
  return alpha => {
    if (!graphContainer.value) {
      return
    }

    const clusters = new Map()

    const width = graphContainer.value.clientWidth
    const height = graphContainer.value.clientHeight

    const labels = [...new Set(simulation.nodes().map(d => d.label))]
    labels.forEach((label, i) => {
      const angle = (i / labels.length) * Math.PI * 2

      clusters.set(label, {
        x: width / 2 + Math.cos(angle) * 180,
        y: height / 2 + Math.sin(angle) * 180
      })
    })

    simulation.nodes().forEach(node => {
      const cluster = clusters.get(node.label)
      if (!cluster) return

      const strength =
        labelStrengths[node.label] ?? defaultStrength

      node.vx += (cluster.x - node.x) * strength * alpha
      node.vy += (cluster.y - node.y) * strength * alpha
    })
  }
}

const updatePinnedStyles = () => {

  if (!nodeSelection) return

  nodeSelection
    .select('circle')
    .attr(
      'stroke',
      d => d.fx != null ? '#333' : 'none'
    )
    .attr(
      'stroke-width',
      d => d.fx != null ? 2 : 0
    )

}

const createNode = (selection) => {

  const nodeGroup = selection
  .attr("class", "node")
  .call(
    d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended)
  )
  .on("contextmenu", (event, d) => {
    event.preventDefault()
    emit("node-right-click", d)
  })

  nodeGroup.append("circle")
    .attr("r", 10)
    .attr("fill", d => getNodeColor(d.label))
    .on("dblclick", (event, d) => {
      if (d.fx != null) {
        d.fx = null
        d.fy = null
      } else {
        d.fx = d.x
        d.fy = d.y
      }

      updatePinnedStyles()
      wakeSimulation()
    })


  nodeGroup.append("text")
    .text(d => getNodeCode(d.label))
    .attr("text-anchor", "middle")
    .attr("dy", ".3em")
    .attr("font-size", 8)
    .attr("fill", "white")
    .attr("pointer-events", "none")

  nodeGroup.style("cursor", "grab")
}

const createNodeLabels = (selection) => {
  return selection
    .text(d =>
      d.name.length > 30
        ? d.name.slice(0, 30) + "…"
        : d.name
    )
    .attr("font-size", 10)
    .attr("text-anchor", "middle")
    .attr("pointer-events", "none")
    .style("user-select", "none")
}


const createLinks = (selection) => {
  return selection
    .attr("stroke", d =>
      d.type === "PARENT_OF" ? "#999" : "#ccc"
    )
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", 2)
    .attr("marker-end", "url(#arrowhead)")
}


const createLinkLabels = (selection) => {
  return selection
    .attr("font-size", 8)
    .attr("fill", "#666")
    .attr("text-anchor", "middle")
    .attr("pointer-events", "none")
    .style("user-select", "none")
    .style("paint-order", "stroke")
    .style("stroke", "white")
    .style("stroke-width", 3)
    .style("stroke-linejoin", "round")
    .text(d =>
      d.label.length > 20
        ? d.label.slice(0, 20) + "…"
        : d.label
    )
}

/*
|--------------------------------------------------------------------------
| Initial graph creation
|--------------------------------------------------------------------------
*/

const renderGraph = async () => {

  await nextTick()

  if (simulation) {
    simulation.stop()
    simulation = null
  }

  d3.select(graphContainer.value)
    .selectAll("*")
    .remove()

  buildData()

  const width = graphContainer.value.clientWidth
  const height = graphContainer.value.clientHeight


  const svg = d3.select(graphContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)


  svgElement.value = svg.node()

  svg.append("defs")
    .append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 18)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#999")

  const g = svg.append('g')

  gElement.value = g.node()


  const {
    filteredNodes,
    filteredLinks
  } = getFilteredData()

  const labelGroups = new Map()

  // load by label to help clustering
  filteredNodes.forEach(node => {
    if (!labelGroups.has(node.label)) {
      labelGroups.set(node.label, [])
    }

    labelGroups.get(node.label).push(node)
  })


  const labels = [...labelGroups.keys()]

  labels.forEach((label, index) => {

    const angle = (index / labels.length) * Math.PI * 2

    const centerX = width / 2 + Math.cos(angle) * 200
    const centerY = height / 2 + Math.sin(angle) * 200

    labelGroups.get(label).forEach((node, i) => {

      const offset = i * 15

      node.x = centerX + offset
      node.y = centerY + offset

    })

  })


  const linkForce = d3.forceLink(filteredLinks)
    .id(d => d.id)
    .distance(d => {
      if (d.type === 'PARENT_OF') {
        return 80
      } else {
        return 150
      }
    })
    .strength(d =>
      d.type === 'PARENT_OF' ? 0.8 : 0.2
    )


  simulation = d3.forceSimulation(filteredNodes)
    .force('link', linkForce)
    .force(
      'charge',
      d3.forceManyBody().strength(-120)
    )
    .force(
      'collision',
      d3.forceCollide(18)
    )
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.01))
    .force('cluster', clusterForce(0.05, {"TERM":-0.01}))
    .alphaDecay(0.3)
    .velocityDecay(0.3)
  /*
  |--------------------------------------------------------------------------
  | Links
  |--------------------------------------------------------------------------
  */

  linkSelection = g.append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(filteredLinks, d => d.id)
    .join(
      enter => {
        const links = enter.append("line")
        createLinks(links)
        return links
      }
    )

  linkLabelSelection = g.append("g")
    .attr("class", "link-labels")
    .selectAll("text")
    .data(filteredLinks, d => d.id)
    .join(
      enter => createLinkLabels(enter.append("text"))
    )



  /*
  |--------------------------------------------------------------------------
  | Nodes
  |--------------------------------------------------------------------------
  */

  nodeSelection = g.append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(filteredNodes, d => d.id)
    .join(
      enter => {
        const nodes = enter.append("g")
        createNode(nodes)
        return nodes
      }
    )

  labelSelection = g.append("g")
    .attr("class", "labels")
    .selectAll("text")
    .data(filteredNodes, d => d.id)
    .join(
      enter => createNodeLabels(enter.append("text"))
    )


  /*
  |--------------------------------------------------------------------------
  | Simulation tick
  |--------------------------------------------------------------------------
  */

  simulation.on("tick", () => {

  linkSelection
    .attr("x1", d => d.source.x ?? 0)
    .attr("y1", d => d.source.y ?? 0)
    .attr("x2", d => d.target.x ?? 0)
    .attr("y2", d => d.target.y ?? 0)


    linkLabelSelection
      .attr(
        "x",
        d => (d.source.x + d.target.x) / 2
      )
      .attr(
        "y",
        d => (d.source.y + d.target.y) / 2
      )


    nodeSelection
      .attr(
        "transform",
        d => `translate(${d.x},${d.y})`
      )


    labelSelection
      .attr("x", d => d.x)
      .attr("y", d => d.y - 18)

  })

  simulation.on("end", () => {
    if (hasInitialFit.value) {
      return
    }
    hasInitialFit.value = true

    const bounds = g.node().getBBox()

    const scale = 0.9 / Math.max(
      bounds.width / width,
      bounds.height / height
    )

    const transform = d3.zoomIdentity
      .translate(
        width / 2 - scale * (bounds.x + bounds.width / 2),
        height / 2 - scale * (bounds.y + bounds.height / 2)
      )
      .scale(scale)

    svg.transition()
      .duration(750)
      .call(
        zoomBehavior.value.transform,
        transform
      )


  })


  /*
  |--------------------------------------------------------------------------
  | Zoom
  |--------------------------------------------------------------------------
  */

  const zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on("zoom", event => {
      g.attr("transform", event.transform)
    })


  zoomBehavior.value = zoom

  svg.call(zoom)

}



/*
|--------------------------------------------------------------------------
| Updating filters without rebuilding the graph
|--------------------------------------------------------------------------
*/

const updateGraph = () => {
  hasInitialFit.value = false
  if (!simulation) return


  const {
    filteredNodes,
    filteredLinks
  } = getFilteredData()


  /*
    Update simulation data
  */

  simulation.nodes(filteredNodes)

  const linkForce = simulation.force("link")

  linkForce.links(filteredLinks)

  simulation.alpha(0.3).restart()


  /*
    Update DOM
  */
  nodeSelection = nodeSelection
    .data(filteredNodes, d => d.id)
    .join(
      enter => {
        const nodes = enter.append("g")
        createNode(nodes)
        return nodes
      },
      update => update,
      exit => exit.remove()
    )


  linkSelection = linkSelection
    .data(filteredLinks, d => d.id)
    .join(
      enter => createLinks(enter.append("line")),
      update => createLinks(update),
      exit => exit.remove()
    )

  labelSelection = labelSelection
    .data(filteredNodes, d => d.id)
    .join(
      enter => createNodeLabels(enter.append("text")),
      update => createNodeLabels(update),
      exit => exit.remove()
    )

  linkLabelSelection = linkLabelSelection
    .data(filteredLinks, d => d.id)
    .join(
      enter => createLinkLabels(enter.append("text")),
      update => createLinkLabels(update),
      exit => exit.remove()
    )

  wakeSimulation(0.1)

}



/*
|--------------------------------------------------------------------------
| Drag
|--------------------------------------------------------------------------
*/

function dragstarted(event, d) {
  if (!event.active) {
    simulation.alphaTarget(0.3).restart()
  }

  const target = event.sourceEvent?.target

  if (target instanceof Element) {
    d3.select(event.sourceEvent.target.closest("g"))
        .style("cursor", "grabbing")
  }

  d.fx = d.x
  d.fy = d.y

  updatePinnedStyles()

}


function dragged(event, d) {
  const target = event.sourceEvent?.target
  if (target instanceof Element) {
    d3.select(event.sourceEvent.target.closest("g"))
    .style("cursor", "grab")
  }

  d.fx = event.x
  d.fy = event.y

}

function dragended(event, d) {

  if (!event.active) {
    simulation.alphaTarget(0)
  }

}


/*
|--------------------------------------------------------------------------
| Lifecycle
|--------------------------------------------------------------------------
*/

onMounted(() => {

  renderGraph()

  resizeObserver.value = new ResizeObserver(() => {
    resizeGraph()
  })

  resizeObserver.value.observe(graphContainer.value)

})

onUnmounted(() => {
  resizeObserver.value?.disconnect()
  if (simulation) {
    simulation.stop()
    simulation = null
  }
})


watch(selectedLabels, updateGraph, { deep: true })
watch(selectedPhases, updateGraph,{ deep: true })


watch(
  () => props.ontology,
  () => {
    console.log('ontology updated')
    renderGraph()
  },
  { deep: true }
)


const formatVersion = (version) => {
  if (!version) return 'N/A'
  return `${version.major}.${version.minor}.${version.patch}`
}

</script>



<template>
  <div class="graph-wrapper">
    <OntologyFiltersPanel
      :selected-labels="selectedLabels"
      :selected-phases="selectedPhases"
      :lifecycle-filters="lifecycleFilters"
      :is-collapsed="panelIsCollapsed"
      @update-labels="updateLabels"
      @update-phases="updatePhases"
    />
    <div class="graph-content">
      <div ref="graphContainer" class="ontology-network-graph"></div>
      <SearchBox
        :ontology="ontology"
        @recenter-on-node="recenterOnNode"
      />
    </div>
    <h3 class="version-label" >V{{ formatVersion(ontology.version) }}</h3>
  </div>
</template>


<style scoped>
.version-label {
  position: absolute;
  top: 0;
  right: 1%;
  z-index: 999;
}

.graph-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
}

.graph-content {
  position: relative;
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ontology-network-graph {
  width: 100%;
  height: 100%;
  border: none;
  touch-action: none;
  flex: 1;
  background: #fafafa;
}

.ontology-network-graph svg text {
  user-select: none;
  -webkit-user-select: none;
}

.ontology-network-graph svg {
  cursor: grab;
}

.ontology-network-graph svg:active {
  cursor: grabbing;
}
</style>