<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/composables/user/useAuthStore'
import { useUserAccess } from '@/composables/user/useUserAccess'
import { useMyPersonQuery } from '@/composables/people/myPersonQuery'
import { useMyClaimsQuery } from '@/composables/people/claimsQuery'
import { useMutateClaims } from '@/composables/people/mutateClaims'
import { useMutateOrcid } from '@/composables/people/mutateOrcid'
import { personLabel, orcidUrl } from '@/composables/people/personDisplay'

import EditProfileModal from './EditProfileModal.vue'
import InviteUserModal from './InviteUserModal.vue'
import DeleteAccountModal from './DeleteAccountModal.vue'
import PersonCard from '@/components/people/PersonCard.vue'
import PersonFormModal from '@/components/people/PersonFormModal.vue'
import ErasePersonModal from '@/components/people/ErasePersonModal.vue'
import ClaimPersonModal from '@/components/people/ClaimPersonModal.vue'

const route = useRoute()
const router = useRouter()
const { user, authenticate } = useAuthStore()

const { myPerson, myPersonLoading, refetchMyPerson } = useMyPersonQuery()
const { myClaims, myClaimsLoading, refetchMyClaims } = useMyClaimsQuery()
const { withdrawClaim, withdrawClaimLoading, unlinkPerson, unlinkPersonLoading } = useMutateClaims()
const { startOrcidLink, startOrcidLinkLoading, removeOrcid, removeOrcidLoading } = useMutateOrcid()

const showEditProfileModal = ref(false)
const showInviteModal = ref(false)
const showDeleteAccountModal = ref(false)
const showEditPersonModal = ref(false)
const showErasePersonModal = ref(false)
const showClaimModal = ref(false)
const confirmUnlink = ref(false)
const personMessage = ref('')
const personError = ref('')
// Set when the server says ORCID linking is not available, which hides the button
const orcidUnavailable = ref('')

const orcidLink = computed(() => orcidUrl(myPerson.value?.orcid))

// The teams the user belongs to, with their access in each, inherited access included. The team trees, requests
// and team admin are on the Access control page.
const { readTeams, writeTeams, curateTeams, adminTeams, loading: accessLoading } = useUserAccess()
const myTeams = computed(() => {
  const teams = new Map()
  const byAccess = { read: readTeams, write: writeTeams, curate: curateTeams, admin: adminTeams }
  for (const [access, accessTeams] of Object.entries(byAccess)) {
    for (const team of accessTeams.value) {
      if (!teams.has(team.id)) teams.set(team.id, { ...team, access: [] })
      teams.get(team.id).access.push(access)
    }
  }
  const nameOf = (team) => team.fullname || team.name
  return [...teams.values()].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
})

// Outcome of the ORCID redirect, passed back by the /orcid page
watch(() => route.query.orcid, (outcome) => {
  if (!outcome) return
  if (outcome === 'linked') {
    personMessage.value = 'Your ORCID iD is now linked.'
    refetchMyPerson()
  } else {
    personError.value = route.query.message || 'ORCID linking did not complete.'
  }
  router.replace({ path: route.path })
}, { immediate: true })

const clearMessages = () => {
  personMessage.value = ''
  personError.value = ''
}

const handleProfileUpdated = async () => {
  showEditProfileModal.value = false
  await authenticate(true)
}

const handlePersonSaved = async () => {
  clearMessages()
  await refetchMyPerson()
}

const handlePersonErased = async () => {
  clearMessages()
  personMessage.value = 'Your person record has been erased.'
  await refetchMyPerson()
}

const handleUnlink = async () => {
  if (!myPerson.value) return
  clearMessages()
  const { status, errors } = await unlinkPerson(myPerson.value.id)
  confirmUnlink.value = false
  if (status === 'SUCCESS') {
    personMessage.value = 'Your account is no longer linked to a person record.'
    await refetchMyPerson()
    await refetchMyClaims()
  } else {
    personError.value = errors?.[0]?.message || 'Failed to unlink'
  }
}

const handleWithdrawClaim = async (claim) => {
  clearMessages()
  const { status, errors } = await withdrawClaim(claim.person.id)
  if (status === 'SUCCESS') {
    await refetchMyClaims()
  } else {
    personError.value = errors?.[0]?.message || 'Failed to withdraw the request'
  }
}

const handleClaimRequested = async () => {
  clearMessages()
  personMessage.value = 'Your request has been sent to the admins of the teams controlling that record.'
  await refetchMyClaims()
}

const connectOrcid = async () => {
  clearMessages()
  try {
    const { status, url, errors } = await startOrcidLink()
    if (status === 'SUCCESS' && url) {
      window.location.assign(url)
    } else {
      orcidUnavailable.value = errors?.[0]?.message || 'ORCID linking is not available.'
    }
  } catch (error) {
    console.error('Start ORCID link failed:', error)
    personError.value = error.message || 'Failed to start ORCID sign-in'
  }
}

const handleRemoveOrcid = async () => {
  clearMessages()
  const { status, errors } = await removeOrcid()
  if (status === 'SUCCESS') {
    personMessage.value = 'ORCID iD removed.'
    await refetchMyPerson()
  } else {
    personError.value = errors?.[0]?.message || 'Failed to remove the ORCID iD'
  }
}

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
</script>

<template>
  <div class="page-container profile-page">
    <h2>Your profile</h2>

    <!-- Account -->
    <section class="profile-section">
      <div class="section-header">
        <h3>Account</h3>
        <div class="section-actions">
          <button class="btn btn-secondary btn-small" @click="showEditProfileModal = true">Edit account</button>
          <button class="btn btn-secondary btn-small" @click="showInviteModal = true">Invite user</button>
        </div>
      </div>
      <dl v-if="user" class="details">
        <dt>Username</dt><dd>{{ user.name }}</dd>
        <dt>Full name</dt><dd>{{ user.fullname }}</dd>
        <dt>Email</dt><dd>{{ user.email }}</dd>
        <dt>Ontology role</dt><dd>{{ user.ontologyRole }}</dd>
      </dl>
    </section>

    <!-- Person -->
    <section class="profile-section">
      <div class="section-header">
        <h3>Your person record</h3>
      </div>
      <p class="section-intro text-muted">
        A person record credits you for research data and can list you as a contact for programs and trials.
        It is separate from your account, so you choose how you are credited.
      </p>

      <div v-if="personMessage" class="success-message">{{ personMessage }}</div>
      <div v-if="personError" class="error-message">{{ personError }}</div>

      <div v-if="myPersonLoading && !myPerson" class="loading-text">Loading...</div>

      <template v-else-if="myPerson">
        <PersonCard :person="myPerson" :editable="false" />

        <div class="person-actions">
          <button class="btn btn-secondary btn-small" @click="showEditPersonModal = true">
            Edit name and institution
          </button>

          <template v-if="orcidLink">
            <a :href="orcidLink" target="_blank" rel="noopener" class="orcid-display">
              <span class="orcid-id">iD</span> {{ orcidLink }}
            </a>
            <button class="btn btn-secondary btn-small" :disabled="removeOrcidLoading" @click="handleRemoveOrcid">
              {{ removeOrcidLoading ? 'Removing...' : 'Remove ORCID iD' }}
            </button>
          </template>
          <template v-else-if="!orcidUnavailable">
            <button class="btn btn-orcid" :disabled="startOrcidLinkLoading" @click="connectOrcid">
              <span class="orcid-id">iD</span>
              {{ startOrcidLinkLoading ? 'Opening ORCID...' : 'Connect your ORCID iD' }}
            </button>
          </template>
          <span v-else class="text-muted">{{ orcidUnavailable }}</span>
        </div>

        <div class="person-danger">
          <template v-if="!confirmUnlink">
            <button class="btn btn-secondary btn-small" @click="confirmUnlink = true">Unlink from my account</button>
          </template>
          <template v-else>
            <span>Unlink this record from your account? It stays in place and can be claimed again later.</span>
            <button class="btn btn-secondary btn-small" :disabled="unlinkPersonLoading" @click="confirmUnlink = false">Keep</button>
            <button class="btn btn-warning btn-small" :disabled="unlinkPersonLoading" @click="handleUnlink">
              {{ unlinkPersonLoading ? 'Unlinking...' : 'Unlink' }}
            </button>
          </template>
          <button class="btn btn-danger btn-small" @click="showErasePersonModal = true">Erase my person record</button>
        </div>
      </template>

      <template v-else>
        <p>Your account is not linked to a person record.</p>

        <div v-if="myClaimsLoading && myClaims.length === 0" class="loading-text">Loading requests...</div>
        <div v-else-if="myClaims.length > 0" class="claims-list">
          <h4>Pending requests</h4>
          <div v-for="claim in myClaims" :key="claim.person?.id" class="claim-item">
            <span>
              {{ personLabel(claim.person) }}
              <span class="text-muted">requested {{ formatDate(claim.requestedAt) }}</span>
            </span>
            <button class="btn btn-secondary btn-small" :disabled="withdrawClaimLoading" @click="handleWithdrawClaim(claim)">
              Withdraw
            </button>
          </div>
        </div>

        <button class="btn btn-primary" @click="showClaimModal = true">Claim a person record</button>
      </template>
    </section>

    <section class="profile-section">
      <div class="section-header">
        <h3>Teams</h3>
      </div>
      <p class="section-intro text-muted">
        Your access through the teams you belong to. Request an affiliation to a team, or manage the teams you
        administer, under <router-link :to="{ path: '/access', query: { tab: 'teams' } }">Teams in Access control</router-link>.
      </p>
      <div v-if="accessLoading && myTeams.length === 0" class="loading-text">Loading...</div>
      <ul v-else-if="myTeams.length > 0" class="team-access-list">
        <li v-for="team in myTeams" :key="team.id" class="team-access-item">
          <span>{{ team.fullname || team.name }}</span>
          <span class="text-muted">{{ team.access.join(', ') }}</span>
        </li>
      </ul>
      <p v-else class="no-teams">You are not in any team yet.</p>
    </section>

    <!-- Danger zone -->
    <section class="profile-section danger-zone">
      <div class="section-header">
        <h3>Delete account</h3>
      </div>
      <p class="section-intro text-muted">
        Deleting your account logs you out at once. Your contributions stay attributed to an anonymous id.
      </p>
      <button class="btn btn-danger" @click="showDeleteAccountModal = true">Delete my account</button>
    </section>

    <EditProfileModal
      :is-open="showEditProfileModal"
      @close="showEditProfileModal = false"
      @profile-updated="handleProfileUpdated"
    />
    <InviteUserModal :is-open="showInviteModal" @close="showInviteModal = false" />
    <DeleteAccountModal
      :is-open="showDeleteAccountModal"
      :has-person="!!myPerson"
      @close="showDeleteAccountModal = false"
    />
    <PersonFormModal
      :is-open="showEditPersonModal"
      :person="myPerson"
      limited-to-own-fields
      @close="showEditPersonModal = false"
      @saved="handlePersonSaved"
    />
    <ErasePersonModal
      :is-open="showErasePersonModal"
      :person="myPerson"
      @close="showErasePersonModal = false"
      @erased="handlePersonErased"
    />
    <ClaimPersonModal
      :is-open="showClaimModal"
      @close="showClaimModal = false"
      @requested="handleClaimRequested"
    />
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 900px;
  margin: 0 auto;
}

.profile-section {
  margin-bottom: 24px;
  padding: 16px 20px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}

.danger-zone {
  border-color: #f5c6cb;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.section-header h3 {
  margin: 0;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.section-intro {
  margin: 0 0 12px;
}

.details {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0;
}

.details dt {
  color: #666;
}

.details dd {
  margin: 0;
}

.person-actions,
.person-danger {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.person-danger {
  padding-top: 12px;
  border-top: 1px solid #e9ecef;
}

.btn-orcid {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid #a6ce39;
  border-radius: 4px;
  background: white;
  color: #333;
  cursor: pointer;
}

.btn-orcid:hover:not(:disabled) {
  background: #f3f9e6;
}

.orcid-display {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #333;
  text-decoration: none;
}

.orcid-id {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #a6ce39;
  color: white;
  font-size: 0.65rem;
  font-weight: bold;
}

.team-access-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.team-access-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 6px 12px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  margin-bottom: 6px;
}

.no-teams {
  margin: 0;
}

.claims-list {
  margin: 12px 0;
}

.claims-list h4 {
  margin: 0 0 8px;
}

.claim-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  margin-bottom: 6px;
}
</style>
