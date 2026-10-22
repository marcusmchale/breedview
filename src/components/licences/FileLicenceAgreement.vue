<!-- src/components/licences/FileLicenceAgreement.vue: the study licences a file's download needs accepted first
     (breedgraph docs/licences.md §5): those of the datasets citing it, which the user may not see, as
     FileDownloadState.licences lists them. One box to tick for them all, as for a choice of datasets
     (LicenceAgreement); once accepted, the download goes on. -->
<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { useAcceptLicences } from '@/composables/licences/mutateLicences'

// LegalText shows a licence read from a file with its own download button, which shows this agreement
const LegalText = defineAsyncComponent(() => import('@/components/references/LegalText.vue'))

const props = defineProps({
  // LegalReferences: id, description, text, textFormat, contentHash, and filename and fileId when given as a file
  licences: {
    type: Array,
    required: true
  },
  filename: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['accepted', 'close'])

const { acceptLicences, loading: accepting } = useAcceptLicences()
const agreed = ref(false)
const acceptError = ref('')
const plural = computed(() => props.licences.length > 1)

const accept = async () => {
  acceptError.value = ''
  try {
    const { status, errors } = await acceptLicences(props.licences)
    if (status === 'SUCCESS') {
      emit('accepted')
    } else {
      acceptError.value = errors?.[0]?.message || 'The licences could not be accepted'
    }
  } catch (e) {
    acceptError.value = e.message || 'The licences could not be accepted'
  }
}
</script>

<template>
  <div class="modal file-licence-agreement" @click.stop>
    <div class="modal-header">
      <h4>{{ filename || 'This file' }} holds data under {{ plural ? 'licences' : 'a licence' }}</h4>
    </div>
    <div class="modal-content">
      <p class="hint">
        Read and accept {{ plural ? 'them' : 'it' }} to download the file. Use the data, and pass it on, only as
        {{ plural ? 'they allow' : 'it allows' }}.
      </p>
      <div v-for="licence in licences" :key="licence.id" class="licence">
        <div class="licence-title">{{ licence.description || `Licence #${licence.id}` }}</div>
        <LegalText :reference="licence" />
      </div>
      <label class="agree">
        <input v-model="agreed" type="checkbox" name="fileLicencesAgreed" :disabled="accepting" />
        I have read and agree to {{ plural ? 'these licences' : 'this licence' }}
      </label>
      <div v-if="acceptError" class="error-message">{{ acceptError }}</div>
      <div class="form-actions">
        <button type="button" class="btn btn-primary accept-licences" :disabled="!agreed || accepting" @click="accept">
          {{ accepting ? 'Accepting...' : 'Accept and download' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="accepting" @click="emit('close')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-licence-agreement {
  max-width: 720px;
  text-align: left;
}

.hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: #555;
}

.licence {
  margin-bottom: 12px;
}

.licence-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.agree {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  margin: 8px 0;
}
</style>
