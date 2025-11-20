<template>
  <div class="ontology-role-page">
    <div class="header">
      <h1>Ontology Role Management</h1>
      <button @click="goBack" class="btn-back">
        ← Back to Ontology Management
      </button>
    </div>

    <div v-if="loadingRequests" class="loading">
      Loading role requests...
    </div>
    <div v-else-if="errorRequests" class="error">
      Error: {{ errorRequests.message }}
    </div>
    <div v-else class="role-requests-container">
      <h2>Users with Outstanding Role Requests</h2>

      <div v-if="roleRequests.length === 0" class="no-data">
        <p>No users found.</p>
      </div>

      <div v-else class="users-table">
        <div class="table-header">
          <div class="col-user">User</div>
          <div class="col-email">Email</div>
          <div class="col-current">Current Role</div>
          <div class="col-requested">Requested Role</div>
          <div class="col-action">Action</div>
        </div>

        <div
          v-for="u in roleRequests"
          :key="u.id"
          class="table-row"
          :class="{ 'has-request': u.ontologyRoleRequested && u.ontologyRoleRequested !== u.ontologyRole }"
        >
          <div class="col-user">
            <div class="user-info">
              <p class="user-name">{{ u.fullname }}</p>
            </div>
          </div>

          <div class="col-email">
            {{ u.email }}
          </div>

          <div class="col-current">
            <span class="role-badge role-current">
              {{ formatRoleName(u.ontologyRole) }}
            </span>
          </div>

          <div class="col-requested">
            <span
              v-if="u.ontologyRoleRequested && u.ontologyRoleRequested !== u.ontologyRole"
              class="role-badge role-pending"
            >
              {{ formatRoleName(u.ontologyRoleRequested) }}
            </span>
            <span v-else class="role-badge role-none">—</span>
          </div>

          <div class="col-action">
            <button
              @click="openModal(u)"
              :disabled="!user || user.ontologyRole !== 'ADMIN'"
              class="btn-set-role"
              :title="user?.ontologyRole !== 'ADMIN' ? 'Only admins can set roles' : 'Set role for this user'"
            >
              Set Role
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loadingEditors" class="loading">
      Loading editors...
    </div>
    <div v-else-if="errorEditors" class="error">
      Error: {{ errorEditors.message }}
    </div>
    <div v-else class="role-requests-container">
      <h2>Editors</h2>
      <div v-if="editors.length === 0" class="no-data">
        <p>No editors found.</p>
      </div>

      <div v-else class="users-table">
        <div class="table-header">
          <div class="col-user">User</div>
          <div class="col-email">Email</div>
          <div class="col-current">Current Role</div>
          <div class="col-requested">Requested Role</div>
          <div class="col-action">Action</div>
        </div>

        <div
          v-for="u in editors"
          :key="u.id"
          class="table-row"
          :class="{ 'has-request': u.ontologyRoleRequested && u.ontologyRoleRequested !== u.ontologyRole }"
        >
          <div class="col-user">
            <div class="user-info">
              <p class="user-name">{{ u.fullname }}</p>
            </div>
          </div>

          <div class="col-email">
            {{ u.email }}
          </div>

          <div class="col-current">
            <span class="role-badge role-current">
              {{ formatRoleName(u.ontologyRole) }}
            </span>
          </div>

          <div class="col-requested">
            <span
              v-if="u.ontologyRoleRequested && u.ontologyRoleRequested !== u.ontologyRole"
              class="role-badge role-pending"
            >
              {{ formatRoleName(u.ontologyRoleRequested) }}
            </span>
            <span v-else class="role-badge role-none">—</span>
          </div>

          <div class="col-action">
            <button
              @click="openModal(u)"
              :disabled="!user || user.ontologyRole !== 'ADMIN'"
              class="btn-set-role"
              :title="user?.ontologyRole !== 'ADMIN' ? 'Only admins can set roles' : 'Set role for this user'"
            >
              Set Role
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loadingAdmins" class="loading">
      Loading admins...
    </div>
    <div v-else-if="errorAdmins" class="error">
      Error: {{ errorAdmins.message }}
    </div>
    <div v-else class="role-requests-container">
      <h2>Admins</h2>

      <div v-if="admins.length === 0" class="no-data">
        <p>No admins found.</p>
      </div>

      <div v-else class="users-table">
        <div class="table-header">
          <div class="col-user">User</div>
          <div class="col-email">Email</div>
          <div class="col-current">Current Role</div>
          <div class="col-requested">Requested Role</div>
          <div class="col-action">Action</div>
        </div>

        <div
          v-for="u in admins"
          :key="u.id"
          class="table-row"
          :class="{ 'has-request': u.ontologyRoleRequested && u.ontologyRoleRequested !== u.ontologyRole }"
        >
          <div class="col-user">
            <div class="user-info">
              <p class="user-name">{{ u.fullname }}</p>
            </div>
          </div>

          <div class="col-email">
            {{ u.email }}
          </div>

          <div class="col-current">
            <span class="role-badge role-current">
              {{ formatRoleName(u.ontologyRole) }}
            </span>
          </div>

          <div class="col-requested">
            <span
              v-if="u.ontologyRoleRequested && u.ontologyRoleRequested !== u.ontologyRole"
              class="role-badge role-pending"
            >
              {{ formatRoleName(u.ontologyRoleRequested) }}
            </span>
            <span v-else class="role-badge role-none">—</span>
          </div>

          <div v-if="user && user.id === u.id" class="col-action">
            <button
              @click="openModal(u)"
              :disabled="!user || user.ontologyRole !== 'ADMIN'"
              class="btn-set-role"
              :title="user?.ontologyRole !== 'ADMIN' ? 'Only admins can set roles' : 'Set role for this user'"
            >
              Set Role
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Set Ontology Role Modal -->
    <SetOntologyRoleModal
      :is-open="showModal"
      :user="selectedUser"
      :ontology-roles="ontologyRoles"
      :is-submitting="isSubmitting"
      :error="modalError"
      @close="closeModal"
      @set-role="handleSetRole"
    />
  </div>
</template>


<script setup>
import { ref, computed, watchEffect } from 'vue'
import { useQuery, useMutation } from '@vue/apollo-composable'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/composables/useAuthStore'
import ROLE_REQUESTS from '../graphql/ontology/roleRequests.graphql'
import EDITORS from '../graphql/ontology/editors.graphql'
import ADMINS from '../graphql/ontology/admins.graphql'
import SET_ONTOLOGY_ROLE from '../graphql/account/setOntologyRole.graphql'
import SetOntologyRoleModal from './SetOntologyRoleModal.vue'

const router = useRouter()
const { user, authenticate } = useAuthStore()

// Query for role requests
const { result: resultRequests, loading: loadingRequests, error: errorRequests, refetch: refetchRequests } = useQuery(ROLE_REQUESTS, {
  fetchPolicy: 'network-only'
})

const roleRequests = computed(() => resultRequests.value?.ontologyRoleRequests?.result || [])

// Query for editors
const { result: resultEditors, loading: loadingEditors, error: errorEditors, refetch: refetchEditors } = useQuery(EDITORS, {
  fetchPolicy: 'network-only'
})

const editors = computed(() => resultEditors.value?.ontologyEditors?.result || [])

// Query for Admins
const { result: resultAdmins, loading: loadingAdmins, error: errorAdmins, refetch: refetchAdmins } = useQuery(ADMINS, {
  fetchPolicy: 'network-only'
})

const admins = computed(() => resultAdmins.value?.ontologyAdmins?.result || [])

// Modal state
const showModal = ref(false)
const selectedUser = ref(null)
const modalError = ref(null)

// Set ontology role mutation
const { mutate: setOntologyRole, loading: isSubmitting } = useMutation(SET_ONTOLOGY_ROLE)

const goBack = () => {
  router.push({ name: 'Ontology' })
}

watchEffect(() => {
  if (user.value?.ontologyRole !== 'ADMIN') {
    goBack()
  }
})

const openModal = (user) => {
  selectedUser.value = user
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  selectedUser.value = null
  modalError.value = null
}

const handleSetRole = async (userId, newRole) => {
  try {
    const { data } = await setOntologyRole({
      userId: userId,
      ontologyRole: newRole
    })

    const result = data?.accountsSetOntologyRole

    if (result?.status === 'SUCCESS') {
      await refetchRequests()
      await refetchAdmins()
      await refetchEditors()
      if (userId === user.id) {
        await authenticate(true)
      }
      closeModal()
    } else {
      modalError.value = result?.errors?.[0]?.message || 'Failed to set role'
    }
  } catch (err) {
    modalError.value = err.message || 'An error occurred while setting the role'
  }
}

const formatRoleName = (role) => {
  if (!role) return 'None'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

const ontologyRoles = ['VIEWER', 'CONTRIBUTOR', 'EDITOR', 'ADMIN']
</script>

<style scoped>
.ontology-role-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h1 {
  margin: 0;
  font-size: 2rem;
  color: #333;
}

.btn-back {
  background-color: #2196F3;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
  font-size: 1rem;
}

.btn-back:hover {
  background-color: #0b7dda;
}

.loading,
.error,
.no-data {
  text-align: center;
  padding: 2rem;
  font-size: 1.1rem;
}

.error {
  color: #d32f2f;
  background-color: #ffebee;
  border-radius: 4px;
  border-left: 4px solid #d32f2f;
}

.no-data {
  color: #999;
}

.role-requests-container {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.role-requests-container h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #333;
}

.users-table {
  display: flex;
  flex-direction: column;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 1.5fr 1.5fr 1fr 1fr 1fr;
  gap: 1rem;
  background-color: #f5f5f5;
  padding: 1rem;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #e0e0e0;
  text-align: left;
}

.table-row {
  display: grid;
  grid-template-columns: 1.5fr 1.5fr 1fr 1fr 1fr;
  gap: 1rem;
  padding: 1.5rem 1rem;
  border-bottom: 1px solid #f0f0f0;
  align-items: center;
  transition: background-color 0.2s;
}

.table-row:hover {
  background-color: #fafafa;
}

.table-row.has-request {
  background-color: #fffbf0;
}

.col-user {
  min-width: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  margin: 0;
  font-weight: 500;
  color: #333;
}

.col-email {
  color: #666;
  word-break: break-word;
}

.col-current,
.col-requested {
  text-align: center;
}

.col-action {
  text-align: center;
}

.role-badge {
  display: inline-block;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  text-transform: capitalize;
}

.role-current {
  background-color: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #81c784;
}

.role-pending {
  background-color: #fff3e0;
  color: #e65100;
  border: 1px solid #ffb74d;
}

.role-none {
  color: #999;
}

.btn-set-role {
  padding: 0.5rem 1rem;
  background-color: #1976d2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-set-role:hover:not(:disabled) {
  background-color: #1565c0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.btn-set-role:disabled {
  background-color: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 1024px) {
  .table-header,
  .table-row {
    grid-template-columns: 1fr;
  }

  .table-header > div::before,
  .table-row > div::before {
    content: attr(data-label);
    font-weight: 600;
    display: block;
    margin-bottom: 0.5rem;
  }
}
</style>