<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Request Ontology Role</h2>
        <button @click="closeModal" class="close-btn">&times;</button>
      </div>

      <div class="modal-body">
        <div v-if="error" class="error-message">
          <p>{{ error }}</p>
        </div>

        <div v-else-if="user" class="role-selection">
          <p class="current-role-label">
            <strong>Current Role:</strong> {{ formatRoleName(user.ontologyRole) || 'None' }}
          </p>

          <p class="requested-role-label" v-if="user.ontologyRoleRequested">
            <strong>Requested Role:</strong> {{ formatRoleName(user.ontologyRoleRequested) }}
          </p>

          <div class="roles-grid">
            <button
              v-for="role in ontologyRoles"
              :key="role"
              @click="selectRole(role)"
              :class="[
                'role-button',
                { current: role === user.ontologyRole },
                { requested: role === user.ontologyRoleRequested && role !== user.ontologyRole },
                { selected: role === selectedRole && role !== user.ontologyRole }
              ]"
            >
              {{ formatRoleName(role) }}
            </button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="closeModal" class="btn btn-secondary">
          Cancel
        </button>
        <button
          @click="submitRequest"
          :disabled="!selectedRole || selectedRole === user?.ontologyRoleRequested || isSubmitting"
          class="btn btn-primary"
        >
          {{ isSubmitting ? 'Submitting...' : 'Request Role' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import { useAuthStore } from '../../composables/user/useAuthStore'
import REQUEST_ONTOLOGY_ROLE from '../../graphql/account/requestOntologyRole.graphql'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'requested'])

const ontologyRoles = ['VIEWER', 'CONTRIBUTOR', 'EDITOR', 'ADMIN']
const isModalOpen = ref(false)
const selectedRole = ref(null)
const error = ref(null)
const isSubmitting = ref(false)

// Watch for changes to isOpen prop and update local state
watch(() => props.isOpen, (newValue) => {
  isModalOpen.value = newValue
  if (newValue) {
    // Reset form when modal opens
    selectedRole.value = null
    error.value = null
  }
})


const { user, authenticate } = useAuthStore()
const { mutate: requestOntologyRole } = useMutation(REQUEST_ONTOLOGY_ROLE)

const selectRole = (role) => {
  selectedRole.value = role
}

const formatRoleName = (role) => {
  if (!role) return ''
  return role.charAt(0) + role.slice(1).toLowerCase()
}

const submitRequest = async () => {
  if (!selectedRole.value || selectedRole.value === user.value?.ontologyRoleRequested) {
    return
  }

  isSubmitting.value = true
  error.value = null

  try {
    const { data } = await requestOntologyRole({
      ontologyRole: selectedRole.value
    })

    const result = data?.accountsRequestOntologyRole

    if (result?.status === 'SUCCESS') {
      emit('requested', selectedRole.value)
      await authenticate(true)
      closeModal()
    } else {
      error.value = result?.errors?.[0]?.message || 'Failed to request ontology role'
    }
  } catch (err) {
    console.error('Error requesting ontology role:', err)
    error.value = 'An error occurred while submitting your request'
  } finally {
    isSubmitting.value = false
  }
}

const closeModal = () => {
  selectedRole.value = null
  error.value = null
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 90%;
  overflow: hidden;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 1.5rem;
}

.error-message {
  text-align: center;
  padding: 1rem;
  color: #d32f2f;
  background-color: #ffebee;
  border-radius: 4px;
}

.role-selection {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.current-role-label,
.requested-role-label {
  margin: 0;
  font-size: 0.95rem;
}

.requested-role-label {
  color: #ff9800;
}

.roles-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.role-button {
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  background-color: #f5f5f5;
  color: #333;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: capitalize;
}

.role-button:hover {
  border-color: #1976d2;
  background-color: #e3f2fd;
  color: #1976d2;
}

.role-button.current {
  border-color: #4caf50;
  background-color: #e8f5e9;
  color: #2e7d32;
  font-weight: 600;
}

.role-button.requested {
  border-color: #ff9800;
  background-color: #fff3e0;
  color: #e65100;
  font-weight: 600;
}

.role-button.selected {
  border-color: #1976d2;
  background-color: #e3f2fd;
  color: #1976d2;
  font-weight: 600;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #e9ecef;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #1976d2;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1565c0;
}

.btn-secondary {
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #e0e0e0;
}

.btn-secondary:hover {
  background-color: #eeeeee;
}
</style>