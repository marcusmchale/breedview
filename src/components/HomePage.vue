<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../composables/user/useAuthStore'
import InviteUserModal from './user/InviteUserModal.vue'
import RequestOntologyRoleModal from "@/components/user/RequestOntologyRoleModal.vue";
import EditProfileModal from "@/components/user/EditProfileModal.vue";

const router = useRouter()

// Get user data from auth store instead of making separate query
const { user, isLoading, error: storeError } = useAuthStore()

// Create computed properties for template usage
const loading = computed(() => isLoading.value)
const error = computed(() => storeError.value)

const showInviteModal = ref(false)
const showRequestOntologyRoleModal = ref(false)
const showEditProfileModal = ref(false)

const redirectToLogin = () => {
  router.push('/login')
}

const handleUserInvited = (email) => {
  console.log('User invited:', email)
}
const handleRequestOntologyRoleRequest = (ontologyRole) => {
  console.log('User requested ontology role:', ontologyRole)
}

</script>

<template>
  <div class="page-container">
    <div v-if="loading" class="loading">
      Loading...
    </div>

    <div v-else-if="error" class="error">
      <p>Unable to load user information</p>
      <button @click="redirectToLogin" class="btn btn-primary">
        Go to Login
      </button>
    </div>

    <div v-else-if="user" class="welcome">
      <h1>Welcome, {{ user.fullname }}!</h1>
      <div class="user-info">
        <p><strong>Username:</strong> {{ user.name }}</p>
        <p><strong>Email:</strong> {{ user.email }}</p>
        <p><strong>User ID:</strong> {{ user.id }}</p>
        <p><strong>Fullname:</strong> {{ user.fullname }}</p>
        <p><strong>Ontology Role:</strong> {{ user.ontologyRole }}</p>
      </div>

      <div class="user-actions">
        <button @click="showInviteModal = true" class="btn btn-primary">
          Invite User
        </button>
        <button @click="showRequestOntologyRoleModal = true" class="btn btn-primary">
          Request Ontology Role
        </button>
        <button @click="showEditProfileModal = true" class="btn btn-primary">
          Edit Profile
        </button>
      </div>
    </div>

    <!-- Invite User Modal -->
    <InviteUserModal
      :is-open="showInviteModal"
      @close="showInviteModal = false"
      @invited="handleUserInvited"
    />

    <!-- Request Ontology Role Modal -->
    <RequestOntologyRoleModal
      :is-open="showRequestOntologyRoleModal"
      @close="showRequestOntologyRoleModal = false"
      @requested="handleRequestOntologyRoleRequest"
    />

    <EditProfileModal
        :is-open="showEditProfileModal"
        @close="showEditProfileModal = false"
    />


  </div>
</template>

<style scoped>
.welcome {
  text-align: center;
  margin-bottom: 2rem;
}

.welcome h1 {
  margin-bottom: 1.5rem;
  color: #333;
}

.user-info {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  border: 1px solid #e9ecef;
}

.user-info p {
  margin: 0.5rem 0;
  font-size: 1rem;
}

.user-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
</style>