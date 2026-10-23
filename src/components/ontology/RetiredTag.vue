<script setup>
import { computed, ref } from 'vue'

import { useAuthStore } from '@/composables/user/useAuthStore'
import RestoreEntriesModal from '@/components/ontology/RestoreEntriesModal.vue'

// Marks an ontology entry that data cites but the ontology has since removed: the data keeps it, as it stood when it
// was removed (breedgraph README, Ontology). Ontology editors and admins can restore it from here.
const props = defineProps({
  entry: {
    type: Object,
    default: null
  }
})

const { user } = useAuthStore()

const retired = computed(() => props.entry?.phase === 'REMOVED')
const canRestore = computed(() => ['ADMIN', 'EDITOR'].includes(user.value?.ontologyRole))
const restoring = ref(false)
</script>

<template>
  <template v-if="retired">
    <button
      v-if="canRestore"
      type="button"
      class="retired-tag"
      title="Removed from the ontology, and kept by the data that cites it: restore it"
      @click.stop="restoring = true"
    >retired</button>
    <span
      v-else
      class="retired-tag"
      title="Removed from the ontology, and kept by the data that cites it, as it stood"
    >retired</span>
  </template>
  <!-- stays open once restored, when the entry is no longer retired, to say so -->
  <RestoreEntriesModal v-if="restoring" :entry="entry" @close="restoring = false" />
</template>

<style scoped>
.retired-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  border: 1px solid #e0c36b;
  border-radius: 10px;
  background: #fff8e1;
  color: #7a5c00;
  font-size: 0.75rem;
  font-weight: normal;
  line-height: 1.5;
  vertical-align: middle;
}

button.retired-tag {
  cursor: pointer;
}

button.retired-tag:hover {
  background: #ffefc2;
}
</style>
