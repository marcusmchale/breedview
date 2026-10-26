<script setup>
import { computed } from 'vue'
import ControllerBadge from "@/components/controls/ControllerBadge.vue";
import { useCanCurate } from '@/composables/controls/useWriteAccess'

const props = defineProps({
  entry: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

// select-entry: a source or sink chosen, to show its card instead
defineEmits(['edit-entry', 'delete-entry', 'select-entry'])

const hasData = computed(() => !!props.entry)

// Changing or removing it needs curate access to it
const canCurate = useCanCurate({ entityLabel: 'GERMPLASM', entityId: () => props.entry?.id })

const displayFields = computed(() => {
  if (!props.entry) return []

  const entry = props.entry.data || props.entry

  return [
    { label: 'Name', value: entry.name },
    { label: 'Description', value: entry.description },
    { label: 'Reproduction', value: entry.reproduction },
    { label: 'Time', value: entry.time },
    { label: 'Origin', value: entry.origin?.name }
  ].filter(field => field.value)
})

// The unit it came from, linked to the Units page, which opens it where it is now; a placeholder, without a subject,
// when it is hidden
const unit = computed(() => (props.entry?.data || props.entry)?.unit ?? null)
const unitName = computed(() => unit.value && (unit.value.name || `${unit.value.subject?.name} ${unit.value.id}`))

const synonymsList = computed(() => {
  if (!props.entry) return []
  const entry = props.entry.data || props.entry
  return entry.synonyms || []
})

const controlMethodsList = computed(() => {
  if (!props.entry) return []
  const entry = props.entry.data || props.entry
  return entry.controlMethods || []
})

const referencesList = computed(() => {
  if (!props.entry) return []
  const entry = props.entry.data || props.entry
  return entry.references || []
})

const sourcesList = computed(() => {
  if (!props.entry) return []
  const entry = props.entry.data || props.entry
  return (entry.sources || []).map(rel => ({
    id: rel.source?.id,
    name: rel.source?.name,
    type: rel.sourceType,
    description: rel.description
  }))
})

const sinksList = computed(() => {
  if (!props.entry) return []
  const entry = props.entry.data || props.entry
  return (entry.sinks || []).map(rel => ({
    id: rel.sink?.id,
    name: rel.sink?.name,
    type: rel.sourceType,
    description: rel.description
  }))
})
</script>

<template>
  <div class="details-card" v-if="hasData">
    <div class="card-header">
      <h2>{{ entry.data?.name || entry.name }}</h2>
      <div class="card-actions">
        <button v-if="canCurate" @click="$emit('edit-entry')" class="btn btn-sm btn-outline">
          ✏️ Edit
        </button>
        <button v-if="canCurate" @click="$emit('delete-entry')" class="btn btn-sm btn-danger">
          🗑️ Delete
        </button>
        <ControllerBadge entityLabel="GERMPLASM" :entityId="entry.id" />
      </div>
    </div>

    <div class="card-content">
      <!-- Basic Fields -->
      <div class="section">
        <h3 class="section-title">Information</h3>
        <div class="fields-grid">
          <div v-for="field in displayFields" :key="field.label" class="field">
            <label class="field-label">{{ field.label }}</label>
            <p class="field-value">{{ field.value }}</p>
          </div>
          <div v-if="unit" class="field">
            <label class="field-label">Unit</label>
            <p class="field-value">
              <router-link v-if="unit.subject" :to="{ name: 'Units', query: { unit: unit.id } }">{{ unitName }}</router-link>
              <span v-else class="hidden-unit">Unit {{ unit.id }} (access restricted)</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Synonyms -->
      <div v-if="synonymsList.length > 0" class="section">
        <h3 class="section-title">Synonyms</h3>
        <div class="tag-list">
          <span v-for="synonym in synonymsList" :key="synonym" class="tag">
            {{ synonym }}
          </span>
        </div>
      </div>

      <!-- Control Methods -->
      <div v-if="controlMethodsList.length > 0" class="section">
        <h3 class="section-title">Control Methods</h3>
        <div class="list">
          <div v-for="method in controlMethodsList" :key="method.id" class="list-item">
            {{ method.name }}
          </div>
        </div>
      </div>

      <!-- References -->
      <div v-if="referencesList.length > 0" class="section">
        <h3 class="section-title">References</h3>
        <div class="list">
          <div v-for="ref in referencesList" :key="ref.id" class="list-item">
            <span v-if="ref.description" class="ref-description">{{ ref.description }}</span>
            <a v-if="ref.url" :href="ref.url" target="_blank" class="ref-link">
              {{ ref.externalId || 'View' }}
            </a>
          </div>
        </div>
      </div>

      <!-- Sources -->
      <div v-if="sourcesList.length > 0" class="section">
        <h3 class="section-title">Sources</h3>
        <div class="relationship-list">
          <div v-for="source in sourcesList" :key="source.id" class="relationship-item">
            <span class="rel-type">{{ source.type }}</span>
            <button v-if="source.id" type="button" class="rel-name rel-link" @click="$emit('select-entry', source.id)">{{ source.name }}</button>
            <span v-else class="rel-name">{{ source.name }}</span>
            <span v-if="source.description" class="rel-description">{{ source.description }}</span>
          </div>
        </div>
      </div>

      <!-- Sinks -->
      <div v-if="sinksList.length > 0" class="section">
        <h3 class="section-title">Sinks</h3>
        <div class="relationship-list">
          <div v-for="sink in sinksList" :key="sink.id" class="relationship-item">
            <span class="rel-type">{{ sink.type }}</span>
            <button v-if="sink.id" type="button" class="rel-name rel-link" @click="$emit('select-entry', sink.id)">{{ sink.name }}</button>
            <span v-else class="rel-name">{{ sink.name }}</span>
            <span v-if="sink.description" class="rel-description">{{ sink.description }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.details-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 2px solid #f0f0f0;
  background: linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%);
}

.card-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
  flex: 1;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.card-content {
  padding: 20px;
  max-height: 500px;
  overflow-y: auto;
}

.section {
  margin-bottom: 24px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.fields-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 600px) {
  .fields-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.field {
  display: flex;
  flex-direction: column;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 4px;
}

.field-value {
  margin: 0;
  color: #333;
  font-size: 0.95rem;
  line-height: 1.4;
  word-break: break-word;
}

.hidden-unit {
  color: #999;
  font-style: italic;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  display: inline-block;
  background: var(--brand-accent-light);
  color: var(--brand-accent-dark);
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 500;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item {
  padding: 8px 12px;
  background: #f9f9f9;
  border-left: 3px solid #4caf50;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #333;
}

.ref-description {
  display: block;
  margin-bottom: 4px;
  font-size: 0.9rem;
  color: #333;
}

.ref-link {
  display: inline-block;
  color: var(--brand-accent);
  text-decoration: none;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 3px;
  transition: background 0.2s;
}

.ref-link:hover {
  background: var(--brand-accent-light);
}

.relationship-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.relationship-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
  border-left: 3px solid #ff9800;
}

.rel-type {
  display: inline-block;
  background: #fff3e0;
  color: #e65100;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 0.8rem;
  font-weight: 600;
  flex-shrink: 0;
}

.rel-name {
  font-weight: 500;
  color: #333;
  flex: 1;
  min-width: 0;
}

.rel-link {
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  color: var(--brand-accent-darker);
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  text-decoration: underline;
}

.rel-description {
  font-size: 0.85rem;
  color: #999;
  flex: 0;
  display: block;
  width: 100%;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-sm {
  padding: 6px 10px;
  font-size: 0.8rem;
}

.btn-outline {
  background: white;
  color: var(--brand-accent);
  border: 1px solid var(--brand-accent);
}

.btn-outline:hover {
  background: var(--brand-accent-light);
}

.btn-danger {
  background: #dc3545;
  color: white;
  border: none;
}

.btn-danger:hover {
  background: #c82333;
}
</style>