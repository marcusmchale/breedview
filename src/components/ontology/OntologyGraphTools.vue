<script setup>
import { ref } from 'vue'

import OntologyNetworkGraph from '@/components/ontology/OntologyNetworkGraph.vue'
import OntologyEntryModal from '@/components/ontology/OntologyEntryModal.vue'
import CreateEntryButtonsPanel from '@/components/ontology/CreateEntryButtonsPanel.vue'
import OntologyCard from '@/components/ontology/OntologyCard.vue'

import { ONTOLOGY_ENTRY_CONFIGS } from '@/composables/ontology/ontologyEntryConfig'

const props = defineProps({
  ontology: {
    type: Object
  },
  ontologyLoading: {
    type: Boolean,
    default: false
  },
  ontologyErrors: {
    type: Array,
    default: () => []
  },
  lifecycleFilters: {
    type: Boolean,
    default: true
  },
  // When false, the CreateEntryButtonsPanel is hidden (e.g. history page)
  showCreateButtons: {
    type: Boolean,
    default: true
  },
  // When false, the EditEntryButtonsPanel is hidden on the OntologyCard (e.g. history page)
  showEditButtons: {
    type: Boolean,
    default: true
  },
  // Forwarded to OntologyEditor's mutation handlers via events
  mutationLoading: {
    type: Boolean,
    default: false
  },
  mutationError: {
    type: String,
    default: null
  }
})

const emit = defineEmits([
  'create-entry',
  'update-entry',
  'deprecate-entry',
  'cancel-deprecate-entry'
])

// ── Selected node card ────────────────────────────────────────────────────────
const selectedEntry = ref(null)

const handleNodeLeftClick = (node) => {
  const entry = props.ontology?.entries.find(e => e.id === node.id)
  if (!entry) return
  // Toggle off if clicking the same node again
  if (selectedEntry.value?.id === entry.id) {
    selectedEntry.value = null
  } else {
    selectedEntry.value = entry
  }
}

// ── Right-click → open edit modal ────────────────────────────────────────────
const handleNodeRightClick = (node) => {
  const entry = props.ontology?.entries.find(e => e.id === node.id)
  if (!entry || !ONTOLOGY_ENTRY_CONFIGS[entry.__typename]) return
  emit('update-entry', entry)
}

const handleEditFromCard = () => {
  if (!selectedEntry.value) return
  emit('update-entry', selectedEntry.value)
}
</script>

<template>
  <div class="ontology-graph-tools">
    <div v-if="ontologyErrors?.length" class="error">Errors: {{ ontologyErrors }}</div>
    <div v-if="ontologyLoading">Loading ontology entries…</div>

    <template v-else-if="ontology">
      <!-- Graph + buttons row -->
      <div class="graph-row">
        <OntologyNetworkGraph
          :ontology="ontology"
          :lifecycle-filters="lifecycleFilters"
          @node-right-click="handleNodeRightClick"
          @node-left-click="handleNodeLeftClick"
        />

        <CreateEntryButtonsPanel
          v-if="showCreateButtons"
          @create-entry="(typename) => emit('create-entry', typename)"
        />
      </div>

      <!-- Entry card shown below the graph when a node is selected -->
      <div v-if="selectedEntry" class="card-container">
        <OntologyCard
          :entry="selectedEntry"
          :showEditButtons="showEditButtons"
          @edit-entry="handleEditFromCard"
        />
      </div>
    </template>

    <!-- Mutation error shown outside modal -->
    <div v-if="mutationError" class="error-message">
      {{ mutationError }}
    </div>
  </div>
</template>

<style scoped>
.ontology-graph-tools {
  width: 100%;
}

.graph-row {
  width: 100%;
  height: 600px;
  display: flex;
  flex-direction: row;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  margin: 2rem 0 0;
}

/* Graph takes all remaining space */
.graph-row > :first-child {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.card-container {
  margin-top: 20px;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.error-message {
  color: #dc2626;
  padding: 0.75rem;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  background: #fef2f2;
  margin-top: 1rem;
}
</style>