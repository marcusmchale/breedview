<template>
  <div class="page-container">
    <div class="programs-header">
      <h1>Programs</h1>
      <button @click="showCreateForm = true" class="btn btn-primary">
        Create New Program
      </button>
    </div>

    <!-- Add error/success messages for main page operations -->
    <div v-if="pageError" class="error-message">
      {{ pageError }}
    </div>
    <div v-if="pageSuccess" class="success-message">
      {{ pageSuccess }}
    </div>

    <!-- Create/Edit Form Modal -->
    <div v-if="showCreateForm || editingProgram" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingProgram ? 'Edit Program' : 'Create Program' }}</h2>
          <button @click="cancelForm" class="modal-close">&times;</button>
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>
        <div v-if="success" class="success-message">
          {{ success }}
        </div>

        <FormKit
          type="form"
          v-model="formData"
          @submit="submitForm"
          :actions="false"
        >
          <FormKit
            type="text"
            name="name"
            label="Name"
            validation="required"
            placeholder="Enter program name"
          />

          <FormKit
            type="text"
            name="fullname"
            label="Full Name"
            placeholder="Enter full program name"
          />

          <FormKit
            type="textarea"
            name="description"
            label="Description"
            placeholder="Enter program description"
            :input-attrs="{ rows: 4 }"
          />

          <div class="form-actions">
            <FormKit
              type="submit"
              input-class="btn btn-primary"
              :disabled="loading"
            >
              {{ loading ? 'Saving...' : (editingProgram ? 'Update Program' : 'Create Program') }}
            </FormKit>
            <button type="button" @click="cancelForm" class="btn btn-secondary">
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>

    <!-- Programs List -->
    <div class="programs-content">
      <div v-if="queryLoading && !programs.length" class="loading">
        Loading programs...
      </div>

      <div v-else-if="queryError" class="error">
        Error loading programs: {{ queryError.message }}
      </div>

      <div v-else-if="programs.length === 0" class="empty-state">
        <h3>No programs found</h3>
        <p>Create your first program to get started!</p>
      </div>

      <div v-else class="programs-grid">
        <div
          v-for="program in programs"
          :key="program.id"
          class="program-card"
        >
          <div class="program-card-header">
            <div class="program-title-section">
              <h3>{{ program.name }}</h3>
            </div>
            <div class="program-actions">
              <button @click="editProgram(program)" class="btn btn-sm btn-outline">
                Edit
              </button>
              <button @click="deleteProgram(program.id)" class="btn btn-sm btn-danger" :disabled="deleting">
                {{ deleting ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
            <ControllerBadge
              entity-label="PROGRAM"
              :entity-id="program.id"
            />
          </div>

          <div class="program-card-content">
            <p v-if="program.fullname"><strong>Full Name:</strong> {{ program.fullname }}</p>
            <p v-if="program.description"><strong>Description:</strong> {{ program.description }}</p>

          <!-- Trials Expansion Panel -->
          <div v-if="program.trials && program.trials.length > 0" class="trials-section">
            <div class="trials-header" @click="program.expandTrials = !program.expandTrials">
              <strong>Trials:</strong> {{ program.trials.length }}
              <span class="expand-icon">{{ program.expandTrials ? '▼' : '►' }}</span>
            </div>
            
            <div v-if="program.expandTrials" class="trials-list">
              <div 
                v-for="trial in program.trials" 
                :key="trial.id" 
                class="trial-card"
              >
                <div class="trial-header">
                  <div class="trial-title-section">
                    <strong>{{ trial.name }}</strong>
                  </div>
                  <div class="trial-actions">
                    <button
                      @click="editTrial(trial)"
                      class="btn btn-sm btn-outline"
                    >
                      Edit
                    </button>
                    <button
                      @click="deleteTrial(trial.id)"
                      class="btn btn-sm btn-danger"
                    >
                      Delete
                    </button>
                  </div>
                    <ControllerBadge
                      entity-label="TRIAL"
                      :entity-id="trial.id"
                    />
                </div>
                
                <div class="trial-content">
                  <p v-if="trial.description">{{ trial.description }}</p>
                  
                  <!-- Studies Expansion Panel -->
                  <div v-if="trial.studies && trial.studies.length > 0" class="studies-section">
                    <div class="studies-header" @click="trial.expandStudies = !trial.expandStudies">
                      <strong>Studies:</strong> {{ trial.studies.length }}
                      <span class="expand-icon">{{ trial.expandStudies ? '▼' : '►' }}</span>
                    </div>
                    
                    <div v-if="trial.expandStudies" class="studies-list">
                      <div 
                        v-for="study in trial.studies" 
                        :key="study.id" 
                        class="study-card"
                      >
                        <div class="study-header">
                          <div class="study-title-section">
                            <strong>{{ study.name }}</strong>
                          </div>
                          <div class="study-actions">
                            <button class="btn btn-sm btn-outline">Edit</button>
                            <button class="btn btn-sm btn-danger">Delete</button>
                          </div>
                          <ControllerBadge
                            entity-label="STUDY"
                            :entity-id="study.id"
                          />
                        </div>
                        
                        <div class="study-content">
                          <p v-if="study.description">{{ study.description }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Create Study Button -->
                  <div class="trial-extension">
                    <button @click="createStudy(trial)" class="btn btn-sm btn-outline">
                      Create Study
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="program-card-footer">
          <div class="program-extension">
            <button @click="createTrial(program)" class="btn btn-sm btn-outline">
              Create Trial
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Update Trial  List -->
    <div v-if="showCreateTrialForm" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>Create Trial for {{ selectedProgram.name }}</h2>
          <button @click="showCreateTrialForm = false" class="modal-close">&times;</button>
        </div>

        <div v-if="trialError" class="error-message">
          {{ trialError }}
        </div>
        <div v-if="trialSuccess" class="success-message">
          {{ trialSuccess }}
        </div>

        <FormKit
          type="form"
          v-model="trialFormData"
          @submit="submitTrialForm"
          :actions="false"
        >
          <FormKit
            type="text"
            name="name"
            label="Trial Name"
            validation="required"
            placeholder="Enter trial name"
          />

          <FormKit
            type="textarea"
            name="description"
            label="Description"
            placeholder="Enter trial description"
            :input-attrs="{ rows: 4 }"
          />

          <div class="form-actions">
            <FormKit
              type="submit"
              input-class="btn btn-primary"
              :disabled="trialLoading"
            >
              {{ trialLoading ? 'Creating...' : 'Create Trial' }}
            </FormKit>
            <button type="button" @click="showCreateTrialForm = false" class="btn btn-secondary">
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>
      <!-- Edit Trial Modal -->
    <div v-if="showEditTrialForm" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>Edit Trial for {{ selectedProgram ? selectedProgram.name : '' }}</h2>
          <button @click="showEditTrialForm = false" class="modal-close">&times;</button>
        </div>

        <div v-if="editTrialError" class="error-message">
          {{ editTrialError }}
        </div>
        <div v-if="editTrialSuccess" class="success-message">
          {{ editTrialSuccess }}
        </div>

        <FormKit
          type="form"
          v-model="editTrialFormData"
          @submit="submitEditTrialForm"
          :actions="false"
        >
          <FormKit
            type="text"
            name="name"
            label="Trial Name"
            validation="required"
            placeholder="Enter trial name"
          />

          <FormKit
            type="textarea"
            name="description"
            label="Description"
            placeholder="Enter trial description"
            :input-attrs="{ rows: 4 }"
          />

          <!-- Hidden inputs for trialId and programId -->
          <FormKit
            type="hidden"
            name="trialId"
          />
          <FormKit
            type="hidden"
            name="programId"
          />

          <div class="form-actions">
            <FormKit
              type="submit"
              input-class="btn btn-primary"
              :disabled="editTrialLoading"
            >
              {{ editTrialLoading ? 'Updating...' : 'Update Trial' }}
            </FormKit>
            <button type="button" @click="showEditTrialForm = false" class="btn btn-secondary">
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>
    <!-- Create/Update Study Modal -->
    <div v-if="showCreateStudyForm" class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2>Create Study for {{ selectedTrial ? selectedTrial.name : '' }}</h2>
          <button @click="showCreateStudyForm = false" class="modal-close">&times;</button>
        </div>

        <div v-if="studyError" class="error-message">
          {{ studyError }}
        </div>
        <div v-if="studySuccess" class="success-message">
          {{ studySuccess }}
        </div>

        <FormKit
          type="form"
          v-model="studyFormData"
          @submit="submitStudyForm"
          :actions="false"
        >
          <FormKit
            type="text"
            name="name"
            label="Study Name"
            validation="required"
            placeholder="Enter study name"
          />

          <FormKit
            type="textarea"
            name="description"
            label="Description"
            placeholder="Enter study description"
            :input-attrs="{ rows: 4 }"
          />

          <!-- Hidden input for trialId -->
          <FormKit
            type="hidden"
            name="trialId"
          />

          <div class="form-actions">
            <FormKit
              type="submit"
              input-class="btn btn-primary"
              :disabled="studyLoading"
            >
              {{ studyLoading ? 'Creating...' : 'Create Study' }}
            </FormKit>
            <button type="button" @click="showCreateStudyForm = false" class="btn btn-secondary">
              Cancel
            </button>
          </div>
        </FormKit>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import PROGRAMS_QUERY from '../graphql/programs/programs.graphql'
import CREATE_PROGRAM_MUTATION from '../graphql/programs/createProgram.graphql'
import UPDATE_PROGRAM_MUTATION from '../graphql/programs/updateProgram.graphql'
import DELETE_PROGRAM_MUTATION from '../graphql/programs/deleteProgram.graphql'

import CREATE_TRIAL_MUTATION from '../graphql/programs/createTrial.graphql'
import UPDATE_TRIAL_MUTATION from '../graphql/programs/updateTrial.graphql'
import DELETE_TRIAL_MUTATION from '../graphql/programs/deleteTrial.graphql'

import CREATE_STUDY_MUTATION from '../graphql/programs/createStudy.graphql'

import ControllerBadge from './ControllerBadge.vue'

// Reactive data
const programs = ref([])
const showCreateForm = ref(false)
const editingProgram = ref(null)
const loading = ref(false)
const deleting = ref(false) // Add separate loading state for delete operations
const error = ref('') // Modal form errors
const success = ref('') // Modal form success
const pageError = ref('') // Main page errors
const pageSuccess = ref('') // Main page success
const formData = ref({
  name: '',
  fullname: '',
  description: ''
})

// GraphQL queries and mutations
const { result, loading: queryLoading, error: queryError, refetch } = useQuery(PROGRAMS_QUERY)
const { mutate: createProgram, onError: onCreateError } = useMutation(CREATE_PROGRAM_MUTATION)
const { mutate: updateProgram, onError: onUpdateError } = useMutation(UPDATE_PROGRAM_MUTATION)
const { mutate: deleteProgramMutation, onError: onDeleteError } = useMutation(DELETE_PROGRAM_MUTATION)


// Error handlers
onCreateError((err) => {
  console.error('Create program error:', err)
  error.value = err.message
})

onUpdateError((err) => {
  console.error('Update program error:', err)
  error.value = err.message
})

onDeleteError((err) => {
  console.error('Delete program error:', err)
  pageError.value = err.message // Use pageError for delete operations
})

// Watch for query results
watch(result, (newResult) => {
  if (newResult?.programs?.result) {
    // Add expandTrials property to each program
    programs.value = newResult.programs.result.map(program => ({
      ...program,
      expandTrials: false,
      trials: (program.trials || []).map(trial => ({
        ...trial,
        expandStudies: false
      }))
    }))
    console.log('Programs data received:', JSON.parse(JSON.stringify(programs.value)))
  }
  if (newResult?.programs?.errors?.length > 0) {
    pageError.value = newResult.programs.errors[0].message
  }
}, { immediate: true })

// Clear page messages after some time
const clearPageMessages = () => {
  setTimeout(() => {
    pageError.value = ''
    pageSuccess.value = ''
  }, 5000) // Clear after 5 seconds
}

// Form handling
const resetForm = () => {
  formData.value = {
    name: '',
    fullname: '',
    description: ''
  }
}

const editProgram = (program) => {
  // Clear page messages when opening modal
  pageError.value = ''
  pageSuccess.value = ''

  editingProgram.value = program
  formData.value = {
    name: program.name || '',
    fullname: program.fullname || '',
    description: program.description || ''
  }
  showCreateForm.value = false
}

const cancelForm = () => {
  showCreateForm.value = false
  editingProgram.value = null
  resetForm()
  error.value = ''
  success.value = ''
}

const submitForm = async (formValues) => {
  try {
    loading.value = true
    error.value = ''
    success.value = ''

    // Filter out empty strings and whitespace-only values
    const cleanFormValues = Object.fromEntries(
      Object.entries(formValues)
        .filter(([, value]) => value && value.toString().trim() !== '')
        .map(([key, value]) => [key, value.toString().trim()])
    )

    let response
    if (editingProgram.value) {
      // Update existing program
      response = await updateProgram( {
          program: {
            programId: editingProgram.value.id,
            ...cleanFormValues
          }
      })
    } else {
      // Create new program
      response = await createProgram({ program: cleanFormValues})
    }

    // Check response status
    const operationName = editingProgram.value ? 'programsUpdateProgram' : 'programsCreateProgram'
    const result = response.data[operationName]

    if (result.status === 'SUCCESS') {
      success.value = editingProgram.value ? 'Program updated successfully!' : 'Program created successfully!'
      await refetch()
      cancelForm()
    } else {
      const errorMsg = result.errors?.[0]?.message || 'Operation failed. Please try again.'
      error.value = errorMsg
    }
  } catch (err) {
    console.error('Form submission error:', err)
    error.value = err.message || 'An unexpected error occurred.'
  } finally {
    loading.value = false
  }
}

const deleteProgram = async (programId) => {
  if (!confirm('Are you sure you want to delete this program? This action cannot be undone.')) {
    return
  }

  try {
    deleting.value = true
    pageError.value = ''
    pageSuccess.value = ''

    const response = await deleteProgramMutation({ programId: programId })
    if (response.data.programsDeleteProgram.status === 'SUCCESS') {
      pageSuccess.value = 'Program deleted successfully!'
      clearPageMessages()
      await refetch()
    } else {
      const errorMsg = response.data.programsDeleteProgram.errors?.[0]?.message || 'Delete failed. Please try again.'
      pageError.value = errorMsg
      clearPageMessages()
    }
  } catch (err) {
    console.error('Delete error:', err)
    pageError.value = err.message || 'An unexpected error occurred during delete.'
    clearPageMessages()
  } finally {
    deleting.value = false
  }
}

const { mutate: createTrialMutation, onError: onCreateTrialError } = useMutation(CREATE_TRIAL_MUTATION)

// New state for trial creation form
const showCreateTrialForm = ref(false)
const selectedProgram = ref(null)
const trialFormData = ref({
  name: '',
  description: '',
  programId: null
})
const trialLoading = ref(false)
const trialError = ref('')
const trialSuccess = ref('')

// Create trial method
const createTrial = (program) => {

  selectedProgram.value = program
  trialFormData.value = {
    name: '',
    description: '',
    programId: program.id
  }

  showCreateTrialForm.value = true
  trialError.value = ''
  trialSuccess.value = ''
}

// Submit trial form
const submitTrialForm = async (formValues) => {
  try {
    trialLoading.value = true
    trialError.value = ''
    trialSuccess.value = ''

    const cleanFormValues = Object.fromEntries(
      Object.entries(formValues)
        .filter(([key, value]) => {
          // Preserve programId as its original type
          if (key === 'programId') return value !== null && value !== undefined;

          // For other fields, filter out empty or whitespace-only values
          return value && value.toString().trim() !== '';
        })
        .map(([key, value]) => {
          // Only apply toString().trim() to non-programId fields
          return key === 'programId'
            ? [key, value]
            : [key, value.toString().trim()]
        })
    )
    const response = await createTrialMutation({
      trial: {
        ...cleanFormValues
      }
    })

    const result = response.data.programsCreateTrial

    if (result.status === 'SUCCESS') {
      trialSuccess.value = 'Trial created successfully!'
      await refetch() // Refetch programs to update the list
      setTimeout(() => {
        showCreateTrialForm.value = false
      }, 1500)
    } else {
      const errorMsg = result.errors?.[0]?.message || 'Operation failed. Please try again.'
      trialError.value = errorMsg
    }
  } catch (err) {
    console.error('Trial creation error:', err)
    trialError.value = err.message || 'An unexpected error occurred.'
  } finally {
    trialLoading.value = false
  }
}

// Add error handler for trial mutation
onCreateTrialError((err) => {
  console.error('Create trial error:', err)
  trialError.value = err.message
})


const { mutate: updateTrialMutation, onError: onUpdateTrialError } = useMutation(UPDATE_TRIAL_MUTATION)
const { mutate: deleteTrialMutation, onError: onDeleteTrialError } = useMutation(DELETE_TRIAL_MUTATION)

// New state for trial editing
const showEditTrialForm = ref(false)
const editingTrial = ref(null)
const editTrialFormData = ref({
  name: '',
  description: '',
  trialId: null
})
const editTrialLoading = ref(false)
const editTrialError = ref('')
const editTrialSuccess = ref('')

// Edit trial method
const editTrial = (trial) => {
  editingTrial.value = trial
  editTrialFormData.value = {
    name: trial.name || '',
    description: trial.description || '',
    trialId: trial.id
  }
  showEditTrialForm.value = true
  editTrialError.value = ''
  editTrialSuccess.value = ''
}

// Submit edit trial form
const submitEditTrialForm = async (formValues) => {
  try {
    editTrialLoading.value = true
    editTrialError.value = ''
    editTrialSuccess.value = ''

    const cleanFormValues = Object.fromEntries(
      Object.entries(formValues)
        .filter(([key, value]) => {
          // Preserve trialId and programId as their original types
          if (key === 'trialId') return value !== null && value !== undefined;
          // For other fields, filter out empty or whitespace-only values
          return value && value.toString().trim() !== '';
        })
        .map(([key, value]) => {
          // Only apply toString().trim() to non-ID fields
          return key === 'trialId'
            ? [key, value]
            : [key, value.toString().trim()]
        })
    )

    const response = await updateTrialMutation({
      trial: {
        ...cleanFormValues
      }
    })

    const result = response.data.programsUpdateTrial

    if (result.status === 'SUCCESS') {
      editTrialSuccess.value = 'Trial updated successfully!'
      await refetch() // Refetch programs to update the list
      setTimeout(() => {
        showEditTrialForm.value = false
      }, 1500)
    } else {
      const errorMsg = result.errors?.[0]?.message || 'Operation failed. Please try again.'
      editTrialError.value = errorMsg
    }
  } catch (err) {
    console.error('Trial update error:', err)
    editTrialError.value = err.message || 'An unexpected error occurred.'
  } finally {
    editTrialLoading.value = false
  }
}

// Delete trial method
const deleteTrial = async (trialId) => {
  if (!confirm('Are you sure you want to delete this trial? This action cannot be undone.')) {
    return
  }

  try {
    const response = await deleteTrialMutation({
      trialId: trialId
    })

    const result = response.data.programsDeleteTrial

    if (result.status === 'SUCCESS') {
      pageSuccess.value = 'Trial deleted successfully!'
      clearPageMessages()
      await refetch()
    } else {
      const errorMsg = result.errors?.[0]?.message || 'Delete failed. Please try again.'
      pageError.value = errorMsg
      clearPageMessages()
    }
  } catch (err) {
    console.error('Delete trial error:', err)
    pageError.value = err.message || 'An unexpected error occurred during delete.'
    clearPageMessages()
  }
}

// Add error handlers for trial mutations
onUpdateTrialError((err) => {
  console.error('Update trial error:', err)
  editTrialError.value = err.message
})

onDeleteTrialError((err) => {
  console.error('Delete trial error:', err)
  pageError.value = err.message
})

// Add new state for study creation form
const showCreateStudyForm = ref(false)
const selectedTrial = ref(null)
const studyFormData = ref({
  name: '',
  description: '',
  trialId: null
})
const studyLoading = ref(false)
const studyError = ref('')
const studySuccess = ref('')

// Create study method
const createStudy = (trial) => {
  selectedTrial.value = trial
  studyFormData.value = {
    name: '',
    description: '',
    trialId: trial.id
  }

  showCreateStudyForm.value = true
  studyError.value = ''
  studySuccess.value = ''
}

// Mutation for creating study
const { mutate: createStudyMutation, onError: onCreateStudyError } = useMutation(CREATE_STUDY_MUTATION)

// Submit study form
const submitStudyForm = async (formValues) => {
  try {
    studyLoading.value = true
    studyError.value = ''
    studySuccess.value = ''

    const cleanFormValues = Object.fromEntries(
      Object.entries(formValues)
        .filter(([key, value]) => {
          // Preserve trialId as its original type
          if (key === 'trialId') return value !== null && value !== undefined;

          // For other fields, filter out empty or whitespace-only values
          return value && value.toString().trim() !== '';
        })
        .map(([key, value]) => {
          // Only apply toString().trim() to non-trialId fields
          return key === 'trialId'
            ? [key, value]
            : [key, value.toString().trim()]
        })
    )

    const response = await createStudyMutation({
      study: {
        ...cleanFormValues
      }
    })

    const result = response.data.programsCreateStudy

    if (result.status === 'SUCCESS') {
      studySuccess.value = 'Study created successfully!'
      await refetch() // Refetch programs to update the list
      setTimeout(() => {
        showCreateStudyForm.value = false
      }, 1500)
    } else {
      const errorMsg = result.errors?.[0]?.message || 'Operation failed. Please try again.'
      studyError.value = errorMsg
    }
  } catch (err) {
    console.error('Study creation error:', err)
    studyError.value = err.message || 'An unexpected error occurred.'
  } finally {
    studyLoading.value = false
  }
}

// Add error handler for study mutation
onCreateStudyError((err) => {
  console.error('Create study error:', err)
  studyError.value = err.message
})


</script>


<style scoped>
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.programs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 15px;
}

.programs-header h1 {
  margin: 0;
  color: #333;
}

.programs-content {
  margin-top: 20px;
}

.programs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  gap: 20px;
}

.program-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s ease;
}

.program-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.program-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
  gap: 15px;
}

.program-title-section {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.program-card-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25em;
}

.program-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.program-card-content p {
  margin: 8px 0;
  color: #666;
  line-height: 1.4;
}

.program-card-content strong {
  color: #333;
}

.trials-info {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  color: #555;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  font-size: 1.1em;
}

.error {
  color: #dc3545;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty-state h3 {
  margin-bottom: 10px;
  color: #333;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  padding: 0;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 10px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: #333;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  border: 1px solid #f5c6cb;
}

.success-message {
  background-color: #d4edda;
  color: #155724;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  border: 1px solid #c3e6cb;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  text-decoration: none;
  display: inline-block;
  text-align: center;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background-color: #545b62;
}

.btn-outline {
  background-color: transparent;
  color: #007bff;
  border: 1px solid #007bff;
}

.btn-outline:hover {
  background-color: #007bff;
  color: white;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover {
  background-color: #c82333;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Add to existing <style scoped> section */
.trials-header, .studies-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
  margin-top: 10px;
}

.expand-icon {
  font-size: 0.8em;
  color: #666;
}

.trials-list, .studies-list {
  margin-top: 10px;
}

.trial-card, .study-card {
  border: 1px solid #e9ecef;
  border-radius: 4px;
  margin-bottom: 10px;
  padding: 15px;
}

.trial-header, .study-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.trial-title-section,
.study-title-section {
  display: flex;
  align-items: center;
  gap: 8px;
}


.trial-actions, .study-actions {
  display: flex;
  gap: 5px;
}

.trial-content, .study-content {
  color: #666;
}
</style>