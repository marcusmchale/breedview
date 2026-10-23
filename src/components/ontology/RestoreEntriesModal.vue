<script setup>
import { computed, onMounted, ref } from 'vue'

import { useRestoreEntries } from '@/composables/ontology/restoreEntries'
import { entryLabel } from '@/composables/ontology/ontologyLifecycles'

// Restore a removed ontology entry, as a draft the next commit activates, with the removed entries it is defined by
// (ontologyRestoreEntries). The API's refusals are shown as given, e.g. while another entry has its name.
const props = defineProps({
  entry: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'restored'])

const { entriesToRestore, restoreEntries, restoreLoading } = useRestoreEntries()

const entries = ref([])
const reading = ref(true)
const errorMessage = ref('')
const restored = ref(false)

onMounted(async () => {
  try {
    entries.value = await entriesToRestore(props.entry.id)
  } catch (error) {
    console.error('Reading the entries to restore failed:', error)
    errorMessage.value = error.message || 'The entries to restore could not be read'
  } finally {
    reading.value = false
  }
})

const withIt = computed(() => entries.value.filter((entry) => String(entry.id) !== String(props.entry.id)))

const restore = async () => {
  errorMessage.value = ''
  try {
    const { status, errors } = await restoreEntries(entries.value)
    if (status === 'SUCCESS') {
      restored.value = true
      emit('restored', entries.value.map((entry) => entry.id))
    } else {
      errorMessage.value = errors?.map((e) => e.message).join(', ') || 'Restoring failed'
    }
  } catch (error) {
    console.error('Restoring failed:', error)
    errorMessage.value = error.message || 'Restoring failed'
  }
}

const close = () => {
  if (!restoreLoading.value) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="close">
      <div class="modal restore-modal" @click.stop>
        <div class="modal-header">
          <h3>Restore {{ entryLabel(entry) }}</h3>
          <button class="modal-close-btn" aria-label="Close" @click="close">&times;</button>
        </div>

        <p v-if="reading" class="text-muted">Reading the entry…</p>
        <template v-else-if="restored">
          <p class="success-message">
            Restored as {{ entries.length > 1 ? 'drafts' : 'a draft' }}: the next commit of the ontology makes
            {{ entries.length > 1 ? 'them' : 'it' }} current again.
          </p>
        </template>
        <template v-else-if="entries.length">
          <p>
            It was removed from the ontology, and data that cites it keeps it. Restored, it comes back as a draft with
            the same id, and the next commit makes it current again.
          </p>
          <div v-if="withIt.length" class="with-it">
            <p>Restored with it, as removed entries it is defined by:</p>
            <ul>
              <li v-for="other in withIt" :key="other.id">{{ entryLabel(other) }}</li>
            </ul>
          </div>
        </template>
        <p v-else-if="!errorMessage" class="text-muted">It is not removed from the ontology, so there is nothing to restore.</p>

        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

        <div class="modal-buttons">
          <button type="button" class="btn btn-secondary" :disabled="restoreLoading" @click="close">
            {{ restored ? 'Close' : 'Cancel' }}
          </button>
          <button
            v-if="!restored && entries.length"
            type="button"
            class="btn btn-primary"
            :disabled="restoreLoading"
            @click="restore"
          >
            {{ restoreLoading ? 'Restoring…' : entries.length > 1 ? `Restore ${entries.length} entries` : 'Restore' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.restore-modal {
  max-width: 520px;
  text-align: left;
}

.with-it ul {
  margin: 4px 0 0;
  padding-left: 20px;
}
</style>
