<script setup>
import { computed, ref } from 'vue'

import { useAuthStore } from '@/composables/user/useAuthStore'
import { useCurrentVersionQuery } from '@/composables/ontology/currentVersion'

import OntologyEditor from '@/components/ontology/OntologyEditor.vue'
import LatestCommit from '@/components/ontology/LatestCommit.vue'
import CommitVersion from '@/components/ontology/CommitVersion.vue'

const { user } = useAuthStore()
const { version } = useCurrentVersionQuery()

const showCommitVersionForm = ref(false)

const canEdit = computed(() => ['ADMIN', 'EDITOR'].includes(user.value?.ontologyRole))
const canCreate = computed(() => ['ADMIN', 'EDITOR', 'CONTRIBUTOR'].includes(user.value?.ontologyRole))

const handleCommitSuccess = () => {
  alert('Ontology version committed!')
  showCommitVersionForm.value = false
}
</script>

<template>
  <div class="ontology-management-page">
    <h1>Ontology</h1>

    <OntologyEditor
      v-if="version"
      :versionId="version.id"
      :editor="canEdit"
      :creator="canCreate"
      :key="version.id"
    />

    <LatestCommit @commit="showCommitVersionForm = true" />

    <CommitVersion
      v-if="showCommitVersionForm"
      @success="handleCommitSuccess"
      @cancel="showCommitVersionForm = false"
    />
  </div>
</template>