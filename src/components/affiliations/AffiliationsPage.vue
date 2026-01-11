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
      <!-- Create New Organisation Section -->
      <div class="create-organisation-section">
        <h3>Create New Organisation</h3>
        <form @submit.prevent="submitCreateOrganisation" class="create-org-form">
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
              <button type="submit" class="btn btn-primary" :disabled="createOrgLoading">
                {{ createOrgLoading ? 'Creating...' : 'Create Organisation' }}
              </button>
            </div>
          </div>
        </form>
        <div v-if="createOrgError" class="error-message">
          {{ createOrgError }}
        </div>
        <div v-if="createOrgSuccess" class="success-message">
          {{ createOrgSuccess }}
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
            :current-user-id="currentUserId"
            @create-team="handleCreateTeam"
            @request-affiliation="handleRequestAffiliation"
            @team-deleted="handleTeamDeleted"
            @team-created="handleTeamCreated"
          />
        </div>
      </div>
    </div>

    <!-- Create Team Modal -->
    <CreateTeamModal
      :is-open="showCreateTeamModal"
      :parent-team="selectedParentTeam"
      @close="showCreateTeamModal = false"
      @team-created="handleTeamCreated"
    />

    <!-- Request Affiliation Modal -->
    <RequestAffiliationModal
      :is-open="showRequestAffiliationModal"
      :selected-team="selectedTeamForAffiliation"
      :current-user-id="currentUserId"
      @close="showRequestAffiliationModal = false"
      @affiliation-requested="handleAffiliationRequested"
    />
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { useAuthStore } from '@/composables/user/useAuthStore'
import ORGANISATIONS_QUERY from '../../graphql/organisations/organisations.graphql'
import CREATE_ORGANISATION_MUTATION from '../../graphql/organisations/createOrganisation.graphql'
import TeamNode from '../organisations/TeamNode.vue'
import CreateTeamModal from '../organisations/CreateTeamModal.vue'
import RequestAffiliationModal from './RequestAffiliationModal.vue'

// Get authentication data from the store
const { currentUserId } = useAuthStore()

defineEmits(['back-to-home'])

// Reactive data
const organisations = ref([])
const loading = ref(true)
const error = ref(false)
const showCreateTeamModal = ref(false)
const selectedParentTeam = ref(null)

// Create Organisation form data
const newOrganisation = ref({ name: '', fullname: '' })
const createOrgError = ref('')
const createOrgSuccess = ref('')

// Request Affiliation modal data
const showRequestAffiliationModal = ref(false)
const selectedTeamForAffiliation = ref(null)

// Use Apollo query for organisations (only if authenticated)
const { result, loading: queryLoading, error: queryError, refetch } = useQuery(ORGANISATIONS_QUERY, {}, {
  fetchPolicy: 'network-only',
  errorPolicy: 'all',
  skip: computed(() => !currentUserId.value) // Skip query if not authenticated
})

// Use Apollo mutation for creating organisation
const { mutate: createOrganisationMutation, loading: createOrgLoading, onError: onCreateOrgError, onDone: onCreateOrgDone } = useMutation(CREATE_ORGANISATION_MUTATION)

// Handle create organisation errors
onCreateOrgError((error) => {
  console.error('Create organisation error:', error)
  createOrgError.value = error.message || 'Failed to create organisation. Please try again.'
  createOrgSuccess.value = ''
})

// Handle successful create organisation
onCreateOrgDone((result) => {
  const response = result.data?.organisationsCreateTeam
  console.log('Create organisation response:', result)
  if (response?.status === 'SUCCESS') {
    createOrgSuccess.value = 'Organisation created successfully!'
    createOrgError.value = ''
    newOrganisation.value = { name: '', fullname: '' }

    // Refetch organisations to show the new one
    refetchOrganisations()
  } else {
    createOrgError.value = response?.errors?.[0]?.message || 'Failed to create organisation'
    createOrgSuccess.value = ''
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

const submitCreateOrganisation = async () => {
  if (!newOrganisation.value.name.trim()) return

  createOrgError.value = ''
  createOrgSuccess.value = ''

  try {
    await createOrganisationMutation({
      name: newOrganisation.value.name.trim(),
      fullname: newOrganisation.value.fullname.trim() || null
    })
  } catch (error) {
    console.error('Create organisation failed:', error)
    createOrgError.value = error.message || 'An unexpected error occurred.'
  }
}

const handleCreateTeam = (parentTeam) => {
  selectedParentTeam.value = parentTeam
  showCreateTeamModal.value = true
}

const handleRequestAffiliation = (team) => {
  selectedTeamForAffiliation.value = team
  showRequestAffiliationModal.value = true
}

const handleTeamCreated = (newTeam) => {
  console.log('Team created:', newTeam)
  refetchOrganisations()
}

const handleTeamDeleted = (deletedTeam) => {
  console.log('Team deleted:', deletedTeam)
  refetchOrganisations()
}

const handleAffiliationRequested = (affiliationData) => {
  console.log('Affiliation requested:', affiliationData)
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

.create-organisation-section {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border: 1px solid #e9ecef;
}

.create-organisation-section h3 {
  margin: 0 0 1rem 0;
  color: #495057;
}

.create-org-form .form-row {
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