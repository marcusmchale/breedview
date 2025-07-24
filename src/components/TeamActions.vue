
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
      @click="$emit('add-team')"
    >
      Add Team
    </button>
    
    <button
      v-if="userIsAdmin && !hasChildren"
      class="btn btn-danger"
      @click="$emit('remove-team')"
      :disabled="removeTeamLoading"
    >
      {{ removeTeamLoading ? 'Removing...' : 'Remove Team' }}
    </button>
  </div>

  <div v-if="removeTeamError" class="error-message">
    {{ removeTeamError }}
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
  removeTeamLoading: {
    type: Boolean,
    default: false
  },
  removeTeamError: {
    type: String,
    default: ''
  }
})

defineEmits(['request-affiliation', 'manage-affiliations', 'add-team', 'remove-team'])
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