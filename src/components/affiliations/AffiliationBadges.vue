<template>
  <div class="affiliation-badges">
    <span
      v-if="userAffiliations.read"
      class="badge badge-clickable"
      :class="getBadgeClass('read')"
      :title="getBadgeTooltip('read')"
      @click="$emit('badge-click', 'READ', userAffiliations.read)"
    >
      R{{ userAffiliations.read.heritable ? '+' : '' }}
    </span>
    <span
      v-if="userAffiliations.write"
      class="badge badge-clickable"
      :class="getBadgeClass('write')"
      :title="getBadgeTooltip('write')"
      @click="$emit('badge-click', 'WRITE', userAffiliations.write)"
    >
      W{{ userAffiliations.write.heritable ? '+' : '' }}
    </span>
    <span
      v-if="userAffiliations.admin"
      class="badge badge-clickable"
      :class="getBadgeClass('admin')"
      :title="getBadgeTooltip('admin')"
      @click="$emit('badge-click', 'ADMIN', userAffiliations.admin)"
    >
      A{{ userAffiliations.admin.heritable ? '+' : '' }}
    </span>
    <span
      v-if="userAffiliations.curate"
      class="badge badge-clickable"
      :class="getBadgeClass('curate')"
      :title="getBadgeTooltip('curate')"
      @click="$emit('badge-click', 'CURATE', userAffiliations.curate)"
    >
      C{{ userAffiliations.curate.heritable ? '+' : '' }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  teamAffiliations: {
    type: Object,
    required: true
  },
  currentUserId: {
    type: [String, Number],
    required: true
  }
})

defineEmits(['badge-click'])

// Computed property to check user affiliations (excluding revoked ones)
const userAffiliations = computed(() => {
  const affiliations = props.teamAffiliations || {}

  const userId = props.currentUserId

  const findUserAffiliation = (affiliationList) => {
    const userAffiliation = affiliationList?.find(affiliation => affiliation.user.id == userId)
    return (!userAffiliation || userAffiliation.authorisation === 'REVOKED') ? null : userAffiliation
  }

  return {
    read: findUserAffiliation(affiliations.read),
    write: findUserAffiliation(affiliations.write),
    admin: findUserAffiliation(affiliations.admin),
    curate: findUserAffiliation(affiliations.curate)
  }
})

// Helper function to get badge CSS class based on authorisation status
const getBadgeClass = (type) => {
  const affiliation = userAffiliations.value[type]
  if (!affiliation) return ''

  const statusClass = affiliation.authorisation === 'AUTHORISED' ? 'badge-authorised' : 'badge-pending'
  return `badge-${type} ${statusClass}`
}

// Helper function to get badge tooltip text
const getBadgeTooltip = (type) => {
  const affiliation = userAffiliations.value[type]
  if (!affiliation) return ''

  const typeName = type.charAt(0).toUpperCase() + type.slice(1)
  const status = affiliation.authorisation === 'AUTHORISED' ? 'Authorised' :
                 affiliation.authorisation === 'REQUESTED' ? 'Requested' : 'Unknown'
  const heritable = affiliation.heritable ? ' (Heritable)' : ' (Direct only)'

  return `${typeName} Access - ${status}${heritable} - Click to manage`
}
</script>

<style scoped>
.affiliation-badges {
  display: flex;
  gap: 5px;
  align-items: center;
}
</style>