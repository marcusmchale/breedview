<script setup>
import { computed, ref } from 'vue'
import { useQuery } from "@vue/apollo-composable";
import { useAuthStore } from '@/composables/user/useAuthStore'
import { useCurrentVersionQuery } from '@/composables/ontology/currentVersion'

import { useOntologyQuery } from '@/composables/ontology/ontologyQuery'

import OntologyEditor from '@/components/ontology/OntologyEditor.vue'
import OntologyGraphTools from '@/components/ontology/OntologyGraphTools.vue'
import LatestCommit from '@/components/ontology/LatestCommit.vue'
import CommitVersion from '@/components/ontology/CommitVersion.vue'
import OntologyRole from '@/components/ontology/OntologyRole.vue'
import OntologyContributors from '@/components/ontology/OntologyContributors.vue'

// Signed in, the editorial view with the latest commit and roles; for visitors, the published version only
const { user, isAuthenticated } = useAuthStore()
const { version, refetchVersion } = useCurrentVersionQuery()


import COMMIT_HISTORY from '@/graphql/ontology/commitHistory.graphql'

const { result, refetch: refetchCommit } = useQuery(COMMIT_HISTORY, { limit: 1 }, () => ({ enabled: isAuthenticated.value }))

const {
  ontology: publishedOntology,
  ontologyLoading: publishedLoading,
  ontologyErrors: publishedErrors
} = useOntologyQuery({ versionId: computed(() => isAuthenticated.value ? null : version.value?.id ?? null), view: 'PUBLISHED' })

const formatVersion = (v) => v ? `${v.major}.${v.minor}.${v.patch}` : ''
const latestCommit = computed(
  () => result.value?.ontologyCommitHistory?.result?.[0] || null
)

const showCommitVersionForm = ref(false)

const canEdit = computed(() => ['ADMIN', 'EDITOR'].includes(user.value?.ontologyRole))
const canCreate = computed(() => ['ADMIN', 'EDITOR', 'CONTRIBUTOR'].includes(user.value?.ontologyRole))

const handleCommitSuccess = async () => {
  showCommitVersionForm.value = false
  await refetchCommit()
  await refetchVersion()
}

</script>

<template>
  <div class="ontology-management-page">
    <template v-if="isAuthenticated">
      <p v-if="user"><strong>Ontology Role:</strong> {{ user.ontologyRole }}</p>
      <ontologyRole/>

      <LatestCommit :latestCommit="latestCommit" @commit="showCommitVersionForm = true" />
      <OntologyContributors :key="version?.id" />

      <CommitVersion
        v-if="showCommitVersionForm"
        :latestCommit="latestCommit"
        @success="handleCommitSuccess"
        @cancel="showCommitVersionForm = false"
      />

      <OntologyEditor
        v-if="version"
        :versionId="version.id"
        :editor="canEdit"
        :creator="canCreate"
        :admin="user?.ontologyRole === 'ADMIN'"
        :key="version.id"
      />
    </template>

    <template v-else>
      <p class="published-note">
        The terms BreedGraph's data is described with, as published<template v-if="publishedOntology?.version">
        in version {{ formatVersion(publishedOntology.version) }}</template>. Click an entry to see it, or sign in to
        see the drafts, the commit history and ontology roles.
      </p>
      <OntologyContributors :version-id="version?.id ?? null" />
      <OntologyGraphTools
        v-if="publishedOntology || publishedLoading || publishedErrors?.length"
        :ontology="publishedOntology"
        :ontology-loading="publishedLoading"
        :ontology-errors="publishedErrors"
        :lifecycle-filters="false"
        :show-create-buttons="false"
        :show-edit-buttons="false"
      />
    </template>
  </div>
</template>