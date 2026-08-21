<script setup>
import { computed, ref } from 'vue'
import { useQuery } from "@vue/apollo-composable";
import { useAuthStore } from '@/composables/user/useAuthStore'
import { useCurrentVersionQuery } from '@/composables/ontology/currentVersion'

import OntologyEditor from '@/components/ontology/OntologyEditor.vue'
import LatestCommit from '@/components/ontology/LatestCommit.vue'
import CommitVersion from '@/components/ontology/CommitVersion.vue'
import OntologyRole from '@/components/ontology/OntologyRole.vue'

const { user } = useAuthStore()
const { version, refetchVersion } = useCurrentVersionQuery()


import COMMIT_HISTORY from '@/graphql/ontology/commitHistory.graphql'

const { result, refetch: refetchCommit } = useQuery(COMMIT_HISTORY, { limit: 1 })
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
    <p v-if="user"><strong>Ontology Role:</strong> {{ user.ontologyRole }}</p>
    <ontologyRole/>

    <LatestCommit :latestCommit="latestCommit" @commit="showCommitVersionForm = true" />

    <CommitVersion
      v-if="showCommitVersionForm"
      @success="handleCommitSuccess"
      @cancel="showCommitVersionForm = false"
    />

    <OntologyEditor
      v-if="version"
      :versionId="version.id"
      :editor="canEdit"
      :creator="canCreate"
      :key="version.id"
    />

  </div>
</template>