<template>
  <div v-if="isVisible" class="modal-overlay" @click="closeModal">
    <div class="modal controller-modal" @click.stop>
      <div class="modal-header">
        <h2>
          <span class="controller-icon">🔒</span>
          Controller Details
        </h2>
        <button @click="closeModal" class="modal-close">&times;</button>
      </div>

      <div class="modal-content">
        <div v-if="loading" class="loading-state">
          Loading controller information...
        </div>

        <div v-else-if="error" class="error-state">
          <strong>Error:</strong> {{ error }}
        </div>

        <div v-else-if="controller" class="controller-details">
          <div class="detail-row">
            <strong>Created:</strong>
            <span>{{ formatDate(controller.created) }}</span>
          </div>

          <div class="detail-row">
            <strong>Updated:</strong>
            <span>{{ formatDate(controller.updated) }}</span>
          </div>

          <div v-if="controller.release" class="detail-row">
            <strong>Release:</strong>
            <span
              class="release-badge clickable"
              :class="'release-' + controller.release.toLowerCase()"
              @click="showReleaseForm = true"
              title="Click to change release level"
            >
              {{ controller.release }}
            </span>
          </div>

          <!-- Release Change Form -->
          <div v-if="showReleaseForm" class="release-form">
            <h3>Change Release Level</h3>
            <div class="form-group">
              <label for="release-select">Select Release Level:</label>
              <select
                id="release-select"
                v-model="selectedRelease"
                class="release-select"
              >
                <option value="PRIVATE">Private</option>
                <option value="REGISTERED">Registered</option>
                <option value="PUBLIC">Public</option>
              </select>
            </div>

            <div v-if="releaseError" class="error-message">
              {{ releaseError }}
            </div>

            <div v-if="releaseSuccess" class="success-message">
              Release level updated successfully!
            </div>

            <div class="form-actions">
              <button
                @click="submitRelease"
                class="btn btn-primary"
                :disabled="releaseMutationLoading || !selectedRelease"
              >
                {{ releaseMutationLoading ? 'Updating...' : 'Update Release' }}
              </button>
              <button
                @click="cancelReleaseForm"
                class="btn btn-secondary"
                :disabled="releaseMutationLoading"
              >
                Cancel
              </button>
            </div>
          </div>


          <div v-if="controller.controls && controller.controls.length > 0" class="section">
            <strong>Controls:</strong>
            <ul class="list">
              <li v-for="(control, index) in controller.controls" :key="index" class="list-item">
                <div class="control-info">
                  <span class="team-name">{{ control.team?.name || 'Unknown Team' }}</span>
                  <span class="control-details">
                    <span class="release-badge" :class="'release-' + control.release?.toLowerCase()">
                      {{ control.release }}
                    </span>
                    <span class="control-time">{{ formatDate(control.time) }}</span>
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <div v-if="controller.writes && controller.writes.length > 0" class="section">
            <strong>Write History:</strong>
            <ul class="list">
              <li v-for="(write, index) in controller.writes" :key="index" class="list-item">
                <div class="write-info">
                  <span class="user-name">{{ write.user?.name || 'Unknown User' }}</span>
                  <span class="write-time">{{ formatDate(write.time) }}</span>
                </div>
              </li>
            </ul>
          </div>

          <div v-if="controller.teams && controller.teams.length > 0" class="section">
            <strong>Teams:</strong>
            <ul class="list">
              <li v-for="team in controller.teams" :key="team.id" class="list-item">
                <span class="team-name">{{ team.name }}</span>
                <span v-if="team.fullname" class="team-fullname">{{ team.fullname }}</span>
              </li>
            </ul>
          </div>

          <div v-if="!hasAnyData" class="no-data">
            No detailed controller information available
          </div>
        </div>

        <div v-else class="no-controller">
          No controller information available
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed, ref } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import SET_RELEASE_MUTATION from '../../graphql/controls/setRelease.graphql'

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  controller: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  entityLabel: {
    type: String,
    required: false
  },
  entityId: {
    type: Number,
    required: false
  }
})

const emit = defineEmits(['close', 'releaseUpdated'])

const showReleaseForm = ref(false)
const selectedRelease = ref('')
const releaseError = ref('')
const releaseSuccess = ref(false)


// Set up the mutation
const { mutate: setRelease, loading: releaseMutationLoading, onDone, onError: onMutationError } = useMutation(SET_RELEASE_MUTATION)

onDone((result) => {
  if (result?.data?.controlsSetRelease) {
    const response = result.data.controlsSetRelease

    if (response.status === 'SUCCESS') {
      releaseSuccess.value = true
      releaseError.value = ''

      // Hide the form after 2 seconds and emit success event
      setTimeout(() => {
        showReleaseForm.value = false
        releaseSuccess.value = false
        emit('releaseUpdated')
      }, 2000)
    } else if (response.errors && response.errors.length > 0) {
      releaseError.value = response.errors[0].message
      releaseSuccess.value = false
    }
  }
})

onMutationError((error) => {
  console.error('Set release error:', error)
  releaseError.value = error.message || 'Failed to update release level'
  releaseSuccess.value = false
})

const hasAnyData = computed(() => {
  if (!props.controller) return false
  return (
    (props.controller.controls && props.controller.controls.length > 0) ||
    (props.controller.writes && props.controller.writes.length > 0) ||
    (props.controller.teams && props.controller.teams.length > 0)
  )
})

const closeModal = () => {
  emit('close')
}


const cancelReleaseForm = () => {
  showReleaseForm.value = false
  selectedRelease.value = ''
  releaseError.value = ''
  releaseSuccess.value = false
}

const submitRelease = async () => {
  if (!selectedRelease.value) {
    releaseError.value = 'Please select a release level'
    return
  }

  if (!props.entityLabel || !props.entityId) {
    releaseError.value = 'Missing entity information'
    return
  }

  releaseError.value = ''
  releaseSuccess.value = false

  try {
    await setRelease({
      entityLabel: props.entityLabel,
      entityIds: [props.entityId],
      release: selectedRelease.value
    })
  } catch (err) {
    console.error('Error submitting release:', err)
    releaseError.value = err.message || 'Failed to update release level'
  }
}

const formatDate = (dateString) => {
  if (!dateString || dateString === null || dateString === undefined || dateString === '') {
    return 'N/A'
  }

  try {
    const date = new Date(dateString)

    if (isNaN(date.getTime())) {
      return 'Invalid Date'
    }

    // Use browser's locale automatically
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    })
  } catch (error) {
    console.error('Date formatting error:', error, 'for value:', dateString)
    return 'Format Error'
  }
}
</script>

<style scoped>
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
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  display: flex;
  align-items: center;
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
  border-radius: 50%;
  transition: background-color 0.2s;
}

.modal-close:hover {
  color: #333;
  background-color: #e9ecef;
}

.modal-content {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.controller-modal {
  max-width: 600px;
  width: 90%;
}

.controller-icon {
  margin-right: 8px;
  font-size: 1.2em;
}

.controller-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #eee;
}

.detail-row strong {
  color: #333;
  min-width: 100px;
}

.section {
  margin-top: 8px;
}

.section > strong {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-size: 0.95em;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item {
  padding: 10px 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border-left: 3px solid #007bff;
}

.control-info,
.write-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.control-details {
  display: flex;
  gap: 8px;
  align-items: center;
}

.team-name,
.user-name {
  font-weight: 500;
  color: #333;
}

.team-fullname {
  font-size: 0.9em;
  color: #666;
  margin-left: 8px;
}

.control-time,
.write-time {
  font-size: 0.85em;
  color: #666;
}

.release-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 500;
  text-transform: uppercase;
}


.release-badge.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.release-badge.clickable:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.release-private {
  background-color: #dc3545;
  color: white;
}

.release-registered {
  background-color: #ffc107;
  color: #333;
}

.release-public {
  background-color: #28a745;
  color: white;
}


.release-form {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin: 16px 0;
}

.release-form h3 {
  margin: 0 0 16px 0;
  color: #333;
  font-size: 1.1em;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-weight: 500;
}

.release-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 1em;
  background-color: white;
  cursor: pointer;
}

.release-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 0.95em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
}

.error-message {
  padding: 10px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  margin-bottom: 12px;
}

.success-message {
  padding: 10px;
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 4px;
  color: #155724;
  margin-bottom: 12px;
}

.loading-state,
.error-state,
.no-teams,
.no-controller,
.no-data {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 40px 20px;
}

.error-state {
  color: #dc3545;
  font-style: normal;
}

.error-state strong {
  display: block;
  margin-bottom: 8px;
}
</style>