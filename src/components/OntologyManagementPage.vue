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
            :style="{
              backgroundColor: getNodeColor(entry.method.replace('create', '')),
              color: 'white'
            }"
            @click="createEntry(entry.method)"
          >
            {{ entry.label }}
          </button>
        </div>
      </section>

      <section>
        <h2>Filter by Life Cycle Phases</h2>
        <div class="phase-selection">
          <button
            v-for="phase in availableLifeCyclePhases"
            :key="phase"
            @click="togglePhaseSelection(phase)"
            :class="{ 'selected': selectedPhases.includes(phase) }"
          >
            {{ phase }}
          </button>
        </div>
      </section>

      <section>
        <h2>Ontology Versioning</h2>
        <h2>Current Version</h2>
        <div v-if="latestCommit" class="latest-commit-info">
          <p><strong>Version:</strong> {{ formatVersion(latestCommit.version) }}</p>
          <p><strong>Time:</strong> {{ new Date(latestCommit.time).toLocaleString() }}</p>
          <p><strong>Comment:</strong> {{ latestCommit.comment || 'No comment' }}</p>
        </div>
        <div v-else>
          Loading commit history...
        </div>
        <div class="version-actions">
          <button
            title="Commit drafted entries to active and deprecated entries to removed in a new version"
            class="btn-version"
            @click="openCommitVersionForm"
          >
            Commit Changes
          </button>
        </div>
      </section>
    </div>

    <!-- Form Modal -->
    <div v-if="showForm" class="form-modal">
      <div class="form-container">
        <h2>{{ formTitle }}</h2>
        <FormKit
          type="form"
          @submit="handleSubmit"
          :actions="false"
        >
          <FormKit
            v-for="field in formFields"
            :key="field.name"
            :type="field.type"
            :name="field.name"
            :label="field.label"
            :validation="field.validation"
            :placeholder="field.placeholder"
            :options="field.options"
            :multiple="field.multiple"
            :value="field.value"
          />
          <div class="form-actions">
            <button type="submit" class="btn-primary">Submit</button>
            <button type="button" @click="closeForm" class="btn-secondary">Cancel</button>
          </div>
        </FormKit>
      </div>
    </div>

    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error: {{ error.message }}</div>
    <OntologyNetworkGraph
      v-else-if="ontologyEntries"
      :entries="ontologyEntries"
      :relationships="ontologyRelationships"
      :relationships-loading="relationshipsLoading"
      :relationships-error="relationshipsError"
      @node-right-click="handleNodeRightClick"
    />

  </div>
</template>

<script>
import { computed, ref } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { useOntologySchema } from '@/composables/useOntologySchema'
import { useOntologyCreateMutations, useOntologyCreatorHandlers } from '@/composables/createOntologyEntries'
import { useOntologyUpdateMutations, useOntologyUpdateHandlers } from '@/composables/updateOntologyEntries'
import { getNodeColor } from '@/composables/nodeColorMap'

import OntologyNetworkGraph from './OntologyNetworkGraph.vue'
import ONTOLOGY_ENTRIES from '../graphql/ontology/entries.graphql'
import ONTOLOGY_RELATIONSHIPS from '../graphql/ontology/relationships.graphql'
import COMMIT_VERSION from '../graphql/ontology/commitVersion.graphql'
import LATEST_COMMIT from '../graphql/ontology/latestCommit.graphql'

export default {
  name: 'OntologyManagementPage',
  components: {
    OntologyNetworkGraph
  },
  setup() {
    const availableLifeCyclePhases = ['DRAFT', 'ACTIVE', 'DEPRECATED', 'REMOVED']
    const selectedPhases = ref(['DRAFT', 'ACTIVE'])

    const { getCreateEntriesForLabels } = useOntologySchema()
    const createEntriesForLabels = computed(() => getCreateEntriesForLabels().value)

    const queryVariables = computed(() => ({
      phases: selectedPhases.value.length > 0 ? selectedPhases.value : undefined
    }))

    const ontologyEntriesQuery = useQuery(
      ONTOLOGY_ENTRIES,
      queryVariables,
      { fetchPolicy: 'network-only' }
    )

    const ontologyEntries = computed(() =>
      ontologyEntriesQuery.result.value?.ontologyEntries?.result || []
    )

    const togglePhaseSelection = (phase) => {
      if (selectedPhases.value.includes(phase)) {
        selectedPhases.value = selectedPhases.value.filter(p => p !== phase)
      } else {
        selectedPhases.value.push(phase)
      }
      refetchAll()
    }

    // Query ontology relationships
    const entryIds = computed(() => ontologyEntries.value.map(entry => entry.id))

    const relationshipsQuery = useQuery(
      ONTOLOGY_RELATIONSHIPS,
      () => ({
        entryIds: entryIds.value,
        phases: selectedPhases.value.length > 0 ? selectedPhases.value : undefined
      }),
      () => ({ enabled: entryIds.value.length > 0 }),
    )

    const ontologyRelationships = computed(() =>
      relationshipsQuery.result.value?.ontologyRelationships?.result || []
    )

    const showForm = ref(false)
    const formTitle = ref('')
    const formFields = ref([])
    const currentMutation = ref(null)

    // Setup mutations
    const createMutations = useOntologyCreateMutations()
    const updateMutations = useOntologyUpdateMutations()

    // Get creator and update handlers
    const creatorHandlers = useOntologyCreatorHandlers()
    const updateHandlers = useOntologyUpdateHandlers()

    // Helper function to open form
    const openForm = (title, fields, mutation) => {
      formTitle.value = title
      formFields.value = fields
      currentMutation.value = mutation
      showForm.value = true
    }

    const commitVersionMutation = useMutation(COMMIT_VERSION)

    const openCommitVersionForm = () => {
      const fields = [
        {
          name: 'versionChange',
          type: 'select',
          label: 'Version Change Type',
          options: ['MAJOR', 'MINOR', 'PATCH'],
          validation: 'required',
          placeholder: 'Select version change type'
        },
        {
          name: 'comment',
          type: 'textarea',
          label: 'Version Comment',
          validation: 'required',
          placeholder: 'Enter version comment'
        },
        {
          name: 'licenceId',
          type: 'number',
          label: 'Licence ID (Optional)',
          validation: '',
          placeholder: 'Enter licence ID'
        },
        {
          name: 'copyrightId',
          type: 'number',
          label: 'Copyright ID (Optional)',
          validation: '',
          placeholder: 'Enter copyright ID'
        }
      ]

      // Directly pass the mutation function
      openForm('Commit Ontology Version', fields, async (formData) => {
        try {
          const result = await commitVersionMutation.mutate({
            versionChange: formData.versionChange,
            comment: formData.comment,
            licenceId: formData.licenceId ? parseInt(formData.licenceId) : null,
            copyrightId: formData.copyrightId ? parseInt(formData.copyrightId) : null
          })

          return {
            data: {
              ontologyCommitVersion: result.data?.ontologyCommitVersion || {}
            }
          }
        } catch (error) {
          console.error('Commit version mutation error:', error)
          throw error
        }
      })
    }

    const latestCommitHistoryQuery = useQuery(
      LATEST_COMMIT,
      { limit: 1 },
      { fetchPolicy: 'network-only' }
    )

    const latestCommit = computed(() =>
      latestCommitHistoryQuery.result.value?.ontologyCommitHistory?.result?.[0] || null
    )
            // Combined refetch method
    const refetchAll = async () => {
      try {
        await Promise.all([
          ontologyEntriesQuery.refetch(),
          relationshipsQuery.refetch(),
          latestCommitHistoryQuery.refetch()
        ])
      } catch (error) {
        console.error('Error refetching data:', error)
      }
    }

    const formatVersion = (version) => {
      if (!version) return 'N/A'
      return `${version.major}.${version.minor}.${version.patch}`
    }

    return {
      createEntriesForLabels,
      ontologyEntries,
      ontologyRelationships,
      loading: ontologyEntriesQuery.loading || relationshipsQuery.loading,
      error: ontologyEntriesQuery.error || relationshipsQuery.error || null,
      refetch: refetchAll,
      showForm,
      formTitle,
      formFields,
      currentMutation,
      openForm,
      ...createMutations,
      ...updateMutations,
      creatorHandlers,
      updateHandlers,
      getNodeColor,
      availableLifeCyclePhases,
      selectedPhases,
      togglePhaseSelection,
      openCommitVersionForm,
      latestCommit,
      formatVersion
    }
  },
  methods: {
    createEntry(methodName) {
      // methodName comes as 'createTerm', 'createSubject', etc.
      const handler = this.creatorHandlers[methodName]

      if (handler) {
        const context = {
          ontologyEntries: this.ontologyEntries,
          openForm: this.openForm,
          createTermMutation: this.createTermMutation,
          createSubjectMutation: this.createSubjectMutation,
          createTraitMutation: this.createTraitMutation,
          createConditionMutation: this.createConditionMutation,
          createScaleMutation: this.createScaleMutation,
          createCategoryMutation: this.createCategoryMutation,
          createObservationMethodMutation: this.createObservationMethodMutation,
          createVariableMutation: this.createVariableMutation,
          createControlMethodMutation: this.createControlMethodMutation,
          createFactorMutation: this.createFactorMutation,
          createEventMutation: this.createEventMutation,
          createLocationTypeMutation: this.createLocationTypeMutation,
          createDesignMutation: this.createDesignMutation,
          createLayoutTypeMutation: this.createLayoutTypeMutation
        }
        handler(context)
      } else {
        console.warn(`Handler ${methodName} not implemented yet`)
      }
    },

    handleNodeRightClick(node) {
      // Find the full entry from ontologyEntries
      const entry = this.ontologyEntries.find(e => e.id === node.id)
      if (!entry) {
        console.warn('Entry not found for node:', node)
        return
      }

      // Determine which update handler to use based on __typename
      const typename = entry.__typename
      //const handlerName = `update${typename}`

      // Get the update handlers
      const { useOntologyUpdateHandlers } = require('@/composables/updateOntologyEntries')
      const handlers = useOntologyUpdateHandlers()

      // Map typename to handler method name
      const handlerMap = {
        'Term': 'updateTerm',
        'Subject': 'updateSubject',
        'Trait': 'updateTrait',
        'Condition': 'updateCondition',
        'Scale': 'updateScale',
        'Category': 'updateCategory',
        'ObservationMethod': 'updateObservationMethod',
        'Variable': 'updateVariable',
        'ControlMethod': 'updateControlMethod',
        'Factor': 'updateFactor',
        'Event': 'updateEvent',
        'LocationType': 'updateLocationType',
        'Design': 'updateDesign',
        'LayoutType': 'updateLayoutType'
      }

      const handlerMethodName = handlerMap[typename]
      if (handlerMethodName && handlers[handlerMethodName]) {
        const handler = handlers[handlerMethodName]
        const context = {
          entry,
          relationships: this.ontologyRelationships,
          ontologyEntries: this.ontologyEntries,
          openForm: this.openForm.bind(this),
          [`update${typename}Mutation`]: this[`update${typename}Mutation`]
        }
        handler(context)
      } else {
        console.warn(`No update handler found for type: ${typename}`)
      }
    },

    closeForm() {
      this.showForm = false
      this.formTitle = ''
      this.formFields = []
      this.currentMutation = null
    },

    async handleSubmit(formData) {
      try {
        const result = await this.currentMutation(formData)

        // Check for errors in the response
        if (result?.data) {
          const mutationKey = Object.keys(result.data)[0]
          const response = result.data[mutationKey]

          if (response.errors && response.errors.length > 0) {
            alert('Error: ' + response.errors.map(e => e.message).join(', '))
          } else if (response.status === 'success' || response.status === 'SUCCESS') {
            alert('Successfully created!')
            this.closeForm()
            this.refetch()
          }
        }
      } catch (error) {
        console.error('Error submitting form:', error)
        alert('An error occurred: ' + error.message)
      }
    }
  }
}
</script>

<style scoped>
.form-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.form-container {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  min-width: 400px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  justify-content: flex-end;
}

.btn-primary {
  background-color: #4CAF50;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary:hover {
  background-color: #45a049;
}

.btn-secondary {
  background-color: #f44336;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-secondary:hover {
  background-color: #da190b;
}

/* Existing styles ... */
.phase-selection {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.phase-selection button {
  padding: 0.5rem 1rem;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.phase-selection button.selected {
  background-color: #4CAF50;
  color: white;
}

.phase-selection button:hover {
  background-color: #e0e0e0;
}

.phase-selection button.selected:hover {
  background-color: #45a049;
}

.latest-commit-info {
  background-color: #f4f4f4;
  border-radius: 4px;
  padding: 1rem;
  margin-top: 0.5rem;
}

.latest-commit-info p {
  margin: 0.25rem 0;
  font-size: 0.9em;
}

</style>