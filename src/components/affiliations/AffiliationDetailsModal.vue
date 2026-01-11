<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal">
      <h3>{{ selectedAffiliation?.accessType }} Affiliation Details</h3>
      <div class="affiliation-details">
        <p><strong>Team:</strong> {{ teamName }}</p>
        <p><strong>Access Type:</strong> {{ selectedAffiliation?.accessType }}</p>
        <p><strong>Status:</strong>
          <span :class="getStatusClass(selectedAffiliation?.data.authorisation)">
            {{ getStatusText(selectedAffiliation?.data.authorisation) }}
          </span>
        </p>
        <p><strong>Inheritance:</strong> {{ selectedAffiliation?.data.heritable ? 'Heritable (applies to child teams)' : 'Direct only (this team only)' }}</p>
      </div>

      <div class="form-actions right">
        <button
          type="button"
          class="btn btn-danger"
          @click="$emit('remove-affiliation')"
          :disabled="removeAffiliationLoading"
        >
          {{ removeAffiliationLoading ? 'Removing...' : 'Remove Affiliation' }}
        </button>
        <button type="button" @click="$emit('close')" class="btn btn-secondary">
          Cancel
        </button>
      </div>

      <div v-if="removeAffiliationError" class="error-message">
        {{ removeAffiliationError }}
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  selectedAffiliation: {
    type: Object,
    default: null
  },
  teamName: {
    type: String,
    required: true
  },
  removeAffiliationLoading: {
    type: Boolean,
    default: false
  },
  removeAffiliationError: {
    type: String,
    default: ''
  }
})

defineEmits(['close', 'remove-affiliation'])

// Helper function to get status CSS class
const getStatusClass = (status) => {
  switch (status) {
    case 'AUTHORISED':
      return 'status-authorised'
    case 'REQUESTED':
      return 'status-pending'
    default:
      return 'status-unknown'
  }
}

// Helper function to get readable status text
const getStatusText = (status) => {
  switch (status) {
    case 'AUTHORISED':
      return 'Authorised'
    case 'REQUESTED':
      return 'Pending Approval'
    default:
      return 'Unknown'
  }
}
</script>

<style scoped>
.affiliation-details {
  margin-bottom: 1.5rem;
}

.affiliation-details p {
  margin: 0.5rem 0;
}
</style>