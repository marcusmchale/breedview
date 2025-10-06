<template>
  <div class="ontology-management-page">
    <h1>Ontology Management</h1>
    <div class="ontology-actions">
      <section>
        <h2>Add to ontology</h2>
        <div class="entry-management">
          <button
            v-for="(entry, index) in createEntriesForLabels"
            :key="index"
            :title="entry.description"
            @click="createEntry(entry.method)"
          >
            {{ entry.label }}
          </button>
        </div>
      </section>
    </div>

    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <OntologyNetworkGraph
      v-else-if="ontologyEntries"
      :entries="ontologyEntries"
    />

  </div>
</template>

<script>
import { computed } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import { useOntologySchema } from '@/composables/useOntologySchema'
import OntologyNetworkGraph from './OntologyNetworkGraph.vue'
import ONTOLOGY_ENTRIES from '../graphql/ontology/entries.graphql'

export default {
  name: 'OntologyManagementPage',
    components: {
    OntologyNetworkGraph
  },
  setup() {
    const { getCreateEntriesForLabels } = useOntologySchema()
    const createEntriesForLabels = computed(() => getCreateEntriesForLabels().value)
    const { result, loading, error } = useQuery(ONTOLOGY_ENTRIES)
    const ontologyEntries = computed(() =>
      result.value?.ontologyEntries?.result || []
    )
    console.log(ontologyEntries)
    return { createEntriesForLabels, ontologyEntries, loading, error }

  },
  methods: {
    createEntry(methodName) {
      const method = this[methodName]
      if (method) {
        method.call(this)
      } else {
        console.warn(`Method ${methodName} not implemented`)
      }
    },
    createTerm() {
      console.log("Create Term")
    },
    createSubject() {
      console.log('Create Subject')
    },
    // ... other methods as needed
  }
}

</script>
