<!-- src/components/controls/BulkControlActions.vue: set the release of, offer or renounce a selection of what a team controls -->
<script setup>
import { ref, computed } from 'vue'

import OfferTransferModal from './OfferTransferModal.vue'
import { useBulkControlActions, RELEASE_LABELS, releasesFor } from '@/composables/controls/bulkControl'

const props = defineProps({
  // { entities: [{ label, id }] } or { scope: { teamId, label, release?, belowUnitIds? } }; null when nothing is chosen
  selection: { type: Object, default: null },
  // what the selection is, e.g. "12 datasets" or "Rep Field A and the 5,001 units below it"
  description: { type: String, default: '' },
  label: { type: String, required: true },
  // the team acting: { id, name }
  team: { type: Object, required: true }
})

const emit = defineEmits(['changed'])

const { setRelease, renounce, actionLoading } = useBulkControlActions()
// the releases the selection can be given (Persons: at most registered users)
const releases = computed(() => releasesFor([props.label]))

const release = ref('PRIVATE')
const message = ref('')
const errorMessage = ref('')
const showOffer = ref(false)

const report = ({ status, errors }, done) => {
  if (status === 'SUCCESS') {
    message.value = done
    errorMessage.value = ''
    emit('changed')
  } else {
    message.value = ''
    errorMessage.value = errors?.map((e) => e.message).join(', ') || 'The change failed'
  }
}

const clearMessages = () => {
  message.value = ''
  errorMessage.value = ''
}

const applyRelease = async () => {
  if (!props.selection) return
  if (!window.confirm(`Set the release of ${props.description} to ${RELEASE_LABELS[release.value]}?`)) return
  clearMessages()
  try {
    report(await setRelease(props.selection, release.value), `Set ${props.description} to ${RELEASE_LABELS[release.value]}`)
  } catch (error) {
    errorMessage.value = error.message
  }
}

const applyRenounce = async () => {
  if (!props.selection) return
  if (!window.confirm(`End ${props.team.name}'s control of ${props.description}? Other teams must also control each.`)) return
  clearMessages()
  try {
    report(await renounce(props.selection, [String(props.team.id)]), `${props.team.name} no longer controls ${props.description}`)
  } catch (error) {
    errorMessage.value = error.message
  }
}

const offered = (accepted) => {
  showOffer.value = false
  message.value = accepted ? `Transferred ${props.description}` : `Offered ${props.description}; the recipient's admins accept it`
  errorMessage.value = ''
  emit('changed')
}
</script>

<template>
  <div class="bulk-actions" :class="{ idle: !selection }">
    <span class="selection-description">{{ selection ? description : 'Choose what to act on' }}</span>
    <div class="action-group">
      <select v-model="release" name="bulkRelease" :disabled="!selection || actionLoading" aria-label="Release">
        <option v-for="r in releases" :key="r" :value="r">{{ RELEASE_LABELS[r] }}</option>
      </select>
      <button class="btn btn-primary btn-sm" :disabled="!selection || actionLoading" @click="applyRelease">
        Set release
      </button>
    </div>
    <button class="btn btn-secondary btn-sm" :disabled="!selection || actionLoading" @click="showOffer = true">
      Offer transfer…
    </button>
    <button class="btn btn-secondary btn-sm" :disabled="!selection || actionLoading" @click="applyRenounce"
            title="End this team's control where other teams also control them">
      Renounce
    </button>
    <span v-if="actionLoading" class="text-muted">Working…</span>
  </div>
  <div v-if="message" class="action-message">{{ message }}</div>
  <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

  <OfferTransferModal
    :is-open="showOffer"
    :entity-label="label"
    :entities="selection?.entities ?? null"
    :scope="selection?.scope ?? null"
    :description="description"
    :control-teams="[team]"
    @close="showOffer = false"
    @offered="offered"
  />
</template>

<style scoped>
.bulk-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin: 12px 0;
  background: #f1f8e9;
  border: 1px solid #c5e1a5;
  border-radius: 6px;
}

.bulk-actions.idle {
  background: #f8f9fa;
  border-color: #e9ecef;
}

.selection-description {
  flex: 1 1 220px;
  font-weight: 500;
}

.action-group {
  display: flex;
  gap: 6px;
}

.action-message {
  margin: -4px 0 12px;
  color: #2e7d32;
}

.error-message {
  margin: -4px 0 12px;
  padding: 8px 12px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
}
</style>
