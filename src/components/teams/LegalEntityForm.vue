<script setup>
import { computed, watch } from 'vue'
import { useDataProcessingTermsQuery } from '@/composables/teams/dataProcessingTermsQuery'

// Fields for declaring the legal entity responsible for an organisation.
// v-model: { legalName, privacyContact, accepted }. The terms version shown is reported through
// 'terms-version' so the parent sends exactly the version the user accepted.
const model = defineModel({
  type: Object,
  default: () => ({ legalName: '', privacyContact: '', accepted: false })
})

defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['terms-version'])

const { termsVersion, termsUrl, termsAvailable, termsLoading } = useDataProcessingTermsQuery()

watch(termsVersion, (version) => emit('terms-version', version), { immediate: true })

const complete = computed(() =>
  termsAvailable.value &&
  !!model.value.legalName?.trim() &&
  !!model.value.privacyContact?.trim() &&
  model.value.accepted === true
)

defineExpose({ complete, termsVersion })
</script>

<template>
  <div class="legal-entity-form">
    <div v-if="termsLoading" class="loading-text">Loading data processing terms...</div>

    <p v-else-if="!termsAvailable" class="warning-message">
      No data processing terms are configured on this server, so a legal entity cannot be declared.
    </p>

    <template v-else>
      <div class="form-group">
        <label for="legal-name">Legal name</label>
        <input
          id="legal-name"
          v-model="model.legalName"
          type="text"
          placeholder="The legal entity responsible for this team's data"
          :disabled="disabled"
        />
      </div>

      <div class="form-group">
        <label for="privacy-contact">Privacy contact</label>
        <input
          id="privacy-contact"
          v-model="model.privacyContact"
          type="email"
          placeholder="dataprotection@example.org"
          :disabled="disabled"
        />
        <p class="help-text">
          A role address for requests about personal data, not a person's own address. The legal name and this
          address are shown publicly with the person records the team tree holds, so the people credited can reach you.
        </p>
      </div>

      <div class="form-group">
        <label class="accept-terms">
          <input v-model="model.accepted" type="checkbox" :disabled="disabled" />
          <span>
            I accept the
            <a v-if="termsUrl" :href="termsUrl" target="_blank" rel="noopener">data processing terms</a>
            <template v-else>data processing terms</template>
            (version {{ termsVersion }}) on behalf of this legal entity
          </span>
        </label>
        <p class="help-text">
          The terms set out the host's role and the team's responsibilities as data controller
          for the person records it holds: informing people, handling their requests, and erasure.
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.help-text {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: #666;
}

.accept-terms {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-weight: normal;
  cursor: pointer;
}

.accept-terms input {
  margin-top: 4px;
  width: auto;
}
</style>
