<script setup>
import { computed, ref, watch } from 'vue'

import { cancelledWith, definingEntries, deprecatedWith, entryLabel } from '@/composables/ontology/ontologyLifecycles'

// Confirms deprecating an ontology entry, or cancelling its deprecation, with the entries that must go with it: those
// defined by it are deprecated with it, and the deprecated entries it is defined by come back with it. Deprecating,
// the entries that define it may go too. The ontology is the editorial view, with its relationships.
const props = defineProps({
  entry: {
    type: Object,
    required: true
  },
  ontology: {
    type: Object,
    required: true
  },
  // 'deprecate' or 'cancel'
  action: {
    type: String,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['confirm', 'back'])

const byId = computed(() => new Map((props.ontology.entries ?? []).map((entry) => [String(entry.id), entry])))
const entryOf = (id) => byId.value.get(String(id)) ?? { id }

const deprecating = computed(() => props.action === 'deprecate')

// the entries that define it, chosen to be deprecated with it
const chosen = ref([])
const offered = computed(() => deprecating.value
  ? definingEntries([props.entry.id, ...chosen.value], props.ontology)
  : []
)
// one no longer offered, as what offered it was let go, is let go too
watch(offered, (ids) => {
  const kept = chosen.value.filter((id) => ids.includes(id))
  if (kept.length !== chosen.value.length) chosen.value = kept
})

const required = computed(() => deprecating.value
  ? deprecatedWith([props.entry.id, ...chosen.value], props.ontology)
  : cancelledWith([props.entry.id], props.ontology)
)

const ids = computed(() => [...new Set([String(props.entry.id), ...chosen.value, ...required.value])])
const lockedAmong = computed(() => ids.value.map(entryOf).filter((entry) => entry.locked))

const confirmLabel = computed(() => {
  if (props.loading) return deprecating.value ? 'Deprecating…' : 'Cancelling…'
  const count = ids.value.length
  if (deprecating.value) return count > 1 ? `Deprecate ${count} entries` : 'Deprecate'
  return count > 1 ? `Cancel deprecation of ${count} entries` : 'Cancel deprecation'
})
</script>

<template>
  <div class="lifecycle-panel">
    <template v-if="deprecating">
      <p>
        Deprecating {{ entryLabel(entry) }}: the next commit removes it from the ontology, with its relationships.
        Data that cites it keeps it, and it can be restored.
      </p>
      <div v-if="required.length" class="entry-group">
        <p>Deprecated with it, as they are defined by it:</p>
        <ul>
          <li v-for="id in required" :key="id">{{ entryLabel(entryOf(id)) }}</li>
        </ul>
      </div>
      <div v-if="offered.length" class="entry-group">
        <p>Also deprecate what it is defined by:</p>
        <label v-for="id in offered" :key="id" class="offered-entry">
          <input v-model="chosen" type="checkbox" :value="id" :disabled="loading" />
          {{ entryLabel(entryOf(id)) }}
        </label>
      </div>
      <p v-if="lockedAmong.length" class="locked-note">
        🔒 Locked, so they can't be deprecated: {{ lockedAmong.map(entryLabel).join('; ') }}
      </p>
    </template>
    <template v-else>
      <p>Cancelling the deprecation of {{ entryLabel(entry) }} keeps it in the next version.</p>
      <div v-if="required.length" class="entry-group">
        <p>Cancelled with it, as deprecated entries it is defined by:</p>
        <ul>
          <li v-for="id in required" :key="id">{{ entryLabel(entryOf(id)) }}</li>
        </ul>
      </div>
    </template>

    <div class="panel-actions">
      <button type="button" class="btn btn-secondary" :disabled="loading" @click="emit('back')">Back</button>
      <button
        type="button"
        :class="['btn', deprecating ? 'btn-danger' : 'btn-primary']"
        :disabled="loading"
        @click="emit('confirm', ids)"
      >
        {{ confirmLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.lifecycle-panel {
  margin-top: 1rem;
  padding: 12px 16px;
  border: 1px solid #f0c36d;
  border-radius: 6px;
  background: #fffaf0;
}

.lifecycle-panel p {
  margin: 0 0 8px;
}

.entry-group {
  margin-bottom: 8px;
}

.entry-group ul {
  margin: 0;
  padding-left: 20px;
}

.offered-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: normal;
}

.offered-entry input {
  width: auto;
}

.locked-note {
  color: #7a5c00;
}

.panel-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}
</style>
