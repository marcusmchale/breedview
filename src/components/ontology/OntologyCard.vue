
<script setup>
import { computed } from 'vue'

const props = defineProps({
  entry: {
    type: Object,
    default: null
  },
  showEditButtons: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['edit-entry'])

const hasData = computed(() => !!props.entry)

const typeName = computed(() => props.entry?.__typename ?? '')

const displayFields = computed(() => {
  if (!props.entry) return []
  const e = props.entry
  return [
    { label: 'Type', value: e.__typename },
    { label: 'Phase', value: e.phase },
    { label: 'Description', value: e.description },
    { label: 'Scale Type', value: e.scaleType },
    { label: 'Observation Type', value: e.observationType },
    { label: 'Control Type', value: e.controlType },
  ].filter(f => f.value)
})

const relatedEntries = computed(() => {
  if (!props.entry) return []
  const e = props.entry
  const sections = []

  const push = (label, arr, nameKey = 'name') => {
    if (arr?.length) {
      sections.push({ label, items: arr.map(i => i[nameKey] ?? i.id) })
    }
  }

  push('Parents', e.parents)
  push('Children', e.children)
  push('Terms', e.terms)
  push('Subjects', e.subjects)
  push('Traits', e.traits)
  push('Scales', e.scales)
  push('Categories', e.categories)
  push('Observation Methods', e.observationMethods)
  push('Variables', e.variables)
  push('Control Methods', e.controlMethods)
  push('Conditions', e.conditions)
  push('Factors', e.factors)
  push('Events', e.events)
  push('Location Types', e.locationTypes)
  push('Layout Types', e.layoutTypes)
  push('Designs', e.designs)

  return sections
})

const referencesList = computed(() => {
  if (!props.entry) return []
  return props.entry.references ?? []
})
</script>

<template>
  <div class="ontology-card" v-if="hasData">
    <div class="card-header">
      <div class="card-title">
        <span class="type-badge">{{ typeName }}</span>
        <h2>{{ entry.name }}</h2>
      </div>
      <div class="card-actions">
        <button v-if="showEditButtons" @click="$emit('edit-entry')" class="btn btn-sm btn-outline">
          ✏️ Edit
        </button>
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
        </div>
      </div>

      <!-- Related entries -->
      <div
        v-for="section in relatedEntries"
        :key="section.label"
        class="section"
      >
        <h3 class="section-title">{{ section.label }}</h3>
        <div class="tag-list">
          <span v-for="name in section.items" :key="name" class="tag">
            {{ name }}
          </span>
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
    </div>
  </div>
</template>

<style scoped>
.ontology-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 2px solid #f0f0f0;
  background: linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%);
  gap: 12px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.card-title h2 {
  margin: 0;
  font-size: 1.3rem;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.type-badge {
  display: inline-block;
  background: #e8f5e9;
  color: #2e7d32;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.card-content {
  padding: 20px;
  max-height: 500px;
  overflow-y: auto;
}

.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #f0f0f0;
}

.fields-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
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
  font-size: 0.8rem;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 3px;
}

.field-value {
  margin: 0;
  color: #333;
  font-size: 0.9rem;
  line-height: 1.4;
  word-break: break-word;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  display: inline-block;
  background: #e3f2fd;
  color: #1565c0;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: 500;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.list-item {
  padding: 6px 10px;
  background: #f9f9f9;
  border-left: 3px solid #4caf50;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #333;
}

.ref-description {
  display: block;
  margin-bottom: 3px;
  font-size: 0.875rem;
  color: #333;
}

.ref-link {
  display: inline-block;
  color: #2196f3;
  text-decoration: none;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 3px;
  transition: background 0.2s;
}

.ref-link:hover {
  background: #e3f2fd;
}

.btn {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-sm {
  padding: 5px 9px;
  font-size: 0.78rem;
}

.btn-outline {
  background: white;
  color: #2196f3;
  border: 1px solid #2196f3;
}

.btn-outline:hover {
  background: #e3f2fd;
}
</style>