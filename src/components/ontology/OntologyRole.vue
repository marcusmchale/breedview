<script setup>
import { ref } from 'vue'
import {useRouter} from "vue-router";
import {useAuthStore} from "@/composables/user/useAuthStore";

import RequestOntologyRoleModal from "@/components/user/RequestOntologyRoleModal.vue";

const router = useRouter()
const { user } = useAuthStore()

const showRequestOntologyRoleModal = ref(false)

</script>

<template>
  <div class="version-actions">
      <button v-if='user' @click="showRequestOntologyRoleModal = true" class="btn btn-primary">
          Request Ontology Role
      </button>

      <button
        v-if='user && user.ontologyRole === "ADMIN"'
        title="Manage Roles"
        class="btn btn-primary"
        @click="router.push({ name: 'ontology-roles' })"
      >
        Manage Roles
      </button>

      <RequestOntologyRoleModal
        :is-open="showRequestOntologyRoleModal"
        @close="showRequestOntologyRoleModal = false"
      />

  </div>
</template>

<style scoped>

.version-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
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