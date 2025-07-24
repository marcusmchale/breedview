<template>
  <div class="affiliations-page">
    <div class="page-header">
      <h2>Manage Affiliations</h2>
      <button @click="$emit('back-to-home')" class="btn btn-secondary">
        Back to Home
      </button>
    </div>

    <div v-if="loading" class="loading">
      Loading organisations...
    </div>

    <div v-else-if="error" class="error">
      <p>Unable to load organisations</p>
      <button @click="refetchOrganisations" class="btn btn-primary">
        Retry
      </button>
    </div>

    <div v-else>
      <!-- Add New Organisation Section -->
      <div class="add-organisation-section">
        <h3>Add New Organisation</h3>
        <form @submit.prevent="submitAddOrganisation" class="add-org-form">
          <div class="form-row">
            <div class="form-group">
              <label>Organisation Name:</label>
              <input
                v-model="newOrganisation.name"
                type="text"
                required
                placeholder="Enter organisation name"
              />
            </div>
            <div class="form-group">
              <label>Organisation Full Name (Optional):</label>
              <input
                v-model="newOrganisation.fullname"
                type="text"
                placeholder="Enter organisation full name (optional)"
              />
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" :disabled="addOrgLoading">
                {{ addOrgLoading ? 'Adding...' : 'Add Organisation' }}
              </button>
            </div>
          </div>
        </form>
        <div v-if="addOrgError" class="error-message">
          {{ addOrgError }}
        </div>
        <div v-if="addOrgSuccess" class="success-message">
          {{ addOrgSuccess }}
        </div>
      </div>

      <div class="organisations-section">
        <h3>Available Organisations</h3>

        <div v-if="organisations.length === 0" class="no-organisations">
          <p>No organisations found.</p>
        </div>
        <div v-else class="organisations-list">
          <TeamNode
            v-for="organisation in organisations"
            :key="organisation.id"
            :team-data="organisation"
            :depth="0"
            :current-user-id="props.currentUserId"
            @add-team="handleAddTeam"
            @request-affiliation="handleRequestAffiliation"
            @team-removed="handleTeamRemoved"
            @team-added="handleTeamAdded"
          />
        </div>
      </div>
    </div>

    <!-- Add Team Modal -->
    <AddTeamModal
      :is-open="showAddTeamModal"
      :parent-team="selectedParentTeam"
      @close="showAddTeamModal = false"
      @team-added="handleTeamAdded"
    />

    <!-- Request Affiliation Modal -->
    <RequestAffiliationModal
      :is-open="showRequestAffiliationModal"
      :selected-team="selectedTeamForAffiliation"
      :current-user-id="props.currentUserId"
      @close="showRequestAffiliationModal = false"
      @affiliation-requested="handleAffiliationRequested"
    />
  </div>
</template>


<script setup>
import { ref, watch } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import ORGANISATIONS_QUERY from '../graphql/organisations/organisations.graphql'
import ADD_ORGANISATION_MUTATION from '../graphql/organisations/addOrganisation.graphql'
import TeamNode from './TeamNode.vue'
import AddTeamModal from './AddTeamModal.vue'
import RequestAffiliationModal from './RequestAffiliationModal.vue'

const props = defineProps({
  currentUserId: {
    type: [String, Number],
    required: true
  }
})

defineEmits(['back-to-home'])


// Reactive data
const organisations = ref([])
const loading = ref(true)
const error = ref(false)
const showAddTeamModal = ref(false)
const selectedParentTeam = ref(null)

// Add Organisation form data
const newOrganisation = ref({ name: '', fullname: '' })
const addOrgError = ref('')
const addOrgSuccess = ref('')

// Request Affiliation modal data
const showRequestAffiliationModal = ref(false)
const selectedTeamForAffiliation = ref(null)

// Use Apollo query for organisations
const { result, loading: queryLoading, error: queryError, refetch } = useQuery(ORGANISATIONS_QUERY, {}, {
  fetchPolicy: 'network-only',
  errorPolicy: 'all'
})

// Use Apollo mutation for adding organisation
const { mutate: addOrganisationMutation, loading: addOrgLoading, onError: onAddOrgError, onDone: onAddOrgDone } = useMutation(ADD_ORGANISATION_MUTATION)

// Handle add organisation errors
onAddOrgError((error) => {
  console.error('Add organisation error:', error)
  addOrgError.value = error.message || 'Failed to add organisation. Please try again.'
  addOrgSuccess.value = ''
})

// Handle successful add organisation
onAddOrgDone((result) => {
  const response = result.data?.add_team
  console.log('Add organisation response:', result)
  if (response?.status === 'SUCCESS') {
    addOrgSuccess.value = 'Organisation added successfully!'
    addOrgError.value = ''
    newOrganisation.value = { name: '', fullname: '' }

    // Refetch organisations to show the new one
    refetchOrganisations()
  } else {
    addOrgError.value = response?.errors?.[0]?.message || 'Failed to add organisation'
    addOrgSuccess.value = ''
  }
})

// Watch for query state changes
watch([queryLoading, queryError, result], () => {
  if (queryLoading.value) {
    loading.value = true
    return
  }

  loading.value = false

  if (queryError.value) {
    error.value = true
    console.error('Organisations query error:', queryError.value)
    return
  }

  const organisationsData = result.value?.organisations

  if (organisationsData?.status === 'SUCCESS' || organisationsData?.status === 'NOT_FOUND') {
    organisations.value = organisationsData.result || []
    error.value = false
  } else {
    error.value = true
    console.error('Organisations query failed:', organisationsData?.errors)
  }
}, { immediate: true })

const refetchOrganisations = async () => {
  try {
    await refetch()
  } catch (error) {
    console.error('Failed to refetch organisations:', error)
  }
}

const submitAddOrganisation = async () => {
  if (!newOrganisation.value.name.trim()) return

  addOrgError.value = ''
  addOrgSuccess.value = ''

  try {
    await addOrganisationMutation({
      name: newOrganisation.value.name.trim(),
      fullname: newOrganisation.value.fullname.trim() || null
    })
  } catch (error) {
    console.error('Add organisation failed:', error)
    addOrgError.value = error.message || 'An unexpected error occurred.'
  }
}

const handleAddTeam = (parentTeam) => {
  selectedParentTeam.value = parentTeam
  showAddTeamModal.value = true
}

const handleRequestAffiliation = (team) => {
  selectedTeamForAffiliation.value = team
  showRequestAffiliationModal.value = true
}

const handleTeamAdded = (newTeam) => {
  console.log('Team added:', newTeam)
  // Refetch organisations to update the tree
  refetchOrganisations()
}

const handleTeamRemoved = (removedTeam) => {
  console.log('Team removed:', removedTeam)
  // Refetch organisations to update the tree
  refetchOrganisations()
}

const handleAffiliationRequested = (affiliationData) => {
  console.log('Affiliation requested:', affiliationData)
  // Refetch organisations to update the affiliation status
  refetchOrganisations()
}
</script>

<style scoped>
.affiliations-page {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e5e5e5;
}

.page-header h2 {
  margin: 0;
  color: #333;
}

.add-organisation-section {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border: 1px solid #e9ecef;
}

.add-organisation-section h3 {
  margin: 0 0 1rem 0;
  color: #495057;
}

.add-org-form .form-row {
  display: flex;
  gap: 1rem;
  align-items: end;
}

.form-group {
  flex: 1;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #495057;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.organisations-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.organisations-section h3 {
  margin: 0 0 1.5rem 0;
  color: #495057;
}

.no-organisations {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}
</style>
