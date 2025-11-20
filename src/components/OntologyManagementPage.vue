<template>
  <div class="ontology-management-page">
    <h1>Ontology</h1>
    <div class="ontology-actions">
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
    </div>

    <section>
      <h2>Filter by Ontology Labels</h2>
      <div class="label-filter">
        <button
          v-for="(entry, index) in createEntriesForLabels"
          :key="index"
          :title="`${entry.description} (${entry.code})`"
          :style="{
            backgroundColor: entry.color,
            color: 'white',
            opacity: selectedLabels.length === 0 || selectedLabels.includes(entry.enumLabel) ? 1 : 0.3
          }"
          @click="toggleLabelFilter(entry.enumLabel)"
          class="ontology-button label-filter-button"
        >
          {{ entry.label }}
        </button>
      </div>
    </section>

    <div v-if="error">Error: {{ error.message }}</div>
    <div v-if="loading">Loading ontology entries...</div>
    <OntologyNetworkGraph
      v-else-if="ontologyEntries"
      :entries="ontologyEntries"
      :relationships="ontologyRelationships"
      :selected-labels="selectedLabels"
      @node-right-click="handleNodeRightClick"
    />
    <section>
        <h2>Add to ontology</h2>
                <div class="entry-management">
          <button
            v-for="(entry, index) in createEntriesForLabels"
            :key="index"
            :title="`${entry.description} (${entry.code})`"
            :style="{
              backgroundColor: entry.color,
              color: 'white'
            }"
            @click="createEntry(entry.method)"
            class="ontology-button"
          >
            {{ entry.label }}
          </button>
        </div>
      </section>
    <section>
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
            title="View commit history"
            class="btn-version btn-history"
            @click="goToCommitHistory"
          >
            View History
          </button>
          <button
            v-if='user && (user.ontologyRole === "ADMIN" || user.ontologyRole === "EDITOR")'
            title="Commit drafted entries to active and deprecated entries to removed in a new version"
            class="btn-version"
            @click="openCommitVersionForm"
          >
            Commit Changes
          </button>
          <button
            v-if='user && user.ontologyRole === "ADMIN"'
            title="Manage Roles"
            class="btn-version btn-history"
            @click="goToOntologyRoles"
          >
            Manage Roles
          </button>
        </div>
      </section>

<!-- Form Modal -->
    <div v-if="showForm" class="form-modal">
      <div class="form-container">
        <h2>{{ formTitle }}</h2>
        <FormKit
          type="form"
          @submit="handleSubmit"
          :actions="false"
          v-model="formData"
        >
          <template v-for="field in formFields" :key="field.name">
            <!-- Custom Axes Builder -->
            <div v-if="field._axesBuilder" class="axes-builder-field">
              <label class="axes-label">Axes (order matters)</label>
              <div class="add-buttons">
                <button
                  v-for="option in field._axesBuilder.options"
                  :key="option.value"
                  type="button"
                  class="add-axis-btn"
                  @click="addAxis(field.name, option.value)"
                >
                  + {{ option.label }}
                </button>
              </div>

              <div v-if="formData[field.name] && formData[field.name].length > 0" class="axes-list">
                <div
                  v-for="(axis, index) in formData[field.name]"
                  :key="`${axis}-${index}`"
                  class="axis-item"
                  @click="removeAxis(field.name, index)"
                  :title="`Click to remove`"
                >
                  <span class="axis-index">{{ index + 1 }}.</span>
                  <span class="axis-label">{{ getAxisLabel(field._axesBuilder.options, axis) }}</span>
                  <span class="axis-remove">×</span>
                </div>
              </div>

              <div v-else class="empty-axes">
                Click buttons above to add axes in order
              </div>

              <FormKit :type="field.type" :name="field.name" :value="field.value" />
            </div>

            <!-- Regular FormKit fields -->
            <FormKit
              v-else
              :type="field.type"
              :name="field.name"
              :label="field.label"
              :validation="field.validation"
              :placeholder="field.placeholder"
              :options="field.options"
              :multiple="field.multiple"
              :value="field.value"
            />
          </template>

          <div class="form-actions">
            <button type="submit" class="btn-primary">Submit</button>
            <button type="button" @click="closeForm" class="btn-secondary">Cancel</button>
            <button
              v-if="currentEntryId"
              type="button"
              @click="deprecateEntry(currentEntryId)"
              class="btn-danger"
              title="Deprecate this entry"
            >
              Deprecate
            </button>
          </div>
        </FormKit>
      </div>
    </div>



  </div>
</template>


<script setup>
import { computed, ref } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { useOntologySchema } from '@/composables/useOntologySchema'
import { useRouter } from 'vue-router'
import { useOntologyCreateMutations, useOntologyCreatorHandlers } from '@/composables/createOntologyEntries'
import { useOntologyUpdateMutations, useOntologyUpdateHandlers } from '@/composables/updateOntologyEntries'
import { useAuthStore } from '@/composables/useAuthStore'

import OntologyNetworkGraph from './OntologyNetworkGraph.vue'
import ONTOLOGY_ENTRIES from '../graphql/ontology/entries.graphql'
import ONTOLOGY_RELATIONSHIPS from '../graphql/ontology/relationships.graphql'
import COMMIT_VERSION from '../graphql/ontology/commitVersion.graphql'
import COMMIT_HISTORY from '../graphql/ontology/commitHistory.graphql'
import DEPRECATE_ENTRIES from '../graphql/ontology/deprecateEntries.graphql'

const router = useRouter()
const { user } = useAuthStore()

// Navigation functions
const goToCommitHistory = () => {
  router.push({ name: 'commit-history' })
}

const goToOntologyRoles = () => {
  router.push({ name: 'ontology-roles' })
}

// Reactive data
const availableLifeCyclePhases = ['DRAFT', 'ACTIVE', 'DEPRECATED', 'REMOVED']
const selectedPhases = ref(['DRAFT', 'ACTIVE'])
const selectedLabels = ref([])
const showForm = ref(false)
const formTitle = ref('')
const formFields = ref([])
const currentMutation = ref(null)
const currentEntryId = ref(null)
const formData = ref({})

// Get composable data
const { getCreateEntriesForLabels } = useOntologySchema()
const createEntriesForLabels = computed(() => getCreateEntriesForLabels().value)

// Query variables
const queryVariables = computed(() => ({
  phases: selectedPhases.value.length > 0 ? selectedPhases.value : undefined
}))

// GraphQL setup
const ontologyEntriesQuery = useQuery(
  ONTOLOGY_ENTRIES,
  queryVariables,
  { fetchPolicy: 'network-only' }
)

const ontologyEntries = computed(() =>
  ontologyEntriesQuery.result.value?.ontologyEntries?.result || []
)

// Expose error from ontologyEntriesQuery
const error = computed(() =>
  ontologyEntriesQuery.error.value || relationshipsQuery.error.value
)

// Loading state (optional, but good to have)
const loading = computed(() =>
  ontologyEntriesQuery.loading.value || relationshipsQuery.loading.value
)


const entryIds = computed(() => ontologyEntries.value.map(entry => entry.id))

const relationshipsQuery = useQuery(
  ONTOLOGY_RELATIONSHIPS,
  () => ({
    entryIds: entryIds.value,
    phases: selectedPhases.value.length > 0 ? selectedPhases.value : undefined
  }),
  () => ({ enabled: entryIds.value.length > 0 })
)

const ontologyRelationships = computed(() =>
  relationshipsQuery.result.value?.ontologyRelationships?.result || []
)

const latestCommitHistoryQuery = useQuery(
  COMMIT_HISTORY,
  { limit: 1 },
  { fetchPolicy: 'network-only' }
)

const latestCommit = computed(() =>
  latestCommitHistoryQuery.result.value?.ontologyCommitHistory?.result?.[0] || null
)

// Mutations
const createMutations = useOntologyCreateMutations()
const updateMutations = useOntologyUpdateMutations()
const creatorHandlers = useOntologyCreatorHandlers()
const updateHandlers = useOntologyUpdateHandlers()
const deprecateEntriesMutation = useMutation(DEPRECATE_ENTRIES)
const commitVersionMutation = useMutation(COMMIT_VERSION)

// Toggle functions
const togglePhaseSelection = (phase) => {
  if (selectedPhases.value.includes(phase)) {
    selectedPhases.value = selectedPhases.value.filter(p => p !== phase)
  } else {
    selectedPhases.value.push(phase)
  }
  refetchAll()
}

const toggleLabelFilter = (label) => {
  if (selectedLabels.value.includes(label)) {
    selectedLabels.value = selectedLabels.value.filter(l => l !== label)
  } else {
    selectedLabels.value.push(label)
  }
}

// Refetch all data
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

// Form management
const openForm = (title, fields, mutation) => {
  formTitle.value = title
  formFields.value = fields
  currentMutation.value = mutation
  showForm.value = true
}

const closeForm = () => {
  showForm.value = false
  formTitle.value = ''
  formFields.value = []
  currentMutation.value = null
  currentEntryId.value = null
  formData.value = {}
}

// Axes management
const addAxis = (fieldName, value) => {
  if (!formData.value[fieldName]) {
    formData.value[fieldName] = []
  }
  formData.value[fieldName].push(value)
}

const removeAxis = (fieldName, index) => {
  if (formData.value[fieldName]) {
    formData.value[fieldName].splice(index, 1)
  }
}

const getAxisLabel = (options, value) => {
  const option = options.find(opt => opt.value === value)
  return option ? option.label : value
}

// Format helpers
const formatVersion = (version) => {
  if (!version) return 'N/A'
  return `${version.major}.${version.minor}.${version.patch}`
}

// Main entry creation
const createEntry = (methodName) => {
  const handler = creatorHandlers[methodName]

  if (handler) {
    const context = {
      ontologyEntries: ontologyEntries.value,
      openForm,
      createTermMutation: createMutations.createTermMutation,
      createSubjectMutation: createMutations.createSubjectMutation,
      createTraitMutation: createMutations.createTraitMutation,
      createConditionMutation: createMutations.createConditionMutation,
      createScaleMutation: createMutations.createScaleMutation,
      createCategoryMutation: createMutations.createCategoryMutation,
      createObservationMethodMutation: createMutations.createObservationMethodMutation,
      createVariableMutation: createMutations.createVariableMutation,
      createControlMethodMutation: createMutations.createControlMethodMutation,
      createFactorMutation: createMutations.createFactorMutation,
      createEventMutation: createMutations.createEventMutation,
      createLocationTypeMutation: createMutations.createLocationTypeMutation,
      createDesignMutation: createMutations.createDesignMutation,
      createLayoutTypeMutation: createMutations.createLayoutTypeMutation
    }
    handler(context)
  } else {
    console.warn(`Handler ${methodName} not implemented yet`)
  }
}

// Handle node right-click for editing
const handleNodeRightClick = (node) => {
  const entry = ontologyEntries.value.find(e => e.id === node.id)
  if (!entry) {
    console.warn('Entry not found for node:', node)
    return
  }

  const typename = entry.__typename

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
  if (handlerMethodName && updateHandlers[handlerMethodName]) {
    const handler = updateHandlers[handlerMethodName]
    currentEntryId.value = entry.id

    const context = {
      entry,
      relationships: ontologyRelationships.value,
      ontologyEntries: ontologyEntries.value,
      openForm,
      [`update${typename}Mutation`]: updateMutations[`update${typename}Mutation`]
    }
    handler(context)
  } else {
    console.warn(`No update handler found for type: ${typename}`)
  }
}

// Deprecate entry
const deprecateEntry = async (entryId) => {
  if (!confirm('Are you sure you want to deprecate this entry? This will change its lifecycle phase.')) {
    return
  }

  try {
    const result = await deprecateEntriesMutation.mutate({
      entry_ids: [entryId]
    })

    if (result?.data?.ontologyDeprecateEntries) {
      const response = result.data.ontologyDeprecateEntries
      if (response.errors && response.errors.length > 0) {
        alert('Error: ' + response.errors.map(e => e.message).join(', '))
      } else if (response.status === 'SUCCESS') {
        alert('Entry deprecated successfully!')
        closeForm()
        refetchAll()
      }
    }
  } catch (error) {
    console.error('Error removing entry:', error)
    alert('An error occurred: ' + error.message)
  }
}

// Handle form submission
const handleSubmit = async (formDataValues) => {
  try {
    const processedFormData = Object.fromEntries(
      Object.entries(formDataValues).map(([key, value]) => [
        key,
        Array.isArray(value) ?
          (value.length === 0 ? [] : value) :
          value
      ])
    )

    const result = await currentMutation.value(processedFormData)

    if (result?.data) {
      const mutationKey = Object.keys(result.data)[0]
      const response = result.data[mutationKey]

      if (response.errors && response.errors.length > 0) {
        alert('Error: ' + response.errors.map(e => e.message).join(', '))
      } else if (response.status === 'success' || response.status === 'SUCCESS') {
        alert('Successfully created!')
        closeForm()
        refetchAll()
      }
    }
  } catch (error) {
    console.error('Error submitting form:', error)
    alert('An error occurred: ' + error.message)
  }
}

// Commit version form
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

  openForm('Commit Ontology Version', fields, async (formDataValues) => {
    try {
      const result = await commitVersionMutation.mutate({
        versionChange: formDataValues.versionChange,
        comment: formDataValues.comment,
        licenceId: formDataValues.licenceId ? parseInt(formDataValues.licenceId) : null,
        copyrightId: formDataValues.copyrightId ? parseInt(formDataValues.copyrightId) : null
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

.version-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn-version {
  background-color: #4CAF50;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-version:hover {
  background-color: #45a049;
}

.btn-history {
  background-color: #2196F3;
}

.btn-history:hover {
  background-color: #0b7dda;
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

.btn-secondary:hover {
  background-color: #da190b;
}

.btn-danger {
  background-color: #ff6b6b;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-danger:hover {
  background-color: #ee5252;
}

.entry-management, .label-filter {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.label-filter button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s, opacity 0.3s;
}

.label-filter button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: opacity 0.3s;
}


.ontology-button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s, opacity 0.3s;
  color: white;
}

.ontology-button:hover {
  opacity: 0.85;
}

.ontology-button:active {
  opacity: 0.7;
}

.entry-management button {
  background-color: transparent; /* Will be overridden by inline style */
  color: white;
}


.axes-builder-field {
  margin-bottom: 1.5rem;
}

.axes-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #374151;
}

.add-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.add-axis-btn {
  padding: 0.5rem 1rem;
  border: 2px solid #4CAF50;
  background: white;
  color: #4CAF50;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.add-axis-btn:hover {
  background: #4CAF50;
  color: white;
}

.axes-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.axis-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.axis-item:hover {
  background: #fee;
  border-color: #f44336;
}

.axis-index {
  font-weight: bold;
  color: #666;
  min-width: 2rem;
}

.axis-label {
  flex: 1;
  font-weight: 500;
}

.axis-remove {
  font-size: 1.5rem;
  color: #f44336;
  font-weight: bold;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.axis-item:hover .axis-remove {
  opacity: 1;
}

.empty-axes {
  padding: 2rem;
  text-align: center;
  color: #999;
  font-style: italic;
  background: #f9f9f9;
  border: 2px dashed #ddd;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

</style>