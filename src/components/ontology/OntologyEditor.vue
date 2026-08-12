<script setup>
import { computed, ref } from 'vue'

import OntologyNetworkGraph from '@/components/ontology/OntologyNetworkGraph.vue'
import OntologyEntryModal from '@/components/ontology/OntologyEntryModal.vue'
import { useOntologyQuery } from '@/composables/ontology/ontologyQuery'
import { useOntologySchema } from '@/composables/ontology/useOntologySchema'
import { useMutateOntology } from '@/composables/ontology/mutateOntology'
import { ONTOLOGY_ENTRY_CONFIGS } from '@/composables/ontology/ontologyEntryConfig'

const props = defineProps({
  versionId: {
    type: String,
    default: null
  },
  editor: {
    type: Boolean,
    default: false
  },
  creator: {
    type: Boolean,
    default: false
  }
})

const {
  ontology,
  ontologyLoading,
  ontologyErrors,
  ontologyRefetch
} = useOntologyQuery({ versionId: props.versionId, view: 'EDITORIAL' })

const mutations = useMutateOntology({ versionId: props.versionId, view: 'EDITORIAL' })
const { refetchConnected, deprecateEntries, cancelDeprecateEntries } = mutations

const { getCreateEntriesForLabels } = useOntologySchema()
const createEntriesForLabels = computed(() => getCreateEntriesForLabels().value)

// ── Modal state ───────────────────────────────────────────────────────────────
const showModal = ref(false)
const activeConfig = ref(null)
const activeEntry = ref(null)
const mutationLoading = ref(false)
const mutationError = ref(null)

const openCreateForm = (typename) => {
  console.log('typename', typename)
  activeConfig.value = ONTOLOGY_ENTRY_CONFIGS[typename]
  activeEntry.value = null
  mutationError.value = null
  showModal.value = true
}

const openUpdateForm = (entry) => {
  activeConfig.value = ONTOLOGY_ENTRY_CONFIGS[entry.__typename]
  activeEntry.value = entry
  mutationError.value = null
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  activeConfig.value = null
  activeEntry.value = null
  mutationError.value = null
}

// ── Submit handler ────────────────────────────────────────────────────────────
const handleSubmit = async ({ formData, referenceIds, controlTeamId }) => {
  const typename = activeConfig.value.typename
  mutationLoading.value = true
  mutationError.value = null

  try {
    if (activeEntry.value) {
      const variables = activeConfig.value.processUpdate(activeEntry.value, formData, referenceIds)
      const { status, errors } = await mutations[`update${typename}`](variables)
      if (status === 'SUCCESS') {
        await refetchConnected(activeEntry.value.id)
        closeModal()
      } else {
        mutationError.value = errors?.map(e => e.message).join(', ') ?? 'Update failed'
      }
    } else {
      const variables = activeConfig.value.processCreate(formData, referenceIds)
      const { status, errors } = await mutations[`create${typename}`](variables, controlTeamId)
      if (status === 'SUCCESS') {
        await ontologyRefetch()
        closeModal()
      } else {
        mutationError.value = errors?.map(e => e.message).join(', ') ?? 'Create failed'
      }
    }
  } catch (err) {
    console.error('Ontology mutation error:', err)
    mutationError.value = err.message ?? 'An unexpected error occurred'
  } finally {
    mutationLoading.value = false
  }
}

// ── Deprecate / Cancel Deprecate ──────────────────────────────────────────────
const handleDeprecate = async (entryId) => {
  mutationLoading.value = true
  try {
    const { status, errors } = await deprecateEntries([entryId])
    if (status === 'SUCCESS') {
      closeModal()
    } else {
      mutationError.value = errors?.map(e => e.message).join(', ') ?? 'Deprecation failed'
    }
  } catch (err) {
    mutationError.value = err.message
  } finally {
    mutationLoading.value = false
  }
}

const handleCancelDeprecate = async (entryId) => {
  mutationLoading.value = true
  try {
    const { status, errors } = await cancelDeprecateEntries([entryId])
    if (status === 'SUCCESS') {
      closeModal()
    } else {
      mutationError.value = errors?.map(e => e.message).join(', ') ?? 'Cancel deprecation failed'
    }
  } catch (err) {
    mutationError.value = err.message
  } finally {
    mutationLoading.value = false
  }
}

// ── Graph interaction ─────────────────────────────────────────────────────────
const handleNodeRightClick = (node) => {
  const entry = ontology.value?.entries.find(e => e.id === node.id)
  if (!entry) {
    console.warn('Entry not found for node:', node)
    return
  }
  if (!ONTOLOGY_ENTRY_CONFIGS[entry.__typename]) {
    console.warn('No config for type:', entry.__typename)
    return
  }
  openUpdateForm(entry)
}
</script>

<template>
  <div>
    <div v-if="ontologyErrors?.length" class="error">Errors: {{ ontologyErrors }}</div>
    <div v-if="ontologyLoading">Loading ontology entries…</div>
    <div v-else class="graph-container">
      <OntologyNetworkGraph
        v-if="ontology"
        :ontology="ontology"
        @node-right-click="handleNodeRightClick"
      />
    </div>

    <section>
      <h2>Add to ontology</h2>
      <div class="entry-management">
        <button
          v-for="(entry, index) in createEntriesForLabels"
          :key="index"
          :title="`${entry.description} (${entry.code})`"
          :style="{ backgroundColor: entry.color, color: 'white' }"
          class="ontology-button"
          @click="openCreateForm(entry.typename)"
        >
          {{ entry.label }}
        </button>
      </div>
    </section>

    <!-- Error display outside modal (if modal is closed) -->
    <div v-if="mutationError && !showModal" class="error-message">
      {{ mutationError }}
    </div>

    <!-- Shared modal -->
    <OntologyEntryModal
      v-if="showModal && activeConfig"
      :config="activeConfig"
      :ontology-entries="ontology?.entries ?? []"
      :entry="activeEntry"
      :loading="mutationLoading"
      @submit="handleSubmit"
      @deprecate="handleDeprecate"
      @cancel-deprecate="handleCancelDeprecate"
      @close="closeModal"
    />
  </div>
</template>

<style scoped>
.graph-container {
  width: 100%;
  height: 600px;
  margin: 2rem 0;
  display: flex;
  flex-direction: row;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.entry-management {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.ontology-button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
  color: white;
}

.ontology-button:hover {
  opacity: 0.85;
}

.ontology-button:active {
  opacity: 0.7;
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