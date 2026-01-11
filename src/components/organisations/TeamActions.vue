
<template>
  <div class="team-actions">
    <button class="btn btn-primary" @click="$emit('request-affiliation')">
      {{ userIsAdmin ? 'Set Affiliation' : 'Request Affiliation' }}
    </button>
    
    <!-- Show Manage Affiliations button only for team admins -->
    <button
      v-if="userIsAdmin"
      class="btn btn-info"
      @click="$emit('manage-affiliations')"
    >
      Manage Affiliations
    </button>

    <!-- Separator - only show if there are admin buttons -->
    <div v-if="userIsAdmin" class="separator"></div>

    <button
      v-if="userIsAdmin"
      class="btn btn-secondary"
      @click="$emit('create-team')"
    >
      Create Team
    </button>
    
    <button
      v-if="userIsAdmin && !hasChildren"
      class="btn btn-danger"
      @click="$emit('delete-team')"
      :disabled="deleteTeamLoading"
    >
      {{ deleteTeamLoading ? 'Deleting...' : 'Delete Team' }}
    </button>
  </div>

  <div v-if="deleteTeamError" class="error-message">
    {{ deleteTeamError }}
  </div>
</template>

<script setup>
defineProps({
  userIsAdmin: {
    type: Boolean,
    required: true
  },
  hasChildren: {
    type: Boolean,
    required: true
  },
  deleteTeamLoading: {
    type: Boolean,
    default: false
  },
  deleteTeamError: {
    type: String,
    default: ''
  }
})

defineEmits(['request-affiliation', 'manage-affiliations', 'create-team', 'delete-team'])
</script>

<style scoped>
.team-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}
</style>