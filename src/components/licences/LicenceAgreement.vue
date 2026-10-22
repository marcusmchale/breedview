<!-- src/components/licences/LicenceAgreement.vue: the licences of the chosen datasets' studies still to accept before
     their data is loaded or analysed (breedgraph docs/licences.md §5), with one box to tick for them all. It tells
     its parent, through `blocked`, whether the data may be asked for: not while licences are pending or being read. -->
<script setup>
import { computed, ref, watch } from 'vue'
import { useLicenceRequirements } from '@/composables/licences/useLicenceRequirements'
import { useAcceptLicences } from '@/composables/licences/mutateLicences'
import LegalText from '@/components/references/LegalText.vue'

const props = defineProps({
  datasetIds: {
    type: Array,
    default: () => []
  }
})

const blocked = defineModel('blocked', { type: Boolean, default: false })

const { pending, known, error, refetch } = useLicenceRequirements(() => props.datasetIds)
const { acceptLicences, loading: accepting } = useAcceptLicences()

const agreed = ref(false)
const acceptError = ref('')

watch([pending, known], () => { blocked.value = !known.value || pending.value.length > 0 }, { immediate: true })
// a new choice of data asks for the box to be ticked again
watch(() => pending.value.map((item) => item.licence.id).join(), () => { agreed.value = false })

const plural = computed(() => pending.value.length > 1)

const accept = async () => {
  acceptError.value = ''
  try {
    const { status, errors } = await acceptLicences(pending.value.map((item) => item.licence))
    if (status !== 'SUCCESS') acceptError.value = errors?.[0]?.message || 'The licences could not be accepted'
  } catch (e) {
    acceptError.value = e.message || 'The licences could not be accepted'
  } finally {
    agreed.value = false
    await refetch()
  }
}
</script>

<template>
  <div v-if="pending.length" class="licence-agreement">
    <h4>{{ plural ? 'This data has licences' : 'This data has a licence' }}</h4>
    <p class="hint">
      Read and accept {{ plural ? 'them' : 'it' }} to load or analyse the data. Use the data, and pass it on, only as
      {{ plural ? 'they allow' : 'it allows' }}.
    </p>
    <div v-for="item in pending" :key="item.licence.id" class="licence">
      <div class="licence-title">{{ item.licence.description || `Licence #${item.licence.id}` }}</div>
      <LegalText :reference="item.licence" />
    </div>
    <label class="agree">
      <input v-model="agreed" type="checkbox" name="licencesAgreed" :disabled="accepting" />
      I have read and agree to {{ plural ? 'these licences' : 'this licence' }}
    </label>
    <div v-if="acceptError" class="error-message">{{ acceptError }}</div>
    <button type="button" class="btn btn-primary accept-licences" :disabled="!agreed || accepting" @click="accept">
      {{ accepting ? 'Accepting...' : 'Accept' }}
    </button>
  </div>
  <div v-else-if="error" class="error-message">The licences of this data could not be read: {{ error.message }}</div>
</template>

<style scoped>
.licence-agreement {
  border: 1px solid #f0c36d;
  background: #fffbea;
  border-radius: 6px;
  padding: 12px 16px;
  margin: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.licence-agreement h4 {
  margin: 0;
}

.hint {
  margin: 0;
  font-size: 13px;
  color: #555;
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
}

.accept-licences {
  align-self: flex-start;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #f5c6cb;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.btn-primary {
  background-color: #2196f3;
  color: white;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
