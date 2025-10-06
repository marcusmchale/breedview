
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
        <div v-if="controller" class="controller-details">
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
            <span>{{ controller.release }}</span>
          </div>
          
          <div v-if="controller.teams && controller.teams.length > 0" class="teams-section">
            <strong>Teams:</strong>
            <ul class="teams-list">
              <li v-for="(team, index) in controller.teams" :key="team.id || index" class="team-item">
                <span class="team-name">{{ team.name || team.fullname }}</span>
                <span v-if="team.description" class="team-description">{{ team.description }}</span>
              </li>
            </ul>
          </div>

          <div v-else class="no-teams">
            No teams assigned
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
import { defineProps, defineEmits } from 'vue'

defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  controller: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const closeModal = () => {
  emit('close')
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
.controller-modal {
  max-width: 500px;
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
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.detail-row strong {
  color: #333;
  min-width: 80px;
}

.teams-section {
  margin-top: 16px;
}

.teams-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.controller-item {
  padding: 6px 12px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
  border-left: 3px solid #007bff;
  cursor: help;
}

.controller-item:hover {
  background-color: #e9ecef;
}

.no-teams,
.no-controller {
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 20px;
}
</style>