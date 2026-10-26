<script setup>
import { ref } from 'vue'
import PersonPicker from './PersonPicker.vue'

// Contacts for a Program or Trial: Persons linked to an account, released at least as widely as the
// entity and at least to registered users. The picker offers linked Persons; the server checks release.
const model = defineModel({
  type: Array,
  default: () => []
})

const expanded = ref(false)
</script>

<template>
  <div class="contacts-field">
    <label class="section-label">Contacts</label>
    <div class="section-content">
      <span v-if="model.length > 0" class="selected-summary">{{ model.length }} contact(s) selected</span>
      <button type="button" class="btn btn-sm btn-link" @click="expanded = !expanded">
        {{ expanded ? 'Done' : (model.length > 0 ? 'Manage' : '+ Add Contacts') }}
      </button>
    </div>
    <div v-if="expanded" class="picker-wrapper">
      <p class="help-text">
        People others can message about this through BreedGraph. Each must be linked to an account and have a
        release level at least that of this record, and at least registered.
      </p>
      <PersonPicker
        v-model="model"
        linked-only
        empty-text="No person records linked to an account are readable by you."
      />
    </div>
  </div>
</template>

<style scoped>
.contacts-field {
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.section-label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.section-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.selected-summary {
  color: #333;
}

.btn-link {
  background: none;
  border: none;
  color: var(--brand-primary);
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
}

.btn-link:hover {
  text-decoration: underline;
}

.picker-wrapper {
  margin-top: 8px;
}

.help-text {
  margin: 0 0 8px;
  font-size: 0.85rem;
  color: #666;
}
</style>
